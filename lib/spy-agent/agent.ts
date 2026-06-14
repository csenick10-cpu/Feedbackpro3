// Orchestrator: pull intraday data, compute the indicator snapshot, score the
// directional bias, pick the 0DTE strike, and assemble a human-readable report.

import {
  atr,
  ema,
  macd,
  openingRange,
  realizedVol,
  rsi,
  vwap,
} from "./indicators.ts"
import { BARS_PER_YEAR, getIntraday } from "./market-data.ts"
import {
  buildSignals,
  hoursToClose,
  recommendStrike,
  scoreBias,
} from "./strike-engine.ts"
import type { AgentReport, Candle, IndicatorSnapshot, Instrument } from "./types.ts"

const DISCLAIMER =
  "Educational tool only — not financial advice. 0DTE options are extremely high risk and can expire worthless within minutes. Signals are derived from delayed/estimated data and a rules-based model. Do your own research and manage risk."

function buildSnapshot(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close)
  const price = closes[closes.length - 1]
  const open = candles[0].open
  const or = openingRange(candles, 6)
  const m = macd(closes)
  return {
    price,
    vwap: vwap(candles),
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    rsi14: rsi(closes, 14),
    macd: m.macd,
    macdSignal: m.signal,
    macdHist: m.histogram,
    atr14: atr(candles, 14),
    realizedVol: realizedVol(closes, BARS_PER_YEAR),
    openingRangeHigh: or.high,
    openingRangeLow: or.low,
    sessionHigh: Math.max(...candles.map((c) => c.high)),
    sessionLow: Math.min(...candles.map((c) => c.low)),
    changeFromOpenPct: ((price - open) / open) * 100,
    bars: candles.length,
  }
}

function buildReasoning(
  instrument: Instrument,
  ind: IndicatorSnapshot,
  report: Pick<AgentReport, "direction" | "confidence" | "expectedMove" | "recommendation">,
): string[] {
  const lines: string[] = []
  const dirWord =
    report.direction === "bullish" ? "upside (calls)" : report.direction === "bearish" ? "downside (puts)" : "no clear edge"

  lines.push(
    `Net read: ${report.direction.toUpperCase()} with ${report.confidence}% conviction — leaning ${dirWord}.`,
  )
  lines.push(
    `Price ${ind.price.toFixed(2)} is ${ind.price >= ind.vwap ? "above" : "below"} VWAP ${ind.vwap.toFixed(2)}; ` +
      `EMAs 9/21/50 = ${ind.ema9.toFixed(2)}/${ind.ema21.toFixed(2)}/${ind.ema50.toFixed(2)}.`,
  )
  lines.push(
    `RSI ${ind.rsi14.toFixed(1)}, MACD hist ${ind.macdHist >= 0 ? "+" : ""}${ind.macdHist.toFixed(3)}, ` +
      `ATR ${ind.atr14.toFixed(2)}, realized vol ${(ind.realizedVol * 100).toFixed(1)}%.`,
  )
  lines.push(
    `Expected ~1σ move over the remaining session ≈ ${report.expectedMove.toFixed(2)} pts ` +
      `(session range so far ${ind.sessionLow.toFixed(2)}–${ind.sessionHigh.toFixed(2)}).`,
  )

  if (report.recommendation) {
    const r = report.recommendation
    lines.push(
      `Best 0DTE: ${instrument} ${r.strike}${r.optionType === "call" ? "C" : "P"} (${r.moneyness}). ` +
        `Est. premium ${r.option.premium.toFixed(2)}, Δ ${r.option.delta.toFixed(2)}, ` +
        `θ ${r.option.theta.toFixed(2)}/day, breakeven ${r.option.breakeven.toFixed(2)}.`,
    )
    lines.push(
      `Plan: enter near ${r.underlyingEntry.toFixed(2)}, target ${r.underlyingTarget.toFixed(2)}, ` +
        `stop ${r.underlyingStop.toFixed(2)} (R:R ${r.riskRewardRatio.toFixed(2)}). ` +
        `Thesis invalid below/above ${r.invalidation.toFixed(2)} (loss of the VWAP/EMA21 pivot).`,
    )
  } else {
    lines.push(
      "Signals are mixed — no high-conviction 0DTE setup. Best trade is patience: wait for a VWAP reclaim/rejection or an opening-range break to define direction.",
    )
  }
  return lines
}

export interface RunOptions {
  instrument?: Instrument
  /** Trim the candles returned for charting to keep payloads small. */
  chartBars?: number
}

export async function runAgent(opts: RunOptions = {}): Promise<AgentReport> {
  const instrument: Instrument = opts.instrument ?? "SPY"
  const { symbol, candles, source } = await getIntraday(instrument)

  const ind = buildSnapshot(candles)
  const signals = buildSignals(ind)
  const bias = scoreBias(signals)
  const hoursLeft = hoursToClose()

  const years = hoursLeft / (365 * 24)
  const iv = Math.max(0.08, Math.min(1.5, ind.realizedVol * 1.15 + 0.02))
  const expectedMove = ind.price * iv * Math.sqrt(years)

  const recommendation = recommendStrike(instrument, ind, bias, hoursLeft)

  const report: AgentReport = {
    instrument,
    underlyingSymbol: symbol,
    generatedAt: new Date().toISOString(),
    source,
    price: ind.price,
    direction: bias.direction,
    confidence: bias.confidence,
    expectedMove,
    indicators: ind,
    signals,
    recommendation,
    reasoning: [],
    candles: candles.slice(-Math.max(1, opts.chartBars ?? candles.length)),
    disclaimer: DISCLAIMER,
  }
  report.reasoning = buildReasoning(instrument, ind, report)
  return report
}
