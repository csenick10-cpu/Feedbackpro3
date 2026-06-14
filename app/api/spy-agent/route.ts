import { NextResponse } from "next/server"
import { runAgent } from "@/lib/spy-agent/agent.ts"
import type { Instrument } from "@/lib/spy-agent/types.ts"

// Always run fresh — intraday signals are time-sensitive.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get("instrument") ?? "SPY").toUpperCase()
  const instrument: Instrument = raw === "SPXW" || raw === "SPX" ? "SPXW" : "SPY"
  const riskRaw = Number(searchParams.get("risk"))
  const riskPerTrade = Number.isFinite(riskRaw) && riskRaw > 0 ? riskRaw : undefined

  try {
    const report = await runAgent({ instrument, chartBars: 78, riskPerTrade })
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "scan_failed", message: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    )
  }
}
