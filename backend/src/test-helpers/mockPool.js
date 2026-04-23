// Test helper: fluent mock of the mssql pool interface used by handlers.
//
// Each handler issues one or more queries via
//   pool.request().input(name, type, value)...input(...).query('SELECT ...')
// This helper builds a pool whose request() returns a chainable object that
// captures inputs and resolves .query() with a scripted result.

import { vi } from 'vitest';

// Build a pool that returns scripted query results in order. Each script entry
// is either a `recordset` array, a `rowsAffected` array, an object like
// { recordset, rowsAffected }, or an Error to throw.
export function createMockPool(scripts = []) {
  const calls = [];
  const queue = [...scripts];

  const pool = {
    request: vi.fn(() => {
      const captured = { inputs: {}, query: null };
      calls.push(captured);

      const chain = {
        input: vi.fn((name, _type, value) => {
          captured.inputs[name] = value;
          return chain;
        }),
        query: vi.fn(async (sqlText) => {
          captured.query = sqlText;
          if (queue.length === 0) {
            throw new Error(
              `mockPool: unexpected query (no more scripted results): ${sqlText}`,
            );
          }
          const next = queue.shift();
          if (next instanceof Error) throw next;
          if (Array.isArray(next)) return { recordset: next, rowsAffected: [next.length] };
          return {
            recordset: next.recordset ?? [],
            rowsAffected: next.rowsAffected ?? [next.recordset?.length ?? 0],
          };
        }),
      };
      return chain;
    }),
  };

  return { pool, calls, remaining: () => queue.length };
}

export function fakeRequest({ body, params = {}, query = {}, headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const queryMap = new Map(Object.entries(query));
  return {
    json: vi.fn(async () => body),
    params,
    query: {
      get: (k) => (queryMap.has(k) ? queryMap.get(k) : null),
    },
    headers: {
      get: (k) => (headerMap.has(k.toLowerCase()) ? headerMap.get(k.toLowerCase()) : null),
    },
  };
}

export function sqlError(number, message = 'unique constraint violation') {
  const err = new Error(message);
  err.number = number;
  return err;
}
