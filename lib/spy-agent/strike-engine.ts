// The decision core: turn an indicator snapshot into a scored directional bias
// and a concrete 0DTE strike recommendation with Black-Scholes greeks.

import type {
  Direction,
  IndicatorSnapshot,
  Instrument,
  OptionMetrics,
  OptionType,
  Signal,
  StrikeRecommendation,
} from "./types.ts"

const RISK_FREE = 0.04

/** Strike increment listed for each instrument's 0DTE chain. */
export function strikeIncrement(instrument: Instrument): number {
  return instrument === "SPXW" ? 5 : 1
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// --- Black-Scholes -------------------------------------------------------

function normCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-0.5 * x * x)
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

function normPdf(x: number): number {
  return 0.3989422804014327 * Math.exp(-0.5 * x * x)
}

export function blackScholes(
  type: OptionType,
  spot: number,
  strike: number,
  iv: number,
  years: number,
): OptionMetrics {
  const T = Math.max(years, 1e-6)
  const sigma = Math.max(iv, 1e-4)
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(spot / strike) + (RISK_FREE + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const disc = Math.exp(-RISK_FREE * T)
  let premium: number
  let delta: number
  if (type === "call") {
    premium = spot * normCdf(d1) - strike * disc * normCdf(d2)
    delta = normCdf(d1)
  } else {
    premium = strike * disc * normCdf(-d2) - spot * normCdf(-d1)
    delta = normCdf(d1) - 1
  }
  const gamma = normPdf(d1) / (spot * sigma * sqrtT)
  // Theta per calendar day (annual theta / 365).
  const term1 = -(spot * normPdf(d1) * sigma) / (2 * sqrtT)
  const term2 =
    type === "call"
      ? -RISK_FREE * strike * disc * normCdf(d2)
      : RISK_FREE * strike * disc * normCdf(-d2)
  const thetaPerDay = (term1 + term2) / 365
  const breakeven = type === "call" ? strike + premium : strike - premium
  return {
    iv: sigma,
    premium: Math.max(premium, 0),
    delta,
    gamma,
    theta: thetaPerDay,
    breakeven,
    hoursToExpiry: years * 365 * 24,
  }
}

// --- Signal scoring ------------------------------------------------------

export function buildSignals(ind: IndicatorSnapshot): Signal[] {
  const atr = Math.max(ind.atr14, ind.price * 0.0005)
  const signals: Signal[] = []

  // 1. EMA trend stack.
  const stackBull = ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50
  const stackBear = ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50
  const spread = (ind.ema9 - ind.ema50) / atr
  signals.push({
    name: "EMA Trend Stack",
    weight: 0.24,
    score: clamp(spread / 3, -1, 1),
    detail: stackBull
      ? "9>21>50 EMAs stacked bullish"
      : stackBear
        ? "9<21<50 EMAs stacked bearish"
        : "EMAs intertwined / no clean trend",
  })

  // 2. VWAP location.
  const vwapDist = (ind.price - ind.vwap) / atr
  signals.push({
    name: "VWAP Location",
    weight: 0.22,
    score: clamp(vwapDist / 1.5, -1, 1),
    detail: `Price ${ind.price >= ind.vwap ? "above" : "below"} VWAP by ${Math.abs(ind.price - ind.vwap).toFixed(2)}`,
  })

  // 3. RSI momentum (fade the extremes slightly).
  let rsiScore = (ind.rsi14 - 50) / 25
  if (ind.rsi14 > 75 || ind.rsi14 < 25) rsiScore *= 0.6 // exhaustion discount
  signals.push({
    name: "RSI(14) Momentum",
    weight: 0.16,
    score: clamp(rsiScore, -1, 1),
    detail: `RSI ${ind.rsi14.toFixed(1)}${ind.rsi14 > 70 ? " (overbought)" : ind.rsi14 < 30 ? " (oversold)" : ""}`,
  })

  // 4. MACD histogram.
  signals.push({
    name: "MACD Histogram",
    weight: 0.16,
    score: clamp((ind.macdHist / atr) * 4, -1, 1),
    detail: `Hist ${ind.macdHist >= 0 ? "+" : ""}${ind.macdHist.toFixed(3)} (${ind.macd >= ind.macdSignal ? "bullish" : "bearish"} cross)`,
  })

  // 5. Opening-range breakout.
  let orScore = 0
  let orDetail = "Inside opening range"
  if (ind.price > ind.openingRangeHigh) {
    orScore = clamp((ind.price - ind.openingRangeHigh) / atr, 0, 1)
    orDetail = "Broke above opening range"
  } else if (ind.price < ind.openingRangeLow) {
    orScore = -clamp((ind.openingRangeLow - ind.price) / atr, 0, 1)
    orDetail = "Broke below opening range"
  }
  signals.push({ name: "Opening-Range Break", weight: 0.12, score: orScore, detail: orDetail })

  // 6. Trend from session open.
  signals.push({
    name: "Day Momentum",
    weight: 0.1,
    score: clamp(ind.changeFromOpenPct / 0.8, -1, 1),
    detail: `${ind.changeFromOpenPct >= 0 ? "+" : ""}${ind.changeFromOpenPct.toFixed(2)}% from the open`,
  })

  return signals
}

export interface BiasResult {
  direction: Direction
  confidence: number
  blended: number
}

export function scoreBias(signals: Signal[]): BiasResult {
  const totalWeight = signals.reduce((s, x) => s + x.weight, 0) || 1
  const blended = signals.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight

  let direction: Direction = "neutral"
  if (blended > 0.15) direction = "bullish"
  else if (blended < -0.15) direction = "bearish"

  // Agreement: weight share of signals pointing the same way as the net bias.
  const dirSign = Math.sign(blended) || 1
  const agreeWeight = signals
    .filter((x) => Math.sign(x.score) === dirSign && x.score !== 0)
    .reduce((s, x) => s + x.weight, 0)
  const agreement = agreeWeight / totalWeight

  const magnitude = Math.min(1, Math.abs(blended) / 0.5)
  let confidence = Math.round((0.45 * magnitude + 0.45 * agreement + 0.1) * 100)
  if (direction === "neutral") confidence = Math.min(confidence, 48)
  confidence = clamp(confidence, 5, 95)

  return { direction, confidence, blended }
}

// --- Trade-hours / expiry helpers ---------------------------------------

/** Trading hours remaining until the 0DTE PM settlement (16:00 ET). */
export function hoursToClose(now = new Date()): number {
  const etHour = ((now.getUTCHours() - 4 + 24) % 24) + now.getUTCMinutes() / 60
  const remaining = 16 - etHour
  if (remaining <= 0 || etHour < 9.5) return 6.5 // illustrate a full next session
  return clamp(remaining, 0.25, 6.5)
}

// --- Strike recommendation ----------------------------------------------

export function recommendStrike(
  instrument: Instrument,
  ind: IndicatorSnapshot,
  bias: BiasResult,
  hoursLeft: number,
): StrikeRecommendation | null {
  if (bias.direction === "neutral") return null

  const inc = strikeIncrement(instrument)
  const spot = ind.price
  const optionType: OptionType = bias.direction === "bullish" ? "call" : "put"
  const dir = bias.direction === "bullish" ? 1 : -1

  // Years to expiry (calendar fraction) for a 0DTE contract.
  const years = hoursLeft / (365 * 24)
  // IV: lean on realized vol, floor + 0DTE premium bump.
  const iv = clamp(ind.realizedVol * 1.15 + 0.02, 0.08, 1.5)
  const expectedMove = spot * iv * Math.sqrt(years) // ~1-sigma underlying move

  // Strike offset by conviction: high conviction reaches for OTM gamma,
  // low conviction buys ITM delta for safety.
  let offsetStrikes: number
  if (bias.confidence >= 72) offsetStrikes = 1 // OTM
  else if (bias.confidence >= 58) offsetStrikes = 0 // ATM
  else offsetStrikes = -1 // ITM

  const atmStrike = Math.round(spot / inc) * inc
  const strike = atmStrike + offsetStrikes * inc * dir

  const moneyness =
    offsetStrikes === 0 ? "ATM" : offsetStrikes > 0 ? `${offsetStrikes} strike OTM` : `${-offsetStrikes} strike ITM`

  const atr = Math.max(ind.atr14, spot * 0.0005)
  const reward = Math.max(expectedMove * 0.9, atr * 1.2)
  const risk = Math.max(expectedMove * 0.55, atr * 0.8)
  const underlyingTarget = spot + dir * reward
  const underlyingStop = spot - dir * risk
  // Thesis dies on a decisive loss of the VWAP / EMA21 pivot.
  const pivot = dir === 1 ? Math.min(ind.vwap, ind.ema21) : Math.max(ind.vwap, ind.ema21)
  const invalidation = pivot - dir * 0.1 * atr

  const option = blackScholes(optionType, spot, strike, iv, years)

  return {
    optionType,
    strike,
    moneyness,
    underlyingEntry: spot,
    underlyingTarget,
    underlyingStop,
    invalidation,
    riskRewardRatio: risk > 0 ? reward / risk : 0,
    option,
  }
}
