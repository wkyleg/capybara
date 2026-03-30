import { useNavigate } from 'react-router';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      <div
        className="pointer-events-none absolute top-16 right-[12%] text-7xl opacity-[0.12] select-none font-display"
        aria-hidden
      >
        🦫
      </div>
      <div className="max-w-lg w-full tropical-panel p-8 sm:p-10 relative z-10">
        <p className="text-xs uppercase tracking-[0.35em] mb-3 text-muted-tropical font-semibold">Neurosec · Elata</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-2 text-sunset-500 drop-shadow-lg">Capybara</h1>
        <p className="text-lg font-display font-medium text-lagoon-400 mb-1">Jungle dash</p>
        <p className="text-sm leading-relaxed mb-2 text-muted-tropical">
          One button, endless canopy. Your calm and arousal nudge the scroll; collect snacks and golden yuzu while the
          forest speeds up.
        </p>
        <p className="text-xs mb-8 text-muted-tropical border-l-2 border-lagoon-500/50 pl-3">
          Space / tap · hold for a higher hop · P pause · R restart
        </p>
        <div className="flex flex-col gap-3">
          <button type="button" className="tropical-btn-primary" onClick={() => navigate('/calibrate')}>
            Play run
          </button>
          <button
            type="button"
            className="tropical-btn-ghost w-full py-3 text-sm"
            onClick={() => navigate('/settings')}
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
