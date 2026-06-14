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
import { BARS_PER_YEAR, getDailyLevels, getIntraday } from "./market-data.ts"
import { sessionContext } from "./session.ts"
import {
  buildKeyLevels,
  buildSignals,
  DEFAULT_RISK_PER_TRADE,
  hoursToClose,
  keyLevelSignal,
  recommendStrike,
  scoreBias,
} from "./strike-engine.ts"
import type {
  AgentReport,
  Candle,
  IndicatorSnapshot,
  Instrument,
  KeyLevels,
  SessionContext,
} from "./types.ts"

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
  session: SessionContext,
  keyLevels: KeyLevels,
  report: Pick<AgentReport, "direction" | "confidence" | "expectedMove" | "recommendation">,
): string[] {
  const lines: string[] = []
  const dirWord =
    report.direction === "bullish" ? "upside (calls)" : report.direction === "bearish" ? "downside (puts)" : "no clear edge"

  lines.push(
    `Net read: ${report.direction.toUpperCase()} with ${report.confidence}% conviction — leaning ${dirWord}.`,
  )
  lines.push(`Session: ${session.label}. ${session.note}`)
  const res = keyLevels.nearestResistance
  const sup = keyLevels.nearestSupport
  lines.push(
    `Key levels — nearest resistance ${res ? `${res.label} ${res.price.toFixed(2)}` : "n/a"}, ` +
      `nearest support ${sup ? `${sup.label} ${sup.price.toFixed(2)}` : "n/a"}; ` +
      `prior day ${keyLevels.prevLow.toFixed(2)}–${keyLevels.prevHigh.toFixed(2)} (close ${keyLevels.prevClose.toFixed(2)}).`,
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
    const s = r.sizing
    lines.push(
      `Sizing (≈$${s.riskPerTrade} risk): ${s.contracts} contract${s.contracts === 1 ? "" : "s"} — ` +
        `premium target ~$${s.targetPremium.toFixed(2)}, stop ~$${s.stopPremium.toFixed(2)}; ` +
        `~+$${Math.round(s.profitAtTarget)} at target vs −$${Math.round(s.maxLoss)} at stop.`,
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
  /** Dollar risk budget (1R) used for position sizing. */
  riskPerTrade?: number
  /** Override the clock (for testing different session phases). */
  now?: Date
}

export async function runAgent(opts: RunOptions = {}): Promise<AgentReport> {
  const instrument: Instrument = opts.instrument ?? "SPY"
  const now = opts.now ?? new Date()
  const riskPerTrade = opts.riskPerTrade ?? DEFAULT_RISK_PER_TRADE
  const { symbol, candles, source } = await getIntraday(instrument)

  const ind = buildSnapshot(candles)
  const daily = await getDailyLevels(instrument, candles)
  const keyLevels = buildKeyLevels(ind, daily)

  const signals = [...buildSignals(ind), keyLevelSignal(ind, keyLevels)]
  const session = sessionContext(now)

  // Score the raw bias, then temper conviction by the time-of-day context:
  // the same signals are worth more in the morning trend than at midday.
  const rawBias = scoreBias(signals)
  const bias = {
    ...rawBias,
    confidence: Math.round(Math.max(5, Math.min(95, rawBias.confidence * session.multiplier))),
  }

  const hoursLeft = hoursToClose(now)
  const years = hoursLeft / (365 * 24)
  const iv = Math.max(0.08, Math.min(1.5, ind.realizedVol * 1.15 + 0.02))
  const expectedMove = ind.price * iv * Math.sqrt(years)

  const recommendation = recommendStrike(instrument, ind, bias, hoursLeft, riskPerTrade)

  const report: AgentReport = {
    instrument,
    underlyingSymbol: symbol,
    generatedAt: now.toISOString(),
    source,
    price: ind.price,
    direction: bias.direction,
    confidence: bias.confidence,
    expectedMove,
    session,
    keyLevels,
    indicators: ind,
    signals,
    recommendation,
    reasoning: [],
    candles: candles.slice(-Math.max(1, opts.chartBars ?? candles.length)),
    disclaimer: DISCLAIMER,
  }
  report.reasoning = buildReasoning(instrument, ind, session, keyLevels, report)
  return report
}
