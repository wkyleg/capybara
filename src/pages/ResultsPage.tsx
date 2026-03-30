import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeReportAnalytics } from '@/game/reportAnalytics';
import type { GameEvent, GameOverPayload, SpeedSample } from '@/game/runner';
import type { SessionReport } from '@/neuro/SessionRecorder';

interface StoredResults {
  report: SessionReport;
  game: GameOverPayload;
}

const tooltipStyle = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: 12,
  borderRadius: 12,
};

function CanopyOrnament({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <title>Canopy leaf</title>
      <path
        d="M8 32 Q14 18 24 22 Q34 14 40 28 Q36 36 24 34 Q12 38 8 32 Z"
        fill="rgba(134, 239, 172, 0.25)"
        stroke="rgba(134, 239, 172, 0.45)"
        strokeWidth="1"
      />
      <path
        d="M22 8 Q26 20 24 28 M30 10 Q28 22 26 30"
        fill="none"
        stroke="rgba(45, 212, 191, 0.4)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ResultsPage() {
  const navigate = useNavigate();

  const data = useMemo<StoredResults | null>(() => {
    try {
      const raw = sessionStorage.getItem('capybaraResults') ?? sessionStorage.getItem('copyparaResults');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const analytics = useMemo(() => (data ? computeReportAnalytics(data.report, data.game) : null), [data]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    const { report, game } = data;
    return report.samples.map((s) => {
      const speedPt = game.speedSamples.find((sp) => Math.abs(sp.tSec - s.t) < 0.55);
      const ab = s.alpha + s.beta > 1e-6 ? s.alpha / (s.beta + 1e-6) : null;
      return {
        t: s.t,
        calm: Math.round(s.calm * 100),
        arousal: Math.round(s.arousal * 100),
        bpm: s.bpm != null ? Math.round(s.bpm) : null,
        hrv: s.hrv != null ? Math.round(s.hrv * 10) / 10 : null,
        alphaBeta: ab != null ? Math.round(ab * 100) / 100 : null,
        speed: speedPt ? Math.round(speedPt.speed) : null,
        scale: speedPt ? Number(speedPt.neuroScale.toFixed(2)) : null,
      };
    });
  }, [data]);

  const eventMarkers = useMemo(() => {
    if (!data) return [];
    const { game } = data;
    return game.events.map((e: GameEvent) => ({
      t: e.tSec,
      type: e.type,
      key: `evt-${e.seq ?? `${e.tSec}-${e.type}-${JSON.stringify(e.meta ?? null)}`}`,
    }));
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-cream-300">
        <p className="mb-4 text-muted-tropical text-center max-w-sm">
          No jungle run yet — finish a dash to see your canopy report.
        </p>
        <button type="button" className="tropical-btn-ghost px-6 py-2.5 text-sm" onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    );
  }

  const { report, game } = data;
  const cov = analytics?.coverage;

  return (
    <div className="min-h-screen py-8 px-4 pb-20 text-cream-300">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CanopyOrnament className="shrink-0 opacity-90" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-sunset-500">Canopy report</h1>
          </div>
          <button
            type="button"
            className="tropical-btn-primary w-auto px-6 py-2.5 text-sm"
            onClick={() => navigate('/calibrate')}
          >
            Run again
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-tropical border-l-2 border-lagoon-500/40 pl-4">
          Time runs along like distance under the trees: <strong className="text-mint-400">calm</strong>,{' '}
          <strong className="text-yuzu-400">arousal</strong>, and scroll speed together. Dashed lines mark jumps,
          snacks, bumps, and yuzu glow-ups.
        </p>

        {analytics?.coverage?.lowConfidence && (
          <p className="text-xs rounded-xl border border-yuzu-500/25 bg-yuzu-500/5 px-4 py-3 text-cream-200">
            Sensor coverage was light this run (BPM ~{analytics.coverage.bpmPct.toFixed(0)}% of samples, HRV ~
            {analytics.coverage.hrvPct.toFixed(0)}%, bands ~{analytics.coverage.eegBandPct.toFixed(0)}%). Tie-ins are
            more reliable with EEG or camera rPPG connected.
          </p>
        )}

        {analytics && (
          <ul className="space-y-2 text-sm text-cream-200 border border-mint-500/20 rounded-xl p-4 bg-mint-500/5">
            {analytics.blurbs.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-mint-400 shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 tropical-panel">
          <Stat label="Distance" value={String(game.dist)} />
          <Stat label="Snacks" value={String(game.snacks)} />
          <Stat label="Max combo" value={String(game.maxCombo)} />
          <Stat label="Duration" value={`${game.durationSec.toFixed(1)}s`} />
          <Stat label="Mode" value={game.spicy ? 'Spicy' : 'Chill'} />
          <Stat label="Best ever" value={String(game.best)} />
          <Stat label="Dominant EEG" value={report.dominantState.split('—')[0]?.trim() ?? '—'} />
          <Stat label="Avg calm" value={`${Math.round(report.avgCalm * 100)}%`} />
          {analytics && (
            <>
              <Stat label="Jumps→hit ≤1s" value={String(analytics.jumpThenHitWithin1s)} />
              <Stat label="Arousal spikes" value={String(analytics.panicStretches)} />
              <Stat label="BPM coverage" value={cov ? `${cov.bpmPct.toFixed(0)}%` : '—'} />
              <Stat label="HRV coverage" value={cov ? `${cov.hrvPct.toFixed(0)}%` : '—'} />
            </>
          )}
        </div>

        {analytics && analytics.notableMoments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-yuzu-400">Notable moments</h2>
            <ul className="text-sm space-y-2 p-4 tropical-panel">
              {analytics.notableMoments.map((m) => (
                <li key={`${m.kind}-${m.tSec}-${m.detail}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="tabular-nums text-muted-tropical">{m.tSec.toFixed(1)}s</span>
                  <span className="font-display font-semibold text-lagoon-400">{m.kind}</span>
                  <span className="text-cream-200">{m.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-mint-400">Biometrics & pace</h2>
          <div className="h-72 w-full tropical-panel p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows}>
                <XAxis dataKey="t" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} name="Time (s)" />
                <YAxis yAxisId="left" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line yAxisId="left" type="monotone" dataKey="calm" stroke="#86efac" dot={false} name="Calm %" />
                <Line yAxisId="left" type="monotone" dataKey="arousal" stroke="#fbbf24" dot={false} name="Arousal %" />
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#2dd4bf" dot={false} name="Speed" />
                {eventMarkers.map((e) => (
                  <ReferenceLine
                    key={e.key}
                    yAxisId="left"
                    x={e.t}
                    stroke={
                      e.type === 'hit' || e.type === 'death' ? '#fb7185' : e.type === 'yuzu' ? '#fbbf24' : '#a78bfa'
                    }
                    strokeDasharray="3 3"
                    strokeOpacity={0.55}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-lagoon-400">
            BPM, HRV & alpha/beta
          </h2>
          <div className="h-64 w-full tropical-panel p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows}>
                <XAxis dataKey="t" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                <YAxis yAxisId="bio" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                <YAxis yAxisId="ratio" orientation="right" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  yAxisId="bio"
                  type="monotone"
                  dataKey="bpm"
                  stroke="#f472b6"
                  dot={false}
                  name="BPM"
                  connectNulls
                />
                <Line
                  yAxisId="bio"
                  type="monotone"
                  dataKey="hrv"
                  stroke="#38bdf8"
                  dot={false}
                  name="HRV"
                  connectNulls
                />
                <Line
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="alphaBeta"
                  stroke="#c4b5fd"
                  dot={false}
                  name="α/β"
                  connectNulls
                />
                {eventMarkers.map((e) => (
                  <ReferenceLine
                    key={`${e.key}-bio`}
                    yAxisId="bio"
                    x={e.t}
                    stroke={
                      e.type === 'hit' || e.type === 'death' ? '#fb7185' : e.type === 'yuzu' ? '#fbbf24' : '#a78bfa'
                    }
                    strokeDasharray="3 3"
                    strokeOpacity={0.45}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {analytics && (
          <section className="space-y-3">
            <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-mint-400">Run phases</h2>
            <div className="overflow-x-auto tropical-panel p-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-muted-tropical border-b border-white/10">
                    <th className="py-2 pr-3">Phase</th>
                    <th className="py-2 pr-3">Calm</th>
                    <th className="py-2 pr-3">Arousal</th>
                    <th className="py-2 pr-3">HRV</th>
                    <th className="py-2 pr-3">Jumps</th>
                    <th className="py-2 pr-3">Snacks</th>
                    <th className="py-2">Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.phases.map((p) => (
                    <tr key={p.phaseIndex} className="border-b border-white/5 text-cream-200">
                      <td className="py-2 pr-3 font-display text-mint-400">{p.label}</td>
                      <td className="py-2 pr-3 tabular-nums">{(p.meanCalm * 100).toFixed(0)}%</td>
                      <td className="py-2 pr-3 tabular-nums">{(p.meanArousal * 100).toFixed(0)}%</td>
                      <td className="py-2 pr-3 tabular-nums">{p.meanHrv != null ? p.meanHrv.toFixed(1) : '—'}</td>
                      <td className="py-2 pr-3">{p.jumpCount}</td>
                      <td className="py-2 pr-3">{p.snackCount}</td>
                      <td className="py-2">{p.hitCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {analytics && (
          <section className="space-y-3">
            <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-lagoon-400">
              Events vs neuro (±2s windows)
            </h2>
            <div className="overflow-x-auto tropical-panel p-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-muted-tropical border-b border-white/10">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Count</th>
                    <th className="py-2 pr-3">Mean calm</th>
                    <th className="py-2 pr-3">Mean arousal</th>
                    <th className="py-2 pr-3">Mean HRV</th>
                    <th className="py-2">Δ calm vs run</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byEventType.map((row) => (
                    <tr key={row.type} className="border-b border-white/5 text-cream-200">
                      <td className="py-2 pr-3 font-mono text-yuzu-300">{row.type}</td>
                      <td className="py-2 pr-3">{row.count}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.meanCalm2s != null ? `${(row.meanCalm2s * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.meanArousal2s != null ? `${(row.meanArousal2s * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.meanHrv2s != null ? row.meanHrv2s.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 tabular-nums">
                        {row.deltaCalmVsBaseline != null
                          ? `${row.deltaCalmVsBaseline >= 0 ? '+' : ''}${(row.deltaCalmVsBaseline * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {analytics?.speedNeuro.fastestT != null && (
          <p className="text-xs text-muted-tropical">
            Fastest pace near{' '}
            <span className="text-cream-200 tabular-nums">{analytics.speedNeuro.fastestT.toFixed(1)}s</span>
            {analytics.speedNeuro.calmestAtSpeedT != null && (
              <>
                {' '}
                · calmest sampled speed point{' '}
                <span className="text-cream-200 tabular-nums">{analytics.speedNeuro.calmestAtSpeedT.toFixed(1)}s</span>
                {analytics.speedNeuro.calmestAtSpeed != null &&
                  ` (~${(analytics.speedNeuro.calmestAtSpeed * 100).toFixed(0)}% calm)`}
              </>
            )}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-lagoon-400">Event log</h2>
          <ul className="max-h-40 overflow-y-auto text-xs font-mono space-y-1 p-4 tropical-panel text-cream-200">
            {game.events.slice(-40).map((e: GameEvent) => (
              <li key={e.seq ?? `${e.tSec}-${e.type}-${JSON.stringify(e.meta ?? null)}`}>
                {e.tSec.toFixed(2)}s — {e.type}
                {e.meta && Object.keys(e.meta).length > 0 ? ` ${JSON.stringify(e.meta)}` : ''}
              </li>
            ))}
          </ul>
        </section>

        {game.speedSamples.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-yuzu-400">
              Neuro pace multiplier
            </h2>
            <div className="h-40 tropical-panel p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={game.speedSamples.map((s: SpeedSample) => ({
                    t: s.tSec,
                    scale: s.neuroScale,
                  }))}
                >
                  <XAxis dataKey="t" tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                  <YAxis yAxisId="scale" domain={[0.75, 1.3]} tick={{ fill: 'rgba(255,250,235,0.55)', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine yAxisId="scale" y={1} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                  <Line yAxisId="scale" type="monotone" dataKey="scale" stroke="#fb923c" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tropical-stat-label">{label}</div>
      <div className="text-lg font-bold tabular-nums font-display text-cream-100 mt-0.5">{value}</div>
    </div>
  );
}
