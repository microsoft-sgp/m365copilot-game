import { describe, expect, it } from 'vitest';
import { CAMPAIGN_ID } from './constants.js';
import { TASK_BANK } from './taskBank.js';
import { buildMarker } from '../lib/verification.js';

const PACK_ID = 7;
const BULLET = '\u2022';
const ARROW = '\u2192';
const DASH = '\u2014';

function universalValidProof(tileIndex) {
  const marker = buildMarker(PACK_ID, tileIndex);
  return [
    `SINGAPORE, April 2025 ${DASH} This launch note is ready.`,
    marker,
    '',
    `${BULLET} Benefit one`,
    `${BULLET} Benefit two`,
    `${BULLET} Benefit three`,
    '',
    ...Array.from({ length: 8 }, (_, i) => `${i + 1}. Question ${i + 1}?`),
    `${ARROW} supporting action`,
    '',
    '## Strengths',
    '## Weaknesses',
    '## Opportunities',
    '## Threats',
    '## Insight 1',
    '## Insight 2',
    '## Insight 3',
    '## Introduction',
    '## Main Activity',
    '## Wrap-Up',
    '## What Went Well',
    '## What I Learned',
    "## What I'll Do Differently",
    '',
    '| A | B | C | D | E |',
    '| --- | --- | --- | --- | --- |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '',
    '**Alpha** explains the first idea.',
    '',
    '**Beta** explains the second idea.',
    '',
    '**Gamma** explains the third idea.',
    '',
    'Yours sincerely,',
    'Subject: Project update',
    'Objective: Improve the club semester.',
    'Action: Follow up tomorrow.',
    'Q: One?',
    'A: Answer one.',
    'Q: Two?',
    'A: Answer two.',
    'Q: Three?',
    'A: Answer three.',
    'Q: Four?',
    'A: Answer four.',
    'Q: Five?',
    'A: Answer five.',
    '#one #two #three',
    '{ "name": "Ada", "university": "NUS", "course": "CS", "year": "2", "skills": ["a", "b", "c"] }',
  ].join('\n');
}

describe('TASK_BANK', () => {
  it('contains the expected 24 unique Copilot tasks', () => {
    expect(TASK_BANK).toHaveLength(24);
    expect(new Set(TASK_BANK.map((task) => task.title))).toHaveLength(24);
  });

  it('keeps every prompt bound to the campaign verification placeholder', () => {
    for (const task of TASK_BANK) {
      expect(task.prompt).toContain(`VERIFY-${CAMPAIGN_ID}-PACK-TILE`);
      expect(task.title).toBeTruthy();
      expect(task.tag).toBeTruthy();
      expect(typeof task.verify).toBe('function');
    }
  });

  it('accepts structurally valid proof for every task and rejects missing markers', () => {
    TASK_BANK.forEach((task, tileIndex) => {
      expect(task.verify(universalValidProof(tileIndex), PACK_ID, tileIndex)).toEqual([]);

      const missingMarker = universalValidProof(tileIndex).replace(
        buildMarker(PACK_ID, tileIndex),
        '',
      );
      expect(task.verify(missingMarker, PACK_ID, tileIndex)).toContain(
        `Missing verification marker: ${buildMarker(PACK_ID, tileIndex)}`,
      );
    });
  });
});
