'use strict';
// PLAY STATS (GoatCounter): no cookies, nothing personal. The page view itself is counted by count.js (with screen
// size, browser and OS, so phones show up there). On top of it, a few events say how far people get:
//   device-touch-only / no-webgl2            who opened it on something it can't be played on
//   loaded / left-while-loading              did they sit through the ~10 s world build
//   tut-01-the-leaf ... tut-12-into-the-forest, tut-finished, tut-left-at-NN
//   forest, eaten-<kind>, eaten-count-N, mated, died-<by>, played-1m / 5m / 15m / 30m
// Each event is sent at most once per page load, so a replayed lesson or a second death doesn't inflate the totals.
// Loaded as a plain script before the game, so it runs (and counts phones) even if the game itself never starts.
// Off on localhost, so testing doesn't count.
const GC_CODE = 'vimuston';   // the part before .goatcounter.com
const STATS = (() => {
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  const on = !local && !!GC_CODE;
  const sent = new Set(), queue = [];
  if(on){
    const s = document.createElement('script');
    s.async = true; s.src = 'https://gc.zgo.at/count.js'; s.dataset.goatcounter = `https://${GC_CODE}.goatcounter.com/count`;
    s.onload = () => { while(queue.length) send(queue.shift()); };
    document.head.appendChild(s);
  }
  function send(ev){ try { window.goatcounter.count(ev); } catch(e){} }
  function stat(name, title = name){
    if(!on || sent.has(name)) return; sent.add(name);
    const ev = {path: name, title, event: true};
    if(window.goatcounter && window.goatcounter.count) send(ev); else queue.push(ev);
  }
  // what it was opened on: a phone or tablet has no mouse and no keyboard to play with (the game has no touch controls)
  const mm = q => { try { return matchMedia(q).matches; } catch(e){ return false; } };
  if(mm('(pointer: coarse)') && !mm('(any-pointer: fine)')) stat('device-touch-only', 'Opened on a touch-only device (phone / tablet)');
  let gl2 = false; try { gl2 = !!document.createElement('canvas').getContext('webgl2'); } catch(e){}
  if(!gl2) stat('no-webgl2', 'No WebGL2: the game cannot start');
  // left before the world finished building
  let loaded = false;
  addEventListener('pagehide', () => { if(!loaded) stat('left-while-loading', 'Left before the game finished loading'); });
  // minutes with the tab in view after loading (wall clock, so pauses in the guide count; a hidden tab doesn't)
  let seen = 0;
  const MARKS = [1, 5, 15, 30];
  setInterval(() => { if(!loaded || document.hidden) return; seen += 5;
    for(const m of MARKS) if(seen >= m*60) stat(`played-${m}m`, `Played ${m} min or more`); }, 5000);
  return {stat, loaded(){ loaded = true; stat('loaded', 'Game finished loading'); }};
})();
const stat = STATS.stat;
