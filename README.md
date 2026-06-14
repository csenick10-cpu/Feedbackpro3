# Feedbackpro3

Customer feedback and review management platform.

## 0DTE Intraday Agent (SPY / SPXW)

An AI/rules-based agent that scans intraday price action and recommends the most
optimal **0DTE** (zero-days-to-expiry) option strike for **SPY** and **SPXW**.

> ⚠️ Educational tool only — **not financial advice**. 0DTE options are extremely
> high risk and can expire worthless within minutes.

### What it does

1. **Pulls intraday data** — 5-minute candles for the underlying (SPY, or `^GSPC`
   for SPXW) from the Yahoo Finance chart API. When no live feed is reachable
   (e.g. a sandboxed runtime), it falls back to a **deterministic simulated
   session** and clearly labels the data source.
2. **Computes technical indicators** — VWAP, EMA 9/21/50, RSI(14), MACD,
   ATR(14), realized volatility, opening range, and session momentum.
3. **Scores a directional bias** — six weighted signals (EMA trend stack, VWAP
   location, RSI, MACD histogram, opening-range break, day momentum) blend into
   a `bullish / bearish / neutral` call with a 0–100 conviction score.
4. **Applies day-trading context** — a time-of-day session model (opening drive,
   morning trend, midday chop, afternoon trend, power hour) tempers conviction
   because the same signal is worth more at 10:00 than at 12:30. It also maps the
   prior-day high/low/close and intraday levels to flag the nearest support and
   resistance.
5. **Recommends the optimal strike** — picks call vs. put, then chooses ITM / ATM /
   OTM by conviction (high conviction reaches for OTM gamma; low conviction buys
   ITM delta). Strikes snap to the listed increment (SPY = 1pt, SPXW = 5pt).
6. **Prices the contract & sizes the trade** — Black-Scholes premium, delta, gamma,
   theta/day, breakeven, and implied vol, plus an underlying entry / target / stop
   plan with risk:reward and an invalidation level. Given a dollar risk budget
   (1R, default $500) it sizes the position in contracts and projects the premium
   at target/stop and the resulting profit/loss.

If signals are mixed, the agent recommends **standing aside** rather than forcing
a trade.

### Architecture

| Path | Role |
| --- | --- |
| `lib/spy-agent/indicators.ts` | Pure TA functions (EMA, RSI, MACD, ATR, VWAP, realized vol) |
| `lib/spy-agent/market-data.ts` | Live intraday + prior-day fetch with deterministic simulated fallback |
| `lib/spy-agent/session.ts` | Time-of-day trading context (opening drive → power hour) |
| `lib/spy-agent/strike-engine.ts` | Signal scoring, conviction, key levels, Black-Scholes, strike + sizing |
| `lib/spy-agent/agent.ts` | Orchestrator → assembles the full report + reasoning |
| `app/api/spy-agent/route.ts` | `GET /api/spy-agent?instrument=SPY\|SPXW&risk=500` JSON endpoint |
| `app/spy-agent/page.tsx` | Live dashboard UI (bias gauge, signals, key levels, greeks, sizing, price chart) |
| `scripts/spy-scan.ts` | Runnable CLI scanner |

The `lib/spy-agent` modules are framework-agnostic and side-effect free, so the
same engine powers the CLI, the API route, and the dashboard.

### Run the CLI

Requires Node 22+ (built-in TypeScript support):

```bash
npm run scan                          # SPY
npm run scan:spxw                     # SPXW
node scripts/spy-scan.ts SPY --risk=1000   # size to a $1,000 risk budget
node scripts/spy-scan.ts SPY --json        # machine-readable
```

### Run the dashboard

```bash
npm install --legacy-peer-deps
npm run dev
# open http://localhost:3000/spy-agent
```
