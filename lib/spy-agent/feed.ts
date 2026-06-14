// Honest data-freshness classification. The agent never *assumes* a feed is
// live — it measures the age of the freshest data point (`asOf`) against the
// wall clock and labels it accordingly, so delayed data can't masquerade as
// real-time for live 0DTE decisions.

import { etDecimalHour } from "./session.ts"

export type Feed = "real-time" | "delayed" | "simulated" | "closed"

/** Max age (seconds) of the latest print to still count as real-time. */
export const REALTIME_MAX_LATENCY_SEC = Number(process.env.REALTIME_MAX_LATENCY_SEC) || 90

export interface Freshness {
  feed: Feed
  latencySeconds: number
  asOf: string
  /** True only when data is genuinely fresh enough to trade live on. */
  isLive: boolean
}

export function isMarketOpen(now = new Date()): boolean {
  const h = etDecimalHour(now)
  const day = new Date(now.getTime() - 4 * 3600 * 1000).getUTCDay() // ET weekday
  const weekday = day >= 1 && day <= 5
  return weekday && h >= 9.5 && h < 16
}

/**
 * Classify a feed from the freshest data timestamp.
 * - simulated: no real data at all
 * - closed: real data, but the cash session isn't open (can't be "live")
 * - real-time: latest print is within REALTIME_MAX_LATENCY_SEC
 * - delayed: real data but stale (e.g. a 15-min delayed feed)
 */
export function classifyFreshness(
  asOfMs: number | null,
  simulated: boolean,
  now = new Date(),
): Freshness {
  if (simulated || asOfMs == null) {
    return { feed: "simulated", latencySeconds: Infinity, asOf: new Date(asOfMs ?? now).toISOString(), isLive: false }
  }
  const latencySeconds = Math.max(0, Math.round((now.getTime() - asOfMs) / 1000))
  const open = isMarketOpen(now)
  let feed: Feed
  if (!open) feed = "closed"
  else if (latencySeconds <= REALTIME_MAX_LATENCY_SEC) feed = "real-time"
  else feed = "delayed"
  return { feed, latencySeconds, asOf: new Date(asOfMs).toISOString(), isLive: feed === "real-time" }
}

export function feedLabel(f: Feed): string {
  switch (f) {
    case "real-time":
      return "REAL-TIME"
    case "delayed":
      return "DELAYED"
    case "closed":
      return "MARKET CLOSED"
    default:
      return "SIMULATED"
  }
}
