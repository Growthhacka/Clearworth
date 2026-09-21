'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { db } = require('./db');

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 30;
const COOKIE = 'cw_session';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  try {
    const [algo, n, saltB64, keyB64] = stored.split('$');
    if (algo !== 'scrypt') return false;
    const key = Buffer.from(keyB64, 'base64');
    const test = await scrypt(password, Buffer.from(saltB64, 'base64'), key.length, { N: Number(n), r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(key, test);
  } catch { return false; }
}

// A throwaway hash so unknown emails cost the same time as known ones.
let dummyHash;
async function burnTime(password) {
  dummyHash = dummyHash || (await hashPassword('clearworth-dummy'));
  await verifyPassword(password, dummyHash);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, expires);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function getSessionToken(req) { return parseCookies(req.headers.cookie)[COOKIE] || null; }

function userFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.name, u.email, u.country, u.currency, u.created_at, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
    return null;
  }
  return row;
}

function destroySession(req) {
  const token = getSessionToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

function cookieHeader(token, maxAge, secure) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

// ---- login throttling (in memory; fine for a single instance) ----
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;
function throttleKey(ip, email) { return `${ip}|${String(email).toLowerCase()}`; }
function isLocked(ip, email) {
  const e = attempts.get(throttleKey(ip, email));
  if (!e) return false;
  if (Date.now() - e.first > WINDOW) { attempts.delete(throttleKey(ip, email)); return false; }
  return e.count >= MAX_FAILS;
}
function recordFail(ip, email) {
  const k = throttleKey(ip, email);
  const e = attempts.get(k);
  if (!e || Date.now() - e.first > WINDOW) attempts.set(k, { count: 1, first: Date.now() });
  else e.count++;
}
function clearFails(ip, email) { attempts.delete(throttleKey(ip, email)); }
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of attempts) if (now - e.first > WINDOW) attempts.delete(k);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}, 10 * 60 * 1000).unref();

const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', 'qwerty123', 'iloveyou', '11111111', 'abcdefgh', 'letmein123']);
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 200) return 'Password is too long';
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common, please choose another';
  return null;
}

module.exports = {
  hashPassword, verifyPassword, burnTime, createSession, userFromRequest, destroySession,
  cookieHeader, isLocked, recordFail, clearFails, passwordProblem,
};
