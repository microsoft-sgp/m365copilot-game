import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './useToast.js';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset shared state between tests
    const { hide } = useToast();
    hide();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts hidden by default on first load', () => {
    const { toast, hide } = useToast();
    hide();
    expect(toast.visible).toBe(false);
  });

  it('show() sets content and becomes visible', () => {
    const { toast, show } = useToast();
    show({ icon: '🔥', title: 'Hello', sub: 'sub', kw: 'KW1' });
    expect(toast.visible).toBe(true);
    expect(toast.icon).toBe('🔥');
    expect(toast.title).toBe('Hello');
    expect(toast.sub).toBe('sub');
    expect(toast.kw).toBe('KW1');
  });

  it('uses default icon ⚡ when none supplied', () => {
    const { toast, show } = useToast();
    show({ title: 'No icon' });
    expect(toast.icon).toBe('⚡');
    expect(toast.sub).toBe('');
    expect(toast.kw).toBe('');
  });

  it('auto-hides after 5 seconds', () => {
    const { toast, show } = useToast();
    show({ title: 'Timed' });
    expect(toast.visible).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(toast.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(toast.visible).toBe(false);
  });

  it('calling show() twice in quick succession resets the timer', () => {
    const { toast, show } = useToast();
    show({ title: 'first' });
    vi.advanceTimersByTime(4000);
    show({ title: 'second' });
    vi.advanceTimersByTime(4999);
    expect(toast.visible).toBe(true);
    expect(toast.title).toBe('second');
    vi.advanceTimersByTime(1);
    expect(toast.visible).toBe(false);
  });

  it('hide() cancels the auto-dismiss timer', () => {
    const { toast, show, hide } = useToast();
    show({ title: 'x' });
    hide();
    expect(toast.visible).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(toast.visible).toBe(false);
  });

  it('shares the same toast state across calls (module-scoped)', () => {
    const a = useToast();
    const b = useToast();
    a.show({ title: 'from-a' });
    expect(b.toast.title).toBe('from-a');
    expect(b.toast.visible).toBe(true);
  });
});
