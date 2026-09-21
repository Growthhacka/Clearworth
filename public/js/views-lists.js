/* Portals: debts (cards & loans, tuition, people), owed to me, investments, goals. */
(function () {
  'use strict';
  const CW = window.CW;
  const { html, raw, icon, fmt, fmtHome, pct } = CW;
  const C = window.Charts;
  const S = CW.S;

  const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
  const chips = (key, options) => html`${options.map(([v, l]) => html`<button class="chip" aria-pressed="${String(S.f[key] === v)}" data-act="filter" data-key="${key}" data-value="${v}">${l}</button>`)}`;
  const iconBtns = (res, id) => html`<span class="icons"><button class="btn sm icon ghost" data-act="edit" data-res="${res}" data-id="${id}" aria-label="Edit" title="Edit">${icon('edit')}</button><button class="btn sm icon ghost" data-act="history" data-res="${res}" data-id="${id}" aria-label="History" title="History">${icon('history')}</button><button class="btn sm icon ghost" data-act="del" data-res="${res}" data-id="${id}" aria-label="Delete" title="Delete">${icon('trash')}</button></span>`;
  const homeNote = (amount_home, cur) => (cur !== CW.home() ? html`<small>≈ ${fmtHome(amount_home)}</small>` : '');

  // ================= Debts =================
  const PORTALS = {
    cards: {
      title: 'Cards & loans', desc: 'Credit cards, personal loans, car loans and mortgages. Track balances, interest and payments in one place.',
      add: 'Add card or loan', chips: [['all', 'All'], ['credit_card', 'Credit cards'], ['loan', 'Loans'], ['mortgage', 'Mortgages']],
      empty: ['card', 'No cards or loans yet', 'Add a credit card, personal loan, car loan or mortgage to see what it really costs you and when you will be free of it.'],
    },
    tuition: {
      title: 'Tuition & school fees', desc: 'School, college and university fees you still owe, for yourself or your children. Add each term or instalment.',
      add: 'Add fees', empty: ['school', 'No school fees tracked', 'Add tuition or school fees you owe, then record each payment as you make it.'],
    },
    people: {
      title: 'People & other debts', desc: 'Money you owe family, friends, landlords, suppliers or anyone else, including informal loans.',
      add: 'Add a debt', empty: ['people', 'You do not owe anyone', 'If you borrow from family, friends or a supplier, add it here so nothing is forgotten.'],
    },
  };

  function debtCard(d) {
    const paid = d.balance <= 0;
    const paidPct = d.original_amount > 0 ? Math.max(0, Math.min(100, ((d.original_amount - d.balance) / d.original_amount) * 100)) : 0;
    let payoff;
    if (paid) payoff = 'Paid off';
    else if (!d.projection) payoff = 'Set a payment';
    else if (d.projection.never) payoff = 'Payment too low';
    else payoff = `${CW.fmtDate(addMonths(d.projection.months))}`;
    const util = d.type === 'credit_card' && d.credit_limit ? (d.balance / d.credit_limit) * 100 : null;
    const sub = [d.counterparty, d.for_whom, CW.meta.debt_types[d.type].label].filter(Boolean).join(' · ');
    return html`<article class="item ${paid ? 'paid' : ''}">
      <div class="item-top"><span class="item-icon">${icon(CW.TYPE_ICON[d.type])}</span><div class="grow"><div class="item-title">${d.name}</div><div class="item-sub">${sub}</div></div>${paid ? html`<span class="badge good">${icon('check')} Paid</span>` : CW.dueBadge(d.due_date)}</div>
      <div class="item-amount num">${fmt(d.balance, d.currency)}${homeNote(d.balance_home, d.currency)}</div>
      ${d.original_amount > 0 ? html`<div><div class="meter-label"><span>Paid off ${pct(paidPct, 0)}</span><span>of ${fmt(d.original_amount, d.currency)}</span></div><div class="meter"><i style="width:${paidPct}%"></i></div></div>` : ''}
      <div class="kv"><div><span>Interest</span><b>${d.interest_rate ? pct(d.interest_rate) + ' APR' : 'None'}</b></div><div><span>Monthly</span><b class="num">${d.min_payment ? fmt(d.min_payment, d.currency) : 'Not set'}</b></div><div><span>${d.projection && !d.projection.never ? 'Debt-free' : 'Payoff'}</span><b>${payoff}</b></div>${util != null ? html`<div><span>Card use</span><b class="${util >= 70 ? 'delta bad' : util >= 30 ? '' : 'delta good'}">${pct(util, 0)} used</b></div>` : ''}${d.projection && !d.projection.never && d.projection.interest > 0 ? html`<div><span>Interest to come</span><b class="num">${fmt(d.projection.interest, d.currency)}</b></div>` : ''}</div>
      <div class="actions"><button class="btn sm" data-act="adjust" data-res="debts" data-id="${d.id}" data-mode="minus">${icon('minus')} Payment</button><button class="btn sm" data-act="adjust" data-res="debts" data-id="${d.id}" data-mode="plus">${icon('plus')} Add</button><span class="grow"></span>${iconBtns('debts', d.id)}</div>
    </article>`;
  }

  function debtPortal(portal) {
    const P = PORTALS[portal];
    const all = CW.debtsIn(portal);
    const addBtn = html`<button class="btn primary" data-act="add" data-res="debts" data-portal="${portal}">${icon('plus')} ${P.add}</button>`;
    if (!all.length) return html`${CW.pageHead(P.title, P.desc)}${CW.emptyState({ iconName: P.empty[0], title: P.empty[1], text: P.empty[2], actions: addBtn })}`;

    const active = all.filter((d) => d.balance > 0);
    const total = active.reduce((a, d) => a + d.balance_home, 0);
    const monthly = active.reduce((a, d) => a + d.min_payment_home, 0);
    const interest = active.reduce((a, d) => a + d.monthly_interest_home, 0);
    const paidOff = all.reduce((a, d) => a + Math.max(0, d.original_home - d.balance_home), 0);
    let list = all.filter((d) => (S.f.debts_status === 'all' ? true : S.f.debts_status === 'paid' ? d.balance <= 0 : d.balance > 0));
    if (portal === 'cards' && S.f.debts_type !== 'all') list = list.filter((d) => d.type === S.f.debts_type);
    list = list.slice().sort((a, b) => (b.balance > 0) - (a.balance > 0) || b.balance_home - a.balance_home);

    return html`${CW.pageHead(P.title, P.desc, addBtn)}
    <div class="grid g4 tiles-sm" style="margin-bottom:18px">
      ${CW.tile({ label: portal === 'tuition' ? 'Fees outstanding' : 'Total owing', value: fmtHome(total), foot: `${active.length} active`, dot: 'var(--s2)' })}
      ${CW.tile({ label: 'Paid each month', value: fmtHome(monthly), foot: 'Your set monthly payments', dot: 'var(--s1)' })}
      ${CW.tile({ label: 'Interest each month', value: fmtHome(interest), foot: interest ? `${fmtHome(interest * 12)} a year` : 'No interest charged', dot: 'var(--s4)' })}
      ${CW.tile({ label: 'Paid off so far', value: fmtHome(paidOff), foot: 'Against original amounts', dot: 'var(--s3)' })}
    </div>
    <div class="filters">${chips('debts_status', [['active', 'Active'], ['paid', 'Paid off'], ['all', 'All']])}${portal === 'cards' ? html`<span style="width:10px"></span>${chips('debts_type', P.chips)}` : ''}</div>
    ${list.length ? html`<div class="items">${list.map(debtCard)}</div>` : html`<p class="muted">Nothing matches this filter.</p>`}`;
  }
  ['cards', 'tuition', 'people'].forEach((p) => { CW.views[p] = () => debtPortal(p); });

  // ================= Owed to me =================
  function recCard(r) {
    const settled = r.balance <= 0;
    const paidPct = r.original_amount > 0 ? Math.max(0, Math.min(100, ((r.original_amount - r.balance) / r.original_amount) * 100)) : 0;
    return html`<article class="item ${settled ? 'paid' : ''}">
      <div class="item-top"><span class="item-icon">${icon('user')}</span><div class="grow"><div class="item-title">${r.name}</div><div class="item-sub">${[r.reason, r.contact].filter(Boolean).join(' · ') || 'Owes you money'}</div></div>${settled ? html`<span class="badge good">${icon('check')} Settled</span>` : CW.dueBadge(r.due_date)}</div>
      <div class="item-amount num">${fmt(r.balance, r.currency)}${homeNote(r.balance_home, r.currency)}</div>
      ${r.original_amount > 0 ? html`<div><div class="meter-label"><span>Repaid ${pct(paidPct, 0)}</span><span>of ${fmt(r.original_amount, r.currency)}</span></div><div class="meter"><i style="width:${paidPct}%"></i></div></div>` : ''}
      <div class="actions"><button class="btn sm" data-act="adjust" data-res="receivables" data-id="${r.id}" data-mode="minus">${icon('minus')} Repaid</button><button class="btn sm" data-act="adjust" data-res="receivables" data-id="${r.id}" data-mode="plus">${icon('plus')} Lend more</button>${!settled ? html`<button class="btn sm" data-act="remind" data-id="${r.id}">${icon('copy')} Remind</button>` : ''}<span class="grow"></span>${iconBtns('receivables', r.id)}</div>
    </article>`;
  }

  CW.views.owed = () => {
    const all = S.data.receivables;
    const addBtn = html`<button class="btn primary" data-act="add" data-res="receivables">${icon('plus')} Add money owed to me</button>`;
    const head = CW.pageHead('Owed to me', 'Money that friends, family, clients or anyone else owes you. It counts towards your net worth until it is repaid.', addBtn);
    if (!all.length) return html`${head}${CW.emptyState({ iconName: 'inbox', title: 'Nobody owes you money', text: 'Lent money to someone or have an unpaid invoice? Add it here, record repayments as they arrive and send polite reminders.', actions: addBtn })}`;
    const open = all.filter((r) => r.balance > 0);
    const total = open.reduce((a, r) => a + r.balance_home, 0);
    const overdue = open.filter((r) => r.overdue);
    const overdueSum = overdue.reduce((a, r) => a + r.balance_home, 0);
    const repaid = all.reduce((a, r) => a + Math.max(0, r.original_home - r.balance_home), 0);
    const st = S.f.owed_status;
    const list = all.filter((r) => (st === 'all' ? true : st === 'settled' ? r.balance <= 0 : r.balance > 0)).sort((a, b) => (b.balance > 0) - (a.balance > 0) || b.balance_home - a.balance_home);
    return html`${head}
    <div class="grid g4 tiles-sm" style="margin-bottom:18px">
      ${CW.tile({ label: 'Owed to you', value: fmtHome(total), foot: `${open.length} ${open.length === 1 ? 'person' : 'people'}`, dot: 'var(--s7)' })}
      ${CW.tile({ label: 'Overdue', value: fmtHome(overdueSum), foot: overdue.length ? `${overdue.length} past the expected date` : 'Nothing overdue', dot: 'var(--s8)' })}
      ${CW.tile({ label: 'Repaid to you so far', value: fmtHome(repaid), dot: 'var(--s3)' })}
      ${CW.tile({ label: 'Settled', value: String(all.length - open.length), foot: 'Fully repaid', dot: 'var(--s1)' })}
    </div>
    <div class="filters">${chips('owed_status', [['open', 'Open'], ['settled', 'Settled'], ['all', 'All']])}</div>
    ${list.length ? html`<div class="items">${list.map(recCard)}</div>` : html`<p class="muted">Nothing matches this filter.</p>`}`;
  };

  CW.act.remind = (d) => {
    const r = CW.item('receivables', d.id);
    const msg = `Hi ${r.name.split(' ')[0]}, I hope you are well. This is a friendly reminder about the ${fmt(r.balance, r.currency, 2)} you owe me${r.reason ? ` for ${r.reason.toLowerCase()}` : ''}${r.due_date ? `, which was due on ${CW.fmtDate(r.due_date)}` : ''}. Please let me know when you are able to settle it. Thank you!`;
    const m = CW.openModal({
      title: 'Send a reminder', size: '',
      body: html`<p class="ink2" style="margin-bottom:10px">Copy this message, or send it straight to WhatsApp.</p><div class="field"><textarea id="rem" style="height:130px" readonly>${msg}</textarea></div><div class="modal-foot"><button class="btn" data-close>Close</button><a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a><button class="btn primary" id="copy">${icon('copy')} Copy message</button></div>`,
    });
    m.el.querySelector('#copy').addEventListener('click', async () => {
      const ta = m.el.querySelector('#rem');
      try { await navigator.clipboard.writeText(msg); } catch (e) { ta.select(); document.execCommand && document.execCommand('copy'); }
      CW.toast('Message copied');
    });
  };

  // ================= Investments =================
  function invCard(i) {
    const gainPct = i.roi;
    const up = i.gain >= 0;
    return html`<article class="item">
      <div class="item-top"><span class="item-icon">${icon(CW.TYPE_ICON[i.type] || 'coin')}</span><div class="grow"><div class="item-title">${i.name}</div><div class="item-sub">${[CW.meta.investment_types[i.type], i.location].filter(Boolean).join(' · ')}</div></div>${gainPct != null ? html`<span class="badge ${up ? 'good' : 'bad'}">${icon(up ? 'up' : 'down')} ${up ? '+' : ''}${pct(gainPct)}</span>` : ''}</div>
      <div class="item-amount num">${fmt(i.current_value, i.currency)}${homeNote(i.value_home, i.currency)}</div>
      <div class="kv" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>You invested</span><b class="num">${fmt(i.amount_invested, i.currency)}</b></div><div><span>${up ? 'Gain' : 'Loss'}</span><b class="num delta ${up ? 'good' : 'bad'}">${up ? '+' : '−'}${fmt(Math.abs(i.gain), i.currency)}</b></div><div><span>${i.annual_income ? 'Income a year' : 'Acquired'}</span><b class="num">${i.annual_income ? fmt(i.annual_income, i.currency) : i.acquired_date ? CW.fmtDate(i.acquired_date) : '–'}</b></div>${i.yield_pct != null ? html`<div><span>Yield</span><b>${pct(i.yield_pct)}</b></div>` : ''}${i.annual_income && i.acquired_date ? html`<div><span>Acquired</span><b>${CW.fmtDate(i.acquired_date)}</b></div>` : ''}</div>
      <div class="actions"><button class="btn sm" data-act="value" data-id="${i.id}">${icon('trend')} Update value</button><button class="btn sm" data-act="adjust" data-res="investments" data-id="${i.id}" data-mode="plus">${icon('plus')} Funds</button><span class="grow"></span>${iconBtns('investments', i.id)}</div>
    </article>`;
  }

  CW.views.investments = () => {
    const d = S.data, s = d.summary.investments;
    const addBtn = html`<button class="btn primary" data-act="add" data-res="investments">${icon('plus')} Add investment</button>`;
    const country = CW.meta.countries.find((c) => c.code === d.user.country);
    const head = CW.pageHead('Investments', 'Land, apartments, farms, funds, businesses and more. Keep the value up to date to see your real worth.', addBtn);
    if (!d.investments.length) return html`${head}${CW.emptyState({ iconName: 'building', title: 'No investments yet', text: `Add land, property, farms, shares or a business stake. Popular in ${country ? country.name : 'your country'}: ${country ? country.ideas : 'property, land, funds and savings'}.`, actions: addBtn })}`;
    const present = [...new Set(d.investments.map((i) => i.type))];
    const t = S.f.inv_type;
    const list = d.investments.filter((i) => t === 'all' || i.type === t);
    const up = s.gain >= 0;
    return html`${head}
    <div class="grid g4 tiles-sm" style="margin-bottom:18px">
      ${CW.tile({ label: 'Total value', value: fmtHome(s.value), foot: `${s.count} investment${s.count > 1 ? 's' : ''}`, dot: 'var(--s3)' })}
      ${CW.tile({ label: 'Amount invested', value: fmtHome(s.cost), dot: 'var(--s1)' })}
      ${CW.tile({ label: up ? 'Total gain' : 'Total loss', value: html`<span class="delta ${up ? 'good' : 'bad'}">${up ? '+' : '−'}${fmtHome(Math.abs(s.gain))}</span>`, foot: s.roi != null ? `${pct(s.roi)} return overall` : '', dot: 'var(--s4)' })}
      ${CW.tile({ label: 'Income a year', value: fmtHome(s.annual_income), foot: s.annual_income ? `${fmtHome(s.annual_income / 12)} a month` : 'Rent, dividends, harvests', dot: 'var(--s7)' })}
    </div>
    ${C.card({ title: 'Portfolio mix', sub: 'By type, at current value', chart: C.donut(s.allocation, { fmt: fmtHome, center: { value: CW.compact(s.value), label: 'total value' } }), table: { head: ['Type', 'Value'], rows: s.allocation.map((x) => [x.label, fmtHome(x.value)]) } })}
    <div class="filters" style="margin-top:20px"><button class="chip" aria-pressed="${String(t === 'all')}" data-act="filter" data-key="inv_type" data-value="all">All</button>${present.map((k) => html`<button class="chip" aria-pressed="${String(t === k)}" data-act="filter" data-key="inv_type" data-value="${k}">${CW.meta.investment_types[k]}</button>`)}</div>
    <div class="items">${list.map(invCard)}</div>`;
  };

  // ================= Goals =================
  function goalCard(g) {
    const late = !g.achieved && g.target_date && CW.daysUntil(g.target_date) < 0;
    const tone = g.achieved ? '' : late ? 'bad' : g.progress < 25 && g.months_left != null && g.months_left <= 3 ? 'warn' : 'blue';
    return html`<article class="item">
      <div class="item-top"><span class="item-icon">${icon(g.kind === 'spending' ? 'card' : g.kind === 'emergency' ? 'shield' : 'target')}</span><div class="grow"><div class="item-title">${g.name}</div><div class="item-sub">${CW.meta.goal_kinds[g.kind]}${g.target_date ? ` · by ${CW.fmtDate(g.target_date)}` : ''}</div></div>${g.achieved ? html`<span class="badge good">${icon('check')} Reached</span>` : late ? html`<span class="badge bad">${icon('alert')} Date passed</span>` : g.priority === 'high' ? html`<span class="badge warn">High priority</span>` : ''}</div>
      <div><div class="meter-label"><span class="num" style="color:var(--ink);font-weight:650">${fmt(g.saved_amount, g.currency)}</span><span class="num">of ${fmt(g.target_amount, g.currency)}</span></div><div class="meter ${g.achieved ? '' : tone}"><i style="width:${g.progress}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">${pct(g.progress, 0)} saved${g.currency !== CW.home() ? ` · ≈ ${fmtHome(g.saved_home)}` : ''}</div></div>
      <div class="kv" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>Still to save</span><b class="num">${fmt(g.remaining, g.currency)}</b></div><div><span>${g.per_month != null && !g.achieved ? 'Set aside monthly' : 'Time left'}</span><b class="num">${g.achieved ? 'Done' : g.per_month != null ? `${fmt(g.per_month, g.currency)} for ${g.months_left || 1} mo` : 'No date set'}</b></div></div>
      <div class="actions"><button class="btn sm" data-act="adjust" data-res="goals" data-id="${g.id}" data-mode="plus">${icon('plus')} Add funds</button><button class="btn sm" data-act="adjust" data-res="goals" data-id="${g.id}" data-mode="minus">${icon('minus')} Withdraw</button><span class="grow"></span>${iconBtns('goals', g.id)}</div>
    </article>`;
  }

  CW.views.goals = () => {
    const d = S.data, s = d.summary.goals;
    const addBtn = html`<button class="btn primary" data-act="add" data-res="goals">${icon('plus')} Add goal</button>`;
    const head = CW.pageHead('Goals & spending plans', 'Set target savings and plan upcoming spending. Clearworth works out what to put aside each month.', addBtn);
    if (!d.goals.length) return html`${head}${CW.emptyState({ iconName: 'target', title: 'No goals yet', text: 'Planning an emergency fund, school fees, a wedding, a car or a house deposit? Add a goal with a target date and see what to save each month.', actions: addBtn })}`;
    const savings = d.goals.filter((g) => g.kind !== 'spending');
    const spending = d.goals.filter((g) => g.kind === 'spending');
    const section = (title, list, sub) => list.length ? html`<h2 style="font-size:18px;margin:26px 0 4px">${title}</h2><p class="muted" style="margin-bottom:14px">${sub}</p><div class="items">${list.map(goalCard)}</div>` : '';
    return html`${head}
    <div class="grid g4 tiles-sm" style="margin-bottom:8px">
      ${CW.tile({ label: 'Saved so far', value: fmtHome(s.saved), foot: `${s.count} goal${s.count > 1 ? 's' : ''} · ${s.achieved} reached`, dot: 'var(--s4)' })}
      ${CW.tile({ label: 'Still to save', value: fmtHome(d.goals.filter((g) => !g.achieved).reduce((a, g) => a + g.remaining_home, 0)), dot: 'var(--s1)' })}
      ${CW.tile({ label: 'Needed each month', value: fmtHome(s.monthly_needed), foot: 'To hit every dated goal', dot: 'var(--s2)' })}
      ${CW.tile({ label: 'Planned spending', value: fmtHome(s.planned_spend), foot: 'Not yet funded', dot: 'var(--s5)' })}
    </div>
    ${section('Savings & emergency funds', savings, 'Money you are building up. It counts towards your net worth.')}
    ${section('Planned spending', spending, 'Upcoming costs you want to be ready for.')}`;
  };
})();
