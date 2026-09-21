(function () {
  'use strict';
  const { html, raw, icon, logo } = window.CW;
  const $ = (s) => document.querySelector(s);

  $('#logo').innerHTML = logo().s;
  $('#logo').style.display = 'inline-flex';
  $('#logo').firstChild.style.cssText = 'width:30px;height:30px';
  $('#year').textContent = new Date().getFullYear();
  const setThemeIcon = () => { $('#theme').innerHTML = icon(window.CW.isDark() ? 'sun' : 'moon').s; };
  setThemeIcon();
  $('#theme').addEventListener('click', () => { window.CW.toggleTheme(); setThemeIcon(); });

  $('#fine').innerHTML = html`<span>${icon('check')} Free to start</span><span>${icon('check')} No card needed</span><span>${icon('check')} Export or delete your data any time</span>`.s;

  const FEATS = [
    ['card', 'Every debt, one list', 'Credit cards, loans, mortgages, tuition and school fees, and personal debts. See balances, interest and due dates together.'],
    ['inbox', 'People who owe you', 'Track money you have lent, record repayments as they arrive, and get a ready-to-send reminder for anyone overdue.'],
    ['building', 'Investments of every kind', 'Land, apartments, farms, stocks, funds, crypto, gold, business stakes. Update values and see gain, return and yearly income.'],
    ['chart', 'Live net worth', 'Assets minus debts, in your home currency, with a history chart that shows the trend month by month.'],
    ['bolt', 'The true cost of your debt', 'See the interest you will pay at your current payments, and the exact date you would be debt-free.'],
    ['calc', 'Payoff planner', 'Compare avalanche and snowball strategies, add an extra monthly amount, and see how much interest and time you save.'],
    ['target', 'Savings goals and spending plans', 'Plan a wedding, school fees, a car or an emergency fund. Clearworth works out what to set aside each month.'],
    ['globe', 'Multi-currency, worldwide', 'Naira, pounds, dirhams, dollars and more. Mix currencies in one portfolio and let Clearworth do the conversion.'],
    ['shield', 'Private and secure', 'Passwords are hashed, every account is separate, and you can export or permanently delete your data at any time.'],
  ];
  $('#feats').innerHTML = FEATS.map(([i, t, d]) => html`<div class="feat"><div class="item-icon">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('');
  const TRUST = [
    ['lock', 'Hashed passwords', 'Passwords are stored with a slow, salted hash (scrypt). Nobody, including us, can read yours.'],
    ['user', 'Your data stays separate', 'Every record is tied to your account and can only be read by you.'],
    ['download', 'Export or delete', 'Download everything as JSON or CSV, or permanently delete your account and data in one step.'],
  ];
  $('#trust').innerHTML = TRUST.map(([i, t, d]) => html`<div class="feat"><div class="item-icon">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('');

  let bootPromise = window.CW.loadMeta().then((meta) => {
    const feature = ['NG', 'GB', 'AE', 'US', 'CA', 'GH', 'KE', 'ZA', 'IN', 'AU'];
    const names = feature.map((c) => meta.countries.find((x) => x.code === c).name);
    $('#band').innerHTML = html`<span>Built for</span>${names.map((n) => html`<span>${n}</span><span class="muted">·</span>`)}<span>and ${meta.countries.length - feature.length - 1} more</span>`.s;
    $('#country-list').innerHTML = meta.countries.filter((c) => c.code !== 'XX').map((c) => html`<span class="country"><b>${c.code}</b>${c.name}<small>${c.currency}</small></span>`).join('');
    return meta;
  }).catch(() => null);

  // ---------- auth modal ----------
  function guessCountry(meta) {
    const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
    return meta.countries.some((c) => c.code === region) ? region : 'NG';
  }

  async function openAuth(mode) {
    const meta = (await bootPromise) || (await window.CW.loadMeta());
    const isSignup = mode === 'signup';
    const country0 = guessCountry(meta);
    const currency0 = meta.countries.find((c) => c.code === country0).currency;
    const body = html`
      <div class="tabs-auth" role="tablist"><button type="button" role="tab" data-mode="signup" aria-selected="${String(isSignup)}">Create account</button><button type="button" role="tab" data-mode="login" aria-selected="${String(!isSignup)}">Log in</button></div>
      <form novalidate>
        <div class="form-error hidden" role="alert"></div>
        <div class="stack" style="gap:14px;margin-top:12px">
          <div class="field signup-only ${isSignup ? '' : 'hidden'}"><label for="a_name">Your name</label><input id="a_name" name="name" autocomplete="name" maxlength="80"></div>
          <div class="field"><label for="a_email">Email</label><input id="a_email" name="email" type="email" autocomplete="email" maxlength="200"></div>
          <div class="field"><label for="a_pw">Password</label><input id="a_pw" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" maxlength="200"><span class="hint signup-only ${isSignup ? '' : 'hidden'}">At least 8 characters.</span></div>
          <div class="form-grid signup-only ${isSignup ? '' : 'hidden'}">
            <div class="field"><label for="a_country">Country</label><select id="a_country" name="country">${window.CW.countryOptions().map(([c, n]) => html`<option value="${c}" ${c === country0 ? 'selected' : ''}>${n}</option>`)}</select></div>
            <div class="field"><label for="a_cur">Home currency</label><select id="a_cur" name="currency">${window.CW.currencyOptions(currency0).map(([c, n]) => html`<option value="${c}" ${c === currency0 ? 'selected' : ''}>${n}</option>`)}</select></div>
          </div>
          <label class="check signup-only ${isSignup ? '' : 'hidden'}"><input type="checkbox" name="demo" checked><span>Start with sample data so I can explore first (you can delete it later)</span></label>
          <button class="btn primary lg" type="submit" style="width:100%" id="a_submit">${isSignup ? 'Create my account' : 'Log in'}</button>
        </div>
      </form>`;
    window.CW.openModal({
      title: isSignup ? 'Start with Clearworth' : 'Welcome back', size: 'narrow', body,
      onMount: (m) => {
        const el = m.el, form = el.querySelector('form'), err = el.querySelector('.form-error');
        let current = mode;
        const setMode = (next) => {
          current = next;
          el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === next));
          el.querySelectorAll('.signup-only').forEach((x) => x.classList.toggle('hidden', next !== 'signup'));
          el.querySelector('#a_submit').textContent = next === 'signup' ? 'Create my account' : 'Log in';
          el.querySelector('#a_pw').autocomplete = next === 'signup' ? 'new-password' : 'current-password';
          el.querySelector('h2').textContent = next === 'signup' ? 'Start with Clearworth' : 'Welcome back';
          err.classList.add('hidden');
        };
        el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
        el.querySelector('#a_country').addEventListener('change', (e) => {
          const c = meta.countries.find((x) => x.code === e.target.value);
          if (c) el.querySelector('#a_cur').value = c.currency;
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          err.classList.add('hidden');
          const f = form.elements;
          const email = f.email.value.trim(), password = f.password.value;
          if (!email || !password) { err.textContent = 'Enter your email and password'; err.classList.remove('hidden'); return; }
          if (current === 'signup' && !f.name.value.trim()) { err.textContent = 'Please tell us your name'; err.classList.remove('hidden'); return; }
          const btn = el.querySelector('#a_submit');
          btn.disabled = true;
          window.CW.noRedirect = true;
          try {
            if (current === 'signup') {
              await window.CW.api('POST', '/api/auth/register', { name: f.name.value, email, password, country: f.country.value, currency: f.currency.value });
              if (f.demo.checked) { try { await window.CW.api('POST', '/api/demo', {}); } catch (x) { /* optional */ } }
            } else {
              await window.CW.api('POST', '/api/auth/login', { email, password });
            }
            location.href = '/app';
          } catch (x) {
            btn.disabled = false;
            err.textContent = x.message; err.classList.remove('hidden');
          }
        });
      },
      onClose: () => { if (location.hash === '#login' || location.hash === '#signup') history.replaceState(null, '', location.pathname); },
    });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-auth]');
    if (a) { e.preventDefault(); openAuth(a.dataset.auth); }
  });
  const fromHash = () => { if (location.hash === '#login') openAuth('login'); else if (location.hash === '#signup') openAuth('signup'); };
  window.addEventListener('hashchange', fromHash);

  // if already signed in, offer a direct way back in
  window.CW.noRedirect = true;
  window.CW.api('GET', '/api/session').then((s) => {
    if (s.user) {
      const l = $('#nav-login'), g = $('#nav-signup');
      l.remove();
      g.textContent = 'Open dashboard'; g.href = '/app'; g.removeAttribute('data-auth');
      document.querySelectorAll('.hero [data-auth="signup"], .cta-card [data-auth="signup"]').forEach((b) => { b.textContent = 'Open your dashboard'; b.href = '/app'; b.removeAttribute('data-auth'); });
    } else fromHash();
  }).catch(fromHash);
})();
