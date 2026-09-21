/* Shared helpers: safe HTML templating, icons, API client, formatting, modal, toast, form builder. */
(function () {
  'use strict';
  const CW = (window.CW = window.CW || {});

  // ---------- safe html templates: interpolated values are escaped unless wrapped in raw()/html`` ----------
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const part = (v) => (v == null || v === false || v === true ? '' : v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join('') : esc(v));
  const html = (strings, ...vals) => new Safe(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));
  const raw = (s) => new Safe(s);
  Object.assign(CW, { html, raw, esc, Safe });

  // ---------- icons ----------
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2 .7 3.5 2.6 3.5 5.5"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
    building: '<rect x="4" y="3" width="10" height="18" rx="1"/><path d="M14 9h6v12h-6M8 7h2M8 11h2M8 15h2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 102.5-6"/><path d="M3 4v4h4M12 8v4l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z"/>',
    logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
    land: '<path d="M3 19l5-9 4 6 3-4 6 7z"/><circle cx="17" cy="6" r="2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 010 3.6h-3a1.8 1.8 0 000 3.6h4.3"/>',
    trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    car: '<path d="M4 14l1.5-5h13L20 14v4h-3v-2H7v2H4z"/><path d="M4 14h16"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
  };
  const icon = (name, cls = 'ic') => raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
  const logo = () => raw('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#256abf"/><path d="M8 21.5c3.2 0 4.6-2.4 6-5.2s2.8-5.3 6-5.3h4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24.5" cy="11" r="2.6" fill="#fff"/><path d="M8 25.5h16" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/></svg>');
  const TYPE_ICON = {
    credit_card: 'card', loan: 'doc', mortgage: 'home', tuition: 'school', person: 'user', other: 'doc',
    land: 'land', real_estate: 'building', agriculture: 'leaf', stocks: 'chart', funds: 'chart', bonds: 'doc', crypto: 'coin', business: 'brief',
    gold: 'coin', savings: 'coin', pension: 'shield', vehicle: 'car',
  };
  Object.assign(CW, { icon, logo, TYPE_ICON });

  // ---------- API ----------
  async function api(method, url, body) {
    const res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'clearworth' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    if (res.status === 401 && !url.startsWith('/api/auth/') && !CW.noRedirect) { location.href = '/#login'; throw new Error('Please sign in'); }
    if (!res.ok) { const e = new Error((data && data.error) || 'Something went wrong'); e.field = data && data.field; e.status = res.status; throw e; }
    return data;
  }
  CW.api = api;

  // ---------- formatting ----------
  CW.locale = 'en-US';
  const nfCache = {};
  function nf(cur, digits) {
    const k = cur + digits;
    if (!nfCache[k]) {
      try { nfCache[k] = new Intl.NumberFormat(CW.locale, { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }); }
      catch { nfCache[k] = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }); }
    }
    return nfCache[k];
  }
  // Whole units for big numbers, cents for small ones.
  CW.fmt = (n, cur, forceCents) => {
    n = Number(n) || 0;
    const zeroDec = ['JPY', 'UGX', 'RWF', 'XOF', 'XAF'].includes(cur);
    const digits = zeroDec ? 0 : forceCents || Math.abs(n) < 1000 ? 2 : 0;
    return nf(cur, digits).format(n);
  };
  CW.home = () => CW.user.currency;
  CW.fmtHome = (n, cents) => CW.fmt(n, CW.home(), cents);
  CW.compact = (n, cur) => {
    try { return new Intl.NumberFormat(CW.locale, { style: 'currency', currency: cur || CW.home(), notation: 'compact', maximumFractionDigits: 1 }).format(n); }
    catch { return String(Math.round(n)); }
  };
  CW.pct = (n, d = 1) => (n == null ? '–' : `${Number(n).toFixed(d).replace(/\.0+$/, '')}%`);
  const parseDay = (iso) => new Date(iso + 'T12:00:00');
  CW.fmtDate = (iso) => (iso ? parseDay(iso).toLocaleDateString(CW.locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  CW.fmtMonth = (iso) => parseDay(iso).toLocaleDateString(CW.locale, { month: 'short', year: '2-digit' });
  CW.todayIso = () => new Date().toISOString().slice(0, 10);
  CW.daysUntil = (iso) => Math.round((parseDay(iso) - parseDay(CW.todayIso())) / 86400000);
  CW.dueBadge = (iso, doneLabel) => {
    if (!iso) return '';
    const d = CW.daysUntil(iso);
    if (d < 0) return html`<span class="badge bad">${icon('alert')} Overdue ${-d}d</span>`;
    if (d === 0) return html`<span class="badge warn">${icon('clock')} Due today</span>`;
    if (d <= 7) return html`<span class="badge warn">${icon('clock')} Due in ${d}d</span>`;
    return html`<span class="badge">${icon('clock')} ${CW.fmtDate(iso)}</span>`;
  };
  CW.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0].toUpperCase()).join('');

  CW.currencyOptions = (first) => {
    const codes = Object.keys(CW.meta.currencies);
    codes.sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
    return codes.map((c) => [c, `${c} · ${CW.meta.currencies[c].name}`]);
  };
  CW.countryOptions = () => {
    const pri = ['NG', 'GB', 'AE', 'US'];
    const list = CW.meta.countries.filter((c) => c.code !== 'XX');
    const top = pri.map((p) => list.find((c) => c.code === p));
    const rest = list.filter((c) => !pri.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name));
    return [...top, ...rest, CW.meta.countries.find((c) => c.code === 'XX')].map((c) => [c.code, c.name]);
  };
  CW.loadMeta = async () => { CW.meta = await api('GET', '/api/meta'); return CW.meta; };

  // ---------- toast ----------
  CW.toast = (msg, kind) => {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 2800);
  };

  // ---------- modal ----------
  CW.openModal = ({ title, body, size = '', onMount, onClose }) => {
    const opener = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="modal ${esc(size)}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Close">${icon('x')}</button></div><div class="modal-body">${part(body)}</div></div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); if (opener && opener.focus) opener.focus(); if (onClose) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    const first = overlay.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => { if (!overlay.contains(document.activeElement) || document.activeElement === overlay) first.focus(); }, 30);
    const modal = { el: overlay, close };
    if (onMount) onMount(modal);
    return modal;
  };

  CW.confirm = ({ title, message, confirmLabel = 'Confirm', danger = false }) => new Promise((resolve) => {
    let done = false;
    const m = CW.openModal({
      title, size: 'narrow',
      body: html`<p class="ink2">${message}</p><div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${confirmLabel}</button></div>`,
      onMount: (mm) => mm.el.querySelector('[data-ok]').addEventListener('click', () => { done = true; mm.close(); resolve(true); }),
      onClose: () => { if (!done) resolve(false); },
    });
    return m;
  });

  // ---------- form builder ----------
  function fieldHtml(f, v) {
    const val = v == null ? '' : v;
    const id = 'f_' + f.name;
    let control;
    if (f.type === 'select') {
      control = html`<select id="${id}" name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map(([o, l]) => html`<option value="${o}" ${String(o) === String(val) ? 'selected' : ''}>${l}</option>`)}</select>`;
    } else if (f.type === 'textarea') {
      control = html`<textarea id="${id}" name="${f.name}" maxlength="${f.maxlength || 1000}" placeholder="${f.placeholder || ''}">${val}</textarea>`;
    } else if (f.type === 'money' || f.type === 'percent') {
      control = html`<input id="${id}" name="${f.name}" type="number" inputmode="decimal" step="any" min="${f.min ?? 0}" value="${val}" placeholder="${f.placeholder || '0.00'}" ${f.required ? 'required' : ''}>`;
    } else if (f.type === 'date') {
      control = html`<input id="${id}" name="${f.name}" type="date" value="${val}" ${f.required ? 'required' : ''}>`;
    } else {
      control = html`<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${val}" maxlength="${f.maxlength || 100}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} ${f.autocomplete ? raw(`autocomplete="${esc(f.autocomplete)}"`) : ''}>`;
    }
    return html`<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}${f.required ? ' *' : ''}</label>${control}${f.hint ? html`<span class="hint">${f.hint}</span>` : ''}<span class="err" data-err="${f.name}"></span></div>`;
  }
  CW.fieldHtml = fieldHtml;

  CW.openForm = ({ title, fields, values = {}, submitLabel = 'Save', size = '', intro, onSubmit, extraFoot }) => {
    const body = html`<form novalidate>${intro ? html`<p class="ink2" style="margin-bottom:14px">${intro}</p>` : ''}<div class="form-error hidden" role="alert"></div><div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name]))}</div><div class="modal-foot">${extraFoot || ''}<button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${submitLabel}</button></div></form>`;
    return CW.openModal({
      title, size, body,
      onMount: (m) => {
        const form = m.el.querySelector('form');
        const errBox = m.el.querySelector('.form-error');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          errBox.classList.add('hidden');
          m.el.querySelectorAll('[data-err]').forEach((s) => (s.textContent = ''));
          const data = {};
          for (const f of fields) {
            const el = form.elements[f.name];
            if (!el) continue;
            data[f.name] = el.value;
          }
          for (const f of fields) if (f.required && String(data[f.name]).trim() === '') { const s = m.el.querySelector(`[data-err="${f.name}"]`); if (s) s.textContent = `${f.label} is required`; form.elements[f.name].focus(); return; }
          const btn = form.querySelector('[type=submit]');
          btn.disabled = true;
          try {
            await onSubmit(data, m);
          } catch (err) {
            btn.disabled = false;
            const s = err.field && m.el.querySelector(`[data-err="${err.field}"]`);
            if (s) s.textContent = err.message; else { errBox.textContent = err.message; errBox.classList.remove('hidden'); }
          }
        });
      },
    });
  };

  // theme toggle used on landing + app
  CW.toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('cw_theme', next); } catch (e) { /* ignore */ }
    document.dispatchEvent(new Event('themechange'));
  };
  CW.isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
})();
