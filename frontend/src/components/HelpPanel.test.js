import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpPanel from './HelpPanel.vue';
import { COPILOT_URL } from '../data/constants.js';

describe('HelpPanel', () => {
  it('renders the "How to Play" heading and play-loop sections', () => {
    const w = mount(HelpPanel);
    expect(w.text()).toContain('How to Play');
    expect(w.findAll('section')).toHaveLength(4);
    expect(w.text()).toContain('Start');
    expect(w.text()).toContain('Play');
    expect(w.text()).toContain('Claim');
    expect(w.text()).toContain('Track progress');
  });

  it('preserves the required gameplay instruction topics', () => {
    const w = mount(HelpPanel);
    const text = w.text();

    expect(text).toContain('onboarding');
    expect(text).toContain('assigned pack');
    expect(text).toContain('launch your board');
    expect(text).toContain('tile');
    expect(text).toContain('Copilot Chat');
    expect(text).toContain('proof');
    expect(text).toContain('Verify & Claim');
    expect(text).toContain('row, column, or diagonal');
    expect(text).toContain('keyword');
    expect(text).toContain('My Activity');
  });

  it('provides a link to open Copilot Chat', () => {
    const w = mount(HelpPanel);
    const link = w.find('a[href]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(COPILOT_URL);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.classes()).toContain('btn-primary');
  });

  it('emits admin when Admin Login is clicked', async () => {
    const w = mount(HelpPanel);
    await w
      .findAll('button')
      .find((button) => button.text().includes('Admin Login'))
      .trigger('click');

    expect(w.emitted('admin')).toHaveLength(1);
  });

  it('does not show developer-facing notes', () => {
    const w = mount(HelpPanel);
    expect(w.text()).not.toContain('Browser Security Note');
    expect(w.text()).not.toContain('Keyword Security Note');
    expect(w.text()).not.toContain('COPILOT_URL');
  });
});
