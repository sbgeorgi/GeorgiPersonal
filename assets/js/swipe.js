/* NomadSwipe demo deck. Right = save, left = pass.
   Input: pointer drag, ArrowRight / ArrowLeft while the deck is focused, or the Save / Pass buttons.
   Markup it expects: #swipeDeck, #savedCount, #passedCount; optional #vibeReadout, #btnSave, #btnPass, #btnReset.
   Reduced motion: no travel or rotation, cards fade out and the next one simply promotes. */
(function () {
  var deck = document.getElementById('swipeDeck');
  var savedEl = document.getElementById('savedCount'), passedEl = document.getElementById('passedCount');
  if (!deck || !savedEl || !passedEl) return;

  /* sample deck: real Las Vegas places, photos in assets/img (credits in the page footer); ratings and distances are illustrative */
  var PLACES = [
    { cat: 'Bar',        name: 'Golden Tiki',              rating: 4.5, dist: '2.3 km', h: 'thermal', img: 'ns-tiki' },
    { cat: 'Museum',     name: 'The Neon Museum',          rating: 4.6, dist: '3.1 km', h: 'cobalt',  img: 'ns-neon' },
    { cat: 'Hotel',      name: 'Hard Rock Hotel',          rating: 4.7, dist: '1.2 km', h: 'indigo',  img: 'ns-hardrock' },
    { cat: 'Nightlife',  name: 'Fremont Street',           rating: 4.6, dist: '4.0 km', h: 'lime',    img: 'ns-fremont' },
    { cat: 'Attraction', name: 'Red Rock Canyon',          rating: 4.9, dist: '24 km',  h: 'amber',   img: 'ns-redrock' },
    { cat: 'Attraction', name: 'Bellagio Fountains',       rating: 4.8, dist: '1.8 km', h: 'teal',    img: 'ns-bellagio' }
  ];
  var VIBES = ['Learning: you love tiki bars…', 'Learning: more neon, fewer museums…', 'Learning: nightlife weighted +12%…', 'Learning: big views are your thing…', 'Deck rebalanced around your taste.'];
  var THRESH = 90, STACK = 4;
  var vibeEl = document.getElementById('vibeReadout');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var saved = 0, passed = 0, queue = 0, cards = [];

  PLACES.forEach(function (p) { new Image().src = 'assets/img/' + p.img + '.jpg'; }); // warm the cache so promoted cards never pop in
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function makeCard(place) {
    var el = document.createElement('div');
    el.className = 'sw-card';
    el.setAttribute('data-h', place.h);
    el.setAttribute('aria-label', place.name + ', ' + place.cat + ', rated ' + place.rating + ', ' + place.dist);
    el.innerHTML =
      '<img class="sw-art" src="assets/img/' + place.img + '.jpg" width="640" height="780" alt="" loading="eager" decoding="async" draggable="false">' +
      '<span class="sw-stamp save" aria-hidden="true">Save</span><span class="sw-stamp pass" aria-hidden="true">Nope</span>' +
      '<span class="sw-info"><b class="sw-name">' + esc(place.name) + '</b>' +
      '<span class="sw-meta">' + esc(place.cat) + ' · ' + place.rating + ' rating · ' + esc(place.dist) + '</span></span>';
    el.__stamps = [el.querySelector('.save'), el.querySelector('.pass')];
    return el;
  }

  /* resting transform of the i-th card in the stack; p (0..1) pulls the stack forward while the top card is dragged */
  function rest(i, p) {
    if (reduced.matches) return i ? 'scale(' + (1 - i * 0.04) + ')' : 'none';
    var k = i - (i ? p : 0), rot = i % 2 ? 2.2 : -2.2;
    return 'translateY(' + (k * 11).toFixed(2) + 'px) scale(' + (1 - k * 0.045).toFixed(4) + ') rotate(' + (i ? rot * (1 - p) : 0).toFixed(2) + 'deg)';
  }
  function restack(p) {
    cards.forEach(function (c, i) {
      c.style.zIndex = 10 - i;
      c.style.pointerEvents = i ? 'none' : '';
      c.style.opacity = i > 2 ? 0.0 : '';
      if (i) c.style.transform = rest(i, p || 0);
    });
  }
  function fill() {
    while (cards.length < STACK) {
      var c = makeCard(PLACES[queue % PLACES.length]); queue++;
      deck.appendChild(c); cards.push(c); c.style.transform = rest(cards.length - 1, 0);
      if (cards.length === 1) c.style.transform = '';
    }
    cards.forEach(function (c, i) { c.style.transition = ''; if (!i) c.style.transform = ''; });
    restack(0);
    arm(cards[0]);
  }

  function count(dir) {
    if (dir > 0) { saved++; savedEl.textContent = saved; } else { passed++; passedEl.textContent = passed; }
    if (vibeEl) {
      vibeEl.textContent = VIBES[Math.min(saved + passed - 1, VIBES.length - 1)] || VIBES[0];
      vibeEl.classList.remove('pulse'); void vibeEl.offsetWidth; vibeEl.classList.add('pulse');
    }
  }

  function fling(dir, dy) {
    var card = cards[0]; if (!card) return;
    cards.shift();
    card.style.pointerEvents = 'none';
    if (reduced.matches) {
      card.style.transition = 'opacity .2s linear'; card.style.opacity = 0;
    } else {
      card.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1), opacity .45s linear';
      card.style.transform = 'translate(' + (dir * deck.clientWidth * 1.25) + 'px,' + (dy || 30) + 'px) rotate(' + (dir * 26) + 'deg)';
      card.style.opacity = 0;
    }
    count(dir);
    if (cards[0]) cards[0].style.transform = '';
    setTimeout(function () { card.remove(); }, 600);
    setTimeout(function () { fill(); }, reduced.matches ? 60 : 160);
    restack(0);
  }

  function arm(card) {
    if (!card || card.__armed) return;
    card.__armed = true;
    var sx = 0, sy = 0, dx = 0, dy = 0, on = false;
    card.addEventListener('pointerdown', function (e) {
      if (card !== cards[0] || (e.pointerType === 'mouse' && e.button)) return;
      on = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      try { card.setPointerCapture(e.pointerId); } catch (err) {}
      card.style.transition = 'none'; deck.classList.add('is-drag');
    });
    card.addEventListener('pointermove', function (e) {
      if (!on) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (reduced.matches) card.style.transform = 'translateX(' + dx + 'px)';
      else card.style.transform = 'translate(' + dx + 'px,' + (dy * 0.5) + 'px) rotate(' + (dx * 0.07) + 'deg)';
      card.__stamps[0].style.opacity = Math.max(0, Math.min(1, dx / THRESH));
      card.__stamps[1].style.opacity = Math.max(0, Math.min(1, -dx / THRESH));
      restack(Math.min(1, Math.abs(dx) / THRESH));
    });
    function end() {
      if (!on) return; on = false; deck.classList.remove('is-drag');
      if (Math.abs(dx) > THRESH) { fling(dx > 0 ? 1 : -1, dy * 0.5); return; }
      card.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
      card.style.transform = '';
      card.__stamps[0].style.opacity = card.__stamps[1].style.opacity = 0;
      restack(0); dx = dy = 0;
    }
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  deck.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); fling(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); fling(-1); }
  });
  function on(id, fn) { var n = document.getElementById(id); if (n) n.addEventListener('click', fn); }
  on('btnSave', function () { fling(1); });
  on('btnPass', function () { fling(-1); });
  on('btnReset', function () {
    saved = passed = 0; savedEl.textContent = passedEl.textContent = '0';
    cards.forEach(function (c) { c.remove(); }); cards = []; queue = 0;
    if (vibeEl) vibeEl.textContent = 'Deck reset. Swipe to teach me your vibe';
    fill();
  });

  fill();
})();
