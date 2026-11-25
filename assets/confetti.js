(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function celebrate() {
    if (motion.matches) return;

    const colors = getComputedStyle(document.body).getPropertyValue('--confetti-colors')
      .split(',').map(color => color.trim()).filter(Boolean);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || colors.length === 0) return;
    canvas.className = 'welcome-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);

    let width, height, frame;
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize, {passive: true});
    window.addEventListener('pagehide', finish, {once: true});
    document.addEventListener('visibilitychange', finish, {once: true});
    motion.addEventListener('change', preferenceChanged);

    const amount = width < 520 ? 68 : 120;
    const pieces = Array.from({length: amount}, (_, index) => {
      const left = index % 2 === 0;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const speed = Math.min(height, 900) * (0.82 + Math.random() * 0.78);
      return {
        origin: left ? 0.34 : 0.66,
        vx: Math.cos(angle) * speed * 0.78 + (left ? 65 : -65),
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 18,
        size: 3 + Math.random() * 6,
        start: Math.random() * 0.19,
        color: colors[index % colors.length]
      };
    });
    const started = performance.now();

    function finish() {
      cancelAnimationFrame(frame);
      canvas.remove();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', finish);
      document.removeEventListener('visibilitychange', finish);
      motion.removeEventListener('change', preferenceChanged);
    }

    function preferenceChanged(event) {
      if (event.matches) finish();
    }

    function draw(now) {
      const elapsed = (now - started) / 1000;
      if (elapsed >= 2.85) {
        finish();
        return;
      }

      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.min(1, (2.85 - elapsed) / 0.8);
      for (const piece of pieces) {
        const age = elapsed - piece.start;
        if (age < 0) continue;
        const travel = (1 - Math.exp(-0.95 * age)) / 0.95;
        const x = width * piece.origin + piece.vx * travel;
        const y = height * 0.79 + piece.vy * travel + 245 * age * age;
        context.save();
        context.translate(x, y);
        context.rotate(piece.angle + piece.spin * age);
        context.scale(0.18 + 0.82 * Math.abs(Math.cos(age * 9 + piece.angle)), 1);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 1.38);
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
  }

  if (document.hidden) document.addEventListener('visibilitychange', celebrate, {once: true});
  else celebrate();
})();
