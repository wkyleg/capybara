import { useNeuroSignals } from '../neuro/hooks';
import { SignalQuality } from './SignalQuality';

interface NeuroPanelProps {
  className?: string;
  compact?: boolean;
}

export function NeuroPanel({ className = '', compact = false }: NeuroPanelProps) {
  const { calm, arousal, bpm, hrvRmssd, signalQuality, source } = useNeuroSignals();

  if (source === 'none') return null;

  const displayBpm = bpm !== null ? Math.round(bpm) : '--';
  const displayHrv = hrvRmssd !== null ? hrvRmssd.toFixed(0) : '--';
  const displayCalm = Math.round(calm * 100);

  if (compact) {
    return (
      <div className={`tropical-neuro-bar text-sm ${className}`}>
        <span className="flex items-center gap-1">
          <span className="text-coral-400">♥</span>
          <span className="font-bold tabular-nums font-display">{displayBpm}</span>
        </span>
        {hrvRmssd !== null && (
          <span className="flex items-center gap-1 text-muted-tropical">
            HRV <span className="font-bold tabular-nums text-cream-200">{displayHrv}</span>
          </span>
        )}
        <span className="flex items-center gap-1 text-mint-400">
          Calm <span className="font-bold tabular-nums">{displayCalm}%</span>
        </span>
        <SignalQuality quality={signalQuality} size={14} />
      </div>
    );
  }

  return (
    <div className={`tropical-panel p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-tropical">
          {source === 'eeg' ? 'EEG + camera' : source === 'rppg' ? 'Camera' : 'Simulated'}
        </span>
        <SignalQuality quality={signalQuality} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-tropical">BPM</div>
          <div className="text-2xl font-bold tabular-nums font-display flex items-center gap-1 text-cream-100">
            <span className="text-coral-400 text-sm">♥</span>
            {displayBpm}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-tropical">HRV</div>
          <div className="text-2xl font-bold tabular-nums font-display text-cream-100">{displayHrv}</div>
        </div>
        <div>
          <div className="text-xs text-muted-tropical">Calm</div>
          <div className="text-2xl font-bold tabular-nums font-display text-mint-400">{displayCalm}%</div>
        </div>
      </div>

      {source === 'eeg' && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-muted-tropical">
            Arousal <span className="text-yuzu-400 font-semibold">{Math.round(arousal * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
