"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Shared reveal state for one review card. The answer isn't only the insight:
// the title, the source quote, and the related concepts can all give it away,
// and they're server-rendered in different parts of the page. Each of them
// sits in an <AfterReveal> slot that reads this one flag.
interface RecallState {
  revealed: boolean;
  reveal: () => void;
}

const RecallContext = createContext<RecallState>({
  revealed: true,
  reveal: () => {},
});

// Mount with key={card path}: client state survives searchParams-only
// navigation, and a new card must start hidden again.
export function RecallProvider({
  recallMode,
  children,
}: {
  recallMode: boolean;
  children: ReactNode;
}) {
  const [revealed, setRevealed] = useState(!recallMode);
  // Stable identity: the keyboard handler lists `reveal` as an effect dep.
  const reveal = useCallback(() => setRevealed(true), []);
  const value = useMemo(() => ({ revealed, reveal }), [revealed, reveal]);
  return (
    <RecallContext.Provider value={value}>{children}</RecallContext.Provider>
  );
}

export function useRecall(): RecallState {
  return useContext(RecallContext);
}

// Renders `children` once the card is revealed, `before` until then.
export function AfterReveal({
  children,
  before = null,
}: {
  children: ReactNode;
  before?: ReactNode;
}) {
  return <>{useRecall().revealed ? children : before}</>;
}
