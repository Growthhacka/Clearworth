'use strict';
// Currency + country reference data.
// `rate` = units of that currency per 1 USD. These are approximate defaults; the server can
// refresh them from a public FX feed and every user can override any rate in Settings.

const CURRENCIES = {
  USD: { name: 'US Dollar', symbol: '$', rate: 1 },
  GBP: { name: 'British Pound', symbol: '£', rate: 0.75 },
  EUR: { name: 'Euro', symbol: '€', rate: 0.86 },
  NGN: { name: 'Nigerian Naira', symbol: '₦', rate: 1550 },
  AED: { name: 'UAE Dirham', symbol: 'AED', rate: 3.6725 },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', rate: 1.38 },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', rate: 12 },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', rate: 129 },
  ZAR: { name: 'South African Rand', symbol: 'R', rate: 17.8 },
  INR: { name: 'Indian Rupee', symbol: '₹', rate: 87 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', rate: 1.52 },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$', rate: 1.68 },
  SAR: { name: 'Saudi Riyal', symbol: 'SAR', rate: 3.75 },
  QAR: { name: 'Qatari Riyal', symbol: 'QAR', rate: 3.64 },
  EGP: { name: 'Egyptian Pound', symbol: 'E£', rate: 48 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', rate: 1.29 },
  CNY: { name: 'Chinese Yuan', symbol: '¥', rate: 7.15 },
  JPY: { name: 'Japanese Yen', symbol: '¥', rate: 148 },
  BRL: { name: 'Brazilian Real', symbol: 'R$', rate: 5.4 },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', rate: 18.5 },
  PKR: { name: 'Pakistani Rupee', symbol: 'Rs', rate: 282 },
  PHP: { name: 'Philippine Peso', symbol: '₱', rate: 57 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', rate: 4.2 },
  TRY: { name: 'Turkish Lira', symbol: '₺', rate: 41 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', rate: 0.8 },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh', rate: 3600 },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh', rate: 2600 },
  RWF: { name: 'Rwandan Franc', symbol: 'FRw', rate: 1440 },
  ZMW: { name: 'Zambian Kwacha', symbol: 'ZK', rate: 25 },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA', rate: 565 },
  XAF: { name: 'Central African CFA Franc', symbol: 'FCFA', rate: 565 },
  JMD: { name: 'Jamaican Dollar', symbol: 'J$', rate: 158 },
};

const c = (code, name, currency, locale, ideas) => ({ code, name, currency, locale, ideas });

const COUNTRIES = [
  c('NG', 'Nigeria', 'NGN', 'en-NG', 'Land in Lagos, Abuja or Port Harcourt, treasury bills, farmland and poultry, rental apartments, cooperative schemes'),
  c('GB', 'United Kingdom', 'GBP', 'en-GB', 'Stocks & Shares ISA, workplace pension, buy-to-let property, premium bonds, index funds'),
  c('AE', 'United Arab Emirates', 'AED', 'en-AE', 'Dubai off-plan and ready property, gold, index funds, business stakes, rental units'),
  c('US', 'United States', 'USD', 'en-US', '401(k) and IRA accounts, index funds, rental property, treasury bills, brokerage accounts'),
  c('CA', 'Canada', 'CAD', 'en-CA', 'RRSP, TFSA, rental property, dividend stocks, GICs'),
  c('GH', 'Ghana', 'GHS', 'en-GH', 'Land, treasury bills, cocoa and farm plots, rental property, mutual funds'),
  c('KE', 'Kenya', 'KES', 'en-KE', 'Land, SACCOs, money market funds, treasury bonds, rental units, agriculture'),
  c('ZA', 'South Africa', 'ZAR', 'en-ZA', 'Tax-free savings accounts, retirement annuities, property, JSE shares, farmland'),
  c('IN', 'India', 'INR', 'en-IN', 'Mutual funds and SIPs, PPF, gold, real estate, fixed deposits, equities'),
  c('AU', 'Australia', 'AUD', 'en-AU', 'Superannuation, investment property, ETFs, ASX shares, term deposits'),
  c('NZ', 'New Zealand', 'NZD', 'en-NZ', 'KiwiSaver, investment property, managed funds, term deposits'),
  c('IE', 'Ireland', 'EUR', 'en-IE', 'Pension, ETFs, rental property, state savings, index funds'),
  c('DE', 'Germany', 'EUR', 'de-DE', 'ETF savings plans, rental property, Riester pension, bonds'),
  c('FR', 'France', 'EUR', 'fr-FR', 'Assurance-vie, rental property (SCPI), PEA, livret savings'),
  c('NL', 'Netherlands', 'EUR', 'nl-NL', 'Property, ETFs, pension pots, savings deposits'),
  c('ES', 'Spain', 'EUR', 'es-ES', 'Property, index funds, pension plans, deposits'),
  c('IT', 'Italy', 'EUR', 'it-IT', 'Property, government bonds, ETFs, pension funds'),
  c('SA', 'Saudi Arabia', 'SAR', 'en-SA', 'Real estate, gold, Tadawul shares, sukuk, business stakes'),
  c('QA', 'Qatar', 'QAR', 'en-QA', 'Property, gold, shares, business stakes'),
  c('EG', 'Egypt', 'EGP', 'en-EG', 'Property, gold, certificates of deposit, farmland'),
  c('SG', 'Singapore', 'SGD', 'en-SG', 'CPF, ETFs, REITs, property, T-bills'),
  c('CN', 'China', 'CNY', 'zh-CN', 'Property, mutual funds, gold, deposits'),
  c('JP', 'Japan', 'JPY', 'ja-JP', 'NISA, iDeCo, property, index funds'),
  c('BR', 'Brazil', 'BRL', 'pt-BR', 'Tesouro Direto, CDBs, property, funds, farmland'),
  c('MX', 'Mexico', 'MXN', 'es-MX', 'Property, CETES, funds, land'),
  c('PK', 'Pakistan', 'PKR', 'en-PK', 'Property, national savings, gold, farmland, mutual funds'),
  c('PH', 'Philippines', 'PHP', 'en-PH', 'Land, UITFs, pag-IBIG, stocks, rentals'),
  c('MY', 'Malaysia', 'MYR', 'en-MY', 'Property, unit trusts, EPF, gold'),
  c('TR', 'Turkey', 'TRY', 'tr-TR', 'Property, gold, FX deposits, funds'),
  c('CH', 'Switzerland', 'CHF', 'de-CH', 'Pillar 3a, property, funds, bonds'),
  c('UG', 'Uganda', 'UGX', 'en-UG', 'Land, SACCOs, treasury bonds, farmland, rentals'),
  c('TZ', 'Tanzania', 'TZS', 'en-TZ', 'Land, farms, SACCOs, treasury bonds, rentals'),
  c('RW', 'Rwanda', 'RWF', 'en-RW', 'Land, SACCOs, treasury bonds, farms, rentals'),
  c('ZM', 'Zambia', 'ZMW', 'en-ZM', 'Land, farms, treasury bills, rentals, shares'),
  c('SN', 'Senegal', 'XOF', 'fr-SN', 'Land, rentals, savings, agriculture, business stakes'),
  c('CM', 'Cameroon', 'XAF', 'fr-CM', 'Land, farms, tontines, rentals, business stakes'),
  c('JM', 'Jamaica', 'JMD', 'en-JM', 'Land, property, unit trusts, treasury bills'),
  c('XX', 'Other country', 'USD', 'en-US', 'Property, land, funds, business stakes, savings'),
];

const DEBT_TYPES = {
  credit_card: { label: 'Credit card', portal: 'cards' },
  loan: { label: 'Loan', portal: 'cards' },
  mortgage: { label: 'Mortgage', portal: 'cards' },
  tuition: { label: 'Tuition / school fees', portal: 'tuition' },
  person: { label: 'Owed to a person', portal: 'people' },
  other: { label: 'Other debt', portal: 'people' },
};

const INVESTMENT_TYPES = {
  land: 'Land',
  real_estate: 'Apartments & property',
  agriculture: 'Agriculture & farming',
  stocks: 'Stocks & shares',
  funds: 'Funds & ETFs',
  bonds: 'Bonds & treasury bills',
  crypto: 'Crypto',
  business: 'Business stake',
  gold: 'Gold & commodities',
  savings: 'Savings & fixed deposits',
  pension: 'Pension & retirement',
  vehicle: 'Vehicles & equipment',
  other: 'Other',
};

const GOAL_KINDS = {
  savings: 'Savings target',
  spending: 'Planned spending',
  emergency: 'Emergency fund',
};

module.exports = { CURRENCIES, COUNTRIES, DEBT_TYPES, INVESTMENT_TYPES, GOAL_KINDS };
