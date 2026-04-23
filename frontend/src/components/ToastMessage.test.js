import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ToastMessage from './ToastMessage.vue';
import { useToast } from '../composables/useToast.js';

describe('ToastMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToast().hide();
  });
  afterEach(() => vi.useRealTimers());

  it('renders nothing when toast is hidden', () => {
    const w = mount(ToastMessage);
    expect(w.html()).toBe('<!--v-if-->');
  });

  it('renders title, sub, kw, and icon when show() is called', async () => {
    const { show } = useToast();
    const w = mount(ToastMessage);
    show({ icon: '🎉', title: 'Hi', sub: 'there', kw: 'CODE-123' });
    await w.vm.$nextTick();
    expect(w.text()).toContain('🎉');
    expect(w.text()).toContain('Hi');
    expect(w.text()).toContain('there');
    expect(w.text()).toContain('CODE-123');
  });

  it('clicking the close button hides the toast', async () => {
    const { show, toast } = useToast();
    const w = mount(ToastMessage);
    show({ title: 'x' });
    await w.vm.$nextTick();
    await w.find('button').trigger('click');
    expect(toast.visible).toBe(false);
  });

  it('omits the sub and kw blocks when not provided', async () => {
    const { show } = useToast();
    const w = mount(ToastMessage);
    show({ title: 'only title' });
    await w.vm.$nextTick();
    expect(w.text()).toContain('only title');
    expect(w.find('.font-mono').exists()).toBe(false);
  });
});
