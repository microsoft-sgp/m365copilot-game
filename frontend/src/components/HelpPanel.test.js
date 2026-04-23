import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpPanel from './HelpPanel.vue';
import { COPILOT_URL } from '../data/constants.js';

describe('HelpPanel', () => {
  it('renders the "How to Play" heading and ordered list', () => {
    const w = mount(HelpPanel);
    expect(w.text()).toContain('How to Play');
    expect(w.findAll('ol li')).toHaveLength(6);
  });

  it('surfaces the configured Copilot URL', () => {
    const w = mount(HelpPanel);
    expect(w.text()).toContain(COPILOT_URL);
  });

  it('shows the browser and keyword security notes', () => {
    const w = mount(HelpPanel);
    expect(w.text()).toContain('Browser Security Note');
    expect(w.text()).toContain('Keyword Security Note');
  });
});
