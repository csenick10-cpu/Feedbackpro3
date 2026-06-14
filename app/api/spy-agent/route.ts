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

  try {
    const report = await runAgent({ instrument, chartBars: 78 })
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
