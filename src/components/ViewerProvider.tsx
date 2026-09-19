"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Serializable subset of the logged-in user that client components need. */
export interface ViewerUser {
  id: string;
  username: string;
  displayName: string;
  profileImage: string | null;
  guessCount: number;
  correctCount: number;
}

export interface ViewerStats {
  guessCount: number;
  correctCount: number;
}

interface ViewerContextValue {
  user: ViewerUser | null;
  stats: ViewerStats;
  setStats: (stats: ViewerStats) => void;
  /** True when an AI provider is configured on the server (enables "let an AI write it"). */
  aiEnabled: boolean;
}

const ViewerContext = createContext<ViewerContextValue>({
  user: null,
  stats: { guessCount: 0, correctCount: 0 },
  setStats: () => {},
  aiEnabled: false,
});

export function ViewerProvider({
  user,
  aiEnabled = false,
  children,
}: {
  user: ViewerUser | null;
  aiEnabled?: boolean;
  children: React.ReactNode;
}) {
  const [stats, setStatsState] = useState<ViewerStats>({
    guessCount: user?.guessCount ?? 0,
    correctCount: user?.correctCount ?? 0,
  });
  const setStats = useCallback((s: ViewerStats) => setStatsState(s), []);
  const value = useMemo(() => ({ user, stats, setStats, aiEnabled }), [user, stats, setStats, aiEnabled]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
