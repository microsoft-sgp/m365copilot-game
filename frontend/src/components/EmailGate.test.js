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
    expect(wrapper.text()).toContain('Please enter how we should address you');
  });

  it('shows error when name is missing', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('input[type="email"]').setValue('ada@smu.edu.sg');
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.text()).toContain('Please enter how we should address you');
  });

  it('shows error for invalid email', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('input[type="text"]').setValue('Ada');
    await wrapper.find('input[type="email"]').setValue('notanemail');
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.text()).toContain('valid email');
  });

  it('emits continue with lowercase trimmed email and name on valid input', async () => {
    const wrapper = mount(EmailGate);
    await wrapper.find('input[type="text"]').setValue(' Alice  ');
    await wrapper.find('input[type="email"]').setValue('  Alice@NUS.edu.sg  ');
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.emitted('continue')).toBeTruthy();
    expect(wrapper.emitted('continue')[0][0]).toEqual({
      email: 'alice@nus.edu.sg',
      name: 'Alice',
    });
  });

  it('emits admin when admin login is clicked', async () => {
    const wrapper = mount(EmailGate);
    const adminBtn = wrapper.findAll('button').find((b) => b.text().includes('Admin'));
    await adminBtn.trigger('click');
    expect(wrapper.emitted('admin')).toBeTruthy();
  });
});
