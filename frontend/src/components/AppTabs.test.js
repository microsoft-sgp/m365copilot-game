import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTabs from './AppTabs.vue';

describe('AppTabs', () => {
  it('renders tabs in both desktop and mobile navs', () => {
    const w = mount(AppTabs, { props: { modelValue: 'game' } });
    const btns = w.findAll('button');
    // 4 desktop + 4 mobile = 8 buttons
    expect(btns).toHaveLength(8);
  });

  it('desktop tabs display icon and label', () => {
    const w = mount(AppTabs, { props: { modelValue: 'game' } });
    const desktopNav = w.findAll('nav')[0];
    const labels = desktopNav.findAll('button').map((b) => b.text());
    expect(labels).toEqual(['🎮 Game', '🔑 Keys', '🧾 Activity', '❓ Help']);
  });

  it('marks the active tab via the "active" class (desktop)', () => {
    const w = mount(AppTabs, { props: { modelValue: 'keywords' } });
    const desktopNav = w.findAll('nav')[0];
    const active = desktopNav.findAll('button').filter((b) => b.classes('active'));
    expect(active).toHaveLength(1);
    expect(active[0].text()).toContain('Keys');
  });

  it('emits update:modelValue with the tab id on click', async () => {
    const w = mount(AppTabs, { props: { modelValue: 'game' } });
    // Click the 3rd desktop button (Activity)
    const desktopNav = w.findAll('nav')[0];
    await desktopNav.findAll('button')[2].trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['activity']]);
  });
});
