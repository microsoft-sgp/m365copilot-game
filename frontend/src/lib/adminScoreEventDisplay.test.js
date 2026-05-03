import { describe, expect, it } from 'vitest';
import { formatAdminScoreEvent } from './adminScoreEventDisplay.js';

describe('formatAdminScoreEvent', () => {
  it('formats line wins as completed tasks', () => {
    expect(formatAdminScoreEvent({ event_type: 'line_won', event_key: 'R1' })).toEqual({
      label: 'Line completed',
      detail: 'Task 1',
    });
    expect(formatAdminScoreEvent({ event_type: 'line_won', event_key: 'C2' })).toEqual({
      label: 'Line completed',
      detail: 'Task 5',
    });
    expect(formatAdminScoreEvent({ event_type: 'line_won', event_key: 'D2' })).toEqual({
      label: 'Line completed',
      detail: 'Task 8',
    });
  });

  it('formats weekly wins as weekly awards', () => {
    expect(formatAdminScoreEvent({ event_type: 'weekly_won', event_key: 'W1' })).toEqual({
      label: 'Weekly award earned',
      detail: 'Week 1',
    });
  });

  it('formats legacy rows without exposing raw fallback codes', () => {
    expect(formatAdminScoreEvent({ event_type: null })).toEqual({
      label: 'Legacy keyword submission',
      detail: '',
    });
  });

  it('formats unknown event types into readable labels', () => {
    expect(formatAdminScoreEvent({ event_type: 'bonus_award' })).toEqual({
      label: 'Bonus Award',
      detail: '',
    });
  });
});
