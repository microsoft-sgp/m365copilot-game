import { describe, expect, it } from 'vitest';
import { CAMPAIGN_ID } from '../data/constants.js';
import {
  buildMarker,
  buildPromptFull,
  validateKeywordFormat,
  verifyStructure,
} from './verification.js';

const PID = 42;
const TI = 3;
const MARKER = `VERIFY-${CAMPAIGN_ID}-042-3`;

describe('buildMarker', () => {
  it('zero-pads packId to 3 digits', () => {
    expect(buildMarker(1, 0)).toBe(`VERIFY-${CAMPAIGN_ID}-001-0`);
    expect(buildMarker(42, 5)).toBe(`VERIFY-${CAMPAIGN_ID}-042-5`);
    expect(buildMarker(999, 8)).toBe(`VERIFY-${CAMPAIGN_ID}-999-8`);
  });
});

describe('buildPromptFull', () => {
  it('replaces all placeholder markers with the concrete marker', () => {
    const tmpl = `Line 1 VERIFY-${CAMPAIGN_ID}-PACK-TILE and again VERIFY-${CAMPAIGN_ID}-PACK-TILE end.`;
    const out = buildPromptFull(tmpl, 7, 2);
    expect(out).not.toContain('PACK-TILE');
    expect(out.match(new RegExp(`VERIFY-${CAMPAIGN_ID}-007-2`, 'g'))).toHaveLength(2);
  });

  it('is a no-op when no placeholder is present', () => {
    expect(buildPromptFull('nothing to replace', 1, 0)).toBe('nothing to replace');
  });
});

describe('verifyStructure', () => {
  describe('marker rule', () => {
    it('passes when marker is present', () => {
      expect(verifyStructure(`hello ${MARKER} world`, PID, TI, { marker: true })).toEqual([]);
    });
    it('fails when marker is missing', () => {
      const errs = verifyStructure('no marker here', PID, TI, { marker: true });
      expect(errs).toHaveLength(1);
      expect(errs[0]).toContain(MARKER);
    });
  });

  describe('bullets rule', () => {
    it('passes when bullet count meets threshold', () => {
      const proof = '• one\n• two\n• three';
      expect(verifyStructure(proof, PID, TI, { bullets: 3 })).toEqual([]);
    });
    it('fails when under threshold', () => {
      const proof = '• one\n• two';
      const errs = verifyStructure(proof, PID, TI, { bullets: 3 });
      expect(errs[0]).toMatch(/3 bullet points/);
      expect(errs[0]).toContain('found 2');
    });
    it('ignores bullets that do not start the line', () => {
      const proof = 'prefix • not a bullet\n• real bullet';
      const errs = verifyStructure(proof, PID, TI, { bullets: 2 });
      expect(errs).toHaveLength(1);
    });
  });

  describe('numberedItems rule', () => {
    it('passes when 1. .. N. are all present at line start', () => {
      const proof = '1. first\n2. second\n3. third\n4. fourth';
      expect(verifyStructure(proof, PID, TI, { numberedItems: 4 })).toEqual([]);
    });
    it('fails when any numbered item is missing', () => {
      const proof = '1. first\n3. third';
      const errs = verifyStructure(proof, PID, TI, { numberedItems: 3 });
      expect(errs).toHaveLength(1);
    });
  });

  describe('headings rule', () => {
    it('accepts case-insensitive headings', () => {
      const proof = '## strengths\nfoo\n## WEAKNESSES\nbar';
      expect(verifyStructure(proof, PID, TI, { headings: ['Strengths', 'Weaknesses'] })).toEqual(
        [],
      );
    });
    it('flags each missing heading', () => {
      const proof = '## Strengths\nfoo';
      const errs = verifyStructure(proof, PID, TI, {
        headings: ['Strengths', 'Weaknesses', 'Threats'],
      });
      expect(errs).toHaveLength(2);
    });
  });

  describe('table rules', () => {
    const table = '| col1 | col2 | col3 |\n| --- | --- | --- |\n| a | b | c |\n| d | e | f |';
    it('counts data rows excluding separator rows', () => {
      expect(verifyStructure(table, PID, TI, { tableRows: 3 })).toEqual([]);
    });
    it('fails when not enough data rows', () => {
      const errs = verifyStructure(table, PID, TI, { tableRows: 5 });
      expect(errs[0]).toMatch(/at least 5 data rows/);
    });
    it('validates column count against the first data row', () => {
      expect(verifyStructure(table, PID, TI, { tableCols: 3 })).toEqual([]);
      const errs = verifyStructure(table, PID, TI, { tableCols: 5 });
      expect(errs[0]).toMatch(/5 columns/);
    });
    it('tableCols silently passes when no rows exist (documented behavior)', () => {
      expect(verifyStructure('no table', PID, TI, { tableCols: 3 })).toEqual([]);
    });
  });

  describe('paragraphs rule', () => {
    it('counts paragraphs separated by blank lines', () => {
      const proof = 'one\n\ntwo\n\nthree';
      expect(verifyStructure(proof, PID, TI, { paragraphs: 3 })).toEqual([]);
    });
    it('tolerates multiple blank lines between paragraphs', () => {
      const proof = 'one\n\n\n\ntwo';
      expect(verifyStructure(proof, PID, TI, { paragraphs: 2 })).toEqual([]);
    });
    it('ignores whitespace-only paragraphs', () => {
      const proof = 'one\n\n   \n\ntwo';
      expect(verifyStructure(proof, PID, TI, { paragraphs: 2 })).toEqual([]);
    });
  });

  describe('endsWith rule', () => {
    it('passes if the required substring is anywhere in proof', () => {
      // Note: implementation uses includes, not a true "ends with".
      expect(verifyStructure('before FIN after', PID, TI, { endsWith: 'FIN' })).toEqual([]);
    });
    it('fails when missing', () => {
      const errs = verifyStructure('no end', PID, TI, { endsWith: 'FIN' });
      expect(errs[0]).toContain('FIN');
    });
  });

  describe('jsonKeys rule', () => {
    it('passes when all keys appear in quoted form', () => {
      const proof = '{"name": "x", "age": 1}';
      expect(verifyStructure(proof, PID, TI, { jsonKeys: ['name', 'age'] })).toEqual([]);
    });
    it('fails per missing key', () => {
      const proof = '{"name": "x"}';
      const errs = verifyStructure(proof, PID, TI, { jsonKeys: ['name', 'age', 'city'] });
      expect(errs).toHaveLength(2);
    });
  });

  describe('qaCount rule', () => {
    it('counts Q: lines at the start of a line', () => {
      const proof = 'Q: a\nA: x\nQ: b\nA: y';
      expect(verifyStructure(proof, PID, TI, { qaCount: 2 })).toEqual([]);
    });
    it('ignores Q: that is not at line start', () => {
      expect(verifyStructure('prefix Q: fake', PID, TI, { qaCount: 1 })).toHaveLength(1);
    });
  });

  describe('hashtags rule', () => {
    it('counts all #word tokens', () => {
      expect(verifyStructure('fun #one #two and #three times', PID, TI, { hashtags: 3 })).toEqual(
        [],
      );
    });
    it('fails when under threshold', () => {
      expect(verifyStructure('#only', PID, TI, { hashtags: 2 })).toHaveLength(1);
    });
  });

  describe('keyword-line rules', () => {
    it('hasObjective requires "Objective:" (case-insensitive)', () => {
      expect(verifyStructure('OBJECTIVE: launch', PID, TI, { hasObjective: true })).toEqual([]);
      expect(verifyStructure('none', PID, TI, { hasObjective: true })).toHaveLength(1);
    });
    it('hasSubject requires "Subject:" (case-insensitive)', () => {
      expect(verifyStructure('subject: greetings', PID, TI, { hasSubject: true })).toEqual([]);
      expect(verifyStructure('none', PID, TI, { hasSubject: true })).toHaveLength(1);
    });
  });

  describe('boldTerms rule', () => {
    it('passes when at least one **bold** appears', () => {
      expect(verifyStructure('**Alpha** leads', PID, TI, { boldTerms: true })).toEqual([]);
    });
    it('fails with no bold segments', () => {
      expect(verifyStructure('plain text', PID, TI, { boldTerms: true })).toHaveLength(1);
    });
  });

  describe('dateline rule', () => {
    it('accepts "SINGAPORE, April 2025 —" style datelines', () => {
      const proof = 'SINGAPORE, April 2025 — launch day.';
      expect(verifyStructure(proof, PID, TI, { dateline: true })).toEqual([]);
    });
    it('fails when dateline is missing', () => {
      expect(verifyStructure('launch day.', PID, TI, { dateline: true })).toHaveLength(1);
    });
  });

  describe('sentences rule', () => {
    it('counts capitalized sentences ending with . ! or ?', () => {
      const proof = 'One thing. Two things! Three questions?';
      expect(verifyStructure(proof, PID, TI, { sentences: 3 })).toEqual([]);
    });
  });

  describe('subBullets rule', () => {
    it('requires at least one line starting with →', () => {
      expect(verifyStructure('→ sub point', PID, TI, { subBullets: true })).toEqual([]);
      expect(verifyStructure('no arrows', PID, TI, { subBullets: true })).toHaveLength(1);
    });
  });

  describe('endWithQ rule', () => {
    it('passes when every numbered line ends with ?', () => {
      const proof = '1. what?\n2. how?\n3. why?';
      expect(verifyStructure(proof, PID, TI, { endWithQ: true })).toEqual([]);
    });
    it('fails when any numbered line does not end with ?', () => {
      const proof = '1. what?\n2. statement.';
      expect(verifyStructure(proof, PID, TI, { endWithQ: true })).toHaveLength(1);
    });
    it('ignores lines that are not numbered', () => {
      const proof = 'header\n1. what?\nplain line';
      expect(verifyStructure(proof, PID, TI, { endWithQ: true })).toEqual([]);
    });
  });

  describe('composite rules', () => {
    it('accumulates errors across multiple failing rules', () => {
      const errs = verifyStructure('empty', PID, TI, {
        marker: true,
        bullets: 3,
        hasObjective: true,
      });
      expect(errs).toHaveLength(3);
    });

    it('returns [] when every rule passes', () => {
      const proof = [
        MARKER,
        '• one',
        '• two',
        '• three',
        '',
        '## Strengths',
        'Objective: ship',
      ].join('\n');
      const errs = verifyStructure(proof, PID, TI, {
        marker: true,
        bullets: 3,
        headings: ['Strengths'],
        hasObjective: true,
      });
      expect(errs).toEqual([]);
    });

    it('returns [] when no rules are supplied', () => {
      expect(verifyStructure('anything', PID, TI, {})).toEqual([]);
    });
  });
});

describe('validateKeywordFormat', () => {
  it('accepts line keywords for all line ids', () => {
    ['R1', 'R2', 'R3', 'C1', 'C2', 'C3', 'D1', 'D2', 'FB'].forEach((line) => {
      expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-042-${line}-ABCD1234`)).toBe(true);
    });
  });

  it('accepts weekly keywords W1..W7', () => {
    for (let w = 1; w <= 7; w++) {
      expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-W${w}-042-ABCD1234`)).toBe(true);
    }
  });

  it('rejects invalid line ids', () => {
    expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-042-R4-ABCD1234`)).toBe(false);
    expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-042-D3-ABCD1234`)).toBe(false);
    expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-042-XX-ABCD1234`)).toBe(false);
  });

  it('rejects invalid weekly ranges', () => {
    expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-W0-042-ABCD1234`)).toBe(false);
    expect(validateKeywordFormat(`CO-${CAMPAIGN_ID}-W8-042-ABCD1234`)).toBe(false);
  });

  it('rejects lowercase and malformed keywords', () => {
    expect(validateKeywordFormat('co-apr26-042-r1-abcd1234')).toBe(false);
    expect(validateKeywordFormat('')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-42-R1-ABCD1234')).toBe(false); // missing zero-pad
    expect(validateKeywordFormat('bogus')).toBe(false);
  });
});
