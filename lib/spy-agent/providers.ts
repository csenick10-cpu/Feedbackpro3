// Market-data providers. Each returns intraday candles plus `asOf` — the
// timestamp of the freshest available print — so the caller can classify the
// feed as real-time vs delayed. Real-time providers require an API key with a
// real-time market-data entitlement; without one most "free" tiers are delayed.

import { getTvCandles } from "./tv-store.ts"
import type { Candle, Instrument } from "./types.ts"

export interface ProviderResult {
  candles: Candle[]
  /** Freshest data timestamp in ms (last trade if available, else last bar). */
  asOf: number
  provider: string
}

const TIMEOUT_MS = 6000

async function httpJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "spy-0dte-agent", ...headers } })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split("?")[0]}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/** Keep only bars belonging to the most recent ET calendar day in the series. */
function latestSessionBars(candles: Candle[]): Candle[] {
  if (candles.length === 0) return candles
  const etDay = (ms: number) => new Date(ms - 4 * 3600 * 1000).toISOString().slice(0, 10)
  const lastDay = etDay(candles[candles.length - 1].time)
  return candles.filter((c) => etDay(c.time) === lastDay)
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

// --- TradingView (push via webhook → in-memory store) --------------------

export async function fromTradingView(instrument: Instrument): Promise<ProviderResult> {
  const candles = getTvCandles(instrument)
  if (candles.length < 30) throw new Error("TradingView buffer not warmed up (need ≥30 bars)")
  return { candles, asOf: candles[candles.length - 1].time, provider: "tradingview" }
}

// --- Polygon.io (real-time on paid plans; SPY + I:SPX) -------------------

export async function fromPolygon(instrument: Instrument): Promise<ProviderResult> {
  const key = process.env.POLYGON_API_KEY
  if (!key) throw new Error("POLYGON_API_KEY not set")
  const ticker = instrument === "SPXW" ? "I:SPX" : "SPY"
  const to = new Date()
  const from = new Date(to.getTime() - 4 * 86400 * 1000)
  const aggs = await httpJson(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/5/minute/${ymd(from)}/${ymd(to)}` +
      `?adjusted=true&sort=asc&limit=5000&apiKey=${key}`,
  )
  const rows: any[] = aggs?.results ?? []
  const candles = latestSessionBars(
    rows.map((r) => ({ time: r.t, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v ?? 0 })),
  )
  if (candles.length < 5) throw new Error("Polygon: too few bars")
  let asOf = candles[candles.length - 1].time
  // For stocks, a last-trade lookup gives a precise real-time timestamp.
  if (instrument === "SPY") {
    try {
      const lt = await httpJson(`https://api.polygon.io/v2/last/trade/SPY?apiKey=${key}`)
      const ns = lt?.results?.t ?? lt?.results?.participant_timestamp
      if (ns) asOf = Math.round(Number(ns) / 1e6) // ns → ms
    } catch {
      /* fall back to last-bar asOf */
    }
  }
  return { candles, asOf, provider: "polygon" }
}

// --- Alpaca (free IEX or paid SIP real-time; SPY only) -------------------

export async function fromAlpaca(instrument: Instrument): Promise<ProviderResult> {
  const id = process.env.ALPACA_API_KEY_ID
  const secret = process.env.ALPACA_API_SECRET_KEY
  if (!id || !secret) throw new Error("ALPACA_API_KEY_ID/SECRET not set")
  if (instrument === "SPXW") throw new Error("Alpaca does not provide SPX index data")
  const feed = process.env.ALPACA_FEED || "iex"
  const headers = { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret }
  const start = new Date(Date.now() - 86400 * 1000).toISOString()
  const data = await httpJson(
    `https://data.alpaca.markets/v2/stocks/SPY/bars?timeframe=5Min&start=${encodeURIComponent(start)}&limit=1000&feed=${feed}`,
    headers,
  )
  const rows: any[] = data?.bars ?? []
  const candles = latestSessionBars(
    rows.map((b) => ({ time: Date.parse(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v ?? 0 })),
  )
  if (candles.length < 5) throw new Error("Alpaca: too few bars")
  let asOf = candles[candles.length - 1].time
  try {
    const lt = await httpJson(`https://data.alpaca.markets/v2/stocks/SPY/trades/latest?feed=${feed}`, headers)
    if (lt?.trade?.t) asOf = Date.parse(lt.trade.t)
  } catch {
    /* fall back */
  }
  return { candles, asOf, provider: `alpaca:${feed}` }
}

// --- Tradier (real-time with brokerage account; SPY + SPX) ---------------

export async function fromTradier(instrument: Instrument): Promise<ProviderResult> {
  const token = process.env.TRADIER_ACCESS_TOKEN
  if (!token) throw new Error("TRADIER_ACCESS_TOKEN not set")
  const base = process.env.TRADIER_BASE_URL || "https://api.tradier.com/v1"
  const symbol = instrument === "SPXW" ? "SPX" : "SPY"
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" }
  const start = ymd(new Date(Date.now() - 86400 * 1000)) + " 09:30"
  const ts = await httpJson(
    `${base}/markets/timesales?symbol=${encodeURIComponent(symbol)}&interval=5min&start=${encodeURIComponent(start)}`,
    headers,
  )
  let rows: any = ts?.series?.data ?? []
  if (rows && !Array.isArray(rows)) rows = [rows]
  const candles = latestSessionBars(
    (rows as any[]).map((r) => ({
      time: (r.timestamp ? Number(r.timestamp) * 1000 : Date.parse(r.time)) || Date.now(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close ?? r.price,
      volume: r.volume ?? 0,
    })),
  )
  if (candles.length < 5) throw new Error("Tradier: too few bars")
  let asOf = candles[candles.length - 1].time
  try {
    const q = await httpJson(`${base}/markets/quotes?symbols=${encodeURIComponent(symbol)}`, headers)
    const quote = q?.quotes?.quote
    const td = Array.isArray(quote) ? quote[0]?.trade_date : quote?.trade_date
    if (td) asOf = Number(td)
  } catch {
    /* fall back */
  }
  return { candles, asOf, provider: "tradier" }
}

// --- Yahoo (UNOFFICIAL, ~15-min DELAYED — fallback only) -----------------

export async function fromYahoo(instrument: Instrument): Promise<ProviderResult> {
  const symbol = instrument === "SPXW" ? "^GSPC" : "SPY"
  const json = await httpJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`,
  )
  const result = json?.chart?.result?.[0]
  const ts: number[] | undefined = result?.timestamp
  const q = result?.indicators?.quote?.[0]
  if (!ts || !q) throw new Error("Yahoo: empty payload")
  const candles: Candle[] = []
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i]
    const h = q.high?.[i]
    const l = q.low?.[i]
    const c = q.close?.[i]
    if (o == null || h == null || l == null || c == null) continue
    candles.push({ time: ts[i] * 1000, open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 })
  }
  if (candles.length < 5) throw new Error("Yahoo: too few candles")
  // Yahoo's chart feed is delayed; reflect that by aging `asOf` by the last bar.
  return { candles, asOf: candles[candles.length - 1].time, provider: "yahoo" }
}

/** Ordered provider chain: push (TradingView) → real-time keys → delayed. */
export function providerChain(): Array<{ name: string; fn: (i: Instrument) => Promise<ProviderResult> }> {
  const chain: Array<{ name: string; fn: (i: Instrument) => Promise<ProviderResult> }> = [
    { name: "tradingview", fn: fromTradingView },
  ]
  const preferred = (process.env.MARKET_DATA_PROVIDER || "").toLowerCase()
  const realtime: Record<string, (i: Instrument) => Promise<ProviderResult>> = {
    polygon: fromPolygon,
    alpaca: fromAlpaca,
    tradier: fromTradier,
  }
  // Honor an explicit preference first, then any other configured providers.
  if (preferred && realtime[preferred]) chain.push({ name: preferred, fn: realtime[preferred] })
  for (const [name, fn] of Object.entries(realtime)) {
    if (name !== preferred) chain.push({ name, fn })
  }
  chain.push({ name: "yahoo", fn: fromYahoo })
  return chain
}
