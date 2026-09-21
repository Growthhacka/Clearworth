# Clearworth: Owe less. Own more.

A private debt, investment and net worth tracker for people in Nigeria, the UK, UAE, USA and 30+ other countries.
Users sign up, log in and manage their own portfolio. Every account has its own data in the database.

## What is inside

| Portal | What it does |
|---|---|
| Dashboard | Net worth, total cost of debt (balance plus projected interest), debt-free date, upcoming due dates, insights |
| Net worth | Assets minus debts, history chart (3M / 6M / 1Y / All), assets and debts breakdown, currency exposure |
| Cards & loans | Credit cards, loans, mortgages: balance, APR, monthly payment, card utilisation, payoff date |
| Tuition & school fees | Fees owed per student/school, with payments recorded term by term |
| People & other debts | Money you owe family, friends, suppliers |
| Owed to me | Money others owe you, repayments, overdue flags, copy/WhatsApp reminder message |
| Investments | Land, apartments, agriculture, stocks, funds, bonds, crypto, business, gold, savings, pension, vehicles. Value history, gain and ROI, yearly income and yield |
| Goals & spending | Savings targets, emergency fund, planned spending, monthly amount needed per goal |
| Planner & calculators | Debt payoff planner (avalanche or snowball, extra monthly payment), loan calculator, investment growth calculator |
| Settings | Profile, home currency, editable exchange rates, password change, JSON/CSV export, delete account |

On every debt, receivable, investment and goal the user can add, edit, delete, add funds or subtract (record a payment, add a charge, withdraw), and view history (with undo).

Every item has its own currency (32 supported) and is converted into the user's home currency for totals.

## Run it

Requires Node.js 22.13 or newer. There are **no npm dependencies** to install.

```bash
cd clearworth
npm start            # or: node --no-warnings server.js
# open http://localhost:3000
```

Sign up from the home page. Tick "Start with sample data" to explore with a ready-made portfolio.

Run the tests: `npm test` (11 API tests covering auth, isolation between users, CRUD, maths, export, deletion).

### Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Port to listen on |
| `DATA_DIR` | `./data` | Where the SQLite database file lives. Back this folder up |
| `TRUST_PROXY` | off | Set to `1` when behind a reverse proxy (Nginx, Caddy, Render, Fly, Railway) so client IPs and HTTPS are read correctly |
| `COOKIE_SECURE` | off | Set to `true` to mark the session cookie Secure (do this on HTTPS) |
| `FX_REFRESH` | on | Set to `off` to stop fetching live exchange rates |

## Deploy

**Docker**

```bash
docker build -t clearworth .
docker run -d -p 3000:3000 -v clearworth-data:/data -e TRUST_PROXY=1 -e COOKIE_SECURE=true clearworth
```

**Render (public link from GitHub)**: push this folder to a GitHub repo, then in Render choose New > Blueprint and select the repo. `render.yaml` sets everything up. The free plan has no persistent disk, so data resets on restart; use the paid Starter plan plus the disk block in `render.yaml` for real users. Vercel and GitHub Pages cannot run this app as it is (serverless or static only, no writable disk).

**Any Node host** (Render, Railway, Fly.io, a VPS): deploy the folder, start command `node --no-warnings server.js`, attach a persistent disk and point `DATA_DIR` at it. Put it behind HTTPS and set `TRUST_PROXY=1` and `COOKIE_SECURE=true`.

## How it is built

- `server.js`: HTTP server, router, static files, security headers, JSON API
- `lib/db.js`: SQLite schema (users, sessions, debts, receivables, investments, goals, transactions, valuations, snapshots, fx_rates, user_rates)
- `lib/auth.js`: scrypt password hashing, hashed session tokens, login throttling
- `lib/finance.js`: currency conversion, interest projection, net worth summary, snapshots
- `lib/validate.js`: input validation for every write
- `lib/countries.js`: countries, currencies, default exchange rates, type lists
- `public/`: landing page, sign-up/login, the app (vanilla JS, SVG charts, light and dark themes)

## Security notes

- Passwords are hashed with scrypt (salted). Session tokens are random and only their hash is stored. The cookie is HttpOnly and SameSite=Lax.
- Every query is parameterised and scoped to the signed-in user. The tests check that one user cannot read, edit or delete another user's records.
- State-changing requests need a custom header plus a same-origin check (CSRF). A strict Content-Security-Policy, no inline scripts, and escaped output prevent XSS.
- Login attempts are throttled (8 failures per 15 minutes per IP and email), sign-ups are rate limited, request bodies are capped.
- CSV exports neutralise spreadsheet formula injection.

## Before you launch publicly

- Use HTTPS and set `COOKIE_SECURE=true`.
- The login throttle is in memory, which suits one server instance. Use a shared store if you run several instances.
- Exchange rates are approximate defaults, refreshed from a public feed when the server is online. Users can override any rate in Settings.
- Add email verification and password reset (needs an email service) if you want them.
- Replace `public/privacy.html` with a notice that names your organisation. If you handle UK or EU users' data, check ICO registration and GDPR obligations. Clearworth shows projections, not financial advice.
- Back up `DATA_DIR` regularly.
