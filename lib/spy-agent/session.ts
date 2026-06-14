// Time-of-day context for the regular trading session (RTH). Day-trading edge
// is highly dependent on *when* in the session you are: the opening drive and
// power hour trend and expand, midday tends to chop. The agent uses this to
// modulate conviction and to tell the trader whether the clock favors the setup.

export type SessionPhase =
  | "pre-open"
  | "opening-drive"
  | "morning-trend"
  | "midday-chop"
  | "afternoon-trend"
  | "power-hour"
  | "closed"

export interface SessionContext {
  phase: SessionPhase
  label: string
  /** Whether the live cash session is open for 0DTE day trading. */
  tradeable: boolean
  /** Conviction multiplier applied to the raw signal score (0..1.15). */
  multiplier: number
  /** Minutes elapsed since the 09:30 ET open (negative before the open). */
  minutesIntoSession: number
  note: string
}

/** Decimal ET hour (e.g. 9.5 = 09:30) accounting for the US Eastern offset. */
export function etDecimalHour(now = new Date()): number {
  // EDT is UTC-4. Good enough for session bucketing (DST edge is cosmetic).
  return ((now.getUTCHours() - 4 + 24) % 24) + now.getUTCMinutes() / 60
}

export function sessionContext(now = new Date()): SessionContext {
  const h = etDecimalHour(now)
  const minutesIntoSession = Math.round((h - 9.5) * 60)
  const open = h >= 9.5 && h < 16

  if (!open) {
    const phase: SessionPhase = h < 9.5 ? "pre-open" : "closed"
    return {
      phase,
      label: phase === "pre-open" ? "Pre-market" : "After hours",
      tradeable: false,
      multiplier: 0.6,
      minutesIntoSession,
      note:
        phase === "pre-open"
          ? "Cash session not open yet — levels are provisional. Wait for the 09:30 ET open to confirm direction."
          : "Regular session closed — this is an illustrative read for the next session, not a live 0DTE trade.",
    }
  }

  // Open buckets.
  if (h < 10) {
    return {
      phase: "opening-drive",
      label: "Opening drive (9:30–10:00)",
      tradeable: true,
      multiplier: 1.1,
      minutesIntoSession,
      note: "High momentum and volume. Favor opening-range breakouts; expect fast, expansive moves — size accordingly.",
    }
  }
  if (h < 11.5) {
    return {
      phase: "morning-trend",
      label: "Morning trend (10:00–11:30)",
      tradeable: true,
      multiplier: 1.15,
      minutesIntoSession,
      note: "Prime trend-continuation window. Cleanest directional follow-through of the day.",
    }
  }
  if (h < 14) {
    return {
      phase: "midday-chop",
      label: "Midday chop (11:30–14:00)",
      tradeable: true,
      multiplier: 0.75,
      minutesIntoSession,
      note: "Lower volume, mean-reverting tape. Conviction discounted — scalp tight or wait for the afternoon.",
    }
  }
  if (h < 15) {
    return {
      phase: "afternoon-trend",
      label: "Afternoon trend (14:00–15:00)",
      tradeable: true,
      multiplier: 1.0,
      minutesIntoSession,
      note: "Trend often resumes after the midday lull. Watch for VWAP reclaims/rejections.",
    }
  }
  return {
    phase: "power-hour",
    label: "Power hour (15:00–16:00)",
    tradeable: true,
    multiplier: 1.1,
    minutesIntoSession,
    note: "0DTE gamma is at its hottest — moves accelerate but theta decays fast. Be decisive and manage time risk.",
  }
}
