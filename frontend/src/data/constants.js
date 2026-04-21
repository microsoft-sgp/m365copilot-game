// Configuration constants ported from the legacy single-file app.
// Keep values in sync with what users have already encountered so saved
// state, deterministic packs, and keyword formats stay compatible.

export const COPILOT_URL = 'https://m365.cloud.microsoft/chat';
export const CAMPAIGN_ID = 'APR26';
export const TOTAL_PACKS = 999;
export const TOTAL_WEEKS = 7;
export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  state: 'copilot_bingo_state',
  submissions: 'copilot_bingo_subs',
  playerName: 'copilot_bingo_player_name',
  lastPack: 'copilot_bingo_last_pack',
};
