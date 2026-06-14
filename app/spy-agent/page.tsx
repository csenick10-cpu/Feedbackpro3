"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentReport, Candle, Instrument, Signal } from "@/lib/spy-agent/types.ts"

const ACCENT = {
  bullish: { text: "text-emerald-400", bg: "bg-emerald-500", soft: "bg-emerald-500/10", border: "border-emerald-500/40", label: "BULLISH" },
  bearish: { text: "text-red-400", bg: "bg-red-500", soft: "bg-red-500/10", border: "border-red-500/40", label: "BEARISH" },
  neutral: { text: "text-zinc-400", bg: "bg-zinc-500", soft: "bg-zinc-500/10", border: "border-zinc-500/40", label: "NEUTRAL" },
} as const

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

export default function SpyAgentPage() {
  const [instrument, setInstrument] = useState<Instrument>("SPY")
  const [report, setReport] = useState<AgentReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scan = useCallback(async (inst: Instrument) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/spy-agent?instrument=${inst}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Scan failed (${res.status})`)
      setReport((await res.json()) as AgentReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    scan(instrument)
  }, [instrument, scan])

  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (auto) timer.current = setInterval(() => scan(instrument), 60_000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [auto, instrument, scan])

  const dir = report?.direction ?? "neutral"
  const accent = ACCENT[dir]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              0DTE Intraday Agent
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              SPY / SPXW Strike Scanner
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Scans live intraday price action and recommends the most optimal 0DTE strike.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-1">
              {(["SPY", "SPXW"] as Instrument[]).map((inst) => (
                <button
                  key={inst}
                  onClick={() => setInstrument(inst)}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                    instrument === inst ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
            <button
              onClick={() => scan(instrument)}
              disabled={loading}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Scanning…" : "↻ Rescan"}
            </button>
            <button
              onClick={() => setAuto((a) => !a)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                auto ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border text-muted-foreground hover:bg-accent"
              }`}
              title="Auto-rescan every 60s"
            >
              Auto {auto ? "ON" : "OFF"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!report && loading && <SkeletonGrid />}

        {report && (
          <>
            {/* Top status strip */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Stat label="Price" value={fmt(report.price)} mono />
              <Stat label="VWAP" value={fmt(report.indicators.vwap)} mono />
              <Stat label="ATR(14)" value={fmt(report.indicators.atr14)} mono />
              <Stat label="~1σ move left" value={`${fmt(report.expectedMove)} pts`} mono />
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    report.session.tradeable ? "bg-sky-500/15 text-sky-400" : "bg-zinc-500/20 text-zinc-400"
                  }`}
                  title={report.session.note}
                >
                  {report.session.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    report.source === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {report.source === "live" ? "LIVE DATA" : "SIMULATED"}
                </span>
                {new Date(report.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Recommendation */}
              <section className={`lg:col-span-2 rounded-xl border ${accent.border} ${accent.soft} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Recommendation
                  </h2>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${accent.text} ${accent.soft}`}>
                    {accent.label} · {report.confidence}%
                  </span>
                </div>

                {report.recommendation ? (
                  <Recommendation report={report} accent={accent} />
                ) : (
                  <div className="py-8 text-center">
                    <div className="text-2xl font-bold">No high-conviction setup</div>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      Signals are mixed. The optimal play is patience — wait for a VWAP reclaim/rejection or an
                      opening-range break to define direction.
                    </p>
                  </div>
                )}

                {/* Confidence gauge */}
                <div className="mt-5">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Conviction</span>
                    <span>{report.confidence}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div className={`h-full ${accent.bg} transition-all`} style={{ width: `${report.confidence}%` }} />
                  </div>
                </div>
              </section>

              {/* Price action chart */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Intraday Price Action
                </h2>
                <PriceChart candles={report.candles} vwap={report.indicators.vwap} dir={dir} />
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>L {fmt(report.indicators.sessionLow)}</span>
                  <span className={accent.text}>
                    {report.indicators.changeFromOpenPct >= 0 ? "+" : ""}
                    {fmt(report.indicators.changeFromOpenPct)}% from open
                  </span>
                  <span>H {fmt(report.indicators.sessionHigh)}</span>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                  <KeyLevel
                    label="Resistance"
                    level={report.keyLevels.nearestResistance}
                    tone="text-red-400"
                  />
                  <KeyLevel label="Support" level={report.keyLevels.nearestSupport} tone="text-emerald-400" />
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Prior day H / L</span>
                    <span className="font-mono">
                      {fmt(report.keyLevels.prevHigh)} / {fmt(report.keyLevels.prevLow)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Signals */}
              <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Signal Breakdown
                </h2>
                <div className="space-y-3">
                  {report.signals.map((s) => (
                    <SignalRow key={s.name} signal={s} />
                  ))}
                </div>
              </section>

              {/* Indicators */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Indicators
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Indicator label="EMA 9" value={fmt(report.indicators.ema9)} />
                  <Indicator label="EMA 21" value={fmt(report.indicators.ema21)} />
                  <Indicator label="EMA 50" value={fmt(report.indicators.ema50)} />
                  <Indicator label="RSI 14" value={fmt(report.indicators.rsi14, 1)} />
                  <Indicator label="MACD" value={fmt(report.indicators.macd, 3)} />
                  <Indicator label="Signal" value={fmt(report.indicators.macdSignal, 3)} />
                  <Indicator label="OR High" value={fmt(report.indicators.openingRangeHigh)} />
                  <Indicator label="OR Low" value={fmt(report.indicators.openingRangeLow)} />
                  <Indicator label="Realized Vol" value={`${fmt(report.indicators.realizedVol * 100, 1)}%`} />
                  <Indicator label="Bars" value={String(report.indicators.bars)} />
                </dl>
              </section>
            </div>

            {/* Reasoning */}
            <section className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Agent Reasoning
              </h2>
              <ul className="space-y-2">
                {report.reasoning.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <span className={accent.text}>›</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{report.disclaimer}</p>
          </>
        )}
      </div>
    </main>
  )
}

function Recommendation({ report, accent }: { report: AgentReport; accent: (typeof ACCENT)[keyof typeof ACCENT] }) {
  const r = report.recommendation!
  const o = r.option
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tracking-tight">
          {report.instrument} {r.strike}
          <span className={accent.text}>{r.optionType === "call" ? "C" : "P"}</span>
        </span>
        <span className="rounded-md bg-background/60 px-2 py-1 text-xs font-medium text-muted-foreground">
          {r.moneyness}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Est. Premium" value={`$${fmt(o.premium)}`} highlight />
        <Metric label="Delta" value={fmt(o.delta)} />
        <Metric label="Gamma" value={fmt(o.gamma, 4)} />
        <Metric label="Theta/day" value={fmt(o.theta)} />
        <Metric label="Breakeven" value={fmt(o.breakeven)} />
        <Metric label="Implied Vol" value={`${fmt(o.iv * 100, 1)}%`} />
        <Metric label="R : R" value={fmt(r.riskRewardRatio)} />
        <Metric label="To Expiry" value={`${fmt(o.hoursToExpiry, 1)}h`} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Level label="Entry" value={fmt(r.underlyingEntry)} tone="neutral" />
        <Level label="Target" value={fmt(r.underlyingTarget)} tone="bull" />
        <Level label="Stop" value={fmt(r.underlyingStop)} tone="bear" />
      </div>

      {/* Day-trade position sizing & premium-based exits */}
      <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Position Plan</span>
          <span className="text-muted-foreground">${r.sizing.riskPerTrade} risk · {r.sizing.contracts}x</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Tgt Premium" value={`$${fmt(r.sizing.targetPremium)}`} />
          <Metric label="Stop Premium" value={`$${fmt(r.sizing.stopPremium)}`} />
          <Metric label="Profit @ Tgt" value={`+$${Math.round(r.sizing.profitAtTarget)}`} highlight />
          <Metric label="Loss @ Stop" value={`-$${Math.round(r.sizing.maxLoss)}`} />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Thesis invalidated at <span className="font-semibold text-foreground">{fmt(r.invalidation)}</span> (loss of the
        VWAP / EMA21 pivot).
      </p>
    </>
  )
}

function SignalRow({ signal }: { signal: Signal }) {
  const pct = Math.min(100, Math.abs(signal.score) * 100)
  const bull = signal.score > 0.05
  const bear = signal.score < -0.05
  const tone = bull ? "bg-emerald-500" : bear ? "bg-red-500" : "bg-zinc-500"
  const text = bull ? "text-emerald-400" : bear ? "text-red-400" : "text-zinc-400"
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{signal.name}</span>
        <span className={`font-mono text-xs ${text}`}>
          {signal.score >= 0 ? "+" : ""}
          {signal.score.toFixed(2)}
        </span>
      </div>
      {/* Centered bar: bears extend left, bulls extend right. */}
      <div className="relative h-1.5 rounded-full bg-border">
        <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/20" />
        <div
          className={`absolute top-0 h-full rounded-full ${tone}`}
          style={bull ? { left: "50%", width: `${pct / 2}%` } : { right: "50%", width: `${pct / 2}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
    </div>
  )
}

function PriceChart({ candles, vwap, dir }: { candles: Candle[]; vwap: number; dir: keyof typeof ACCENT }) {
  if (!candles.length) return <div className="h-40" />
  const w = 320
  const h = 150
  const pad = 4
  const closes = candles.map((c) => c.close)
  const lo = Math.min(...candles.map((c) => c.low), vwap)
  const hi = Math.max(...candles.map((c) => c.high), vwap)
  const range = hi - lo || 1
  const x = (i: number) => pad + (i / (candles.length - 1)) * (w - 2 * pad)
  const y = (v: number) => pad + (1 - (v - lo) / range) * (h - 2 * pad)
  const line = closes.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ")
  const area = `${line} L${x(candles.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`
  const stroke = dir === "bullish" ? "#34d399" : dir === "bearish" ? "#f87171" : "#a1a1aa"
  const vwapY = y(vwap)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pa-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pa-fill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1={pad} y1={vwapY} x2={w - pad} y2={vwapY} stroke="#fbbf24" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
      <text x={w - pad} y={vwapY - 3} textAnchor="end" fontSize="8" fill="#fbbf24">
        VWAP
      </text>
    </svg>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
    </span>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border border-border px-3 py-2 ${highlight ? "bg-background/60" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
    </div>
  )
}

function Level({ label, value, tone }: { label: string; value: string; tone: "bull" | "bear" | "neutral" }) {
  const c = tone === "bull" ? "text-emerald-400" : tone === "bear" ? "text-red-400" : "text-foreground"
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-base font-bold ${c}`}>{value}</div>
    </div>
  )
}

function KeyLevel({
  label,
  level,
  tone,
}: {
  label: string
  level: { label: string; price: number } | null
  tone: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={tone}>{label}</span>
      <span className="font-mono text-foreground/90">
        {level ? `${level.label} · ${fmt(level.price)}` : "—"}
      </span>
    </div>
  )
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`h-48 animate-pulse rounded-xl border border-border bg-card ${i === 0 ? "lg:col-span-2" : ""}`}
        />
      ))}
    </div>
  )
}
