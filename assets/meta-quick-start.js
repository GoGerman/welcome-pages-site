const guide = document.querySelector('.meta-visual-guide');
const stepButton = guide.querySelector('[data-meta-step]');
const missedTouches = new Set();

function hitsButton(point) {
  return stepButton.contains(document.elementFromPoint(point.clientX, point.clientY));
}

function showStep(step) {
  guide.dataset.step = step;
  stepButton.setAttribute('aria-expanded', String(step === 'scan'));
}

stepButton.addEventListener('touchstart', event => {
  for (const touch of event.changedTouches) {
    if (!hitsButton(touch)) missedTouches.add(touch.identifier);
  }
}, { passive: true });

stepButton.addEventListener('touchend', event => {
  for (const touch of event.changedTouches) {
    if (missedTouches.delete(touch.identifier) || !hitsButton(touch)) event.preventDefault();
  }
}, { passive: false });

stepButton.addEventListener('touchcancel', event => {
  for (const touch of event.changedTouches) missedTouches.delete(touch.identifier);
}, { passive: true });

stepButton.addEventListener('click', event => {
  if (event.defaultPrevented || (event.detail > 0 && !hitsButton(event))) return;
  showStep(guide.dataset.step === 'scan' ? 'icon' : 'scan');
});

window.addEventListener('hashchange', () => showStep('icon'));
stepButton.hidden = false;
