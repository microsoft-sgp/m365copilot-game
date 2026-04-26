import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpPanel from './HelpPanel.vue';
import { COPILOT_URL } from '../data/constants.js';

describe('HelpPanel', () => {
  it('renders the "How to Play" heading and ordered list', () => {
    const w = mount(HelpPanel);
    expect(w.text()).toContain('How to Play');
    expect(w.findAll('ol li')).toHaveLength(7);
  });

  it('provides a link to open Copilot Chat', () => {
    const w = mount(HelpPanel);
    const link = w.find('a[href]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(COPILOT_URL);
  });

  it('does not show developer-facing notes', () => {
    const w = mount(HelpPanel);
    expect(w.text()).not.toContain('Browser Security Note');
    expect(w.text()).not.toContain('Keyword Security Note');
  });
});
