import { describe, expect, it } from 'vitest';
import { boundedInteger, isHttpsUrl, numberValue, stringValue } from './http.js';

describe('isHttpsUrl', () => {
  it('accepts https URLs', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
    expect(isHttpsUrl('https://m365.cloud.microsoft/chat')).toBe(true);
    expect(isHttpsUrl('https://example.com/path?q=1#frag')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isHttpsUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpsUrl('ftp://example.com')).toBe(false);
  });

  it('rejects empty, malformed, or non-string input', () => {
    expect(isHttpsUrl('')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(isHttpsUrl(42)).toBe(false);
    expect(isHttpsUrl({})).toBe(false);
  });

  it('is case-insensitive on the scheme', () => {
    expect(isHttpsUrl('HTTPS://example.com')).toBe(true);
  });
});

describe('boundedInteger', () => {
  it('returns the integer when in range', () => {
    expect(boundedInteger(5, 1, 10)).toBe(5);
    expect(boundedInteger('5', 1, 10)).toBe(5);
    expect(boundedInteger(1, 1, 10)).toBe(1);
    expect(boundedInteger(10, 1, 10)).toBe(10);
  });

  it('returns null when below min or above max', () => {
    expect(boundedInteger(0, 1, 10)).toBeNull();
    expect(boundedInteger(11, 1, 10)).toBeNull();
    expect(boundedInteger(-1, 1, 10)).toBeNull();
    expect(boundedInteger(100000, 1, 10000)).toBeNull();
  });

  it('returns null for non-integer numerics', () => {
    expect(boundedInteger(3.14, 1, 10)).toBeNull();
    expect(boundedInteger('3.14', 1, 10)).toBeNull();
  });

  it('returns null for non-numeric, missing, or empty input', () => {
    expect(boundedInteger(null, 1, 10)).toBeNull();
    expect(boundedInteger(undefined, 1, 10)).toBeNull();
    expect(boundedInteger('', 1, 10)).toBeNull();
    expect(boundedInteger('not-a-number', 1, 10)).toBeNull();
    expect(boundedInteger({}, 1, 10)).toBeNull();
  });
});

// Smoke tests for the existing helpers so this file is the canonical home
// for http.ts coverage going forward.
describe('numberValue', () => {
  it('parses numeric strings and numbers', () => {
    expect(numberValue('42')).toBe(42);
    expect(numberValue(42)).toBe(42);
    expect(numberValue('0')).toBe(0);
  });

  it('returns null for missing or invalid input', () => {
    expect(numberValue(null)).toBeNull();
    expect(numberValue(undefined)).toBeNull();
    expect(numberValue('')).toBeNull();
    expect(numberValue('abc')).toBeNull();
  });
});

describe('stringValue', () => {
  it('returns the string when given one', () => {
    expect(stringValue('hello')).toBe('hello');
    expect(stringValue('')).toBe('');
  });

  it('returns empty string for non-strings', () => {
    expect(stringValue(42)).toBe('');
    expect(stringValue(null)).toBe('');
    expect(stringValue(undefined)).toBe('');
    expect(stringValue({})).toBe('');
  });
});
