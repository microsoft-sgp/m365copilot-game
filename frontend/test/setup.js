// Polyfill localStorage because jsdom + vitest 4 ship an empty shim.
// We install a minimal in-memory Storage so useBingoGame/useSubmissions
// hydration tests can actually exercise the storage module.

class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  get length() {
    return this._data.size;
  }
  key(i) {
    return Array.from(this._data.keys())[i] ?? null;
  }
  getItem(k) {
    return this._data.has(k) ? this._data.get(k) : null;
  }
  setItem(k, v) {
    this._data.set(k, String(v));
  }
  removeItem(k) {
    this._data.delete(k);
  }
  clear() {
    this._data.clear();
  }
}

function install(target) {
  if (!target) return;
  // Replace whatever vitest's jsdom shipped with the real thing.
  Object.defineProperty(target, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(target, 'sessionStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

install(globalThis);
if (typeof window !== 'undefined') install(window);

// jsdom doesn't implement scrollIntoView — add a no-op so components that
// call it during mount don't trip the async-error reporter.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement matchMedia — add a stub for responsive tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
