import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTabs from './AppTabs.vue';

describe('AppTabs', () => {
  it('renders all four tabs', () => {
    const w = mount(AppTabs, { props: { modelValue: 'game' } });
    const btns = w.findAll('button');
    expect(btns).toHaveLength(4);
    expect(btns.map((b) => b.text())).toEqual([
      '🎮 Game Board',
      '🔑 My Keywords',
      '📬 Submit & Leaderboard',
      '❓ Help',
    ]);
  });

  it('marks the active tab via the "active" class', () => {
    const w = mount(AppTabs, { props: { modelValue: 'keywords' } });
    const active = w.findAll('button').filter((b) => b.classes('active'));
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('🔑 My Keywords');
  });

  it('emits update:modelValue with the tab id on click', async () => {
    const w = mount(AppTabs, { props: { modelValue: 'game' } });
    await w.findAll('button')[2].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['submit']]);
  });
});
