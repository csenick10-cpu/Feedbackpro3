import { NextResponse } from "next/server"
import { ingestTvBar, getTvCandles, type TvBar } from "@/lib/spy-agent/tv-store.ts"
import type { Instrument } from "@/lib/spy-agent/types.ts"

export const dynamic = "force-dynamic"

// Webhook for TradingView alerts (Pine Script `alert()`). Configure a TradingView
// alert with "Webhook URL" pointing here and a JSON message body, e.g.:
//
//   {
//     "secret": "YOUR_SECRET",
//     "symbol": "SPY",
//     "time":  "{{time}}",
//     "open":  {{open}},  "high": {{high}},
//     "low":   {{low}},   "close": {{close}},
//     "volume": {{volume}}
//   }
//
// Fire it "Once Per Bar Close" on a 5-minute SPY/SPX chart and the agent will
// run on genuine, real-time TradingView prints.

function resolveInstrument(symbol: unknown): Instrument | null {
  const s = String(symbol ?? "").toUpperCase()
  if (!s) return null
  if (s.includes("SPX")) return "SPXW"
  if (s.includes("SPY")) return "SPY"
  return null
}

export async function POST(request: Request) {
  let body: (TvBar & { symbol?: string; instrument?: string; secret?: string }) | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const expected = process.env.TRADINGVIEW_WEBHOOK_SECRET
  if (expected && body.secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const instrument = resolveInstrument(body.instrument ?? body.symbol)
  if (!instrument) {
    return NextResponse.json({ error: "unknown_symbol", hint: "symbol must contain SPY or SPX" }, { status: 400 })
  }

  const candle = ingestTvBar(instrument, body)
  if (!candle) {
    return NextResponse.json({ error: "missing_price", hint: "include close or price" }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    instrument,
    ingested: candle,
    bufferedBars: getTvCandles(instrument).length,
  })
}

// Lightweight status check for the buffer.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const instrument = resolveInstrument(searchParams.get("instrument") ?? searchParams.get("symbol") ?? "SPY") ?? "SPY"
  const candles = getTvCandles(instrument)
  return NextResponse.json({
    instrument,
    bufferedBars: candles.length,
    lastBar: candles[candles.length - 1] ?? null,
    ready: candles.length >= 30,
  })
}
