'use strict';
const { db } = require('./db');
const { CURRENCIES, DEBT_TYPES, INVESTMENT_TYPES } = require('./countries');

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// ---------- exchange rates ----------
function effectiveRates(userId) {
  const rates = {};
  for (const [code, c] of Object.entries(CURRENCIES)) rates[code] = { rate: c.rate, source: 'default' };
  for (const row of db.prepare('SELECT currency, rate, updated_at FROM fx_rates').all()) {
    if (rates[row.currency]) rates[row.currency] = { rate: row.rate, source: 'live', updated_at: row.updated_at };
  }
  if (userId) {
    for (const row of db.prepare('SELECT currency, rate FROM user_rates WHERE user_id = ?').all(userId)) {
      if (rates[row.currency]) rates[row.currency] = { rate: row.rate, source: 'custom' };
    }
  }
  return rates;
}

function converter(rates, home) {
  return (amount, from) => {
    if (!amount) return 0;
    if (from === home) return amount;
    const f = rates[from] && rates[from].rate;
    const h = rates[home] && rates[home].rate;
    if (!f || !h) return amount;
    return (amount / f) * h;
  };
}

// ---------- debt maths ----------
function project(balance, aprPct, payment) {
  if (!(balance > 0) || !(payment > 0)) return null;
  const monthlyRate = (aprPct || 0) / 1200;
  let bal = balance, interest = 0, months = 0;
  while (bal > 0.005 && months < 1200) {
    const i = bal * monthlyRate;
    if (payment <= i + 1e-9 && monthlyRate > 0) return { never: true };
    interest += i;
    bal = bal + i - payment;
    months++;
  }
  if (bal > 0.005) return { never: true };
  return { months, interest: r2(interest) };
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ---------- loading + enrichment ----------
function loadAll(userId, user) {
  const rates = effectiveRates(userId);
  const conv = converter(rates, user.currency);
  const t = today();

  const debts = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY balance > 0 DESC, id DESC').all(userId).map((d) => {
    const proj = project(d.balance, d.interest_rate, d.min_payment);
    return {
      ...d,
      portal: (DEBT_TYPES[d.type] || DEBT_TYPES.other).portal,
      status: d.balance > 0 ? 'active' : 'paid',
      balance_home: r2(conv(d.balance, d.currency)),
      original_home: r2(conv(d.original_amount, d.currency)),
      min_payment_home: r2(conv(d.min_payment, d.currency)),
      credit_limit_home: d.credit_limit == null ? null : r2(conv(d.credit_limit, d.currency)),
      monthly_interest_home: r2(conv((d.balance * d.interest_rate) / 1200, d.currency)),
      projection: proj,
      projected_interest_home: proj && !proj.never ? r2(conv(proj.interest, d.currency)) : 0,
      overdue: d.balance > 0 && !!d.due_date && d.due_date < t,
    };
  });

  const receivables = db.prepare('SELECT * FROM receivables WHERE user_id = ? ORDER BY balance > 0 DESC, id DESC').all(userId).map((r) => ({
    ...r,
    status: r.balance > 0 ? 'open' : 'settled',
    balance_home: r2(conv(r.balance, r.currency)),
    original_home: r2(conv(r.original_amount, r.currency)),
    overdue: r.balance > 0 && !!r.due_date && r.due_date < t,
  }));

  const investments = db.prepare('SELECT * FROM investments WHERE user_id = ? ORDER BY current_value DESC, id DESC').all(userId).map((i) => {
    const gain = i.current_value - i.amount_invested;
    return {
      ...i,
      value_home: r2(conv(i.current_value, i.currency)),
      cost_home: r2(conv(i.amount_invested, i.currency)),
      gain,
      gain_home: r2(conv(gain, i.currency)),
      roi: i.amount_invested > 0 ? r2((gain / i.amount_invested) * 100) : null,
      income_home: r2(conv(i.annual_income, i.currency)),
      yield_pct: i.current_value > 0 && i.annual_income > 0 ? r2((i.annual_income / i.current_value) * 100) : null,
    };
  });

  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC').all(userId).map((g) => {
    const remaining = Math.max(0, g.target_amount - g.saved_amount);
    let monthsLeft = null, perMonth = null;
    if (g.target_date) {
      const ms = new Date(g.target_date) - new Date(t);
      monthsLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.4375)));
      perMonth = remaining > 0 ? r2(remaining / Math.max(1, monthsLeft)) : 0;
    }
    return {
      ...g,
      remaining: r2(remaining),
      progress: g.target_amount > 0 ? Math.min(100, r2((g.saved_amount / g.target_amount) * 100)) : 0,
      achieved: g.saved_amount >= g.target_amount && g.target_amount > 0,
      months_left: monthsLeft,
      per_month: perMonth,
      saved_home: r2(conv(g.saved_amount, g.currency)),
      target_home: r2(conv(g.target_amount, g.currency)),
      remaining_home: r2(conv(remaining, g.currency)),
      per_month_home: perMonth == null ? null : r2(conv(perMonth, g.currency)),
    };
  });

  return { rates, conv, debts, receivables, investments, goals };
}

// ---------- summary ----------
function summarise(data, user) {
  const { debts, receivables, investments, goals } = data;
  const t = today();
  const active = debts.filter((d) => d.balance > 0);
  const sum = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));

  const debtTotal = sum(active, (d) => d.balance_home);
  const monthlyMin = sum(active, (d) => d.min_payment_home);
  const monthlyInterest = sum(active, (d) => d.monthly_interest_home);
  const projectedInterest = sum(active, (d) => d.projected_interest_home);
  const stuck = active.filter((d) => d.projection && d.projection.never).length;
  const noPlan = active.filter((d) => !d.projection).length;

  let debtFreeDate = null;
  if (active.length && active.every((d) => d.projection && !d.projection.never)) {
    const maxMonths = Math.max(...active.map((d) => d.projection.months));
    debtFreeDate = addMonths(t, maxMonths);
  }

  const invValue = sum(investments, (i) => i.value_home);
  const invCost = sum(investments, (i) => i.cost_home);
  const invIncome = sum(investments, (i) => i.income_home);
  const receivableTotal = sum(receivables.filter((r) => r.balance > 0), (r) => r.balance_home);
  const savingsTotal = sum(goals, (g) => g.saved_home);
  const assets = r2(invValue + receivableTotal + savingsTotal);
  const netWorth = r2(assets - debtTotal);

  const cards = active.filter((d) => d.type === 'credit_card' && d.credit_limit_home);
  const cardBal = sum(cards, (d) => d.balance_home);
  const cardLimit = sum(cards, (d) => d.credit_limit_home);

  const byType = {};
  for (const d of active) byType[d.type] = r2((byType[d.type] || 0) + d.balance_home);
  const debtByType = Object.entries(byType)
    .map(([key, value]) => ({ key, label: DEBT_TYPES[key].label, value }))
    .sort((a, b) => b.value - a.value);

  const invByType = {};
  for (const i of investments) invByType[i.type] = r2((invByType[i.type] || 0) + i.value_home);
  const allocation = Object.entries(invByType)
    .map(([key, value]) => ({ key, label: INVESTMENT_TYPES[key] || key, value }))
    .sort((a, b) => b.value - a.value);

  const upcoming = [];
  const inDays = (d) => Math.round((new Date(d) - new Date(t)) / 86400000);
  for (const d of active) if (d.due_date && inDays(d.due_date) <= 30) upcoming.push({ kind: 'debt', id: d.id, name: d.name, date: d.due_date, days: inDays(d.due_date), amount: d.min_payment || d.balance, currency: d.currency });
  for (const r of receivables) if (r.balance > 0 && r.due_date && inDays(r.due_date) <= 30) upcoming.push({ kind: 'receivable', id: r.id, name: r.name, date: r.due_date, days: inDays(r.due_date), amount: r.balance, currency: r.currency });
  for (const g of goals) if (!g.achieved && g.target_date && inDays(g.target_date) <= 30) upcoming.push({ kind: 'goal', id: g.id, name: g.name, date: g.target_date, days: inDays(g.target_date), amount: g.remaining, currency: g.currency });
  upcoming.sort((a, b) => a.days - b.days);

  const plannedSpend = sum(goals.filter((g) => g.kind === 'spending' && !g.achieved), (g) => g.remaining_home);
  const monthlyNeeded = sum(goals.filter((g) => !g.achieved && g.per_month_home), (g) => g.per_month_home);

  return {
    currency: user.currency,
    net_worth: netWorth,
    assets: { total: assets, investments: invValue, receivables: receivableTotal, savings: savingsTotal },
    debts: {
      total: debtTotal, count: active.length, paid_count: debts.length - active.length,
      monthly_min: monthlyMin, monthly_interest: monthlyInterest, annual_interest: r2(monthlyInterest * 12),
      projected_interest: projectedInterest, total_cost: r2(debtTotal + projectedInterest),
      stuck, no_plan: noPlan, debt_free_date: debtFreeDate,
      by_type: debtByType,
    },
    investments: {
      count: investments.length, value: invValue, cost: invCost, gain: r2(invValue - invCost),
      roi: invCost > 0 ? r2(((invValue - invCost) / invCost) * 100) : null, annual_income: invIncome,
      allocation,
    },
    receivables: { total: receivableTotal, count: receivables.filter((r) => r.balance > 0).length, overdue: receivables.filter((r) => r.overdue).length },
    goals: { count: goals.length, saved: savingsTotal, planned_spend: plannedSpend, monthly_needed: monthlyNeeded, achieved: goals.filter((g) => g.achieved).length },
    debt_to_asset: assets > 0 ? r2((debtTotal / assets) * 100) : null,
    card_utilisation: cardLimit > 0 ? r2((cardBal / cardLimit) * 100) : null,
    upcoming,
  };
}

// ---------- snapshots (net-worth history) ----------
function recordSnapshot(userId) {
  const user = db.prepare('SELECT id, currency FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const s = summarise(loadAll(userId, user), user);
  db.prepare(`INSERT INTO snapshots (user_id, day, assets, debts, net_worth) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, day) DO UPDATE SET assets = excluded.assets, debts = excluded.debts, net_worth = excluded.net_worth`)
    .run(userId, today(), s.assets.total, s.debts.total, s.net_worth);
}

module.exports = { r2, today, effectiveRates, converter, project, loadAll, summarise, recordSnapshot };
