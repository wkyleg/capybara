import { useNeuroConnection } from '../neuro/hooks';

interface DeviceConnectProps {
  onReady?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
}

export function DeviceConnect({ onReady, showSkip = true, onSkip }: DeviceConnectProps) {
  const { eegConnected, cameraActive, wasmReady, connecting, error, connectHeadband, enableCamera, enableMock } =
    useNeuroConnection();

  const hasConnection = eegConnected || cameraActive;

  return (
    <div className="flex flex-col gap-5 w-full max-w-md mx-auto">
      <div className="tropical-device-card">
        <h3 className="text-lg font-display font-semibold mb-1 text-cream-100">Webcam (rPPG)</h3>
        <p className="text-sm mb-4 text-muted-tropical">Heart rate & HRV from your face — jungle optional.</p>
        {cameraActive ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-mint-400">
            <span className="inline-block w-2 h-2 rounded-full bg-mint-400 shadow-[0_0_8px_#86efac]" />
            Camera live
          </div>
        ) : (
          <button
            type="button"
            onClick={() => enableCamera()}
            disabled={connecting.camera}
            className="px-5 py-2.5 rounded-xl font-display font-semibold text-sm cursor-pointer disabled:opacity-50 bg-lagoon-600 text-jungle-950 border border-lagoon-400/40 hover:brightness-110 transition"
          >
            {connecting.camera ? 'Opening…' : 'Enable camera'}
          </button>
        )}
        {error.camera && <p className="text-sm mt-2 text-coral-400">{error.camera}</p>}
      </div>

      {wasmReady && (
        <div className="tropical-device-card">
          <h3 className="text-lg font-display font-semibold mb-1 text-cream-100">EEG headband</h3>
          <p className="text-sm mb-4 text-muted-tropical">Muse-style Bluetooth — waves meet the canopy.</p>
          {eegConnected ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-mint-400">
              <span className="inline-block w-2 h-2 rounded-full bg-mint-400 shadow-[0_0_8px_#86efac]" />
              Headband linked
            </div>
          ) : (
            <button
              type="button"
              onClick={() => connectHeadband()}
              disabled={connecting.eeg}
              className="px-5 py-2.5 rounded-xl font-display font-semibold text-sm cursor-pointer disabled:opacity-50 bg-jungle-800 text-lagoon-300 border border-lagoon-500/35 hover:bg-jungle-700 transition"
            >
              {connecting.eeg ? 'Scanning…' : 'Connect headband'}
            </button>
          )}
          {error.eeg && <p className="text-sm mt-2 text-coral-400">{error.eeg}</p>}
          <p className="text-xs mt-3 text-muted-tropical">Chrome or Edge with Web Bluetooth</p>
        </div>
      )}

      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => enableMock()}
          className="text-sm underline cursor-pointer text-muted-tropical hover:text-lagoon-400 transition text-left"
        >
          Simulated signals (dev)
        </button>
      )}

      <div className="flex gap-3 mt-1">
        {hasConnection && onReady && (
          <button type="button" onClick={onReady} className="flex-1 tropical-btn-primary py-3 text-base font-display">
            Continue
          </button>
        )}
        {showSkip && onSkip && (
          <button type="button" onClick={onSkip} className="tropical-btn-ghost px-6 py-3 text-base font-display">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
