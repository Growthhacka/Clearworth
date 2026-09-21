/* Dashboard and Net worth portal. */
(function () {
  'use strict';
  const CW = window.CW;
  const { html, raw, icon, fmt, fmtHome, pct } = CW;
  const C = window.Charts;
  const S = CW.S;

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const isEmpty = () => { const d = S.data; return !d.debts.length && !d.receivables.length && !d.investments.length && !d.goals.length; };
  const dayMs = (iso) => Date.parse(iso + 'T12:00:00');

  CW.tile = ({ label, value, foot, dot, href }) => html`<${raw(href ? 'a' : 'div')} class="tile" ${href ? raw(`href="${CW.esc(href)}" style="color:inherit;text-decoration:none;display:block"`) : ''}><div class="label">${dot ? html`<span class="dot" style="background:${dot}"></span>` : ''}${label}</div><div class="value num">${value}</div>${foot ? html`<div class="foot">${foot}</div>` : ''}</${raw(href ? 'a' : 'div')}>`;

  CW.pageHead = (title, desc, actions) => html`<div class="page-head"><div><h1>${title}</h1>${desc ? html`<p>${desc}</p>` : ''}</div><div class="row wrap">${actions || ''}</div></div>`;

  CW.emptyState = ({ iconName, title, text, actions }) => html`<div class="empty"><div class="ic-big">${icon(iconName)}</div><h3>${title}</h3><p>${text}</p><div class="row wrap" style="justify-content:center">${actions || ''}</div></div>`;

  // series from snapshots
  function snapSeries(snaps, key, name, color) {
    return { name, color, points: snaps.map((s) => ({ x: dayMs(s.day), y: s[key] })) };
  }
  const chartOpts = () => ({
    yFmt: (y) => CW.compact(y), tipFmt: (y) => fmtHome(y),
    tipTitle: (x) => CW.fmtDate(new Date(x).toISOString().slice(0, 10)),
    xTick: (x) => CW.fmtMonth(new Date(x).toISOString().slice(0, 10)),
  });

  function delta30(snaps, current) {
    if (snaps.length < 2) return null;
    const cutoff = Date.now() - 30 * 86400000;
    let base = snaps[0];
    for (const s of snaps) if (dayMs(s.day) <= cutoff) base = s;
    if (base.day === snaps[snaps.length - 1].day) return null;
    return { amount: current - base.net_worth, since: base.day };
  }

  function insights() {
    const d = S.data, s = d.summary, out = [];
    const active = d.debts.filter((x) => x.balance > 0);
    const late = active.filter((x) => x.overdue);
    if (late.length) out.push(['bad', 'alert', 'Overdue', `${late.length} debt${late.length > 1 ? 's are' : ' is'} past the due date (${late.map((x) => x.name).join(', ')}). Pay or update the date to avoid late fees.`]);
    const worst = active.filter((x) => x.interest_rate >= 8).sort((a, b) => b.interest_rate - a.interest_rate)[0];
    if (worst) out.push(['warn', 'bolt', 'Costly debt', `${worst.name} charges ${pct(worst.interest_rate)} a year, about ${fmtHome(worst.monthly_interest_home)} of interest every month. Paying extra here first saves the most.`]);
    if (s.card_utilisation != null && s.card_utilisation >= 30) out.push(['warn', 'card', 'Card use', `You are using ${pct(s.card_utilisation, 0)} of your credit card limits. Staying under 30% is generally better for your credit score.`]);
    if (s.debts.stuck) out.push(['bad', 'alert', 'Payment too low', `${s.debts.stuck} debt${s.debts.stuck > 1 ? 's have' : ' has'} a monthly payment that does not cover the interest, so the balance will never fall. Try the Payoff Planner.`]);
    if (s.debts.no_plan) out.push(['', 'clock', 'Add payments', `Set a monthly payment on ${s.debts.no_plan} debt${s.debts.no_plan > 1 ? 's' : ''} to see your debt-free date.`]);
    if (s.receivables.overdue) out.push(['warn', 'inbox', 'Chase payment', `${s.receivables.overdue} ${s.receivables.overdue > 1 ? 'people are' : 'person is'} overdue in paying you back. Open “Owed to me” to send a reminder.`]);
    if (s.debt_to_asset != null && s.debt_to_asset < 25 && s.debts.total > 0) out.push(['good', 'shield', 'Healthy', `Your debts are only ${pct(s.debt_to_asset, 0)} of your assets. You are well covered.`]);
    if (s.investments.annual_income > 0) out.push(['good', 'trend', 'Income', `Your investments produce about ${fmtHome(s.investments.annual_income)} a year (${fmtHome(s.investments.annual_income / 12)} a month).`]);
    if (s.goals.monthly_needed > 0) out.push(['', 'target', 'Goals', `To hit all your dated goals you need to set aside about ${fmtHome(s.goals.monthly_needed)} each month.`]);
    if (s.debts.count === 0 && d.debts.length) out.push(['good', 'check', 'Debt free', 'Every debt on your list is paid off. Well done.']);
    return out.slice(0, 5);
  }

  function debtCostCard() {
    const s = S.data.summary.debts;
    if (!s.count) return html`<div class="card"><div class="card-head"><div><h3>Cost of your debt</h3></div></div>${S.data.debts.length ? html`<p class="ink2">You have no outstanding debt. Every debt on your list is paid off.</p>` : html`<p class="ink2">Add your debts to see what they will really cost you once interest is included.</p><div style="margin-top:14px"><button class="btn primary sm" data-act="add" data-res="debts" data-portal="cards">${icon('plus')} Add a debt</button></div>`}</div>`;
    const stack = C.stack([{ label: 'Still owed', value: s.total, color: 'var(--s2)' }, { label: 'Interest to come', value: s.projected_interest, color: 'var(--s4)' }], { fmt: fmtHome });
    return html`<div class="card">
      <div class="card-head"><div><h3>Total cost of your debt</h3><div class="sub">What you owe plus interest at your current payments</div></div></div>
      <div class="hero-num num" style="font-size:clamp(30px,4vw,40px)">${fmtHome(s.total_cost)}</div>
      <div style="margin:14px 0 6px">${stack}</div>
      <div class="legend"><span><i style="background:var(--s2)"></i>Still owed ${fmtHome(s.total)}</span><span><i style="background:var(--s4)"></i>Interest ${fmtHome(s.projected_interest)}</span></div>
      <hr class="sep">
      <div class="kv" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div><span>Paid each month</span><b class="num">${fmtHome(s.monthly_min)}</b></div>
        <div><span>Interest per year</span><b class="num">${fmtHome(s.annual_interest)}</b></div>
        <div><span>Debt-free date</span><b>${s.debt_free_date ? CW.fmtDate(s.debt_free_date) : s.stuck ? 'Never at current payments' : 'Add monthly payments'}</b></div>
        <div><span>Debts</span><b>${s.count} active</b></div>
      </div>
      ${s.no_plan || s.stuck ? html`<p class="muted" style="font-size:12.5px;margin-top:12px">${s.no_plan ? `${s.no_plan} debt${s.no_plan > 1 ? 's have' : ' has'} no monthly payment, so their future interest is not included. ` : ''}${s.stuck ? 'Debts whose payment does not cover interest are also excluded.' : ''}</p>` : ''}
    </div>`;
  }

  function welcome() {
    return html`${CW.pageHead(`${greeting()}, ${S.data.user.name.split(' ')[0]}`, 'Let us build your financial picture. Start with anything you like, you can always add more later.')}
    ${CW.emptyState({
      iconName: 'chart', title: 'Your portfolio is empty',
      text: 'Add what you owe, what you own and what others owe you. Your net worth appears here as soon as you do. Want a look around first? Load sample data and delete it whenever you like.',
      actions: html`<button class="btn primary" data-act="add" data-res="debts" data-portal="cards">${icon('plus')} Add a debt</button><button class="btn" data-act="add" data-res="investments">${icon('plus')} Add an investment</button><button class="btn" data-act="seed-demo">Load sample data</button>`,
    })}`;
  }

  CW.views.dashboard = () => {
    if (isEmpty()) return welcome();
    const d = S.data, s = d.summary, snaps = d.snapshots;
    const dl = delta30(snaps, s.net_worth);
    const last6 = snaps.filter((x) => dayMs(x.day) >= Date.now() - 190 * 86400000);
    const chart = last6.length > 1
      ? C.line([snapSeries(last6, 'net_worth', 'Net worth', 'var(--s1)')], { ...chartOpts(), height: 210, frac: 0.615, label: 'Net worth over time' })
      : html`<p class="muted">Your net worth trend appears here as you keep your figures up to date.</p>`;
    const up = d.summary.upcoming.slice(0, 6);
    const ins = insights();
    const goals = d.goals.filter((g) => !g.achieved).slice(0, 3);

    return html`
    ${CW.pageHead(`${greeting()}, ${d.user.name.split(' ')[0]}`, `Here is where you stand today, in ${d.user.currency}.`)}
    <div class="grid g-main" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><div><h3>Your net worth</h3><div class="sub">Everything you have, minus everything you owe</div></div></div>
        <div class="hero-num num ${s.net_worth < 0 ? 'neg' : ''}">${fmtHome(s.net_worth)}</div>
        ${dl ? html`<div class="row" style="margin-top:8px;font-size:14px"><span class="delta ${dl.amount >= 0 ? 'good' : 'bad'}">${icon(dl.amount >= 0 ? 'up' : 'down')}</span><span class="delta ${dl.amount >= 0 ? 'good' : 'bad'}">${dl.amount >= 0 ? '+' : '−'}${fmtHome(Math.abs(dl.amount))}</span><span class="muted">since ${CW.fmtDate(dl.since)}</span></div>` : ''}
        <div style="margin-top:14px">${chart}</div>
      </div>
      ${debtCostCard()}
    </div>
    <div class="grid g4 tiles-sm" style="margin-bottom:16px">
      ${CW.tile({ label: 'Investments', value: fmtHome(s.investments.value), foot: s.investments.count ? html`<span class="delta ${s.investments.gain >= 0 ? 'good' : 'bad'}">${s.investments.gain >= 0 ? '+' : '−'}${fmtHome(Math.abs(s.investments.gain))}${s.investments.roi != null ? ` (${pct(s.investments.roi)})` : ''}</span> return` : 'Add your first investment', dot: 'var(--s3)', href: '#/investments' })}
      ${CW.tile({ label: 'What you owe', value: fmtHome(s.debts.total), foot: s.debts.count ? `${s.debts.count} active · ${fmtHome(s.debts.monthly_min)}/month` : 'Debt free', dot: 'var(--s2)', href: '#/cards' })}
      ${CW.tile({ label: 'Owed to you', value: fmtHome(s.receivables.total), foot: s.receivables.overdue ? `${s.receivables.overdue} overdue` : `${s.receivables.count} open`, dot: 'var(--s7)', href: '#/owed' })}
      ${CW.tile({ label: 'Savings set aside', value: fmtHome(s.goals.saved), foot: s.goals.count ? `${s.goals.count} goal${s.goals.count > 1 ? 's' : ''}` : 'No goals yet', dot: 'var(--s4)', href: '#/goals' })}
    </div>
    <div class="grid g2" style="margin-bottom:16px">
      ${C.card({ title: 'What you owe, by type', sub: 'Outstanding balances', chart: C.hbars(s.debts.by_type, { fmt: fmtHome }), table: { head: ['Type', 'Balance'], rows: s.debts.by_type.map((x) => [x.label, fmtHome(x.value)]) } })}
      ${C.card({ title: 'Where your investments sit', sub: 'By type, at current value', chart: C.donut(s.investments.allocation, { fmt: fmtHome, center: { value: CW.compact(s.investments.value), label: 'invested' } }), table: { head: ['Type', 'Value'], rows: s.investments.allocation.map((x) => [x.label, fmtHome(x.value)]) } })}
    </div>
    <div class="grid g-main" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><div><h3>Coming up</h3><div class="sub">Next 30 days, plus anything overdue</div></div></div>
        ${up.length ? html`<div class="list">${up.map((u) => html`<div class="li"><span class="item-icon">${icon({ debt: 'card', receivable: 'inbox', goal: 'target' }[u.kind])}</span><div class="grow"><div style="font-weight:600" class="ellipsis">${u.name}</div><div class="muted" style="font-size:13px">${{ debt: 'Payment due', receivable: 'Expected repayment', goal: 'Goal date' }[u.kind]}</div></div><div style="text-align:right"><b class="num">${fmt(u.amount, u.currency)}</b><div>${CW.dueBadge(u.date)}</div></div></div>`)}</div>` : html`<p class="muted">Nothing due soon. Add due dates to your debts and expected repayment dates to what people owe you.</p>`}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Insights</h3><div class="sub">Based on your numbers</div></div></div>
        ${ins.length ? ins.map(([tone, ic, tag, text]) => html`<div class="insight"><span class="badge ${tone}">${icon(ic)} ${tag}</span><span>${text}</span></div>`) : html`<p class="muted">Add a few more details and tips will show up here.</p>`}
      </div>
    </div>
    ${goals.length ? html`<div class="card"><div class="card-head"><div><h3>Goals in progress</h3></div><a class="btn sm" href="#/goals">All goals</a></div><div class="grid g3">${goals.map((g) => html`<div><div class="meter-label"><span class="ellipsis" style="color:var(--ink);font-weight:600">${g.name}</span><span>${pct(g.progress, 0)}</span></div><div class="meter blue"><i style="width:${g.progress}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">${fmt(g.saved_amount, g.currency)} of ${fmt(g.target_amount, g.currency)}</div></div>`)}</div></div>` : ''}`;
  };

  // ---------------- Net worth ----------------
  const RANGES = { '3m': 92, '6m': 190, '1y': 370, all: 1e5 };

  CW.views.networth = () => {
    const d = S.data, s = d.summary;
    if (isEmpty()) return html`${CW.pageHead('Net worth', 'Assets minus debts, in one number.')}${CW.emptyState({ iconName: 'chart', title: 'Nothing to measure yet', text: 'Add your debts and investments and your net worth is calculated automatically.', actions: html`<button class="btn primary" data-act="seed-demo">Load sample data</button><a class="btn" href="#/dashboard">Back to dashboard</a>` })}`;
    const range = S.f.nw_range;
    const snaps = d.snapshots.filter((x) => dayMs(x.day) >= Date.now() - RANGES[range] * 86400000);
    const series = [snapSeries(snaps, 'assets', 'Assets', 'var(--s3)'), snapSeries(snaps, 'debts', 'Debts', 'var(--s2)'), snapSeries(snaps, 'net_worth', 'Net worth', 'var(--s1)')];
    const chart = snaps.length > 1 ? C.line(series, { ...chartOpts(), height: 280, label: 'Assets, debts and net worth over time' }) : html`<p class="muted">History builds up over time. Come back after you next update your figures.</p>`;
    const chips = Object.keys(RANGES).map((k) => html`<button class="chip" aria-pressed="${String(range === k)}" data-act="filter" data-key="nw_range" data-value="${k}">${k === 'all' ? 'All' : k.toUpperCase()}</button>`);
    const assetParts = [
      { label: 'Investments', value: s.assets.investments, color: 'var(--s3)' },
      { label: 'Owed to you', value: s.assets.receivables, color: 'var(--s7)' },
      { label: 'Savings set aside', value: s.assets.savings, color: 'var(--s4)' },
    ];
    const debtParts = s.debts.by_type.map((x, i) => ({ label: x.label, value: x.value, color: C.color(i) }));
    const row = (label, value, total, color) => html`<tr><td><span class="legend" style="display:inline"><i style="background:${color}"></i></span>${label}</td><td class="r">${fmtHome(value)}</td><td class="r muted">${total > 0 ? pct((value / total) * 100, 0) : '–'}</td></tr>`;

    // currency exposure
    const by = {};
    const add = (cur, k, v) => { by[cur] = by[cur] || { assets: 0, debts: 0 }; by[cur][k] += v; };
    d.investments.forEach((x) => add(x.currency, 'assets', x.current_value));
    d.receivables.filter((x) => x.balance > 0).forEach((x) => add(x.currency, 'assets', x.balance));
    d.goals.forEach((x) => add(x.currency, 'assets', x.saved_amount));
    d.debts.filter((x) => x.balance > 0).forEach((x) => add(x.currency, 'debts', x.balance));
    const cur = Object.entries(by);
    const rateOf = (c) => d.rates[c].rate, homeRate = d.rates[d.user.currency].rate;

    return html`
    ${CW.pageHead('Net worth', 'What you own plus what people owe you, minus what you owe. Updated every time you change a figure.')}
    <div class="grid g3 tiles-sm" style="margin-bottom:16px">
      ${CW.tile({ label: 'Net worth', value: html`<span class="${s.net_worth < 0 ? 'delta bad' : ''}">${fmtHome(s.net_worth)}</span>`, dot: 'var(--s1)' })}
      ${CW.tile({ label: 'Total assets', value: fmtHome(s.assets.total), foot: 'Investments, owed to you, savings', dot: 'var(--s3)' })}
      ${CW.tile({ label: 'Total debts', value: fmtHome(s.debts.total), foot: s.debt_to_asset != null ? `${pct(s.debt_to_asset, 0)} of your assets` : '', dot: 'var(--s2)' })}
    </div>
    ${C.card({ title: 'Net worth over time', sub: `In ${d.user.currency}`, tools: chips, chart, table: snaps.length ? { head: ['Date', 'Assets', 'Debts', 'Net worth'], rows: snaps.slice().reverse().slice(0, 60).map((x) => [CW.fmtDate(x.day), fmtHome(x.assets), fmtHome(x.debts), fmtHome(x.net_worth)]) } : null })}
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-head"><div><h3>Assets</h3><div class="sub">${fmtHome(s.assets.total)}</div></div></div>
        ${C.stack(assetParts, { fmt: fmtHome })}
        <table class="tbl" style="margin-top:10px"><tbody>${assetParts.map((p) => row(p.label, p.value, s.assets.total, p.color))}</tbody></table>
        <p class="muted" style="font-size:12.5px;margin-top:8px">Savings set aside is the money you have put into your goals.</p></div>
      <div class="card"><div class="card-head"><div><h3>Debts</h3><div class="sub">${fmtHome(s.debts.total)}</div></div></div>
        ${debtParts.length ? html`${C.stack(debtParts, { fmt: fmtHome })}<table class="tbl" style="margin-top:10px"><tbody>${debtParts.map((p) => row(p.label, p.value, s.debts.total, p.color))}</tbody></table>` : html`<p class="muted">No outstanding debts.</p>`}</div>
    </div>
    ${cur.length > 1 ? html`<div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Currency exposure</h3><div class="sub">Your position in each currency, converted at your exchange rates. Change rates in Settings.</div></div></div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Currency</th><th class="r">Assets</th><th class="r">Debts</th><th class="r">Net</th><th class="r">Net in ${d.user.currency}</th></tr></thead><tbody>${cur.map(([c, v]) => html`<tr><td><b>${c}</b></td><td class="r">${fmt(v.assets, c)}</td><td class="r">${fmt(v.debts, c)}</td><td class="r">${fmt(v.assets - v.debts, c)}</td><td class="r"><b>${fmtHome(((v.assets - v.debts) / rateOf(c)) * homeRate)}</b></td></tr>`)}</tbody></table></div></div>` : ''}`;
  };
})();
