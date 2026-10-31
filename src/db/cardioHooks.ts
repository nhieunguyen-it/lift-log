import { useLiveQuery } from 'dexie-react-hooks';
import { getCardioHistory } from './cardioRepo';

/** `undefined` while loading. */
export const useCardioHistory = (exerciseId: string | undefined) =>
  useLiveQuery(async () => (exerciseId ? await getCardioHistory(exerciseId) : []), [exerciseId]);
