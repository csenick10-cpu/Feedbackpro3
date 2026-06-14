// Core domain types for the SPY/SPXW 0DTE intraday agent.

/** A single intraday OHLCV candle. `time` is a unix epoch in ms. */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Instrument = "SPY" | "SPXW"

export type DataSource = "live" | "simulated"

/** Snapshot of computed technical indicators at the latest bar. */
export interface IndicatorSnapshot {
  price: number
  vwap: number
  ema9: number
  ema21: number
  ema50: number
  rsi14: number
  macd: number
  macdSignal: number
  macdHist: number
  atr14: number
  /** Annualized realized volatility estimate (decimal, e.g. 0.18 = 18%). */
  realizedVol: number
  openingRangeHigh: number
  openingRangeLow: number
  sessionHigh: number
  sessionLow: number
  /** Percentage move from the session open. */
  changeFromOpenPct: number
  /** Bars elapsed in the session (used for context / freshness). */
  bars: number
}

export type Direction = "bullish" | "bearish" | "neutral"
export type OptionType = "call" | "put"

/** One scored signal that contributes to the directional decision. */
export interface Signal {
  name: string
  /** -1 (max bearish) .. +1 (max bullish). */
  score: number
  /** Relative importance of this signal in the blend (0..1). */
  weight: number
  detail: string
}

/** Greeks + price for the recommended 0DTE contract (Black-Scholes). */
export interface OptionMetrics {
  iv: number
  premium: number
  delta: number
  gamma: number
  theta: number
  /** Underlying breakeven at expiry. */
  breakeven: number
  /** Hours of trading time left until 0DTE expiry. */
  hoursToExpiry: number
}

export interface StrikeRecommendation {
  optionType: OptionType
  strike: number
  /** "ATM" | "1 OTM" | "2 ITM" style label. */
  moneyness: string
  underlyingEntry: number
  /** Suggested underlying target & stop for the trade idea. */
  underlyingTarget: number
  underlyingStop: number
  /** Underlying level that invalidates the directional thesis. */
  invalidation: number
  riskRewardRatio: number
  option: OptionMetrics
}

export interface AgentReport {
  instrument: Instrument
  underlyingSymbol: string
  generatedAt: string
  source: DataSource
  price: number
  direction: Direction
  /** 0..100 conviction in the directional call. */
  confidence: number
  /** Estimated 1-sigma move over the remaining session (underlying points). */
  expectedMove: number
  indicators: IndicatorSnapshot
  signals: Signal[]
  recommendation: StrikeRecommendation | null
  reasoning: string[]
  /** Compact recent price action for charting (last N candles). */
  candles: Candle[]
  disclaimer: string
}
