'use strict';
const { CURRENCIES, DEBT_TYPES, INVESTMENT_TYPES, GOAL_KINDS } = require('./countries');

class ValidationError extends Error {
  constructor(message, field) { super(message); this.status = 400; this.field = field; }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => DATE_RE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

// Field spec: { type: 'text'|'enum'|'currency'|'money'|'percent'|'date', required, max, values, min, maxValue, nullable }
function clean(spec, body, { partial = false } = {}) {
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    let v = body[key];
    if (v === undefined) {
      if (partial) continue;
      if (rule.required) throw new ValidationError(`${rule.label || key} is required`, key);
      if (rule.default !== undefined) { out[key] = rule.default; continue; }
      continue;
    }
    if (v === null || v === '') {
      if (rule.required) throw new ValidationError(`${rule.label || key} is required`, key);
      out[key] = rule.nullable ? null : rule.type === 'text' ? '' : (rule.default !== undefined ? rule.default : 0);
      continue;
    }
    const label = rule.label || key;
    switch (rule.type) {
      case 'text': {
        v = String(v).trim();
        if (rule.required && !v) throw new ValidationError(`${label} is required`, key);
        if (v.length > (rule.max || 200)) throw new ValidationError(`${label} is too long`, key);
        out[key] = v; break;
      }
      case 'enum': {
        if (!rule.values.includes(v)) throw new ValidationError(`${label} is not valid`, key);
        out[key] = v; break;
      }
      case 'currency': {
        v = String(v).toUpperCase();
        if (!CURRENCIES[v]) throw new ValidationError(`${label} is not supported`, key);
        out[key] = v; break;
      }
      case 'money':
      case 'percent': {
        v = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v);
        if (!Number.isFinite(v)) throw new ValidationError(`${label} must be a number`, key);
        const min = rule.min ?? 0;
        const max = rule.maxValue ?? (rule.type === 'percent' ? 1000 : 1e15);
        if (v < min) throw new ValidationError(`${label} cannot be below ${min}`, key);
        if (v > max) throw new ValidationError(`${label} is too large`, key);
        out[key] = Math.round(v * 100) / 100; break;
      }
      case 'date': {
        v = String(v);
        if (!isDate(v)) throw new ValidationError(`${label} must be a valid date`, key);
        out[key] = v; break;
      }
      default: throw new Error('bad spec');
    }
  }
  return out;
}

const SPECS = {
  debts: {
    name: { type: 'text', required: true, max: 100, label: 'Name' },
    type: { type: 'enum', values: Object.keys(DEBT_TYPES), required: true, label: 'Debt type' },
    counterparty: { type: 'text', max: 100, label: 'Lender / person' },
    for_whom: { type: 'text', max: 100, label: 'For whom' },
    currency: { type: 'currency', required: true, label: 'Currency' },
    original_amount: { type: 'money', label: 'Original amount' },
    balance: { type: 'money', required: true, label: 'Amount owing' },
    interest_rate: { type: 'percent', label: 'Interest rate' },
    min_payment: { type: 'money', label: 'Monthly payment' },
    credit_limit: { type: 'money', nullable: true, label: 'Credit limit' },
    due_date: { type: 'date', nullable: true, label: 'Next due date' },
    notes: { type: 'text', max: 1000, label: 'Notes' },
  },
  receivables: {
    name: { type: 'text', required: true, max: 100, label: 'Name' },
    reason: { type: 'text', max: 200, label: 'Reason' },
    contact: { type: 'text', max: 100, label: 'Contact' },
    currency: { type: 'currency', required: true, label: 'Currency' },
    original_amount: { type: 'money', label: 'Original amount' },
    balance: { type: 'money', required: true, label: 'Amount owed to you' },
    due_date: { type: 'date', nullable: true, label: 'Due date' },
    notes: { type: 'text', max: 1000, label: 'Notes' },
  },
  investments: {
    name: { type: 'text', required: true, max: 100, label: 'Name' },
    type: { type: 'enum', values: Object.keys(INVESTMENT_TYPES), required: true, label: 'Investment type' },
    currency: { type: 'currency', required: true, label: 'Currency' },
    amount_invested: { type: 'money', required: true, label: 'Amount invested' },
    current_value: { type: 'money', required: true, label: 'Current value' },
    acquired_date: { type: 'date', nullable: true, label: 'Date acquired' },
    location: { type: 'text', max: 120, label: 'Location' },
    annual_income: { type: 'money', label: 'Yearly income' },
    notes: { type: 'text', max: 1000, label: 'Notes' },
  },
  goals: {
    name: { type: 'text', required: true, max: 100, label: 'Name' },
    kind: { type: 'enum', values: Object.keys(GOAL_KINDS), required: true, label: 'Goal type' },
    currency: { type: 'currency', required: true, label: 'Currency' },
    target_amount: { type: 'money', required: true, min: 0.01, label: 'Target amount' },
    saved_amount: { type: 'money', label: 'Saved so far' },
    target_date: { type: 'date', nullable: true, label: 'Target date' },
    priority: { type: 'enum', values: ['low', 'medium', 'high'], default: 'medium', label: 'Priority' },
    notes: { type: 'text', max: 1000, label: 'Notes' },
  },
};

module.exports = { ValidationError, clean, SPECS, isDate };
