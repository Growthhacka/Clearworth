/* App shell: state, routing, navigation, generic actions (add / edit / delete / adjust / history). */
(function () {
  'use strict';
  const CW = window.CW;
  const { html, raw, icon, logo, fmt, fmtHome } = CW;
  const $ = (s) => document.querySelector(s);

  const S = (CW.S = { data: null, route: 'dashboard', f: { debts_status: 'active', debts_type: 'all', owed_status: 'open', inv_type: 'all', nw_range: '6m', planner_tab: 'payoff' } });
  CW.views = {}; CW.viewMount = {}; CW.act = {};

  const ROUTES = [
    { id: 'dashboard', title: 'Dashboard', icon: 'home', group: 'Overview' },
    { id: 'networth', title: 'Net worth', icon: 'chart' },
    { id: 'cards', title: 'Cards & loans', icon: 'card', group: 'What I owe', count: () => CW.debtsIn('cards').filter((d) => d.balance > 0).length },
    { id: 'tuition', title: 'Tuition & school fees', icon: 'school', count: () => CW.debtsIn('tuition').filter((d) => d.balance > 0).length },
    { id: 'people', title: 'People & other debts', icon: 'people', count: () => CW.debtsIn('people').filter((d) => d.balance > 0).length },
    { id: 'owed', title: 'Owed to me', icon: 'inbox', group: 'What I own', count: () => S.data.receivables.filter((r) => r.balance > 0).length },
    { id: 'investments', title: 'Investments', icon: 'building', count: () => S.data.investments.length },
    { id: 'goals', title: 'Goals & spending', icon: 'target', group: 'Plan ahead', count: () => S.data.goals.filter((g) => !g.achieved).length },
    { id: 'planner', title: 'Planner & calculators', icon: 'calc' },
    { id: 'settings', title: 'Settings', icon: 'settings', group: 'Account' },
  ];
  CW.ROUTES = ROUTES;
  CW.debtsIn = (portal) => S.data.debts.filter((d) => d.portal === portal);

  // ---------- data ----------
  CW.load = async () => {
    const d = await CW.api('GET', '/api/bootstrap');
    S.data = d; CW.user = d.user;
    const c = CW.meta.countries.find((x) => x.code === d.user.country);
    CW.locale = (c && c.locale) || 'en-US';
    return d;
  };
  CW.reload = async () => {
    const y = window.scrollY;
    await CW.load();
    renderShell();
    render();
    window.scrollTo(0, y);
  };
  CW.set = (key, val) => { S.f[key] = val; const y = window.scrollY; render(); window.scrollTo(0, y); };

  // ---------- shell ----------
  function renderNav() {
    let lastGroup = '';
    $('#sidebar').innerHTML = html`
      <a class="brand" href="#/dashboard">${logo()}Clearworth</a>
      <nav class="nav">${ROUTES.map((r) => {
        const head = r.group && r.group !== lastGroup ? html`<div class="nav-group">${r.group}</div>` : '';
        if (r.group) lastGroup = r.group;
        const n = r.count ? r.count() : 0;
        return html`${head}<a href="#/${r.id}" ${S.route === r.id ? raw('aria-current="page"') : ''}>${icon(r.icon)}<span>${r.title}</span>${n ? html`<span class="count">${n}</span>` : ''}</a>`;
      })}</nav>
      <div class="side-foot"><a class="chip" href="#/settings" title="Change home currency">${icon('globe', 'ic')}&nbsp;Home currency: ${CW.home()}</a></div>`.s;
  }

  function renderTop() {
    const u = CW.user;
    $('#topbar').innerHTML = html`
      <button class="btn ghost icon menu-btn" data-act="open-nav" aria-label="Open menu">${icon('menu')}</button>
      <div class="grow"></div>
      <div class="menu" id="add-menu">
        <button class="btn primary sm" data-act="menu" data-target="add-menu" aria-haspopup="true">${icon('plus')} Add</button>
        <div class="menu-panel hidden">
          <button data-act="add" data-res="debts" data-portal="cards">${icon('card')} Card, loan or mortgage</button>
          <button data-act="add" data-res="debts" data-portal="tuition">${icon('school')} Tuition or school fees</button>
          <button data-act="add" data-res="debts" data-portal="people">${icon('people')} Money I owe someone</button>
          <button data-act="add" data-res="receivables">${icon('inbox')} Someone owes me</button>
          <button data-act="add" data-res="investments">${icon('building')} Investment</button>
          <button data-act="add" data-res="goals">${icon('target')} Goal or spending plan</button>
        </div>
      </div>
      <button class="btn ghost icon" data-act="theme" aria-label="Toggle dark mode">${icon(CW.isDark() ? 'sun' : 'moon')}</button>
      <div class="menu" id="user-menu">
        <button class="btn ghost icon" data-act="menu" data-target="user-menu" aria-label="Account menu" aria-haspopup="true"><span class="avatar">${CW.initials(u.name)}</span></button>
        <div class="menu-panel hidden">
          <div style="padding:10px 12px"><b>${u.name}</b><div class="muted ellipsis" style="font-size:13px">${u.email}</div></div>
          <a href="#/settings">${icon('settings')} Settings</a>
          <button data-act="logout">${icon('logout')} Sign out</button>
        </div>
      </div>`.s;
  }
  function renderShell() { renderNav(); renderTop(); }

  function render() {
    const view = CW.views[S.route] || CW.views.dashboard;
    const root = $('#view');
    root.innerHTML = view().s;
    if (window.Charts) window.Charts.mount(root);
    if (CW.viewMount[S.route]) CW.viewMount[S.route](root);
    const r = ROUTES.find((x) => x.id === S.route);
    document.title = `${r ? r.title : 'Clearworth'} · Clearworth`;
    renderNav();
  }
  CW.render = render;

  function route() {
    const id = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    S.route = ROUTES.some((r) => r.id === id) ? id : 'dashboard';
    document.body.classList.remove('nav-open');
    render();
    window.scrollTo(0, 0);
    $('#view').focus({ preventScroll: true });
  }
  CW.startRouter = () => { window.addEventListener('hashchange', route); route(); renderTop(); };
  document.addEventListener('themechange', () => { renderTop(); });

  // ---------- generic delegated actions ----------
  document.addEventListener('click', (e) => {
    const openMenus = document.querySelectorAll('.menu-panel:not(.hidden)');
    const el = e.target.closest('[data-act]');
    if (!e.target.closest('.menu')) openMenus.forEach((m) => m.classList.add('hidden'));
    if (!el) return;
    const fn = CW.act[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'A' || el.dataset.act) e.preventDefault();
    if (el.closest('.menu-panel') && el.dataset.act !== 'menu') el.closest('.menu-panel').classList.add('hidden');
    fn(el.dataset, el, e);
  });

  Object.assign(CW.act, {
    'open-nav': () => document.body.classList.add('nav-open'),
    'close-nav': () => document.body.classList.remove('nav-open'),
    menu: (d, el) => { const p = document.getElementById(d.target).querySelector('.menu-panel'); const was = p.classList.contains('hidden'); document.querySelectorAll('.menu-panel').forEach((m) => m.classList.add('hidden')); p.classList.toggle('hidden', !was); },
    theme: () => { CW.toggleTheme(); },
    logout: async () => { try { await CW.api('POST', '/api/auth/logout', {}); } catch (x) { /* ignore */ } location.href = '/'; },
    filter: (d) => CW.set(d.key, d.value),
    goto: (d) => { location.hash = '#/' + d.to; },
    'seed-demo': async () => { try { await CW.api('POST', '/api/demo', {}); CW.toast('Sample data added'); await CW.reload(); } catch (x) { CW.toast(x.message, 'bad'); } },
  });

  // ---------- resource forms ----------
  const item = (res, id) => S.data[res].find((x) => String(x.id) === String(id));
  CW.item = item;

  CW.fieldsFor = (res, opts = {}) => {
    const home = CW.home();
    const curOpts = CW.currencyOptions(home);
    const T = CW.meta;
    if (res === 'debts') {
      const portal = opts.portal || 'cards';
      const types = Object.entries(T.debt_types).filter(([, v]) => v.portal === portal).map(([k, v]) => [k, v.label]);
      const who = { cards: 'Lender or bank', tuition: 'School or institution', people: 'Who do you owe?' }[portal];
      return [
        { name: 'name', label: portal === 'tuition' ? 'What is it for?' : 'Name', required: true, placeholder: { cards: 'e.g. Barclaycard, Car loan', tuition: 'e.g. Term 2 fees', people: 'e.g. Borrowed from Uncle Tunde' }[portal], full: true },
        { name: 'type', label: 'Type', type: 'select', options: types, required: true },
        { name: 'counterparty', label: who, placeholder: '' },
        ...(portal === 'tuition' ? [{ name: 'for_whom', label: 'Student', placeholder: 'e.g. My daughter' }] : []),
        { name: 'currency', label: 'Currency', type: 'select', options: curOpts, required: true },
        { name: 'balance', label: 'Amount owing now', type: 'money', required: true },
        { name: 'original_amount', label: 'Original amount', type: 'money', hint: 'Optional. Used to show how much you have paid off.' },
        { name: 'interest_rate', label: 'Interest rate (% per year)', type: 'percent', hint: 'Use 0 if none.' },
        { name: 'min_payment', label: 'Monthly payment', type: 'money', hint: 'Used to work out your debt-free date.' },
        ...(portal === 'cards' ? [{ name: 'credit_limit', label: 'Credit limit (cards)', type: 'money' }] : []),
        { name: 'due_date', label: 'Next due date', type: 'date' },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ];
    }
    if (res === 'receivables') return [
      { name: 'name', label: 'Who owes you?', required: true, full: true, placeholder: 'e.g. My brother, Acme Ltd' },
      { name: 'reason', label: 'What for?', placeholder: 'e.g. Emergency loan, unpaid invoice' },
      { name: 'contact', label: 'Contact (optional)', placeholder: 'Phone or email' },
      { name: 'currency', label: 'Currency', type: 'select', options: curOpts, required: true },
      { name: 'balance', label: 'Amount owed to you now', type: 'money', required: true },
      { name: 'original_amount', label: 'Original amount', type: 'money' },
      { name: 'due_date', label: 'Expected repayment date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ];
    if (res === 'investments') return [
      { name: 'name', label: 'Name', required: true, full: true, placeholder: 'e.g. 600sqm plot in Lekki, 2-bed flat in Dubai Marina' },
      { name: 'type', label: 'Type', type: 'select', options: Object.entries(T.investment_types), required: true },
      { name: 'currency', label: 'Currency', type: 'select', options: curOpts, required: true },
      { name: 'amount_invested', label: 'Amount you invested', type: 'money', required: true, hint: 'What you paid in total.' },
      { name: 'current_value', label: 'Value today', type: 'money', required: true, hint: 'Your best estimate of the market value.' },
      { name: 'acquired_date', label: 'Date acquired', type: 'date' },
      { name: 'annual_income', label: 'Income per year', type: 'money', hint: 'Rent, dividends, harvest sales.' },
      { name: 'location', label: 'Location', full: true, placeholder: 'City, area or platform' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ];
    return [
      { name: 'name', label: 'Goal name', required: true, full: true, placeholder: 'e.g. Emergency fund, Wedding, New car, School fees 2027' },
      { name: 'kind', label: 'Type', type: 'select', options: Object.entries(T.goal_kinds), required: true },
      { name: 'priority', label: 'Priority', type: 'select', options: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
      { name: 'currency', label: 'Currency', type: 'select', options: curOpts, required: true },
      { name: 'target_amount', label: 'Target amount', type: 'money', required: true },
      { name: 'saved_amount', label: 'Saved so far', type: 'money' },
      { name: 'target_date', label: 'Target date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ];
  };

  const TITLES = { debts: 'debt', receivables: 'amount owed to you', investments: 'investment', goals: 'goal' };
  const portalOf = (row) => (row && row.portal) || 'cards';

  CW.act.add = (d) => {
    const res = d.res;
    const defaults = { debts: { type: { cards: 'credit_card', tuition: 'tuition', people: 'person' }[d.portal || 'cards'], interest_rate: 0 }, receivables: {}, investments: { type: 'real_estate' }, goals: { kind: 'savings', priority: 'medium' } }[res];
    CW.openForm({
      title: { debts: { cards: 'Add a card or loan', tuition: 'Add tuition or school fees', people: 'Add money you owe' }[d.portal || 'cards'], receivables: 'Add money owed to you', investments: 'Add an investment', goals: 'Add a goal or spending plan' }[res],
      fields: CW.fieldsFor(res, { portal: d.portal }), size: 'wide',
      values: { currency: CW.home(), ...defaults },
      submitLabel: 'Add',
      onSubmit: async (data, m) => { await CW.api('POST', `/api/${res}`, data); m.close(); CW.toast('Added'); await CW.reload(); },
    });
  };

  CW.act.edit = (d) => {
    const row = item(d.res, d.id);
    if (!row) return;
    CW.openForm({
      title: 'Edit ' + (TITLES[d.res] || 'item'), fields: CW.fieldsFor(d.res, { portal: portalOf(row) }), values: row, size: 'wide', submitLabel: 'Save changes',
      onSubmit: async (data, m) => { await CW.api('PUT', `/api/${d.res}/${d.id}`, data); m.close(); CW.toast('Saved'); await CW.reload(); },
    });
  };

  CW.act.del = async (d) => {
    const row = item(d.res, d.id);
    if (!row) return;
    const ok = await CW.confirm({ title: 'Delete this?', message: `“${row.name}” and its history will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await CW.api('DELETE', `/api/${d.res}/${d.id}`); CW.toast('Deleted'); await CW.reload(); } catch (x) { CW.toast(x.message, 'bad'); }
  };

  // add to / subtract from a balance
  const ADJUST = {
    debts: { minus: ['Record a payment', 'Amount paid', 'Payment recorded', 'Reduces what you owe.'], plus: ['Add to this debt', 'Amount added', 'Debt increased', 'Use when you borrow more or are charged.'] },
    receivables: { minus: ['Record a repayment', 'Amount received', 'Repayment recorded', 'Reduces what they owe you.'], plus: ['Lend more', 'Amount lent', 'Added', 'Increases what they owe you.'] },
    goals: { plus: ['Add funds', 'Amount to add', 'Funds added', 'Moves money towards this goal.'], minus: ['Withdraw funds', 'Amount to withdraw', 'Withdrawn', 'Takes money out of this goal.'] },
    investments: { plus: ['Add funds', 'Amount to add', 'Funds added', 'Increases both the amount invested and the value.'], minus: ['Withdraw or sell part', 'Amount withdrawn', 'Withdrawn', 'Reduces both the amount invested and the value.'] },
  };
  CW.act.adjust = (d) => {
    const row = item(d.res, d.id);
    const cfg = ADJUST[d.res][d.mode];
    const sign = d.mode === 'plus' ? 1 : -1;
    const balanceKey = { debts: 'balance', receivables: 'balance', goals: 'saved_amount', investments: 'current_value' }[d.res];
    const current = row[balanceKey];
    const m = CW.openForm({
      title: cfg[0], size: 'narrow', submitLabel: 'Save',
      intro: `${row.name}: currently ${fmt(current, row.currency, 2)}. ${cfg[3]}`,
      fields: [
        { name: 'amount', label: `${cfg[1]} (${row.currency})`, type: 'money', required: true, min: 0.01 },
        { name: 'day', label: 'Date', type: 'date' },
        { name: 'note', label: 'Note (optional)', full: true, maxlength: 200 },
      ],
      values: { day: CW.todayIso() },
      extraFoot: sign < 0 && d.res !== 'goals' ? html`<button type="button" class="btn" data-fill="${current}" style="margin-right:auto">Full amount</button>` : '',
      onSubmit: async (data, mm) => {
        const amt = Number(data.amount);
        if (!(amt > 0)) { const e = new Error('Enter an amount above zero'); e.field = 'amount'; throw e; }
        await CW.api('POST', `/api/${d.res}/${d.id}/adjust`, { delta: sign * amt, day: data.day || undefined, note: data.note });
        mm.close(); CW.toast(cfg[2]); await CW.reload();
      },
    });
    const fill = m.el.querySelector('[data-fill]');
    if (fill) fill.addEventListener('click', () => { m.el.querySelector('[name=amount]').value = fill.dataset.fill; });
  };

  CW.act.value = (d) => {
    const row = item('investments', d.id);
    CW.openForm({
      title: 'Update value', size: 'narrow', submitLabel: 'Update',
      intro: `${row.name}: last value ${fmt(row.current_value, row.currency, 2)}. Each update is saved so you can see the trend.`,
      fields: [{ name: 'value', label: `New value (${row.currency})`, type: 'money', required: true }, { name: 'day', label: 'As of', type: 'date' }],
      values: { value: row.current_value, day: CW.todayIso() },
      onSubmit: async (data, m) => { await CW.api('POST', `/api/investments/${d.id}/valuation`, { value: data.value, day: data.day || undefined }); m.close(); CW.toast('Value updated'); await CW.reload(); },
    });
  };

  CW.act.history = async (d) => {
    const row = item(d.res, d.id);
    let h;
    try { h = await CW.api('GET', `/api/${d.res}/${d.id}/history`); } catch (x) { return CW.toast(x.message, 'bad'); }
    const verb = { debts: ['Payment', 'Added'], receivables: ['Repaid', 'Lent'], goals: ['Withdrawn', 'Added'], investments: ['Withdrawn', 'Added'] }[d.res];
    const txs = h.transactions.map((t) => html`<tr><td>${CW.fmtDate(t.day)}</td><td>${t.note || ''}</td><td class="r"><b class="${(d.res === 'debts' ? t.delta < 0 : t.delta > 0) ? 'delta good' : 'delta'}">${t.delta > 0 ? '+' : '−'}${fmt(Math.abs(t.delta), row.currency, 2)}</b></td><td class="r"><button class="btn sm ghost icon" data-undo="${t.id}" aria-label="Undo this entry" title="Undo">${icon('x')}</button></td></tr>`);
    let chart = '';
    if (d.res === 'investments' && h.valuations.length > 1) {
      const pts = h.valuations.map((v) => ({ x: Date.parse(v.day + 'T12:00:00'), y: v.value }));
      chart = html`<h3 style="margin:4px 0 8px;font-size:15px">Value over time</h3>${window.Charts.line([{ name: 'Value', color: 'var(--s3)', points: pts }], { yFmt: (y) => CW.compact(y, row.currency), tipFmt: (y) => fmt(y, row.currency), tipTitle: (x) => CW.fmtDate(new Date(x).toISOString().slice(0, 10)), xTick: (x) => CW.fmtMonth(new Date(x).toISOString().slice(0, 10)), height: 200, width: 640, label: 'Investment value over time' })}`;
    }
    const m = CW.openModal({
      title: `History: ${row.name}`, size: 'wide',
      body: html`${chart}<h3 style="margin:16px 0 4px;font-size:15px">${d.res === 'debts' ? 'Payments and charges' : d.res === 'receivables' ? 'Repayments and loans' : 'Contributions'}</h3>${h.transactions.length ? html`<div class="scroll-x"><table class="tbl"><thead><tr><th>Date</th><th>Note</th><th class="r">Amount</th><th></th></tr></thead><tbody>${txs}</tbody></table></div>` : html`<p class="muted" style="margin-top:8px">Nothing recorded yet. Use the payment and add buttons on the card to build a history.</p>`}<div class="modal-foot"><button class="btn" data-close>Close</button></div>`,
    });
    if (window.Charts) window.Charts.mount(m.el);
    m.el.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await CW.confirm({ title: 'Undo this entry?', message: 'The balance will go back to what it was before this entry.', confirmLabel: 'Undo entry' });
      if (!ok) return;
      try { await CW.api('DELETE', `/api/transactions/${b.dataset.undo}`); m.close(); CW.toast('Entry undone'); await CW.reload(); } catch (x) { CW.toast(x.message, 'bad'); }
    }));
  };
})();
