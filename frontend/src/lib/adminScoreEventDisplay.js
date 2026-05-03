const LINE_AWARD_DETAILS = {
  R1: 'Task 1',
  R2: 'Task 2',
  R3: 'Task 3',
  C1: 'Task 4',
  C2: 'Task 5',
  C3: 'Task 6',
  D1: 'Task 7',
  D2: 'Task 8',
};

function titleCaseEventType(eventType) {
  return String(eventType || '')
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatWeekDetail(eventKey) {
  const match = String(eventKey || '').match(/^W([1-9]\d*)$/i);
  return match ? `Week ${match[1]}` : '';
}

export function formatAdminScoreEvent(event = {}) {
  const eventType = String(event.event_type || '').trim();
  const eventKey = String(event.event_key || '')
    .trim()
    .toUpperCase();

  if (!eventType) {
    return { label: 'Legacy keyword submission', detail: '' };
  }

  if (eventType === 'line_won') {
    return { label: 'Line completed', detail: LINE_AWARD_DETAILS[eventKey] || '' };
  }

  if (eventType === 'weekly_won') {
    return { label: 'Weekly award earned', detail: formatWeekDetail(eventKey) };
  }

  return { label: titleCaseEventType(eventType) || 'Score event', detail: '' };
}
