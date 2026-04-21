import { reactive } from 'vue';

const state = reactive({
  visible: false,
  icon: '⚡',
  title: '',
  sub: '',
  kw: '',
});

let timer = null;

export function useToast() {
  function show({ icon = '⚡', title, sub = '', kw = '' }) {
    state.icon = icon;
    state.title = title;
    state.sub = sub;
    state.kw = kw;
    state.visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.visible = false;
    }, 5000);
  }
  function hide() {
    state.visible = false;
    clearTimeout(timer);
  }
  return { toast: state, show, hide };
}
