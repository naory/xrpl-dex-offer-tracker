import { create } from 'zustand';

export interface RippledStatus {
  connected: boolean;
  serverState: string;
  peers: number;
  validatedLedger: number | null;
  mainnetLedger: number | null;
  loadFactor: number;
  uptime: number;
  rateLimitStatus: string;
  hasRecentActivity: boolean;
  connectionType: string;
  lastTransactionTime: number | null;
  connectionIssue: string | null;
  error?: string;
  timestamp: number;
}

export interface TrackedPair {
  takerGets: { currency: string; issuer: string | null };
  takerPays: { currency: string; issuer: string | null };
  label: string;
  value: string;
}

interface AppState {
  selectedPair: string;
  isConnected: boolean;
  showConnectionPopup: boolean;

  trackedPairs: TrackedPair[];
  loadingPairs: boolean;

  rippledStatus: RippledStatus | null;
  loadingStatus: boolean;

  // actions
  setSelectedPair: (pair: string) => void;
  setIsConnected: (connected: boolean) => void;
  setShowConnectionPopup: (open: boolean) => void;

  fetchTrackedPairs: () => Promise<void>;
  fetchRippledStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedPair: '',
  isConnected: false,
  showConnectionPopup: false,

  trackedPairs: [],
  loadingPairs: false,

  rippledStatus: null,
  loadingStatus: false,

  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setShowConnectionPopup: (open) => set({ showConnectionPopup: open }),

  fetchTrackedPairs: async () => {
    set({ loadingPairs: true });
    try {
      const response = await fetch('http://localhost:3001/tracked-pairs');
      if (!response.ok) throw new Error('Failed to fetch tracked pairs');
      const data = await response.json();
      const pairs: TrackedPair[] = data.pairs || [];
      set({ trackedPairs: pairs });
      const { selectedPair, setSelectedPair } = get();
      const matchesCurrent = pairs.some((p) => p.value === selectedPair);
      if (pairs.length > 0 && (!selectedPair || !matchesCurrent)) {
        setSelectedPair(pairs[0].value);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[UI] Error fetching tracked pairs', err);
    } finally {
      set({ loadingPairs: false });
    }
  },

  fetchRippledStatus: async () => {
    set({ loadingStatus: true });
    try {
      const response = await fetch('http://localhost:3001/rippled-status');
      const data: RippledStatus = await response.json();
      set({ rippledStatus: data });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[UI] Error fetching rippled status', err);
      set({ rippledStatus: null });
    } finally {
      set({ loadingStatus: false });
    }
  },
}));


