import { useNavigate } from 'react-router';
import { DeviceConnect } from '@/components/DeviceConnect';
import { useSettingsStore } from '@/lib/settingsStore';

export function SettingsPage() {
  const navigate = useNavigate();
  const neuroInfluence = useSettingsStore((s) => s.neuroInfluence);
  const setNeuroInfluence = useSettingsStore((s) => s.setNeuroInfluence);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const setDefaultMode = useSettingsStore((s) => s.setDefaultMode);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 gap-8">
      <div className="w-full max-w-md">
        <button type="button" className="tropical-btn-outline text-sm mb-6 px-4 py-2" onClick={() => navigate('/')}>
          ← Home
        </button>
        <h1 className="font-display text-3xl font-bold mb-2 text-sunset-500">Jungle settings</h1>
        <p className="text-sm text-muted-tropical mb-8">Tune how much your brain and pulse move the trail.</p>

        <div className="tropical-panel p-6 space-y-6 mb-8">
          <div>
            <label htmlFor="ni" className="block text-sm mb-2 text-muted-tropical">
              Neuro influence on speed & spacing ({Math.round(neuroInfluence * 100)}%)
            </label>
            <input
              id="ni"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={neuroInfluence}
              onChange={(e) => setNeuroInfluence(Number.parseFloat(e.target.value))}
              className="w-full accent-lagoon-500"
            />
          </div>

          <div>
            <span className="block text-sm mb-2 text-muted-tropical">Default run vibe</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2.5 rounded-xl border text-sm font-display font-semibold transition ${
                  defaultMode === 'chill'
                    ? 'tropical-mode-on border-lagoon-400 text-mint-300'
                    : 'border-white/15 bg-black/20 text-cream-300'
                }`}
                onClick={() => setDefaultMode('chill')}
              >
                Chill
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 rounded-xl border text-sm font-display font-semibold transition ${
                  defaultMode === 'spicy'
                    ? 'tropical-mode-on border-yuzu-400 text-yuzu-300'
                    : 'border-white/15 bg-black/20 text-cream-300'
                }`}
                onClick={() => setDefaultMode('spicy')}
              >
                Spicy
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm cursor-pointer text-cream-300">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="rounded border-white/30 accent-lagoon-500"
            />
            Sound (future SFX)
          </label>
        </div>

        <h2 className="font-display text-xl font-semibold mb-3 text-lagoon-400">Devices</h2>
        <DeviceConnect showSkip={false} />
      </div>
    </div>
  );
}
