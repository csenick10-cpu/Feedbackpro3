// CLI: scan SPY / SPXW intraday price action and print the 0DTE recommendation.
//
//   node scripts/spy-scan.ts            # SPY
//   node scripts/spy-scan.ts SPXW       # SPX weeklys
//   node scripts/spy-scan.ts SPY --json # machine-readable
//
// Runs directly on Node 22+ (built-in TypeScript type stripping).

import { runAgent } from "../lib/spy-agent/agent.ts"
import type { Instrument } from "../lib/spy-agent/types.ts"

const args = process.argv.slice(2)
const asJson = args.includes("--json")
const sym = (args.find((a) => !a.startsWith("--")) ?? "SPY").toUpperCase()
const instrument: Instrument = sym === "SPXW" || sym === "SPX" ? "SPXW" : "SPY"

const bar = (pct: number, width = 24) => {
  const filled = Math.round((pct / 100) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}

const arrow = (s: number) => (s > 0.1 ? "▲" : s < -0.1 ? "▼" : "▬")

const report = await runAgent({ instrument })

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const r = report
  const ind = r.indicators
  console.log("")
  console.log(`  ⚡ 0DTE AGENT — ${r.instrument} (${r.underlyingSymbol})   [data: ${r.source}]`)
  console.log(`  ${new Date(r.generatedAt).toLocaleString()}`)
  console.log("  " + "─".repeat(58))
  console.log(`  Price ${r.price.toFixed(2)}   VWAP ${ind.vwap.toFixed(2)}   ATR ${ind.atr14.toFixed(2)}`)
  console.log(`  Bias  ${r.direction.toUpperCase().padEnd(8)} ${bar(r.confidence)} ${r.confidence}%`)
  console.log(`  ~1σ move left in session: ${r.expectedMove.toFixed(2)} pts`)
  console.log("")
  console.log("  Signals")
  for (const s of r.signals) {
    console.log(`   ${arrow(s.score)} ${s.name.padEnd(22)} ${(s.score >= 0 ? "+" : "") + s.score.toFixed(2)}  ${s.detail}`)
  }
  console.log("")
  if (r.recommendation) {
    const c = r.recommendation
    const o = c.option
    console.log("  ► RECOMMENDATION")
    console.log(`    ${r.instrument} ${c.strike}${c.optionType === "call" ? "C" : "P"}  (${c.moneyness})`)
    console.log(`    Premium ~$${o.premium.toFixed(2)}   Δ ${o.delta.toFixed(2)}   Γ ${o.gamma.toFixed(4)}   Θ ${o.theta.toFixed(2)}/day`)
    console.log(`    Breakeven ${o.breakeven.toFixed(2)}   IV ${(o.iv * 100).toFixed(1)}%   ~${o.hoursToExpiry.toFixed(1)}h to expiry`)
    console.log(`    Entry ${c.underlyingEntry.toFixed(2)}  →  Target ${c.underlyingTarget.toFixed(2)}  |  Stop ${c.underlyingStop.toFixed(2)}  (R:R ${c.riskRewardRatio.toFixed(2)})`)
    console.log(`    Invalidation: ${c.invalidation.toFixed(2)}`)
  } else {
    console.log("  ► NO HIGH-CONVICTION SETUP — stand aside / wait for confirmation.")
  }
  console.log("")
  console.log("  Reasoning")
  for (const line of r.reasoning) console.log(`   • ${line}`)
  console.log("")
  console.log(`  ${r.disclaimer}`)
  console.log("")
}
