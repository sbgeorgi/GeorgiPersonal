/* ============================================================
   NomadSwipe page — interactive swipe deck demo
   drag right = save · drag left = pass
   ============================================================ */
(function () {
  const deck = document.getElementById('swipeDeck');
  if (!deck) return;

  const PLACES = [
    { cat: 'Restaurant', name: 'Golden Tiki',      rating: 4.5, dist: '2.3 km', icon: '🍹', g: 'linear-gradient(160deg,#4a2c14,#1c1006)' },
    { cat: 'Café',       name: 'Slow Pour Society',rating: 4.8, dist: '900 m',  icon: '☕', g: 'linear-gradient(160deg,#23301a,#0e130a)' },
    { cat: 'Hotel',      name: 'Hard Rock Stay',   rating: 4.7, dist: '1.2 km', icon: '🎸', g: 'linear-gradient(160deg,#33121f,#150811)' },
    { cat: 'Nightlife',  name: 'Neon Boneyard',    rating: 4.6, dist: '3.1 km', icon: '🌃', g: 'linear-gradient(160deg,#12283a,#081018)' },
    { cat: 'Attraction', name: 'Red Rock Overlook',rating: 4.9, dist: '5.4 km', icon: '🏜️', g: 'linear-gradient(160deg,#3d1d0e,#170b05)' },
    { cat: 'Food Truck', name: 'Taco Alchemy',     rating: 4.7, dist: '1.8 km', icon: '🌮', g: 'linear-gradient(160deg,#3a3310,#151206)' },
    { cat: 'Museum',     name: 'Modern Art Shed',  rating: 4.4, dist: '2.9 km', icon: '🖼️', g: 'linear-gradient(160deg,#241a38,#0f0a1a)' },
    { cat: 'Bar',        name: 'Dive & Thrive',    rating: 4.6, dist: '700 m',  icon: '🍺', g: 'linear-gradient(160deg,#123a2e,#071510)' },
  ];

  const savedEl = document.getElementById('savedCount');
  const passedEl = document.getElementById('passedCount');
  const vibeEl = document.getElementById('vibeReadout');
  let saved = 0, passed = 0, queue = 0;

  const VIBES = ['Learning: you love tiki bars…','Learning: more cafés, less museums…','Learning: nightlife weighted +12%…','Learning: food trucks it is…','Deck rebalanced around your taste ✓'];

  function makeCard(place, idx) {
    const el = document.createElement('div');
    el.className = 'sw-card';
    el.style.background = place.g;
    el.style.zIndex = 10 - idx;
    el.style.transform = `translateY(${idx * 12}px) scale(${1 - idx * 0.045}) rotate(${idx % 2 ? 2.5 : -2.5}deg)`;
    el.innerHTML = `
      <div class="sw-stamp save">SAVE</div>
      <div class="sw-stamp pass">NOPE</div>
      <div class="sw-icon">${place.icon}</div>
      <div class="sw-info">
        <span class="sw-cat">${place.cat}</span>
        <h4>${place.name}</h4>
        <span class="sw-meta">★ ${place.rating} — ${place.dist}</span>
      </div>`;
    return el;
  }

  let cards = [];
  function fill() {
    while (cards.length < 4) {
      const place = PLACES[queue % PLACES.length]; queue++;
      const c = makeCard(place, cards.length);
      c.__place = place;
      deck.appendChild(c);
      cards.push(c);
    }
    restack();
    arm(cards[0]);
  }
  function restack() {
    cards.forEach((c, i) => {
      c.style.zIndex = 10 - i;
      if (i > 0) c.style.transform = `translateY(${i * 12}px) scale(${1 - i * 0.045}) rotate(${i % 2 ? 2.5 : -2.5}deg)`;
    });
  }

  function vibeTick() {
    if (!vibeEl) return;
    vibeEl.textContent = VIBES[Math.min(saved + passed - 1, VIBES.length - 1)] || VIBES[0];
    vibeEl.classList.remove('pulse'); void vibeEl.offsetWidth; vibeEl.classList.add('pulse');
  }

  function arm(card) {
    if (!card) return;
    let sx, sy, dx = 0, dy = 0, dragging = false;
    const saveStamp = card.querySelector('.save');
    const passStamp = card.querySelector('.pass');

    card.addEventListener('pointerdown', e => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = `translate(${dx}px,${dy * 0.6}px) rotate(${dx * 0.08}deg)`;
      saveStamp.style.opacity = Math.max(0, dx / 120);
      passStamp.style.opacity = Math.max(0, -dx / 120);
    });
    card.addEventListener('pointerup', () => {
      if (!dragging) return; dragging = false;
      card.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1)';
      if (Math.abs(dx) > 110) {
        const dir = dx > 0 ? 1 : -1;
        card.style.transform = `translate(${dir * innerWidth}px,${dy}px) rotate(${dir * 32}deg)`;
        card.style.opacity = 0;
        if (dir > 0) { saved++; savedEl.textContent = saved; } else { passed++; passedEl.textContent = passed; }
        vibeTick();
        cards = cards.filter(c => c !== card);
        setTimeout(() => { card.remove(); }, 560);
        setTimeout(fill, 180);
      } else {
        card.style.transform = 'translateY(0) scale(1) rotate(0deg)';
        saveStamp.style.opacity = passStamp.style.opacity = 0;
      }
      dx = dy = 0;
    });
    card.addEventListener('pointercancel', () => { dragging = false; dx = dy = 0; restack(); });
  }

  /* button controls */
  document.getElementById('btnSave')?.addEventListener('click', () => fling(1));
  document.getElementById('btnPass')?.addEventListener('click', () => fling(-1));
  function fling(dir) {
    const card = cards[0]; if (!card) return;
    card.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
    card.style.transform = `translate(${dir * innerWidth}px,40px) rotate(${dir * 30}deg)`;
    card.style.opacity = 0;
    if (dir > 0) { saved++; savedEl.textContent = saved; } else { passed++; passedEl.textContent = passed; }
    vibeTick();
    cards = cards.filter(c => c !== card);
    setTimeout(() => card.remove(), 520);
    setTimeout(fill, 160);
  }
  document.getElementById('btnReset')?.addEventListener('click', () => {
    saved = passed = 0; savedEl.textContent = passedEl.textContent = '0';
    cards.forEach(c => c.remove()); cards = []; queue = 0;
    if (vibeEl) vibeEl.textContent = 'Deck reset — swipe to teach me your vibe';
    fill();
  });

  fill();
})();
