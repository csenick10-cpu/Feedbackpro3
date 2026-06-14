// In-memory rolling candle buffer fed by TradingView alert webhooks.
//
// TradingView has no official pull API, but Pine Script `alert()` can POST a
// real-time JSON payload to a webhook on every bar close. This store ingests
// those pushes so the agent can run on genuine TradingView prints.
//
// NOTE: this is process-local memory. It works for a single long-running server
// (next start / a Node host). On serverless/multi-instance deploys the buffer is
// per-instance and ephemeral — use a shared store (Redis/DB) for production.

import type { Candle, Instrument } from "./types.ts"

const MAX_BARS = 400
const store: Record<Instrument, Candle[]> = { SPY: [], SPXW: [] }
let lastIngestAt: Record<Instrument, number> = { SPY: 0, SPXW: 0 }

export interface TvBar {
  time?: number | string
  open?: number
  high?: number
  low?: number
  close?: number
  price?: number
  volume?: number
}

function toMs(time: number | string | undefined): number {
  if (time == null) return Date.now()
  if (typeof time === "number") return time < 1e12 ? time * 1000 : time // sec vs ms
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** Normalize a webhook payload into a Candle and append/merge it. */
export function ingestTvBar(instrument: Instrument, bar: TvBar): Candle | null {
  const close = bar.close ?? bar.price
  if (close == null || !Number.isFinite(close)) return null
  const time = toMs(bar.time)
  const candle: Candle = {
    time,
    open: bar.open ?? close,
    high: bar.high ?? close,
    low: bar.low ?? close,
    close,
    volume: bar.volume ?? 0,
  }
  const buf = store[instrument]
  const last = buf[buf.length - 1]
  // Same-bar update (same timestamp bucket) → replace; otherwise append.
  if (last && Math.abs(last.time - candle.time) < 1000) {
    buf[buf.length - 1] = candle
  } else {
    buf.push(candle)
    if (buf.length > MAX_BARS) buf.shift()
  }
  lastIngestAt[instrument] = Date.now()
  return candle
}

export function getTvCandles(instrument: Instrument): Candle[] {
  return store[instrument].slice()
}

export function tvLastIngest(instrument: Instrument): number {
  return lastIngestAt[instrument]
}

export function clearTv(instrument?: Instrument): void {
  if (instrument) {
    store[instrument] = []
    lastIngestAt[instrument] = 0
  } else {
    store.SPY = []
    store.SPXW = []
    lastIngestAt = { SPY: 0, SPXW: 0 }
  }
}
