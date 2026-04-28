import { CAMPAIGN_ID } from '../data/constants.js';
import { TASK_BANK } from '../data/taskBank.js';
import { hashStr, mulberry32, seededShuffle } from './rng.js';
import type { VerificationRules } from './verification.js';

export type TileTask = {
  title: string;
  tag: string;
  prompt: string;
  verify: (proof: string, packId: number, tileIndex: number) => string[];
  tileIndex: number;
  packId: number;
  rules?: VerificationRules;
};

// Deterministic pack generation — given a pack id, returns the same nine
// tasks in the same order as the legacy implementation.
export function getPack(packId: number): TileTask[] {
  const rng = mulberry32(hashStr(CAMPAIGN_ID + packId));
  const shuffled = seededShuffle(TASK_BANK as TileTask[], rng);
  return shuffled.slice(0, 9).map((t, i) => ({ ...t, tileIndex: i, packId }));
}
