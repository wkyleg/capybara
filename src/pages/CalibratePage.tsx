import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DeviceConnect } from '../components/DeviceConnect';
import { useNeuroConnection } from '../neuro/hooks';

type Phase = 'connect' | 'countdown';

export function CalibratePage() {
  const navigate = useNavigate();
  const { eegConnected, cameraActive, mockEnabled } = useNeuroConnection();
  const hasConnection = eegConnected || cameraActive || mockEnabled;

  const [phase, setPhase] = useState<Phase>(hasConnection ? 'countdown' : 'connect');
  const [countdown, setCountdown] = useState(3);

  const handleReady = useCallback(() => {
    setPhase('countdown');
  }, []);

  const handleSkip = useCallback(() => {
    setPhase('countdown');
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/play');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {phase === 'connect' && (
        <div className="flex flex-col items-center w-full max-w-md">
          <h2 className="font-display text-3xl font-bold mb-2 text-sunset-500">Sensors</h2>
          <p className="text-sm mb-6 text-center text-muted-tropical leading-relaxed">
            Optional: Muse EEG and/or webcam rPPG. Skip anytime — the jungle stays gentle without hardware.
          </p>
          <DeviceConnect onReady={handleReady} showSkip onSkip={handleSkip} />
        </div>
      )}

      {phase === 'countdown' && (
        <div className="text-center tropical-panel px-12 py-10">
          <p className="text-sm mb-4 text-muted-tropical uppercase tracking-widest">Into the canopy</p>
          <div className="font-display text-8xl font-bold tabular-nums text-mint-400 drop-shadow-[0_0_24px_rgba(134,239,172,0.35)]">
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
}
