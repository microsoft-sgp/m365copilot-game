import { reactive } from 'vue';

const state = reactive({
  visible: false,
  icon: '⚡',
  title: '',
  sub: '',
  kw: '',
});

type ToastPayload = {
  icon?: string;
  title: string;
  sub?: string;
  kw?: string;
};

let timer: ReturnType<typeof setTimeout> | null = null;

export function useToast() {
  function show({ icon = '⚡', title, sub = '', kw = '' }: ToastPayload) {
    state.icon = icon;
    state.title = title;
    state.sub = sub;
    state.kw = kw;
    state.visible = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      state.visible = false;
    }, 5000);
  }
  function hide() {
    state.visible = false;
    if (timer) clearTimeout(timer);
  }
  return { toast: state, show, hide };
}
