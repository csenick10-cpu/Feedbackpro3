// Intraday data layer. Tries a live provider (Yahoo Finance chart API — no key
// required) and transparently falls back to a deterministic simulated session
// when the network is unavailable (e.g. sandboxed runtime). The data `source`
// is always surfaced to the caller so the UI can label it.

import type { Candle, DataSource, Instrument } from "./types.ts"

export interface IntradayData {
  symbol: string
  candles: Candle[]
  source: DataSource
}

/** Underlying ticker we actually pull quotes for, per instrument. */
export function underlyingSymbol(instrument: Instrument): string {
  // SPXW options settle on the S&P 500 index. Yahoo exposes it as ^GSPC.
  return instrument === "SPXW" ? "^GSPC" : "SPY"
}

const INTERVAL_MS = 5 * 60 * 1000 // 5-minute bars
/** ~78 five-minute bars per RTH session * ~252 sessions. */
export const BARS_PER_YEAR = 78 * 252

interface YahooResult {
  meta?: { regularMarketPrice?: number }
  timestamp?: number[]
  indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }> }
}

async function fetchYahoo(symbol: string, timeoutMs = 6000): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=1d&interval=5m&includePrePost=false`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (spy-0dte-agent)" },
    })
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
    const json = (await res.json()) as { chart?: { result?: YahooResult[]; error?: unknown } }
    const result = json?.chart?.result?.[0]
    const ts = result?.timestamp
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
    return candles
  } finally {
    clearTimeout(t)
  }
}

/** Mulberry32 — tiny deterministic PRNG so a given seed always replays. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate a realistic-looking RTH session (9:30–16:00 ET, 78 five-minute
 * bars) when no live feed is reachable. Deterministic per (symbol, day) so the
 * same inputs always produce the same scan — useful for demos and tests.
 */
export function simulateSession(symbol: string, basePrice: number, seed: number): Candle[] {
  const rand = mulberry32(seed)
  const bars = 78
  // Random but stable session character: drift + intraday vol regime.
  const drift = (rand() - 0.5) * 0.012 // up to ~±1.2% net day
  const volPerBar = 0.0011 + rand() * 0.0016 // per-bar sigma
  const trendStrength = rand() // how trendy vs choppy

  const candles: Candle[] = []
  let price = basePrice
  // Open the session a touch away from the prior close.
  price *= 1 + (rand() - 0.5) * 0.004
  const start = startOfSessionEt().getTime()

  for (let i = 0; i < bars; i++) {
    const open = price
    // Blend a directional drift with mean-reverting noise.
    const trend = drift / bars
    const noise = (rand() - 0.5) * 2 * volPerBar
    const meanRevert = ((basePrice - price) / basePrice) * 0.02 * (1 - trendStrength)
    const ret = trend * (0.5 + trendStrength) + noise + meanRevert
    const close = open * (1 + ret)
    const wick = Math.abs(noise) * open * (0.6 + rand())
    const high = Math.max(open, close) + wick
    const low = Math.min(open, close) - wick
    // Volume: U-shaped (heavier at open/close), with random texture.
    const u = 1 + 1.4 * Math.abs(i - bars / 2) / (bars / 2)
    const volume = Math.round((600000 + rand() * 900000) * u)
    candles.push({ time: start + i * INTERVAL_MS, open, high, low, close, volume })
    price = close
  }
  return candles
}

/** Approx. most-recent regular-session open (09:30 America/New_York) in UTC. */
function startOfSessionEt(): Date {
  const now = new Date()
  // ET is UTC-5 (EST) / UTC-4 (EDT). Use -4 as a reasonable default; this only
  // affects cosmetic timestamps in simulated mode, not any computation.
  const etOffsetHrs = -4
  const etNow = new Date(now.getTime() + etOffsetHrs * 3600 * 1000)
  etNow.setUTCHours(9, 30, 0, 0)
  return new Date(etNow.getTime() - etOffsetHrs * 3600 * 1000)
}

/** Deterministic day-seed so simulated sessions are stable within a day. */
function daySeed(symbol: string): number {
  const d = new Date()
  const key = `${symbol}-${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const FALLBACK_BASE: Record<string, number> = {
  SPY: 545,
  "^GSPC": 5450,
}

export async function getIntraday(instrument: Instrument): Promise<IntradayData> {
  const symbol = underlyingSymbol(instrument)
  try {
    const candles = await fetchYahoo(symbol)
    return { symbol, candles, source: "live" }
  } catch {
    const base = FALLBACK_BASE[symbol] ?? 500
    const candles = simulateSession(symbol, base, daySeed(symbol))
    return { symbol, candles, source: "simulated" }
  }
}
