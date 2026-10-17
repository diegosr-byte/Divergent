import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiUrl, dataSource, listScenarios, loadScenario, whatIf, type Source } from './data';
import { pad3 } from './drones';
import MapView, { ALL_LAYERS, frameAt, type Layers } from './MapView';
import { alertKey, AlertsTab, alertsUpTo, LayersTab, MetricsTab, SurveyTab } from './panels';
import Logo from './Logo';
import Timeline from './Timeline';
import type { ReconRoute, Scenario, ScenarioListItem, WhatIfRequest } from './types';

const TABS = ['Layers', 'Alerts', 'Survey', 'Metrics'] as const;
type Tab = (typeof TABS)[number];
// The 3D view has its own analysis tabs and autonomous survey on the map, and layer toggles only drive the 2D map,
// so its sidebar keeps just the alerts feed (with Explain) and the scoreboard.
const TABS_FOR = { ops: ['Alerts', 'Metrics'], classic: ['Layers', 'Alerts', 'Survey', 'Metrics'] } as const satisfies Record<string, readonly Tab[]>;
// The 3D map pulls in MapLibre + deck.gl; load it on demand so the 2D view stays light (preloaded right away below).
const loadOps = () => import('./ops/OpsMap');
const OpsMap = lazy(loadOps);

// deck.gl 9 needs WebGL2; without it, start in the 2D view.
const hasWebGL2 = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
})();

// If the 3D view fails (no WebGL, chunk failed to load, render error), fall back to 2D instead of a blank page.
class OpsBoundary extends Component<{ onFail: (e: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { this.props.onFail(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const [list, setList] = useState<ScenarioListItem[]>([]);
  const [sid, setSid] = useState('demo');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [err, setErr] = useState('');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>('Alerts');
  const [layers, setLayers] = useState<Layers>(ALL_LAYERS);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ route: ReconRoute; t: number } | null>(null);
  const [alt, setAlt] = useState<{ scenario: Scenario; label: string } | null>(null);
  const [moveSensor, setMoveSensor] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [source, setSource] = useState<Source>(dataSource());
  const [view, setView] = useState<'ops' | 'classic'>(hasWebGL2 ? 'ops' : 'classic');
  const [sideOpen, setSideOpen] = useState(true);
  const [acked, setAcked] = useState<Set<string>>(() => new Set());
  const ack = useCallback((key: string) => setAcked((s) => new Set(s).add(key)), []);

  useEffect(() => {
    listScenarios().then(setList).catch((e) => setErr(String(e)));
    if (hasWebGL2) loadOps().catch(() => undefined); // fetch the 3D chunk while the scenario downloads
  }, []);

  useEffect(() => {
    let live = true;
    setScenario(null); setErr(''); setT(0); setPlaying(false);
    setSelectedTrack(null); setProposed(null); setAlt(null); setMoveSensor(null); setAcked(new Set());
    loadScenario(sid).then((s) => { if (live) { setScenario(s); setSource(dataSource()); } }).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [sid]);

  const maxT = scenario ? Math.max(0, scenario.frames.length - 1) : 0;

  // 4x: four simulated seconds per real second.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((x) => {
        if (x >= maxT) { setPlaying(false); return x; }
        return x + 1;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, maxT]);

  useEffect(() => {
    // Space = play/pause; ← / → step one second (Shift: ten), pausing first so the operator can read the frame.
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : document.body;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (target.closest('input, textarea, select, .maplibregl-canvas')) return; // the 3D map pans with arrows
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (e.code === 'ArrowLeft' ? -1 : 1);
        setPlaying(false);
        setT((x) => Math.min(maxT, Math.max(0, x + step)));
        return;
      }
      if (e.code !== 'Space' || target.closest('input, textarea, button')) return;
      e.preventDefault();
      setPlaying((p) => { if (!p && t >= maxT) setT(0); return !p; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t, maxT]);

  const onPlay = (p: boolean) => { if (p && t >= maxT) setT(0); setPlaying(p); };

  const runWhatIf = useCallback(async (req: WhatIfRequest) => {
    if (!scenario) return;
    setBusy(`What-if: ${req.action} ${req.sensor_id}…`); setErr('');
    try {
      const s = await whatIf(scenario, req);
      const label = req.action === 'disable' ? `What-if: ${req.sensor_id} disabled` : `What-if: ${req.sensor_id} moved to (${req.x}, ${req.y})`;
      setAlt({ scenario: s, label });
    } catch (e) { setErr(String(e)); }
    setBusy('');
  }, [scenario]);

  const alertMarks = useMemo(() => scenario?.frames.filter((f) => f.alerts.length).map((f) => f.t) ?? [], [scenario]);
  const alertEvents = useMemo(() => scenario?.frames.flatMap((f) => f.alerts.map((a) => ({ t: f.t, kind: a.kind }))), [scenario]);
  const shownView = alt ? 'classic' : view; // a what-if always opens in the 2D split
  const shownTab: Tab = (TABS_FOR[shownView] as readonly Tab[]).includes(tab) ? tab : 'Alerts';
  const alertCount = scenario ? alertsUpTo(scenario, t).filter((a) => !acked.has(alertKey(a))).length : 0; // open (unacknowledged)
  const reconRoute = scenario?.recon_route && scenario.recon_route.status !== 'proposed' ? scenario.recon_route : proposed?.route ?? null;
  const frame = scenario ? frameAt(scenario, t) : undefined;
  const live = frame?.tracks.filter((x) => x.status === 'active').length ?? 0;
  const teams = frame?.launch_teams.length ?? 0;

  return (
    <div className={`app${sideOpen ? '' : ' side-closed'}`}>
      <div className="classification" role="note">UNCLASSIFIED // EXERCISE // SIMULATED DATA</div>
      <header>
        <h1 className="brand"><span className="brand-mark">Divergent</span></h1>
        <label className="scenario">
          <span className="micro">Scenario</span>
          <select value={sid} onChange={(e) => setSid(e.target.value)}>
            {(list.length ? list : [{ id: sid, name: sid }]).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <span className={`src ${source === 'api' ? 'live' : ''}`} title={apiUrl || 'fixtures/scenario_demo.json'}>
          {source === 'api' ? 'Live API' : source === 'fallback' ? 'API unreachable · fixture' : 'Fixture'}
        </span>
        {busy && <span className="busy">{busy}</span>}
        {err && <span className="error inline" title={err}>{err}</span>}
        <span className="spacer" />
        {scenario && (
          <dl className="telemetry" aria-label="Picture at the current time">
            <div><dt>T+</dt><dd>{pad3(t)}<small>s</small></dd></div>
            <div><dt>Drones</dt><dd>{String(live).padStart(2, '0')}</dd></div>
            <div><dt>Teams</dt><dd>{String(teams).padStart(2, '0')}</dd></div>
            <div className={alertCount ? 'hot' : ''}><dt>Alerts</dt><dd>{String(alertCount).padStart(2, '0')}</dd></div>
          </dl>
        )}
        <span className="sim-pill">Simulated · decision support only</span>
      </header>

      <main>
        <section className={`maps ${alt ? 'split' : ''}`}>
          {scenario && shownView === 'ops' ? (
            <OpsBoundary onFail={(e) => { console.error(e); setView('classic'); setErr('3D view unavailable on this device; showing 2D'); }}>
              <Suspense fallback={<div className="loading">Loading 3D terrain…</div>}>
                <OpsMap scenario={scenario} t={t} playing={playing} onJump={(x) => { setPlaying(false); setT(x); }}
                  selectedTrack={selectedTrack} onSelectTrack={setSelectedTrack} reconRoute={reconRoute} />
              </Suspense>
            </OpsBoundary>
          ) : scenario ? (
            <>
              <MapView scenario={scenario} t={t} playing={playing} layers={layers} selectedTrack={selectedTrack} onSelectTrack={setSelectedTrack}
                reconRoute={reconRoute} label={alt ? 'Baseline' : undefined}
                onWhatIf={runWhatIf} moveSensor={moveSensor} onMoveSensor={setMoveSensor} />
              {alt && (
                <div className="alt">
                  <MapView scenario={alt.scenario} t={Math.min(t, alt.scenario.frames.length - 1)} playing={playing} layers={layers}
                    selectedTrack={selectedTrack} onSelectTrack={setSelectedTrack} reconRoute={null} label={alt.label} />
                  <button className="close-alt" onClick={() => setAlt(null)}>Close what-if ✕</button>
                </div>
              )}
            </>
          ) : (
            <div className="loading">{err ? 'Could not load scenario.' : source === 'fixture' ? 'Loading scenario…' : 'Loading scenario from the API…'}</div>
          )}
        </section>

        <aside hidden={!sideOpen}>
          <nav>
            {TABS_FOR[shownView].map((x) => (
              <button key={x} className={shownTab === x ? 'on' : ''} onClick={() => setTab(x)}>
                {x}{x === 'Alerts' && alertCount > 0 && <span className="count">{alertCount}</span>}
              </button>
            ))}
          </nav>
          {scenario && shownTab === 'Layers' && <LayersTab scenario={scenario} layers={layers} setLayers={setLayers} />}
          {scenario && shownTab === 'Alerts' && <AlertsTab scenario={scenario} t={t} onJump={(x) => { setPlaying(false); setT(x); }} acked={acked} onAck={ack} />}
          {scenario && shownTab === 'Survey' && (
            <SurveyTab scenario={scenario} t={t} proposed={proposed?.route ?? null} proposedAt={proposed?.t ?? t}
              setProposed={(r, at) => setProposed(r ? { route: r, t: at } : null)}
              onScenario={(s, from) => {
                setScenario(s);
                if (from !== null) { setProposed(null); setT(from); setPlaying(true); }
              }} />
          )}
          {scenario && shownTab === 'Metrics' && <MetricsTab scenario={scenario} t={t} />}
        </aside>
      </main>

      <button className="side-toggle" onClick={() => setSideOpen((v) => !v)} aria-expanded={sideOpen}
        aria-label={sideOpen ? 'Hide side panel' : 'Show side panel'} title={sideOpen ? 'Hide alerts and metrics' : 'Show alerts and metrics'}>
        {sideOpen ? '▶' : '◀'}
      </button>
      <Timeline t={t} max={maxT} playing={playing} onT={(x) => setT(x)} onPlay={onPlay} marks={alertMarks} events={alertEvents} />
      <div className="classification" role="note">UNCLASSIFIED // EXERCISE // SIMULATED DATA</div>
    </div>
  );
}
