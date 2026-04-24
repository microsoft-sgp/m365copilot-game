import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EmailGate from './EmailGate.vue';

describe('EmailGate', () => {
  it('renders email input and continue button', () => {
    const wrapper = mount(EmailGate);
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('button').text()).toContain('Continue');
  });

  it('shows error for empty email', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.text()).toContain('Please enter your email');
  });

  it('shows error for invalid email', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('input').setValue('notanemail');
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.text()).toContain('valid email');
  });

  it('emits continue with lowercase trimmed email on valid input', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('input').setValue('  Alice@NUS.edu.sg  ');
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.emitted('continue')).toBeTruthy();
    expect(wrapper.emitted('continue')[0][0]).toBe('alice@nus.edu.sg');
  });

  it('emits admin when admin login is clicked', async () => {
    const wrapper = mount(EmailGate);
    const adminBtn = wrapper.findAll('button').find((b) => b.text().includes('Admin'));
    await adminBtn.trigger('click');
    expect(wrapper.emitted('admin')).toBeTruthy();
  });
});
