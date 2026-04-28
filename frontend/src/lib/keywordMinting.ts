import { CAMPAIGN_ID } from '../data/constants.js';
import { hashStr } from './rng.js';

// Prototype keyword minting — preserved for behavioral parity with the
// legacy implementation. Not tamper-proof; this remains a client-side
// session-bound token, not a server-validated credential.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function buildToken(seedStr: string): string {
  const h = hashStr(seedStr);
  let token = '';
  let seed = Math.abs(h);
  for (let i = 0; i < 8; i++) {
    token += ALPHABET[seed % ALPHABET.length];
    seed = Math.floor(seed / 36) + hashStr(token + i);
  }
  return token;
}

export function mintLineKeyword(lineId: string, packId: number, sessionId: string): string {
  const raw = `${CAMPAIGN_ID}|${packId}|${lineId}|${sessionId}`;
  const token = buildToken(raw);
  return `CO-${CAMPAIGN_ID}-${String(packId).padStart(3, '0')}-${lineId}-${token}`;
}

export function mintWeeklyKeyword(weekNo: number, packId: number, sessionId: string): string {
  const raw = `${CAMPAIGN_ID}|W${weekNo}|${packId}|${sessionId}`;
  const token = buildToken(raw);
  return `CO-${CAMPAIGN_ID}-W${weekNo}-${String(packId).padStart(3, '0')}-${token}`;
}
