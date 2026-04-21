import { CAMPAIGN_ID } from '../data/constants.js';
import { TASK_BANK } from '../data/taskBank.js';
import { hashStr, mulberry32, seededShuffle } from './rng.js';

// Deterministic pack generation — given a pack id, returns the same nine
// tasks in the same order as the legacy implementation.
export function getPack(packId) {
  const rng = mulberry32(hashStr(CAMPAIGN_ID + packId));
  const shuffled = seededShuffle(TASK_BANK, rng);
  return shuffled.slice(0, 9).map((t, i) => ({ ...t, tileIndex: i, packId }));
}
