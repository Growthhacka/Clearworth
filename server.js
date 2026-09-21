'use strict';
/*
 * Clearworth server: zero-dependency Node (>= 22.13) app.
 *   node server.js            -> http://localhost:3000
 * Env: PORT, DATA_DIR, TRUST_PROXY=1 (behind a proxy), COOKIE_SECURE=true, FX_REFRESH=off
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { db } = require('./lib/db');
const auth = require('./lib/auth');
const fin = require('./lib/finance');
const { clean, SPECS, ValidationError, isDate } = require('./lib/validate');
const { COUNTRIES, CURRENCIES, DEBT_TYPES, INVESTMENT_TYPES, GOAL_KINDS } = require('./lib/countries');
const { seedDemo } = require('./lib/demo');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const RESOURCES = ['debts', 'receivables', 'investments', 'goals'];

// ---------------------------------------------------------------- helpers
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}
function isSecure(req) {
  return process.env.COOKIE_SECURE === 'true' || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 100 * 1024) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed);
      } catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// tiny router
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false });
}

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;      // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function cleanEmail(e) {
  const v = String(e || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 200) throw new ValidationError('Enter a valid email address', 'email');
  return v;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, country: u.country, currency: u.currency, created_at: u.created_at });

function bootstrap(user) {
  const data = fin.loadAll(user.id, user);
  const summary = fin.summarise(data, user);
  db.prepare(`INSERT INTO snapshots (user_id, day, assets, debts, net_worth) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, day) DO UPDATE SET assets = excluded.assets, debts = excluded.debts, net_worth = excluded.net_worth`)
    .run(user.id, fin.today(), summary.assets.total, summary.debts.total, summary.net_worth);
  const snapshots = db.prepare('SELECT day, assets, debts, net_worth FROM snapshots WHERE user_id = ? ORDER BY day').all(user.id);
  return {
    user: publicUser(user), rates: data.rates, summary, snapshots,
    debts: data.debts, receivables: data.receivables, investments: data.investments, goals: data.goals,
  };
}

// ---------------------------------------------------------------- public routes
route('GET', '/api/meta', () => ({
  status: 200,
  body: {
    countries: COUNTRIES,
    currencies: Object.fromEntries(Object.entries(CURRENCIES).map(([k, v]) => [k, { name: v.name, symbol: v.symbol }])),
    debt_types: DEBT_TYPES, investment_types: INVESTMENT_TYPES, goal_kinds: GOAL_KINDS,
  },
}), { auth: false });

route('GET', '/api/session', ({ req }) => {
  const u = auth.userFromRequest(req);
  return { status: 200, body: { user: u ? publicUser(u) : null } };
}, { auth: false });

const regHits = new Map();
route('POST', '/api/auth/register', async ({ body, req, res }) => {
  const ip = clientIp(req);
  const hits = (regHits.get(ip) || []).filter((t) => Date.now() - t < 3600000);
  if (hits.length >= 10) throw new HttpError(429, 'Too many sign-ups from this network. Please try again later.');

  const name = clean({ name: { type: 'text', required: true, max: 80, label: 'Name' } }, body).name;
  const email = cleanEmail(body.email);
  const problem = auth.passwordProblem(body.password);
  if (problem) throw new ValidationError(problem, 'password');
  const country = COUNTRIES.find((c) => c.code === body.country) || COUNTRIES.find((c) => c.code === 'XX');
  const currency = CURRENCIES[String(body.currency || '').toUpperCase()] ? String(body.currency).toUpperCase() : country.currency;

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  const hash = await auth.hashPassword(body.password);
  let id;
  try {
    id = Number(db.prepare('INSERT INTO users (name, email, password_hash, country, currency) VALUES (?, ?, ?, ?, ?)').run(name, email, hash, country.code, currency).lastInsertRowid);
  } catch { throw new HttpError(409, 'An account with this email already exists. Try signing in.'); }
  hits.push(Date.now()); regHits.set(ip, hits);

  const { token, maxAge } = auth.createSession(id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return { status: 201, body: { user: publicUser(user) }, headers: { 'Set-Cookie': auth.cookieHeader(token, maxAge, isSecure(req)) } };
}, { auth: false });

route('POST', '/api/auth/login', async ({ body, req }) => {
  const ip = clientIp(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (auth.isLocked(ip, email)) throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  let ok = false;
  if (row) ok = await auth.verifyPassword(password, row.password_hash);
  else await auth.burnTime(password);
  if (!ok) { auth.recordFail(ip, email); throw new HttpError(401, 'Incorrect email or password'); }
  auth.clearFails(ip, email);
  const { token, maxAge } = auth.createSession(row.id);
  return { status: 200, body: { user: publicUser(row) }, headers: { 'Set-Cookie': auth.cookieHeader(token, maxAge, isSecure(req)) } };
}, { auth: false });

route('POST', '/api/auth/logout', ({ req }) => {
  auth.destroySession(req);
  return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': auth.cookieHeader('', 0, isSecure(req)) } };
}, { auth: false });

// ---------------------------------------------------------------- account
route('GET', '/api/bootstrap', ({ user }) => ({ status: 200, body: bootstrap(user) }));

route('PATCH', '/api/me', ({ user, body }) => {
  const name = body.name !== undefined ? clean({ name: { type: 'text', required: true, max: 80, label: 'Name' } }, body).name : user.name;
  const country = body.country !== undefined ? (COUNTRIES.find((c) => c.code === body.country) || null) : { code: user.country };
  if (!country) throw new ValidationError('Choose a valid country', 'country');
  let currency = user.currency;
  if (body.currency !== undefined) {
    currency = String(body.currency).toUpperCase();
    if (!CURRENCIES[currency]) throw new ValidationError('Choose a supported currency', 'currency');
  }
  if (currency !== user.currency) {
    // keep history meaningful: re-express past snapshots in the new home currency
    const rates = fin.effectiveRates(user.id);
    const factor = rates[currency].rate / rates[user.currency].rate;
    db.prepare('UPDATE snapshots SET assets = ROUND(assets * ?, 2), debts = ROUND(debts * ?, 2), net_worth = ROUND(net_worth * ?, 2) WHERE user_id = ?')
      .run(factor, factor, factor, user.id);
  }
  db.prepare('UPDATE users SET name = ?, country = ?, currency = ? WHERE id = ?').run(name, country.code, currency, user.id);
  return { status: 200, body: { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) } };
});

route('POST', '/api/me/password', async ({ user, body, req }) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
  if (!(await auth.verifyPassword(String(body.current || ''), row.password_hash))) throw new HttpError(403, 'Your current password is incorrect');
  const problem = auth.passwordProblem(body.next);
  if (problem) throw new ValidationError(problem, 'next');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await auth.hashPassword(body.next), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  const { token, maxAge } = auth.createSession(user.id);
  return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': auth.cookieHeader(token, maxAge, isSecure(req)) } };
});

route('DELETE', '/api/me', async ({ user, body, req }) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
  if (!(await auth.verifyPassword(String(body.password || ''), row.password_hash))) throw new HttpError(403, 'Password is incorrect');
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': auth.cookieHeader('', 0, isSecure(req)) } };
});

route('PUT', '/api/me/rates', ({ user, body }) => {
  const currency = String(body.currency || '').toUpperCase();
  if (!CURRENCIES[currency]) throw new ValidationError('Unknown currency', 'currency');
  if (body.rate === null || body.rate === '' || body.rate === undefined) {
    db.prepare('DELETE FROM user_rates WHERE user_id = ? AND currency = ?').run(user.id, currency);
  } else {
    const rate = Number(body.rate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) throw new ValidationError('Rate must be a positive number', 'rate');
    db.prepare('INSERT INTO user_rates (user_id, currency, rate) VALUES (?, ?, ?) ON CONFLICT(user_id, currency) DO UPDATE SET rate = excluded.rate').run(user.id, currency, rate);
  }
  return { status: 200, body: { ok: true } };
});

route('POST', '/api/demo', ({ user }) => {
  const n = RESOURCES.reduce((a, r) => a + db.prepare(`SELECT COUNT(*) c FROM ${r} WHERE user_id = ?`).get(user.id).c, 0);
  if (n > 0) throw new HttpError(409, 'Sample data can only be added to an empty portfolio');
  seedDemo(user);
  return { status: 201, body: { ok: true } };
});

// ---------------------------------------------------------------- export
route('GET', '/api/export', ({ user }) => {
  const out = { exported_at: new Date().toISOString(), user: publicUser(user) };
  for (const r of RESOURCES) out[r] = db.prepare(`SELECT * FROM ${r} WHERE user_id = ?`).all(user.id).map(({ user_id, ...rest }) => rest);
  out.transactions = db.prepare('SELECT resource, ref_id, delta, day, note FROM transactions WHERE user_id = ?').all(user.id);
  out.snapshots = db.prepare('SELECT day, assets, debts, net_worth FROM snapshots WHERE user_id = ? ORDER BY day').all(user.id);
  return { status: 200, body: JSON.stringify(out, null, 2), headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="clearworth-export.json"' } };
});

route('GET', '/api/export/:res', ({ user, params }) => {
  const name = params.res.replace(/\.csv$/, '');
  if (!RESOURCES.includes(name)) throw new HttpError(404, 'Not found');
  const rows = db.prepare(`SELECT * FROM ${name} WHERE user_id = ?`).all(user.id).map(({ user_id, ...rest }) => rest);
  const cols = rows.length ? Object.keys(rows[0]) : Object.keys(SPECS[name]);
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\n');
  return { status: 200, body: csv, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="clearworth-${name}.csv"` } };
});

// ---------------------------------------------------------------- resource CRUD
const owned = (table, id, userId) => {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!row) throw new HttpError(404, 'Not found');
  return row;
};
const asId = (s) => { const n = Number(s); if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found'); return n; };

for (const table of RESOURCES) {
  route('POST', `/api/${table}`, ({ user, body }) => {
    const data = clean(SPECS[table], body);
    if ((table === 'debts' || table === 'receivables') && !data.original_amount) data.original_amount = data.balance;
    const cols = Object.keys(data);
    const info = db.prepare(`INSERT INTO ${table} (user_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(user.id, ...cols.map((c) => data[c]));
    const id = Number(info.lastInsertRowid);
    if (table === 'investments') {
      db.prepare('INSERT INTO valuations (user_id, investment_id, value, day) VALUES (?, ?, ?, ?)').run(user.id, id, data.current_value, data.acquired_date || fin.today());
    }
    return { status: 201, body: { id } };
  });

  route('PUT', `/api/${table}/:id`, ({ user, params, body }) => {
    const id = asId(params.id);
    const existing = owned(table, id, user.id);
    const data = clean(SPECS[table], body, { partial: true });
    const cols = Object.keys(data);
    if (cols.length) {
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
        .run(...cols.map((c) => data[c]), id, user.id);
    }
    if (table === 'investments' && data.current_value !== undefined && data.current_value !== existing.current_value) {
      db.prepare('INSERT INTO valuations (user_id, investment_id, value, day) VALUES (?, ?, ?, ?)').run(user.id, id, data.current_value, fin.today());
    }
    return { status: 200, body: { ok: true } };
  });

  route('DELETE', `/api/${table}/:id`, ({ user, params }) => {
    const id = asId(params.id);
    owned(table, id, user.id);
    db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(id, user.id);
    db.prepare('DELETE FROM transactions WHERE user_id = ? AND resource = ? AND ref_id = ?').run(user.id, table, id);
    return { status: 200, body: { ok: true } };
  });

  // Add to / subtract from the balance: payments, new charges, money received, contributions, top-ups.
  route('POST', `/api/${table}/:id/adjust`, ({ user, params, body }) => {
    const id = asId(params.id);
    const row = owned(table, id, user.id);
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e15) throw new ValidationError('Enter an amount', 'delta');
    const day = body.day ? String(body.day) : fin.today();
    if (!isDate(day)) throw new ValidationError('Date is not valid', 'day');
    const note = String(body.note || '').trim().slice(0, 200);
    let applied;
    if (table === 'debts' || table === 'receivables') {
      const next = Math.max(0, fin.r2(row.balance + delta));
      applied = fin.r2(next - row.balance);
      db.prepare(`UPDATE ${table} SET balance = ?, original_amount = original_amount + ?, updated_at = datetime('now') WHERE id = ?`).run(next, Math.max(0, applied), id);
    } else if (table === 'goals') {
      const next = Math.max(0, fin.r2(row.saved_amount + delta));
      applied = fin.r2(next - row.saved_amount);
      db.prepare("UPDATE goals SET saved_amount = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
    } else {
      const inv = Math.max(0, fin.r2(row.amount_invested + delta));
      const val = Math.max(0, fin.r2(row.current_value + delta));
      applied = fin.r2(val - row.current_value);
      db.prepare("UPDATE investments SET amount_invested = ?, current_value = ?, updated_at = datetime('now') WHERE id = ?").run(inv, val, id);
      db.prepare('INSERT INTO valuations (user_id, investment_id, value, day) VALUES (?, ?, ?, ?)').run(user.id, id, val, day);
    }
    if (applied !== 0) db.prepare('INSERT INTO transactions (user_id, resource, ref_id, delta, day, note) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, table, id, applied, day, note);
    return { status: 200, body: { applied } };
  });

  route('GET', `/api/${table}/:id/history`, ({ user, params }) => {
    const id = asId(params.id);
    owned(table, id, user.id);
    const transactions = db.prepare('SELECT id, delta, day, note FROM transactions WHERE user_id = ? AND resource = ? AND ref_id = ? ORDER BY day DESC, id DESC LIMIT 200').all(user.id, table, id);
    const valuations = table === 'investments'
      ? db.prepare('SELECT value, day FROM valuations WHERE user_id = ? AND investment_id = ? ORDER BY day, id').all(user.id, id) : [];
    return { status: 200, body: { transactions, valuations } };
  });
}

route('DELETE', '/api/transactions/:id', ({ user, params }) => {
  // Undo a logged payment/contribution and put the balance back.
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(asId(params.id), user.id);
  if (!tx) throw new HttpError(404, 'Not found');
  const table = tx.resource;
  if (table === 'debts' || table === 'receivables') db.prepare(`UPDATE ${table} SET balance = MAX(0, balance - ?) WHERE id = ? AND user_id = ?`).run(tx.delta, tx.ref_id, user.id);
  else if (table === 'goals') db.prepare('UPDATE goals SET saved_amount = MAX(0, saved_amount - ?) WHERE id = ? AND user_id = ?').run(tx.delta, tx.ref_id, user.id);
  else db.prepare('UPDATE investments SET amount_invested = MAX(0, amount_invested - ?), current_value = MAX(0, current_value - ?) WHERE id = ? AND user_id = ?').run(tx.delta, tx.delta, tx.ref_id, user.id);
  db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  return { status: 200, body: { ok: true } };
});

route('POST', '/api/investments/:id/valuation', ({ user, params, body }) => {
  const id = asId(params.id);
  owned('investments', id, user.id);
  const { current_value } = clean({ current_value: { type: 'money', required: true, label: 'Current value' } }, { current_value: body.value });
  const day = body.day ? String(body.day) : fin.today();
  if (!isDate(day)) throw new ValidationError('Date is not valid', 'day');
  db.prepare("UPDATE investments SET current_value = ?, updated_at = datetime('now') WHERE id = ?").run(current_value, id);
  db.prepare('INSERT INTO valuations (user_id, investment_id, value, day) VALUES (?, ?, ?, ?)').run(user.id, id, current_value, day);
  return { status: 200, body: { ok: true } };
});

// ---------------------------------------------------------------- static files
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};
const PAGES = { '/': 'index.html', '/app': 'app.html', '/privacy': 'privacy.html' };

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = PAGES[pathname] || decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (isSecure(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  try {
    const url = new URL(req.url, 'http://x');
    const pathname = url.pathname;

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, pathname);
    }

    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating) {
      // CSRF defence in depth: custom header (cannot be sent cross-site without CORS) + same-origin check.
      if (req.headers['x-requested-with'] !== 'clearworth') throw new HttpError(403, 'Forbidden');
      const origin = req.headers.origin;
      if (origin) {
        let host; try { host = new URL(origin).host; } catch { host = ''; }
        if (host !== req.headers.host) throw new HttpError(403, 'Forbidden');
      }
    }

    let matched = null, params = {};
    let pathMatched = false;
    for (const r of routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      matched = r;
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      break;
    }
    if (!matched) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Method not allowed' : 'Not found');

    const user = auth.userFromRequest(req);
    if (matched.auth && !user) throw new HttpError(401, 'Please sign in');

    const body = mutating ? await readBody(req) : {};
    const result = await matched.handler({ req, res, user, params, body, query: url.searchParams });
    const headers = result.headers || {};
    if (typeof result.body === 'string') {
      res.writeHead(result.status, { 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(result.body), ...headers });
      return res.end(result.body);
    }
    return send(res, result.status, result.body, headers);
  } catch (err) {
    if (err instanceof ValidationError) return send(res, 400, { error: err.message, field: err.field });
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error('[error]', err);
    if (!res.headersSent) send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
});

// ---------------------------------------------------------------- live FX refresh (optional, best effort)
async function refreshRates() {
  if (process.env.FX_REFRESH === 'off') return;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !j.rates) return;
    const up = db.prepare("INSERT INTO fx_rates (currency, rate, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(currency) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at");
    let n = 0;
    for (const [code, base] of Object.entries(CURRENCIES)) {
      const v = Number(j.rates[code]);
      if (Number.isFinite(v) && v > 0 && v < base.rate * 4 && v > base.rate / 4) { up.run(code, v); n++; }
    }
    console.log(`[fx] refreshed ${n} exchange rates`);
  } catch { /* offline or blocked: keep the last known rates */ }
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Clearworth is running on http://localhost:${PORT}`);
    refreshRates();
    setInterval(refreshRates, 12 * 3600 * 1000).unref();
  });
}

module.exports = { server };
