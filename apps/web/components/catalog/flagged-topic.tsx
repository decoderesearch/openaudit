'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** The id of the model page's Flagged Chats column. */
export const FLAGGED_CHATS_ID = 'flagged-chats';

type FlaggedTopic = {
  topic: string | null;
  setTopic: (topic: string | null) => void;
  evalName: string | null;
  setEvalName: (evalName: string | null) => void;
};

const Context = createContext<FlaggedTopic | null>(null);

/** The topic and the eval that the Flagged Chats column shows. The "Flagged Chats" pills of the
 * topics and of the evals set them. The URL's `topic` (its slug) sets the first topic. */
export function FlaggedTopicProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const [topic, setTopic] = useState<string | null>(() => params?.get('topic')?.replaceAll('-', '_') || null);
  const [evalName, setEvalName] = useState<string | null>(null);
  const value = useMemo(() => ({ topic, setTopic, evalName, setEvalName }), [topic, evalName]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Null outside a `FlaggedTopicProvider`. */
export const useFlaggedTopic = () => useContext(Context);
