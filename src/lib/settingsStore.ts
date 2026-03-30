import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RunMode = 'chill' | 'spicy';

interface SettingsState {
  neuroInfluence: number;
  soundEnabled: boolean;
  defaultMode: RunMode;
  setNeuroInfluence: (v: number) => void;
  setSoundEnabled: (v: boolean) => void;
  setDefaultMode: (m: RunMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      neuroInfluence: 0.65,
      soundEnabled: true,
      defaultMode: 'chill',
      setNeuroInfluence: (v) => set({ neuroInfluence: Math.max(0, Math.min(1, v)) }),
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setDefaultMode: (m) => set({ defaultMode: m }),
    }),
    { name: 'copypara-settings' },
  ),
);
