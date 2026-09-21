'use strict';
// Run with:  node --test test/
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-test-'));
process.env.FX_REFRESH = 'off';
const { server } = require('../server');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

function client() {
  let cookie = '';
  return async (method, url, body, extra = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'clearworth', ...(cookie ? { Cookie: cookie } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json, headers: res.headers };
  };
}

test('public meta lists countries and currencies', async () => {
  const api = client();
  const r = await api('GET', '/api/meta');
  assert.equal(r.status, 200);
  const codes = r.json.countries.map((c) => c.code);
  for (const c of ['NG', 'GB', 'AE', 'US']) assert.ok(codes.includes(c));
});

test('auth: register, wrong password, login, logout', async () => {
  const api = client();
  let r = await api('POST', '/api/auth/register', { name: 'Ada', email: 'ada@example.com', password: 'short', country: 'NG' });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/auth/register', { name: 'Ada', email: 'ada@example.com', password: 'a-strong-pass-1', country: 'NG' });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.currency, 'NGN');
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  r = await api('POST', '/api/auth/register', { name: 'Ada', email: 'ADA@example.com', password: 'a-strong-pass-1', country: 'NG' });
  assert.equal(r.status, 409);
  const other = client();
  r = await other('POST', '/api/auth/login', { email: 'ada@example.com', password: 'nope-nope-1' });
  assert.equal(r.status, 401);
  r = await other('POST', '/api/auth/login', { email: 'ada@example.com', password: 'a-strong-pass-1' });
  assert.equal(r.status, 200);
  r = await other('GET', '/api/bootstrap');
  assert.equal(r.status, 200);
  await other('POST', '/api/auth/logout', {});
  r = await other('GET', '/api/bootstrap');
  assert.equal(r.status, 401);
});

test('login is throttled after repeated failures', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Bo', email: 'bo@example.com', password: 'a-strong-pass-1', country: 'GB' });
  const other = client();
  let last;
  for (let i = 0; i < 9; i++) last = await other('POST', '/api/auth/login', { email: 'bo@example.com', password: 'wrong-wrong-1' });
  assert.equal(last.status, 429);
});

test('CSRF: mutating requests without the header are rejected', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('debts: create, pay down, add charge, undo, delete; totals in home currency', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Chi', email: 'chi@example.com', password: 'a-strong-pass-1', country: 'GB' });
  let r = await api('POST', '/api/debts', { name: 'Visa', type: 'credit_card', currency: 'GBP', balance: 1000, interest_rate: 20, min_payment: 50, credit_limit: 4000 });
  assert.equal(r.status, 201);
  const id = r.json.id;
  r = await api('POST', '/api/debts', { name: 'Uni fees', type: 'tuition', currency: 'USD', balance: 750 });
  assert.equal(r.status, 201);

  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.debts.length, 2);
  // 750 USD at 0.75 GBP/USD = 562.5 GBP, so total = 1562.5
  assert.equal(r.json.summary.debts.total, 1562.5);
  assert.equal(r.json.summary.card_utilisation, 25);
  const visa = r.json.debts.find((d) => d.id === id);
  assert.ok(visa.projection.months > 0 && visa.projection.interest > 0);

  r = await api('POST', `/api/debts/${id}/adjust`, { delta: -400, note: 'March payment' });
  assert.equal(r.json.applied, -400);
  r = await api('POST', `/api/debts/${id}/adjust`, { delta: 150 });
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.debts.find((d) => d.id === id).balance, 750);

  // overpaying clamps at zero and marks the debt as paid
  r = await api('POST', `/api/debts/${id}/adjust`, { delta: -99999 });
  assert.equal(r.json.applied, -750);
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.debts.find((d) => d.id === id).status, 'paid');

  r = await api('GET', `/api/debts/${id}/history`);
  assert.equal(r.json.transactions.length, 3);
  const tx = r.json.transactions.find((t) => t.delta === -750);
  r = await api('DELETE', `/api/transactions/${tx.id}`);
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.debts.find((d) => d.id === id).balance, 750);

  r = await api('PUT', `/api/debts/${id}`, { balance: 500, notes: 'edited' });
  assert.equal(r.status, 200);
  r = await api('DELETE', `/api/debts/${id}`);
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.debts.length, 1);
});

test('validation rejects bad input', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Dee', email: 'dee@example.com', password: 'a-strong-pass-1', country: 'US' });
  let r = await api('POST', '/api/debts', { name: '', type: 'credit_card', currency: 'USD', balance: 10 });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/debts', { name: 'X', type: 'nonsense', currency: 'USD', balance: 10 });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/debts', { name: 'X', type: 'loan', currency: 'ZZZ', balance: 10 });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/debts', { name: 'X', type: 'loan', currency: 'USD', balance: -5 });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/debts', { name: 'X', type: 'loan', currency: 'USD', balance: 'abc' });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/debts', { name: 'X', type: 'loan', currency: 'USD', balance: 5, due_date: '2026-13-45' });
  assert.equal(r.status, 400);
});

test('users cannot see or change each other\'s data', async () => {
  const a = client(); const b = client();
  await a('POST', '/api/auth/register', { name: 'A', email: 'a@example.com', password: 'a-strong-pass-1', country: 'NG' });
  await b('POST', '/api/auth/register', { name: 'B', email: 'b@example.com', password: 'a-strong-pass-1', country: 'NG' });
  const created = await a('POST', '/api/investments', { name: 'Land', type: 'land', currency: 'NGN', amount_invested: 5000000, current_value: 8000000 });
  const id = created.json.id;
  let r = await b('PUT', `/api/investments/${id}`, { current_value: 1 });
  assert.equal(r.status, 404);
  r = await b('DELETE', `/api/investments/${id}`);
  assert.equal(r.status, 404);
  r = await b('POST', `/api/investments/${id}/adjust`, { delta: 5 });
  assert.equal(r.status, 404);
  r = await b('GET', `/api/investments/${id}/history`);
  assert.equal(r.status, 404);
  r = await b('GET', '/api/bootstrap');
  assert.equal(r.json.investments.length, 0);
  r = await a('GET', '/api/bootstrap');
  assert.equal(r.json.investments.length, 1);
});

test('investments, receivables, goals and net worth', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Eve', email: 'eve@example.com', password: 'a-strong-pass-1', country: 'AE' });
  await api('POST', '/api/investments', { name: 'Flat', type: 'real_estate', currency: 'AED', amount_invested: 400000, current_value: 500000, annual_income: 30000 });
  await api('POST', '/api/receivables', { name: 'Sam', currency: 'AED', balance: 2000 });
  await api('POST', '/api/goals', { name: 'Trip', kind: 'spending', currency: 'AED', target_amount: 10000, saved_amount: 2500, target_date: new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10) });
  await api('POST', '/api/debts', { name: 'Loan', type: 'loan', currency: 'AED', balance: 100000, interest_rate: 8, min_payment: 3000 });
  let r = await api('GET', '/api/bootstrap');
  const s = r.json.summary;
  assert.equal(s.investments.value, 500000);
  assert.equal(s.investments.gain, 100000);
  assert.equal(s.investments.roi, 25);
  assert.equal(s.assets.total, 500000 + 2000 + 2500);
  assert.equal(s.net_worth, 500000 + 2000 + 2500 - 100000);
  assert.ok(s.goals.monthly_needed > 0);
  assert.ok(s.debts.debt_free_date);
  assert.equal(r.json.snapshots.length, 1);

  const invId = r.json.investments[0].id;
  await api('POST', `/api/investments/${invId}/valuation`, { value: 520000 });
  r = await api('GET', `/api/investments/${invId}/history`);
  assert.ok(r.json.valuations.length >= 2);

  const goalId = (await api('GET', '/api/bootstrap')).json.goals[0].id;
  r = await api('POST', `/api/goals/${goalId}/adjust`, { delta: 500 });
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.goals[0].saved_amount, 3000);
  const recId = r.json.receivables[0].id;
  await api('POST', `/api/receivables/${recId}/adjust`, { delta: -2000 });
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.receivables[0].status, 'settled');
});

test('changing home currency re-expresses totals and history', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Fay', email: 'fay@example.com', password: 'a-strong-pass-1', country: 'US' });
  await api('POST', '/api/debts', { name: 'Loan', type: 'loan', currency: 'USD', balance: 1000 });
  let r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.summary.debts.total, 1000);
  r = await api('PATCH', '/api/me', { country: 'GB', currency: 'GBP' });
  assert.equal(r.json.user.currency, 'GBP');
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.summary.debts.total, 750);
  // per-user rate override
  await api('PUT', '/api/me/rates', { currency: 'GBP', rate: 0.5 });
  r = await api('GET', '/api/bootstrap');
  assert.equal(r.json.summary.debts.total, 500);
});

test('demo data, export and account deletion', async () => {
  const api = client();
  await api('POST', '/api/auth/register', { name: 'Gus', email: 'gus@example.com', password: 'a-strong-pass-1', country: 'NG' });
  let r = await api('POST', '/api/demo', {});
  assert.equal(r.status, 201);
  r = await api('POST', '/api/demo', {});
  assert.equal(r.status, 409);
  r = await api('GET', '/api/bootstrap');
  assert.ok(r.json.debts.length >= 4 && r.json.investments.length >= 4 && r.json.snapshots.length >= 6);
  r = await api('GET', '/api/export');
  assert.ok(JSON.parse(r.json === undefined ? '{}' : JSON.stringify(r.json)).debts.length >= 4);
  r = await api('GET', '/api/export/debts.csv');
  assert.match(r.json, /^id,name,type/);
  r = await api('DELETE', '/api/me', { password: 'wrong-password' });
  assert.equal(r.status, 403);
  r = await api('DELETE', '/api/me', { password: 'a-strong-pass-1' });
  assert.equal(r.status, 200);
  r = await api('POST', '/api/auth/login', { email: 'gus@example.com', password: 'a-strong-pass-1' });
  assert.equal(r.status, 401);
});

test('static pages and path traversal', async () => {
  let res = await fetch(base + '/../server.js');
  assert.notEqual(res.status, 200);
  res = await fetch(base + '/%2e%2e/server.js');
  assert.notEqual(res.status, 200);
  res = await fetch(base + '/api/nothing');
  assert.equal(res.status, 404);
});
