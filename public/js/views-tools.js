/* Planner & calculators, and Settings. */
(function () {
  'use strict';
  const CW = window.CW;
  const { html, raw, icon, fmt, fmtHome, pct } = CW;
  const C = window.Charts;
  const S = CW.S;
  const $ = (root, s) => root.querySelector(s);
  const addMonthsIso = (n) => { const d = new Date(); d.setMonth(d.getMonth() + Math.round(n)); return d.toISOString().slice(0, 10); };
  const span = (m) => { const y = Math.floor(m / 12), mo = m % 12; return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', mo ? `${mo} mo` : ''].filter(Boolean).join(' ') || '0 mo'; };
  const num = (el) => { const v = Number(el && el.value); return Number.isFinite(v) ? v : 0; };
  const monthTick = (m) => (m === 0 ? 'Now' : m < 24 ? `${Math.round(m)} mo` : `${(m / 12).toFixed(m % 12 ? 1 : 0)} yrs`);

  // ---------------- payoff simulation (home currency) ----------------
  function simulate(debts, extra, strategy, rollover) {
    const ds = debts.map((d) => ({ id: d.id, name: d.name, bal: d.balance_home, start: d.balance_home, apr: d.interest_rate, min: d.min, paidAt: null }));
    const timeline = [{ x: 0, y: ds.reduce((a, d) => a + d.bal, 0) }];
    let months = 0, interest = 0;
    while (ds.some((d) => d.bal > 0.005) && months < 600) {
      months++;
      for (const d of ds) if (d.bal > 0.005) { const i = (d.bal * d.apr) / 1200; d.bal += i; interest += i; }
      let pool = extra;
      for (const d of ds) {
        if (d.paidAt !== null) { if (rollover) pool += d.min; continue; }
        const pay = Math.min(d.min, d.bal); d.bal -= pay;
      }
      const order = ds.filter((d) => d.paidAt === null && d.bal > 0.005).sort(strategy === 'snowball' ? (a, b) => a.bal - b.bal : (a, b) => b.apr - a.apr || a.bal - b.bal);
      for (const d of order) { if (pool <= 0) break; const pay = Math.min(pool, d.bal); d.bal -= pay; pool -= pay; }
      for (const d of ds) if (d.paidAt === null && d.bal <= 0.005) { d.paidAt = months; d.bal = 0; }
      timeline.push({ x: months, y: ds.reduce((a, d) => a + d.bal, 0) });
    }
    return { months, interest, timeline, ds, incomplete: ds.some((d) => d.bal > 0.005) };
  }

  function payoffOutput(root) {
    const active = S.data.debts.filter((d) => d.balance > 0);
    const debts = active.map((d) => {
      const assumed = !(d.min_payment_home > 0);
      return { ...d, min: assumed ? d.balance_home * 0.02 + d.monthly_interest_home : d.min_payment_home, assumed };
    });
    const extra = Math.max(0, num($(root, '#pl-extra')));
    const strategy = $(root, '#pl-strategy').value;
    S.f.planner_extra = $(root, '#pl-extra').value; S.f.planner_strategy = strategy;
    const base = simulate(debts, 0, strategy, false);
    const plan = simulate(debts, extra, strategy, true);
    const assumed = debts.filter((d) => d.assumed);
    const saved = base.interest - plan.interest;
    const out = $(root, '#pl-out');
    const series = [
      { name: 'Minimum payments only', color: 'var(--s2)', points: base.timeline.map((p) => ({ x: p.x, y: p.y })) },
      { name: extra > 0 ? 'Your plan (with extra)' : 'Your plan (freed payments roll over)', color: 'var(--s1)', points: plan.timeline.map((p) => ({ x: p.x, y: p.y })) },
    ];
    const chart = C.line(series, { yFmt: (y) => CW.compact(y), tipFmt: (y) => fmtHome(y), tipTitle: (x) => `${monthTick(x)} · ${CW.fmtMonth(addMonthsIso(x))}`, xTick: monthTick, height: 260, label: 'Total debt balance over time' });
    out.innerHTML = html`
      <div class="grid g4 tiles-sm" style="margin-bottom:16px">
        ${CW.tile({ label: 'Debt-free in', value: plan.incomplete ? '50+ years' : span(plan.months), foot: plan.incomplete ? 'Payments do not clear the debt' : CW.fmtDate(addMonthsIso(plan.months)), dot: 'var(--s1)' })}
        ${CW.tile({ label: 'Total interest', value: fmtHome(plan.interest), foot: 'With this plan', dot: 'var(--s4)' })}
        ${CW.tile({ label: 'Interest saved', value: html`<span class="${base.incomplete || saved > 0 ? 'delta good' : ''}">${base.incomplete ? 'A lot' : fmtHome(Math.max(0, saved))}</span>`, foot: base.incomplete ? 'Minimums alone never clear it' : 'Compared with minimums only', dot: 'var(--s3)' })}
        ${CW.tile({ label: 'Time saved', value: base.incomplete ? '–' : span(Math.max(0, base.months - plan.months)), foot: base.incomplete ? '' : `Minimums only: ${span(base.months)}`, dot: 'var(--s7)' })}
      </div>
      ${C.card({ title: 'Your total debt over time', sub: `In ${S.data.user.currency}. ${strategy === 'avalanche' ? 'Avalanche: highest interest rate first.' : 'Snowball: smallest balance first.'}`, chart, table: { head: ['Month', 'Minimums only', 'Your plan'], rows: plan.timeline.filter((p, i) => i % Math.max(1, Math.ceil(plan.timeline.length / 24)) === 0 || i === plan.timeline.length - 1).map((p) => [`${monthTick(p.x)}`, fmtHome((base.timeline[p.x] || { y: 0 }).y), fmtHome(p.y)]) } })}
      <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Payoff order</h3><div class="sub">The order debts are cleared with this plan</div></div></div>
        <div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>Debt</th><th class="r">Balance</th><th class="r">Interest</th><th class="r">Monthly</th><th class="r">Paid off</th></tr></thead><tbody>${plan.ds.slice().sort((a, b) => (a.paidAt ?? 1e9) - (b.paidAt ?? 1e9)).map((d, i) => html`<tr><td>${i + 1}</td><td><b>${d.name}</b></td><td class="r">${fmtHome(d.start)}</td><td class="r">${pct(d.apr)}</td><td class="r">${fmtHome(debts.find((x) => x.id === d.id).min)}</td><td class="r">${d.paidAt ? CW.fmtDate(addMonthsIso(d.paidAt)) : 'Not within 50 years'}</td></tr>`)}</tbody></table></div>
        ${assumed.length ? html`<p class="muted" style="font-size:12.5px;margin-top:10px">No monthly payment is set for ${assumed.map((d) => d.name).join(', ')}, so an assumed payment of 2% of the balance plus interest was used.</p>` : ''}
      </div>`.s;
    C.mount(out);
  }

  // ---------------- loan calculator ----------------
  function loanOutput(root) {
    const P = num($(root, '#ln-amt')), apr = num($(root, '#ln-apr')), years = num($(root, '#ln-yrs'));
    const out = $(root, '#ln-out');
    const n = Math.round(years * 12);
    if (!(P > 0) || !(n > 0)) { out.innerHTML = '<p class="muted">Enter an amount and a term to see the monthly payment.</p>'; return; }
    const r = apr / 1200;
    const pay = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
    let bal = P, totalInt = 0;
    const pts = [{ x: 0, y: P }], yearly = [];
    let yi = 0, yp = 0;
    for (let m = 1; m <= n; m++) {
      const i = bal * r, pr = Math.min(pay - i, bal);
      bal -= pr; totalInt += i; yi += i; yp += pr;
      pts.push({ x: m, y: Math.max(0, bal) });
      if (m % 12 === 0 || m === n) { yearly.push([`Year ${Math.ceil(m / 12)}`, fmtHome(yp), fmtHome(yi), fmtHome(Math.max(0, bal))]); yi = 0; yp = 0; }
    }
    const chart = C.line([{ name: 'Balance remaining', color: 'var(--s2)', points: pts }], { yFmt: (y) => CW.compact(y), tipFmt: (y) => fmtHome(y), tipTitle: monthTick, xTick: monthTick, height: 220, label: 'Loan balance over time' });
    out.innerHTML = html`
      <div class="grid g4 tiles-sm" style="margin-bottom:16px">
        ${CW.tile({ label: 'Monthly payment', value: fmtHome(pay, 2), dot: 'var(--s1)' })}
        ${CW.tile({ label: 'Total interest', value: fmtHome(totalInt), foot: `${pct((totalInt / P) * 100, 0)} of the amount borrowed`, dot: 'var(--s4)' })}
        ${CW.tile({ label: 'Total you repay', value: fmtHome(P + totalInt), dot: 'var(--s2)' })}
        ${CW.tile({ label: 'Number of payments', value: String(n), foot: span(n), dot: 'var(--s7)' })}
      </div>
      ${C.card({ title: 'Balance over time', chart, table: { head: ['Year', 'Principal paid', 'Interest paid', 'Balance left'], rows: yearly } })}`.s;
    C.mount(out);
  }

  // ---------------- growth calculator ----------------
  function growthOutput(root) {
    const init = num($(root, '#gr-init')), monthly = num($(root, '#gr-mon')), rate = num($(root, '#gr-rate')), years = Math.min(60, num($(root, '#gr-yrs')));
    const out = $(root, '#gr-out');
    if (!(years > 0) || (init <= 0 && monthly <= 0)) { out.innerHTML = '<p class="muted">Enter a starting amount or a monthly amount, and a number of years.</p>'; return; }
    const r = rate / 1200;
    let v = init, contrib = init;
    const a = [{ x: 0, y: v }], b = [{ x: 0, y: contrib }], rows = [];
    for (let m = 1; m <= years * 12; m++) {
      v = v * (1 + r) + monthly; contrib += monthly;
      if (m % 12 === 0) { a.push({ x: m / 12, y: v }); b.push({ x: m / 12, y: contrib }); rows.push([`Year ${m / 12}`, fmtHome(contrib), fmtHome(v - contrib), fmtHome(v)]); }
    }
    const chart = C.line([{ name: 'Total put in', color: 'var(--s1)', points: b }, { name: 'Value with growth', color: 'var(--s3)', points: a }], { yFmt: (y) => CW.compact(y), tipFmt: (y) => fmtHome(y), tipTitle: (x) => `Year ${x}`, xTick: (x) => `${x}y`, height: 240, label: 'Investment growth over time' });
    out.innerHTML = html`
      <div class="grid g3 tiles-sm" style="margin-bottom:16px">
        ${CW.tile({ label: 'Value at the end', value: fmtHome(v), dot: 'var(--s3)' })}
        ${CW.tile({ label: 'You put in', value: fmtHome(contrib), dot: 'var(--s1)' })}
        ${CW.tile({ label: 'Growth', value: html`<span class="delta good">+${fmtHome(v - contrib)}</span>`, foot: 'Assumes steady returns, which real investments do not guarantee', dot: 'var(--s4)' })}
      </div>
      ${C.card({ title: 'Growth over time', chart, table: { head: ['Year', 'Put in', 'Growth', 'Value'], rows } })}`.s;
    C.mount(out);
  }

  // ---------------- planner view ----------------
  const TABS = [['payoff', 'Debt payoff planner'], ['loan', 'Loan calculator'], ['growth', 'Investment growth']];
  CW.views.planner = () => {
    const tab = S.f.planner_tab;
    const tabs = html`<div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button role="tab" aria-selected="${String(tab === k)}" data-act="filter" data-key="planner_tab" data-value="${k}">${l}</button>`)}</div>`;
    const head = CW.pageHead('Planner & calculators', 'Work out the fastest way out of debt, what a loan really costs, and how your money could grow.');
    let body;
    if (tab === 'payoff') {
      const active = S.data.debts.filter((d) => d.balance > 0);
      body = !active.length
        ? CW.emptyState({ iconName: 'calc', title: 'No debts to plan', text: 'Add your debts and the planner will show the fastest and cheapest way to clear them.', actions: html`<button class="btn primary" data-act="add" data-res="debts" data-portal="cards">${icon('plus')} Add a debt</button>` })
        : html`<div class="card" style="margin-bottom:16px"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
            <div class="field"><label for="pl-strategy">Strategy</label><select id="pl-strategy"><option value="avalanche" ${S.f.planner_strategy !== 'snowball' ? 'selected' : ''}>Avalanche: highest interest first (cheapest)</option><option value="snowball" ${S.f.planner_strategy === 'snowball' ? 'selected' : ''}>Snowball: smallest balance first (quick wins)</option></select></div>
            <div class="field"><label for="pl-extra">Extra you can pay each month (${S.data.user.currency})</label><input id="pl-extra" type="number" min="0" step="any" value="${S.f.planner_extra || ''}" placeholder="0"><span class="hint">On top of your current monthly payments.</span></div></div></div><div id="pl-out"></div>`;
    } else if (tab === 'loan') {
      body = html`<div class="card" style="margin-bottom:16px"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="field"><label for="ln-amt">Amount to borrow (${S.data.user.currency})</label><input id="ln-amt" type="number" min="0" step="any" value="${S.f.ln_amt || ''}" placeholder="e.g. 5000"></div>
        <div class="field"><label for="ln-apr">Interest rate (% a year)</label><input id="ln-apr" type="number" min="0" step="any" value="${S.f.ln_apr || ''}" placeholder="e.g. 12.5"></div>
        <div class="field"><label for="ln-yrs">Term (years)</label><input id="ln-yrs" type="number" min="0" step="any" value="${S.f.ln_yrs || ''}" placeholder="e.g. 3"></div></div></div><div id="ln-out"></div>`;
    } else {
      body = html`<div class="card" style="margin-bottom:16px"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="field"><label for="gr-init">Starting amount (${S.data.user.currency})</label><input id="gr-init" type="number" min="0" step="any" value="${S.f.gr_init || ''}" placeholder="e.g. 10000"></div>
        <div class="field"><label for="gr-mon">Add each month</label><input id="gr-mon" type="number" min="0" step="any" value="${S.f.gr_mon || ''}" placeholder="e.g. 500"></div>
        <div class="field"><label for="gr-rate">Expected return (% a year)</label><input id="gr-rate" type="number" min="0" step="any" value="${S.f.gr_rate || ''}" placeholder="e.g. 8"></div>
        <div class="field"><label for="gr-yrs">Years</label><input id="gr-yrs" type="number" min="1" max="60" step="1" value="${S.f.gr_yrs || ''}" placeholder="e.g. 10"></div></div></div><div id="gr-out"></div>`;
    }
    return html`${head}${tabs}${body}`;
  };

  CW.viewMount.planner = (root) => {
    const tab = S.f.planner_tab;
    const wire = (ids, fn, keys) => ids.forEach((id, i) => {
      const el = $(root, id); if (!el) return;
      el.addEventListener('input', () => { if (keys) S.f[keys[i]] = el.value; fn(root); });
      el.addEventListener('change', () => { if (keys) S.f[keys[i]] = el.value; fn(root); });
    });
    if (tab === 'payoff' && $(root, '#pl-out')) { wire(['#pl-strategy', '#pl-extra'], payoffOutput); payoffOutput(root); }
    if (tab === 'loan') { wire(['#ln-amt', '#ln-apr', '#ln-yrs'], loanOutput, ['ln_amt', 'ln_apr', 'ln_yrs']); loanOutput(root); }
    if (tab === 'growth') { wire(['#gr-init', '#gr-mon', '#gr-rate', '#gr-yrs'], growthOutput, ['gr_init', 'gr_mon', 'gr_rate', 'gr_yrs']); growthOutput(root); }
  };

  // ---------------- settings ----------------
  CW.views.settings = () => {
    const d = S.data, u = d.user;
    const used = new Set([u.currency]);
    ['debts', 'receivables', 'investments', 'goals'].forEach((k) => d[k].forEach((x) => used.add(x.currency)));
    const showAll = !!S.f.rates_all;
    const list = Object.keys(CW.meta.currencies).filter((c) => c !== u.currency && (showAll || used.has(c)));
    const homeRate = d.rates[u.currency].rate;
    const empty = !d.debts.length && !d.receivables.length && !d.investments.length && !d.goals.length;
    return html`${CW.pageHead('Settings', 'Your profile, currency, exchange rates and data.')}
    <div class="grid g2" style="align-items:start">
      <div class="stack" style="gap:16px">
        <div class="card"><div class="card-head"><div><h3>Profile</h3><div class="sub">${u.email}</div></div></div>
          <form id="profile-form" novalidate><div class="form-error hidden" role="alert"></div><div class="form-grid">
            <div class="field full"><label for="p_name">Name</label><input id="p_name" name="name" value="${u.name}" maxlength="80"></div>
            <div class="field"><label for="p_country">Country</label><select id="p_country" name="country">${CW.countryOptions().map(([c, n]) => html`<option value="${c}" ${c === u.country ? 'selected' : ''}>${n}</option>`)}</select></div>
            <div class="field"><label for="p_cur">Home currency</label><select id="p_cur" name="currency">${CW.currencyOptions(u.currency).map(([c, n]) => html`<option value="${c}" ${c === u.currency ? 'selected' : ''}>${n}</option>`)}</select><span class="hint">All totals and your net worth are shown in this currency.</span></div>
          </div><div class="modal-foot"><button class="btn primary" type="submit">Save profile</button></div></form></div>

        <div class="card"><div class="card-head"><div><h3>Change password</h3></div></div>
          <form id="pw-form" novalidate><div class="form-error hidden" role="alert"></div><div class="stack" style="gap:14px">
            <div class="field"><label for="pw_cur">Current password</label><input id="pw_cur" name="current" type="password" autocomplete="current-password"></div>
            <div class="field"><label for="pw_new">New password</label><input id="pw_new" name="next" type="password" autocomplete="new-password"><span class="hint">At least 8 characters.</span></div>
          </div><div class="modal-foot"><button class="btn primary" type="submit">Update password</button></div></form></div>
      </div>

      <div class="stack" style="gap:16px">
        <div class="card"><div class="card-head"><div><h3>Exchange rates</h3><div class="sub">Used to convert everything into ${u.currency}. Rates refresh automatically when online. Edit any rate to use your own.</div></div></div>
          ${list.length ? html`<div class="scroll-x"><table class="tbl"><thead><tr><th>Currency</th><th>1 unit equals</th><th></th></tr></thead><tbody>${list.map((c) => {
            const r = d.rates[c];
            const v = homeRate / r.rate;
            return html`<tr><td><b>${c}</b><div class="muted" style="font-size:12px">${CW.meta.currencies[c].name}</div></td><td><div class="row" style="gap:8px"><input class="input" style="width:130px;height:36px" type="number" step="any" min="0" data-rate="${c}" value="${Number(v.toPrecision(6))}" aria-label="Rate for ${c}"><span class="muted">${u.currency}</span></div></td><td class="r"><span class="badge ${r.source === 'custom' ? 'brand' : ''}">${r.source === 'custom' ? 'Custom' : r.source === 'live' ? 'Live' : 'Default'}</span>${r.source === 'custom' ? html` <button class="btn sm ghost" data-reset-rate="${c}">Reset</button>` : ''}</td></tr>`;
          })}</tbody></table></div>` : html`<p class="muted">Everything you have added is in ${u.currency}, so no conversion is needed.</p>`}
          <div style="margin-top:12px"><button class="btn sm" data-act="rates-all">${showAll ? 'Show only currencies I use' : 'Show all currencies'}</button></div>
          <p class="muted" style="font-size:12.5px;margin-top:10px">Default rates are approximate. Update them for accurate totals, especially for volatile currencies.</p>
        </div>

        <div class="card"><div class="card-head"><div><h3>Your data</h3><div class="sub">You own your data. Take a copy or remove it at any time.</div></div></div>
          <div class="row wrap"><a class="btn" href="/api/export" download>${icon('download')} Everything (JSON)</a><a class="btn" href="/api/export/debts.csv" download>Debts (CSV)</a><a class="btn" href="/api/export/receivables.csv" download>Owed to me (CSV)</a><a class="btn" href="/api/export/investments.csv" download>Investments (CSV)</a><a class="btn" href="/api/export/goals.csv" download>Goals (CSV)</a></div>
          ${empty ? html`<hr class="sep"><div class="row between wrap"><span class="ink2">Want to explore first?</span><button class="btn" data-act="seed-demo">Load sample data</button></div>` : ''}
        </div>

        <div class="card" style="border-color:color-mix(in srgb, var(--bad) 35%, transparent)"><div class="card-head"><div><h3>Delete account</h3><div class="sub">Permanently removes your profile and every record. This cannot be undone.</div></div></div>
          <button class="btn danger" data-act="delete-account">${icon('trash')} Delete my account</button></div>
      </div>
    </div>`;
  };

  CW.viewMount.settings = (root) => {
    const showErr = (form, msg) => { const e = $(form, '.form-error'); e.textContent = msg; e.classList.remove('hidden'); };
    const pf = $(root, '#profile-form');
    $(pf, '#p_country').addEventListener('change', (e) => { const c = CW.meta.countries.find((x) => x.code === e.target.value); if (c) $(pf, '#p_cur').value = c.currency; });
    pf.addEventListener('submit', async (e) => {
      e.preventDefault(); $(pf, '.form-error').classList.add('hidden');
      try { await CW.api('PATCH', '/api/me', { name: pf.elements.name.value, country: pf.country.value, currency: pf.currency.value }); CW.toast('Profile saved'); await CW.reload(); } catch (x) { showErr(pf, x.message); }
    });
    const pw = $(root, '#pw-form');
    pw.addEventListener('submit', async (e) => {
      e.preventDefault(); $(pw, '.form-error').classList.add('hidden');
      try { await CW.api('POST', '/api/me/password', { current: pw.current.value, next: pw.next.value }); pw.reset(); CW.toast('Password updated'); } catch (x) { showErr(pw, x.message); }
    });
    const homeRate = S.data.rates[S.data.user.currency].rate;
    root.querySelectorAll('[data-rate]').forEach((inp) => inp.addEventListener('change', async () => {
      const entered = Number(inp.value);
      if (!(entered > 0)) return CW.toast('Enter a rate above zero', 'bad');
      try { await CW.api('PUT', '/api/me/rates', { currency: inp.dataset.rate, rate: homeRate / entered }); CW.toast(`${inp.dataset.rate} rate saved`); await CW.reload(); } catch (x) { CW.toast(x.message, 'bad'); }
    }));
    root.querySelectorAll('[data-reset-rate]').forEach((b) => b.addEventListener('click', async () => {
      try { await CW.api('PUT', '/api/me/rates', { currency: b.dataset.resetRate, rate: null }); CW.toast('Rate reset'); await CW.reload(); } catch (x) { CW.toast(x.message, 'bad'); }
    }));
  };

  CW.act['rates-all'] = () => { S.f.rates_all = !S.f.rates_all; CW.render(); };
  CW.act['delete-account'] = () => {
    CW.openForm({
      title: 'Delete your account', size: 'narrow', submitLabel: 'Delete everything',
      intro: 'This permanently deletes your profile, debts, investments, goals and history. Enter your password to confirm.',
      fields: [{ name: 'password', label: 'Password', type: 'password', required: true, maxlength: 200, autocomplete: 'current-password', full: true }],
      onSubmit: async (data) => { await CW.api('DELETE', '/api/me', { password: data.password }); location.href = '/'; },
    });
  };
})();
