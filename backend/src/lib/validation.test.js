import { describe, expect, it } from 'vitest';
import { validateKeywordFormat } from './validation.js';

describe('validateKeywordFormat', () => {
  it('accepts all valid line ids', () => {
    for (const line of ['R1', 'R2', 'R3', 'C1', 'C2', 'C3', 'D1', 'D2', 'FB']) {
      expect(validateKeywordFormat(`CO-APR26-042-${line}-ABCD1234`)).toBe(true);
    }
  });

  it('accepts W1..W7 weekly keywords', () => {
    for (let w = 1; w <= 7; w++) {
      expect(validateKeywordFormat(`CO-APR26-W${w}-042-ABCD1234`)).toBe(true);
    }
  });

  it('rejects line ids outside the allow-list', () => {
    expect(validateKeywordFormat('CO-APR26-042-R4-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-042-C4-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-042-D3-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-042-XX-ABCD1234')).toBe(false);
  });

  it('rejects week numbers outside 1..7', () => {
    expect(validateKeywordFormat('CO-APR26-W0-042-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-W8-042-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-W10-042-ABCD1234')).toBe(false);
  });

  it('rejects unpadded pack numbers for line keywords', () => {
    expect(validateKeywordFormat('CO-APR26-42-R1-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-1-R1-ABCD1234')).toBe(false);
  });

  it('rejects lowercase input', () => {
    expect(validateKeywordFormat('co-apr26-042-r1-abcd1234')).toBe(false);
  });

  it('rejects empty and garbage input', () => {
    expect(validateKeywordFormat('')).toBe(false);
    expect(validateKeywordFormat('bogus')).toBe(false);
    expect(validateKeywordFormat('CO-APR26')).toBe(false);
  });

  it('rejects keywords with whitespace or punctuation', () => {
    expect(validateKeywordFormat(' CO-APR26-042-R1-ABCD1234')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-042-R1-ABCD1234 ')).toBe(false);
    expect(validateKeywordFormat('CO-APR26-042-R1-ABCD.1234')).toBe(false);
  });

  it('accepts alternate campaign ids', () => {
    expect(validateKeywordFormat('CO-SEP27-001-R1-ABCD1234')).toBe(true);
    expect(validateKeywordFormat('CO-SEP27-W3-001-ABCD1234')).toBe(true);
  });
});
