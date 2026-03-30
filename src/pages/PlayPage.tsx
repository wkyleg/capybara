import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { NeuroPanel } from '@/components/NeuroPanel';
import { ParallaxBackdrop } from '@/components/ParallaxBackdrop';
import { gameAudio } from '@/game/gameAudio';
import { JungleAmbient } from '@/game/jungleAmbient';
import { createRunner, type GameOverPayload, type NeuroGameInput } from '@/game/runner';
import { useSettingsStore } from '@/lib/settingsStore';
import { useNeuroStore } from '@/neuro/hooks';
import { sessionRecorder } from '@/neuro/sessionRecorderInstance';

const RESULTS_KEY = 'capybaraResults';
const RESULTS_LEGACY = 'copyparaResults';

function defaultNeuro(): NeuroGameInput {
  return {
    calm: 0.5,
    arousal: 0.5,
    bpm: null,
    baselineBpm: null,
    baselineDelta: null,
    hrvRmssd: null,
    alphaPower: null,
    betaPower: null,
    thetaPower: null,
    gammaPower: null,
    signalQuality: 0,
    bpmQuality: 0,
    source: 'none',
    calmnessState: null,
    alphaBump: false,
  };
}

export function PlayPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<ReturnType<typeof createRunner> | null>(null);
  const ambientRef = useRef<JungleAmbient | null>(null);
  const parallaxTRef = useRef(0);

  const neuroInfluence = useSettingsStore((s) => s.neuroInfluence);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  const [hud, setHud] = useState({
    dist: 0,
    snacks: 0,
    lives: 3,
    best: 0,
    combo: 0,
    paused: false,
    spicy: false,
  });

  const [parallax, setParallax] = useState({ distPx: 0, calm: 0.5, arousal: 0.5 });

  const gameOverRef = useRef(false);

  const handleGameOver = useCallback(
    (payload: GameOverPayload) => {
      if (gameOverRef.current) return;
      gameOverRef.current = true;

      sessionRecorder.setAppData('game', payload as unknown as Record<string, unknown>);
      const report = sessionRecorder.stop();

      const payloadJson = JSON.stringify({ report, game: payload });
      try {
        sessionStorage.setItem(RESULTS_KEY, payloadJson);
        sessionStorage.setItem(RESULTS_LEGACY, payloadJson);
      } catch {
        /* ignore */
      }

      navigate('/results');
    },
    [navigate],
  );

  useEffect(() => {
    const amb = new JungleAmbient();
    ambientRef.current = amb;
    if (useSettingsStore.getState().soundEnabled) void amb.start();
    else amb.setMuted(true);

    const tickNeuro = () => {
      const m = useNeuroStore.getState().manager?.getState();
      if (!m) return;
      amb.update({
        calm: m.calm,
        arousal: m.arousal,
        bpm: m.bpm,
        bpmQuality: m.bpmQuality,
        hrvRmssd: m.hrvRmssd,
        alphaPower: m.alphaPower,
        betaPower: m.betaPower,
        signalQuality: m.signalQuality,
      });
    };
    const id = window.setInterval(tickNeuro, 100);
    tickNeuro();

    return () => {
      window.clearInterval(id);
      amb.destroy();
      ambientRef.current = null;
    };
  }, []);

  useEffect(() => {
    ambientRef.current?.setMuted(!soundEnabled);
    gameAudio.setEnabled(soundEnabled);
    runnerRef.current?.setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameOverRef.current = false;
    sessionRecorder.start('capybara', 'run');

    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const s = useSettingsStore.getState();
    const runner = createRunner({
      canvas,
      soundEnabled: s.soundEnabled,
      spicy: s.defaultMode === 'spicy',
      neuroInfluence: s.neuroInfluence,
      reducedMotion,
      getSessionT: () => sessionRecorder.getElapsedSec(),
      getNeuro: () => {
        const m = useNeuroStore.getState().manager?.getState();
        if (!m) return { ...defaultNeuro() };
        return {
          calm: m.calm,
          arousal: m.arousal,
          bpm: m.bpm,
          baselineBpm: m.baselineBpm,
          baselineDelta: m.baselineDelta,
          hrvRmssd: m.hrvRmssd,
          alphaPower: m.alphaPower,
          betaPower: m.betaPower,
          thetaPower: m.thetaPower,
          gammaPower: m.gammaPower,
          signalQuality: m.signalQuality,
          bpmQuality: m.bpmQuality,
          source: m.source,
          calmnessState: m.calmnessState,
          alphaBump: m.alphaBump,
        };
      },
      onFrame: (dt) => {
        const m = useNeuroStore.getState().manager;
        if (m && sessionRecorder.isActive()) sessionRecorder.sample(dt, m.getState());
      },
      onGameOver: handleGameOver,
      onHud: () => {
        const snap = runnerRef.current?.getSnapshot();
        if (snap) {
          setHud({
            dist: snap.dist,
            snacks: snap.snacks,
            lives: snap.lives,
            best: snap.best,
            combo: snap.combo,
            paused: runnerRef.current?.getPaused() ?? false,
            spicy: snap.spicy,
          });
          const now = performance.now();
          if (now - parallaxTRef.current > 100) {
            parallaxTRef.current = now;
            const m = useNeuroStore.getState().manager?.getState();
            setParallax({
              distPx: snap.distPx,
              calm: m?.calm ?? 0.5,
              arousal: m?.arousal ?? 0.5,
            });
          }
        }
      },
    });

    runnerRef.current = runner;
    runner.startLoop();

    const onResize = () => runner.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (sessionRecorder.isActive() && !gameOverRef.current) {
        sessionRecorder.stop();
      }
      runner.destroy();
      runnerRef.current = null;
    };
  }, [handleGameOver]);

  useEffect(() => {
    runnerRef.current?.setNeuroInfluence(neuroInfluence);
  }, [neuroInfluence]);

  useEffect(() => {
    runnerRef.current?.setSpicy(defaultMode === 'spicy');
  }, [defaultMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const r = runnerRef.current;
      if (!r) return;

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        r.tapPress(performance.now() / 1000);
        r.requestJump();
      }
      if (e.code === 'KeyP') {
        const p = r.getPaused();
        r.setPaused(!p);
        if (!p) {
          gameAudio.pause();
          ambientRef.current?.pause();
        } else {
          gameAudio.resume();
          ambientRef.current?.resume();
        }
      }
      if (e.code === 'KeyR') {
        gameOverRef.current = false;
        sessionRecorder.start('capybara', 'run');
        r.restart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        runnerRef.current?.tapRelease();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col p-2 sm:p-3 gap-2 text-cream-300">
      <div className="flex flex-wrap items-center gap-2 justify-between shrink-0">
        <button
          type="button"
          className="tropical-btn-outline text-xs px-3 py-1.5"
          onClick={() => {
            runnerRef.current?.destroy();
            navigate('/');
          }}
        >
          ← Home
        </button>
        <div className="flex flex-wrap gap-2 text-xs font-bold font-display">
          <span className="tropical-hud-pill">m {hud.dist}</span>
          <span className="tropical-hud-pill">🍃 {hud.snacks}</span>
          <span className="tropical-hud-pill text-coral-400">{'❤'.repeat(Math.max(0, hud.lives))}</span>
          <span className="tropical-hud-pill">best {hud.best}</span>
          {hud.combo >= 3 && <span className="tropical-hud-pill border-yuzu-400/50 text-yuzu-400">×{hud.combo}</span>}
          <span
            className={`tropical-hud-pill ${hud.spicy ? 'border-sunset-500/40 text-sunset-400' : 'border-lagoon-500/40 text-lagoon-400'}`}
          >
            {hud.spicy ? 'Spicy' : 'Chill'}
          </span>
          {hud.paused && <span className="tropical-hud-pill border-yuzu-400 text-yuzu-300">Paused</span>}
        </div>
        <NeuroPanel compact className="max-w-full" />
      </div>

      <div
        className="flex-1 min-h-0 tropical-frame relative touch-none overflow-hidden"
        onPointerDown={(e) => {
          const r = runnerRef.current;
          if (!r) return;
          gameAudio.resume();
          ambientRef.current?.resume();
          const t = performance.now() / 1000;
          r.tapPress(t);
          r.requestJump();
          e.preventDefault();
        }}
        onPointerUp={() => runnerRef.current?.tapRelease()}
        onPointerLeave={() => runnerRef.current?.tapRelease()}
      >
        <ParallaxBackdrop distPx={parallax.distPx} calm={parallax.calm} arousal={parallax.arousal} className="z-0" />
        <canvas ref={canvasRef} className="relative z-10 w-full h-full block cursor-pointer" />
      </div>

      <p className="text-[10px] text-center shrink-0 text-muted-tropical font-medium">
        Tap or Space · P pause · R restart · sensors nudge speed when connected
      </p>
    </div>
  );
}
