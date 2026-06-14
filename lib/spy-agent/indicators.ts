// Pure technical-analysis helpers. No I/O, no framework deps so this runs
// unchanged in Node (CLI) and the Next.js bundler.

import type { Candle } from "./types.ts"

export function sma(values: number[], period: number): number {
  if (values.length < period) period = values.length
  if (period === 0) return 0
  const slice = values.slice(values.length - period)
  return slice.reduce((a, b) => a + b, 0) / period
}

/** Exponential moving average series aligned to `values`. */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k))
  }
  return out
}

export function ema(values: number[], period: number): number {
  const series = emaSeries(values, period)
  return series[series.length - 1] ?? 0
}

/** Wilder's RSI over the last `period` deltas. Returns 0..100. */
export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export interface MacdResult {
  macd: number
  signal: number
  histogram: number
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (values.length < slow) return { macd: 0, signal: 0, histogram: 0 }
  const fastSeries = emaSeries(values, fast)
  const slowSeries = emaSeries(values, slow)
  const macdLine = fastSeries.map((v, i) => v - slowSeries[i])
  const signalSeries = emaSeries(macdLine, signalPeriod)
  const macdVal = macdLine[macdLine.length - 1]
  const signalVal = signalSeries[signalSeries.length - 1]
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal }
}

/** Average True Range (Wilder smoothing approximation). */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const prevClose = candles[i - 1].close
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)))
  }
  const p = Math.min(period, trs.length)
  return sma(trs, p)
}

/** Session VWAP (cumulative typical-price * volume / cumulative volume). */
export function vwap(candles: Candle[]): number {
  let pv = 0
  let vol = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    pv += typical * c.volume
    vol += c.volume
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1]?.close ?? 0
}

/**
 * Annualized realized volatility from intraday log returns.
 * Scales the per-bar stdev up to a yearly figure using the number of
 * bars per trading year for the given bar interval.
 */
export function realizedVol(closes: number[], barsPerYear: number): number {
  if (closes.length < 3) return 0.15
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
  const perBar = Math.sqrt(variance)
  return perBar * Math.sqrt(barsPerYear)
}

/** High/low of the first `n` bars — the "opening range". */
export function openingRange(candles: Candle[], n = 6): { high: number; low: number } {
  const slice = candles.slice(0, Math.min(n, candles.length))
  return {
    high: Math.max(...slice.map((c) => c.high)),
    low: Math.min(...slice.map((c) => c.low)),
  }
}
