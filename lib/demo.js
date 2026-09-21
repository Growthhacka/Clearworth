'use strict';
const { db } = require('./db');
const { effectiveRates, converter, recordSnapshot, today } = require('./finance');

// Sample portfolio, written in USD and converted into the user's home currency so it feels local.
function seedDemo(user) {
  const rates = effectiveRates(user.id);
  const conv = converter(rates, user.currency);
  const nice = (usd) => {
    const v = conv(usd, 'USD');
    if (v <= 0) return 0;
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2));
    return Math.round(v / mag) * mag;
  };
  const cur = user.currency;
  const day = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
  const uid = user.id;

  db.exec('BEGIN');
  try {
    const debt = db.prepare(`INSERT INTO debts (user_id, name, type, counterparty, for_whom, currency, original_amount, balance, interest_rate, min_payment, credit_limit, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    debt.run(uid, 'Everyday credit card', 'credit_card', 'Main Street Bank', '', cur, nice(4200), nice(3200), 24.9, nice(95), nice(8000), day(9), 'Aim to clear before the promo rate ends');
    debt.run(uid, 'Car loan', 'loan', 'City Auto Finance', '', cur, nice(14000), nice(9500), 11.5, nice(310), null, day(17), '');
    debt.run(uid, 'Tuition, Year 2', 'tuition', 'Greenfield University', 'My daughter', cur, nice(6000), nice(4800), 0, nice(800), null, day(24), 'Paid termly');
    debt.run(uid, 'Borrowed from Uncle Tunde', 'person', 'Uncle Tunde', '', cur, nice(900), nice(600), 0, nice(100), null, day(-5), 'Promised to clear by month end');

    const rec = db.prepare(`INSERT INTO receivables (user_id, name, reason, contact, currency, original_amount, balance, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    rec.run(uid, 'Brother, Emeka', 'Emergency loan', '', cur, nice(1500), nice(1200), day(20), '');
    rec.run(uid, 'Client invoice: Acme Ltd', 'Consulting work', 'accounts@acme.example', cur, nice(2500), nice(2500), day(-3), 'Chase this week');

    const inv = db.prepare(`INSERT INTO investments (user_id, name, type, currency, amount_invested, current_value, acquired_date, location, annual_income, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const invIds = [];
    const addInv = (...a) => invIds.push(Number(inv.run(uid, ...a).lastInsertRowid));
    addInv('Plot of land, 600sqm', 'land', cur, nice(12000), nice(16500), day(-900), 'Prime residential area', 0, 'Title documents in safe');
    addInv('2-bed apartment (rental)', 'real_estate', cur, nice(45000), nice(52000), day(-1300), 'City centre', nice(4800), 'Let on a 12-month lease');
    addInv('Cassava and maize farm', 'agriculture', cur, nice(6000), nice(7400), day(-500), 'Outskirts, 3 hectares', nice(900), 'Harvest twice a year');
    addInv('Index fund portfolio', 'funds', cur, nice(5000), nice(5900), day(-700), '', nice(180), '');
    addInv('Crypto holdings', 'crypto', cur, nice(1500), nice(1900), day(-300), '', 0, '');

    // valuation history for the land + apartment, so trends show up straight away
    const val = db.prepare('INSERT INTO valuations (user_id, investment_id, value, day) VALUES (?, ?, ?, ?)');
    const trend = (id, start, end, months) => {
      for (let m = months; m >= 0; m--) val.run(uid, id, nice(start + ((end - start) * (months - m)) / months), day(-m * 30));
    };
    trend(invIds[0], 12000, 16500, 6);
    trend(invIds[1], 45000, 52000, 6);

    const goal = db.prepare(`INSERT INTO goals (user_id, name, kind, currency, target_amount, saved_amount, target_date, priority, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    goal.run(uid, 'Emergency fund (6 months)', 'emergency', cur, nice(6000), nice(1800), day(270), 'high', '');
    goal.run(uid, 'Family holiday', 'spending', cur, nice(3500), nice(900), day(200), 'medium', 'Flights and accommodation');
    goal.run(uid, 'New laptop', 'spending', cur, nice(1400), nice(1100), day(60), 'low', '');
    goal.run(uid, 'House deposit', 'savings', cur, nice(20000), nice(3500), day(730), 'high', '');

    // six months of net-worth history so the chart is not empty
    const snap = db.prepare(`INSERT OR REPLACE INTO snapshots (user_id, day, assets, debts, net_worth) VALUES (?, ?, ?, ?, ?)`);
    for (let m = 6; m >= 1; m--) {
      const assets = nice(80000 + (6 - m) * 2600 + (m % 2) * 700);
      const debts = nice(24500 - (6 - m) * 1150);
      snap.run(uid, day(-m * 30), assets, debts, assets - debts);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  recordSnapshot(uid);
}

module.exports = { seedDemo };
