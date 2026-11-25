import {startLanguages} from './locale.js';

const page = document.querySelector('[data-welcome]');
const params = new URLSearchParams(location.search);
const id = params.get('id');
const routes = {meta: '/meta/', etsy: '/etsy/', apa: '/apa/', pdf: '/pdf/'};
const pairedGuide = page && /^[a-p]{32}$/.test(id ?? '') &&
  location.origin === 'https://welcomeplugin.com' && location.pathname === routes[document.body.dataset.project];

function sendMessage(message) {
  const runtime = window.chrome?.runtime;
  if (typeof runtime?.sendMessage !== 'function') return Promise.resolve();
  return new Promise(resolve => {
    const deadline = setTimeout(resolve, 2000);
    try {
      runtime.sendMessage(id, message, response => {
        clearTimeout(deadline);
        resolve(runtime.lastError ? undefined : response);
      });
    } catch {
      clearTimeout(deadline);
      resolve();
    }
  });
}

void startLanguages(pairedGuide ? sendMessage : null);

if (page) {
  const hint = params.get('pinned');
  const hintedMode = hint === '1' ? 'usage' : 'pin';
  let liveMode;
  let pollTimer;
  let generation = 0;

  function manualMode() {
    const mode = location.hash.slice(1);
    if (mode === 'pin' || mode === 'usage') return mode;
  }

  function render() {
    page.dataset.mode = manualMode() ?? liveMode ?? hintedMode;
  }

  async function poll(current) {
    const response = await sendMessage({type: 'getPinState'});
    const mode = typeof response?.pinned === 'boolean' ? (response.pinned ? 'usage' : 'pin') : undefined;
    if (current !== generation || document.hidden) return;
    liveMode = mode;
    render();
    pollTimer = setTimeout(() => poll(current), mode ? 1500 : 5000);
  }

  function syncPolling() {
    clearTimeout(pollTimer);
    const current = ++generation;
    if (!document.hidden && !manualMode() && pairedGuide &&
        typeof window.chrome?.runtime?.sendMessage === 'function') {
      void poll(current);
    }
  }

  function locationChanged() {
    render();
    syncPolling();
  }

  page.dataset.interactive = '';
  locationChanged();
  window.addEventListener('hashchange', locationChanged);
  document.addEventListener('visibilitychange', syncPolling);
  window.addEventListener('pageshow', event => {
    if (event.persisted) locationChanged();
  });

  // Chrome can adjust touch targets towards nearby links. Check the contact itself.
  const missedTouches = new Set();
  const linkAt = target => target.closest?.('a[href]');
  const hits = (link, point) => link.contains(document.elementFromPoint(point.clientX, point.clientY));
  page.addEventListener('touchstart', event => {
    const link = linkAt(event.target);
    for (const touch of event.changedTouches) {
      if (link && !hits(link, touch)) missedTouches.add(touch.identifier);
    }
  }, {capture: true, passive: true});
  page.addEventListener('touchend', event => {
    const link = linkAt(event.target);
    for (const touch of event.changedTouches) {
      if (missedTouches.delete(touch.identifier) || (link && !hits(link, touch))) {
        event.preventDefault();
      }
    }
  }, {capture: true, passive: false});
  page.addEventListener('touchcancel', event => {
    for (const touch of event.changedTouches) missedTouches.delete(touch.identifier);
  }, {capture: true, passive: true});

  page.addEventListener('click', event => {
    const link = linkAt(event.target);
    if (!link) return;
    if (event.detail > 0 && !hits(link, event)) {
      event.preventDefault();
      return;
    }
    if (!link.classList.contains('mode-switch') || event.defaultPrevented ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    history.pushState(null, '', link.hash);
    locationChanged();
    document.querySelector(`${link.hash} h1`)?.focus();
    window.scrollTo(0, 0);
  }, {capture: true});
}
