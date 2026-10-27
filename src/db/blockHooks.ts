import { useLiveQuery } from 'dexie-react-hooks';
import { getBlockView } from './programsRepo';
import type { BlockView } from './programsRepo';

/** `undefined` while loading, `null` when the program has no block. */
export const useBlockView = (programId: string | undefined): BlockView | null | undefined =>
  useLiveQuery(async () => (programId ? await getBlockView(programId) : null), [programId]);
