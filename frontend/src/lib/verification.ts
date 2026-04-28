import { CAMPAIGN_ID } from '../data/constants.js';

// Build the verification marker string the user must include in their proof.
export type VerificationRules = {
  marker?: boolean;
  bullets?: number;
  numberedItems?: number;
  headings?: string[];
  tableRows?: number;
  tableCols?: number;
  paragraphs?: number;
  endsWith?: string;
  jsonKeys?: string[];
  qaCount?: number;
  hashtags?: number;
  hasObjective?: boolean;
  hasSubject?: boolean;
  boldTerms?: boolean;
  dateline?: boolean;
  sentences?: number;
  subBullets?: boolean;
  endWithQ?: boolean;
};

export function buildMarker(packId: number | string, tileIndex: number): string {
  return `VERIFY-${CAMPAIGN_ID}-${String(packId).padStart(3, '0')}-${tileIndex}`;
}

// Replace the placeholder marker `VERIFY-${CAMPAIGN_ID}-PACK-TILE` inside a
// task prompt with a concrete marker bound to the current pack and tile.
export function buildPromptFull(
  promptTemplate: string,
  packId: number | string,
  tileIndex: number,
): string {
  const concrete = buildMarker(packId, tileIndex);
  return promptTemplate.replace(/VERIFY-[A-Z0-9]+-PACK-TILE/g, concrete);
}

// Verification engine — returns an array of error messages (empty when the
// proof passes all rule checks). Behavior must remain compatible with the
// legacy single-file implementation.
export function verifyStructure(
  proof: string,
  packId: number | string,
  tileIndex: number,
  rules: VerificationRules,
): string[] {
  const errors: string[] = [];
  const marker = buildMarker(packId, tileIndex);

  if (rules.marker) {
    if (!proof.includes(marker)) {
      errors.push(`Missing verification marker: ${marker}`);
    }
  }
  if (rules.bullets) {
    const bulletMatches = (proof.match(/^•/gm) || []).length;
    if (bulletMatches < rules.bullets) {
      errors.push(
        `Need EXACTLY ${rules.bullets} bullet points starting with "•" (found ${bulletMatches})`,
      );
    }
  }
  if (rules.numberedItems) {
    const nums = [];
    for (let i = 1; i <= rules.numberedItems; i++) {
      if (new RegExp(`^${i}\\.`, 'm').test(proof)) nums.push(i);
    }
    if (nums.length < rules.numberedItems) {
      errors.push(
        `Need EXACTLY ${rules.numberedItems} numbered items (1. to ${rules.numberedItems}.)`,
      );
    }
  }
  if (rules.headings) {
    rules.headings.forEach((h) => {
      if (!new RegExp(`##\\s*${h}`, 'i').test(proof)) {
        errors.push(`Missing heading: ## ${h}`);
      }
    });
  }
  if (rules.tableRows) {
    const rows = (proof.match(/\|.*\|/g) || []).filter((r) => !/^[\s|:-]+$/.test(r));
    if (rows.length < rules.tableRows) {
      errors.push(`Table needs at least ${rules.tableRows} data rows (found ${rows.length})`);
    }
  }
  if (rules.tableCols) {
    const rows = (proof.match(/\|.*\|/g) || []).filter((r) => !/^[\s|:-]+$/.test(r));
    if (rows.length > 0) {
      const cols = (rows[0].match(/\|/g) || []).length - 1;
      if (cols < rules.tableCols) {
        errors.push(`Table needs EXACTLY ${rules.tableCols} columns (found ~${cols})`);
      }
    }
  }
  if (rules.paragraphs) {
    const paras = proof.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paras.length < rules.paragraphs) {
      errors.push(
        `Need EXACTLY ${rules.paragraphs} paragraphs separated by blank lines (found ${paras.length})`,
      );
    }
  }
  if (rules.endsWith) {
    if (!proof.includes(rules.endsWith)) {
      errors.push(`Response must end with "${rules.endsWith}"`);
    }
  }
  if (rules.jsonKeys) {
    rules.jsonKeys.forEach((k) => {
      if (!proof.includes(`"${k}"`)) {
        errors.push(`JSON must include key: "${k}"`);
      }
    });
  }
  if (rules.qaCount) {
    const qs = (proof.match(/^Q:/gm) || []).length;
    if (qs < rules.qaCount) {
      errors.push(`Need EXACTLY ${rules.qaCount} Q&A pairs (Q: lines found: ${qs})`);
    }
  }
  if (rules.hashtags) {
    const tags = (proof.match(/#\w+/g) || []).length;
    if (tags < rules.hashtags) {
      errors.push(`Need EXACTLY ${rules.hashtags} hashtags (found ${tags})`);
    }
  }
  if (rules.hasObjective) {
    if (!/Objective:/i.test(proof)) {
      errors.push('Missing "Objective:" line');
    }
  }
  if (rules.hasSubject) {
    if (!/Subject:/i.test(proof)) {
      errors.push('Missing "Subject:" line');
    }
  }
  if (rules.boldTerms) {
    if (!(proof.match(/\*\*[^*]+\*\*/g) || []).length) {
      errors.push('Each paragraph must start with a **bold term**');
    }
  }
  if (rules.dateline) {
    if (!/^[A-Z]+,\s+\w+\s+\d{4}\s+—/m.test(proof)) {
      errors.push('Missing dateline like "SINGAPORE, April 2025 —" at start');
    }
  }
  if (rules.sentences) {
    const sents = proof.match(/[A-Z][^.!?]*[.!?]/g) || [];
    if (sents.length < rules.sentences) {
      errors.push(`Need EXACTLY ${rules.sentences} sentences (found ${sents.length})`);
    }
  }
  if (rules.subBullets) {
    if (!(proof.match(/^→/gm) || []).length) {
      errors.push('Each numbered step needs a sub-bullet starting with "→"');
    }
  }
  if (rules.endWithQ) {
    const lines = proof.split('\n').filter((l) => /^\d+\./.test(l.trim()));
    const nonQ = lines.filter((l) => !l.trim().endsWith('?'));
    if (nonQ.length > 0) {
      errors.push('All numbered items must end with "?"');
    }
  }
  return errors;
}

// Keyword-format validators for client-side submission checks.
const LINE_KW_RE = /^CO-[A-Z0-9]+-\d{3}-(R[1-3]|C[1-3]|D[12]|FB)-[A-Z0-9]+$/;
const WEEK_KW_RE = /^CO-[A-Z0-9]+-W[1-7]-\d{3}-[A-Z0-9]+$/;

export function validateKeywordFormat(kw: string): boolean {
  return LINE_KW_RE.test(kw) || WEEK_KW_RE.test(kw);
}
