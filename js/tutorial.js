'use strict';
// THE TUTORIAL: field notes on a jumping spider, taught on a tall taro-like plant some 80 cm above the forest floor.
// One broad blade to learn on, a small blade a leap away, and a third blade with an orb-weaver's web slung off its tip.
// The stalks can't be climbed, so the only way down is a fall: a fall (or a balloon ride too far) brings her back up.
// Each lesson is narrated like a nature documentary and checks that she really did the thing (walked, sneaked about,
// leapt, hung on her line...). Finishing, or T at any time, drops her into the forest; T again replays it.
// Built after the seeded world, with its own random stream, so nothing generated before it moves.

const TUT_STORE = 'tut.v1';
const TUT = (() => {
  let s = 4242; const rn = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const rr2 = (a, b) => a + rn()*(b - a);
  const BX = -18, BZ = -9, gy = hAt(BX, BZ), H = 26;                    // the plant's foot, and how high its big blade stands (~80 cm)
  const base = new V3(BX, gy, BZ);
  const meshes = [];
  const add = o => { scene.add(o); o.traverse(c => { if(c.isMesh || c.isLine) drawables.push(c); }); meshes.push(o); return o; };
  // a blade on a stalk rising from the plant's foot. tip: where the stalk meets the blade's underside (as on a taro
  // leaf, a little in from its base); rot: which way the blade points (as addLeaf)
  function blade(id, tip, rot, type, w, l, droop, fold, sr, col){
    const dir = new V3(-Math.sin(rot), 0, -Math.cos(rot));
    const c = tip.clone().addScaledVector(dir, l*.74); c.y += sr + .012;
    const mat = glowLeaf(new THREE.MeshStandardMaterial({color: col, map: LEAF_TEX, bumpMap: LEAF_TEX, bumpScale: .8, roughness: .55, side: THREE.DoubleSide}), .2);
    const m = hot(new THREE.Mesh(leafGeo(type, w, l, droop, fold, 18, 36), mat), TEMP.leaf);
    m.position.copy(c); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; OCCLUDERS.push(m);
    m.add(new THREE.LineSegments(veinGeo(type, w, l, droop, fold), new THREE.LineBasicMaterial({color: mat.color.clone().lerp(new THREE.Color(0xe8f0b0), .45)})));
    add(m);
    const lean = tip.clone().sub(base); lean.y = 0;
    const curve = new THREE.CatmullRomCurve3([base.clone().setY(gy - .05), base.clone().addScaledVector(lean, .15).setY(gy + (tip.y - gy)*.55),
      base.clone().addScaledVector(lean, .7).setY(gy + (tip.y - gy)*.93), tip]);
    add(hot(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, sr, 8), stemM), TEMP.stem)).castShadow = true;
    const p = {id, kind: 'leaf', tut: true, x: c.x, y: c.y, z: c.z, rx: w*.82, rz: l*.78, rot, leaf: {type, w, l, droop, fold}, stalk: curve,
      mesh: m, glow0: mat.emissive.clone()};   // (glow0: its own faint glow, which the lesson highlight pulses up from)
    PLAT.push(p); p.under = leafUnder(p);
    return p;
  }
  const top = gy + H;
  const L1 = blade('TUT-A', new V3(BX + .1, top, BZ + .2), 0, 'heart', 2.4, 3.4, .12, .05, .1, 0x4f8a3a);          // the broad leaf
  const L2 = blade('TUT-B', new V3(BX + 3.3, top - .35, BZ - 2.1), -Math.PI/2, 'round', 1.0, 1.15, .1, .08, .05, 0x6a9a44);   // a leap to the right
  const L3 = blade('TUT-C', new V3(BX - 3.3, top + .25, BZ - 2.8), Math.PI/2, 'lance', .85, 1.35, .12, .1, .05, 0x5a8a3c);    // the orb's leaf, to the left
  // the orb: hung off L3's tip, facing it, its top frame at the blade's level so she plucks it from the tip
  const n = new V3(-Math.sin(L3.rot), 0, -Math.cos(L3.rot)), u = new V3().crossVectors(new V3(0, 1, 0), n).normalize();
  const tipP = new V3(L3.x, 0, L3.z).addScaledVector(n, L3.leaf.l*.92); tipP.y = surfAt(L3, tipP.x, tipP.z);
  const R = 2.0, topB = .9*R, C = tipP.clone().addScaledVector(n, .28); C.y = tipP.y - .03 - topB;
  const F2 = []; for(let k = 0; k < 10; k++){ const a = k/10*6.283 + rr2(-.12, .12), rf = R*rr2(1.0, 1.1); F2.push([Math.cos(a)*rf, Math.min(topB, Math.sin(a)*rf)]); }
  const O = {C, n, u, R, tut: true};
  O.g = hot(new THREE.Group(), .3);
  buildOrbWeb(O, O.g, F2, rr2, rn);
  { // anchor lines: the top corners up to the blade's tip and edges, the bottom down to the plant's stalk
    const P2 = (x, y) => C.clone().addScaledVector(u, x).add(new V3(0, y, 0)), pts = [];
    const tops = F2.filter(q => q[1] >= topB - 1e-6).sort((a, b) => a[0] - b[0]);
    const edgeAt = sd => { const q = new V3(L3.x, 0, L3.z).addScaledVector(n, L3.leaf.l*.55).addScaledVector(u, sd*L3.leaf.w*.6); q.y = surfAt(L3, q.x, q.z) - .01; return q; };
    if(tops.length){ const a = P2(...tops[0]), b = P2(...tops[tops.length - 1]);
      pts.push(a, edgeAt(-1), a, tipP, b, edgeAt(1), b, tipP); }
    const low = F2.reduce((b, q) => q[1] < b[1] ? q : b), lp = P2(...low), stem = L3.stalk.getPoint(.62);
    const mid = lp.clone().lerp(stem, .5); pts.push(lp, mid, mid, stem, mid, L1.stalk.getPoint(.6));
    O.g.add(new THREE.LineSegments(segsFrom(pts), silkM(.5)));
  }
  tagSilk(O.g); add(O.g);
  const S = webSurface(O);
  const spider = addPrey({kind: 'argiope', name: 'Argiope · St Andrew’s Cross spider', m: makeArgiope(), plat: L3, pos: C.clone(), state: 'hub', wary: 0, fwd: new V3(0, -1, 0), orb: O, practice: true});
  spider.m.traverse(c => { if(c.isMesh || c.isLine) drawables.push(c); });
  L3.silk = spider; S.silk = spider; Object.assign(O, {S, spider}); ORBS.push(O);
  // a fly that keeps to the plant: it lands on the broad leaf when the lesson calls it, and flees only between these blades
  const fly = {m: makeFly(), plat: L1, pos: new V3(L1.x, L1.y, L1.z), state: 'walk', t: 0, dir: 0, motion: 0, vib: 0, hear: 0, gone: true, respawn: Infinity, temp: .7, homes: [L1, L2]};
  fly.m.userData.owner = fly; fly.m.visible = false; fly.m.traverse(c => { if(c.isMesh || c.isLine) drawables.push(c); }); flies.push(fly);
  const surfs = new Set([L1, L2, L3, L1.under, L2.under, L3.under, S]);
  const spawnYaw = Math.atan2(-Math.sin(L1.rot), -Math.cos(L1.rot)) + Math.PI;   // facing back along the blade, toward its base
  const spawn = new V3(L1.x, 0, L1.z).addScaledVector(new V3(-Math.sin(L1.rot), 0, -Math.cos(L1.rot)), -.6);
  return {on: false, i: 0, g: [], t: 0, doneT: -1, base, top, L1, L2, L3, O, S, spider, fly, surfs, spawn, spawnYaw,
    prevMode: sp.mode, prevPos: new V3(), leap: null, wasBalloon: false, fade: null, el: null};
})();

/* ---------- the lessons. text: the narration; goals: what she must do, in order, each with how much of it (need) ---------- */
const K = (kb, pd) => `<span class="kbonly"><kbd>${kb}</kbd></span><span class="padonly"><kbd>${pd}</kbd></span>`;
const TUT_STEPS = [
  {name: 'The Leaf', text: 'Morning, high in the understory. On a single broad leaf, <i>Portia labiata</i> stirs: a jumping spider half a centimetre long. She keeps no web of her own. Like every jumping spider, she goes out and finds her food, and she finds it with the sharpest eyes of any animal her size.',
    goals: [{t: `${K('WASD', 'Left stick')} Walk out across the leaf`, need: 4, tick: (e, dt) => e.surf ? e.moved : 0}]},
  {name: 'The Hidden Face', text: 'A leaf has two faces. Each of her feet ends in a dense brush of hairs, split again into thousands of finer tips that cling by molecular attraction alone, so she walks upside down as easily as upright. The underside is shelter from birds, wasps and rain.',
    goals: [{t: 'Walk over the edge to the underside, and explore it', need: 1.5, tick: e => e.under ? e.moved : 0},
            {t: 'Walk back over the edge to the top', need: 1, tick: e => e.top ? 1 : 0}]},
  {name: 'Stalking', text: 'Portia hunts other spiders, and spiders are hard to fool. So she does not move like a hunter. Her slow, choppy gait, legs flickering and pausing at random, looks like a scrap of leaf litter trembling in the air. Her prey may see her; it does not see a predator.',
    goals: [{t: `${K('C', 'RT')} Stalk, and keep moving while you do`, need: 5, tick: (e, dt) => e.surf && sp.sneaking && sp.speed > 0 ? dt : 0}]},
  {name: 'The Dash', text: 'When nothing is watching she crosses open ground in bursts: a dart, a dead stop, a look. Each freeze lets her eyes settle, for a jumping spider sees best when it is still. But running feet drum on a leaf, and that drumming carries.',
    goals: [{t: `${K('Shift', 'LT')} Dash, and cover some ground`, need: 3, tick: e => e.surf && sp.sprinting ? e.moved : 0}]},
  {name: 'The Leap', text: 'Her legs have no muscles to straighten them. To jump, she drives up the pressure of her blood in an instant; the hind legs snap straight and throw her many times her own length, to a spot her great forward eyes have already measured.',
    goals: [{t: `Hold ${K('Space', 'A')} to gauge the leap, let go to jump to either small round leaf`, need: 1, glow: () => [TUT.L2, TUT.L3],
              tick: e => e.landed && [TUT.L2, TUT.L2.under, TUT.L3, TUT.L3.under].includes(e.landed) ? 1 : 0},
            {t: 'Leap back to the broad leaf', need: 1, glow: () => [TUT.L1], tick: e => e.landed && (e.landed === TUT.L1 || e.landed === TUT.L1.under) ? 1 : 0}]},
  {name: 'Ballooning', text: 'Spiders fly without wings. Raising her abdomen, she lets fine strands of silk stream out until the moving air, and even the faint electric charge of the sky, takes her weight. It is called ballooning. Spiders have been caught this way kilometres up, and far out over the sea.',
    goals: [{t: `Leap off the leaf, then hold ${K('Space', 'A')} in mid-air. ${K('WASD', 'Left stick')} steers`, need: 2.5, tick: (e, dt) => sp.balloon && sp.mode === 'air' ? dt : 0}]},
  {name: 'The Slow Leap', text: 'A leap is over in a fraction of a second, far too fast for our eyes. Slowed down, it is an exact thing: legs drawn in, the front pair reaching forward, and she comes down where she looked.',
    goals: [{t: `Hold ${K('Space', 'A')} to gauge, hold ${K('Shift', 'LT')} as well, then let go of ${K('Space', 'A')}`, need: 1, tick: e => e.landed && e.leap && e.leap.slow ? 1 : 0}]},
  {name: 'The Dragline', text: 'Before she leaps, a jumping spider glues a thread of silk to the leaf, and it pays out behind her through the air: her dragline, a safety line. If a leap goes wrong she brakes on it in mid-flight, hangs, and reels herself back up. Portia also uses it to come at a web from above, letting herself down on silk where its owner is not watching.',
    lost: 'She fell without braking. Tie a line, and press X while still in the air.',
    goals: [{t: `${K('X', 'B')} Fix a dragline to the leaf`, need: 1, tick: () => sp.line ? 1 : 0},
            {t: `Leap out into the open air, and in mid-flight press ${K('X', 'B')} to brake on the line and hang`, need: 1.5, tick: (e, dt) => e.braked ? dt : 0},
            {t: `${K('W', 'Left stick up')} Reel yourself back up to the leaf`, need: 1, tick: e => e.surf ? 1 : 0}]},
  {name: 'The Fly', text: 'Most jumping spiders live on insects, and Portia takes them too. A fly sees fast movement superbly and is gone at the first hint of it. So she stalks: slow, then still, then one leap.',
    start: () => { const f = TUT.fly; if(f.gone){ f.respawn = .3; } },
    goals: [{t: `Stalk ${K('C', 'RT')} to within a leap of the fly, without startling it`, need: 1, tick: () => { const f = TUT.fly; return !f.gone && f.state !== 'fly' && f.pos.distanceTo(sp.pos) < 1.6 ? 1 : 0; }},
            {t: `Leap onto it ${K('Space', 'A')}`, need: 1, tick: () => sp.feed && sp.feed.p === TUT.fly ? 1 : 0}]},
  {name: 'The Orb-Weaver', text: 'This is what makes Portia famous. She hunts other spiders in their own webs by speaking their language: plucking the silk, she plays the struggle of a small insect caught in the threads, and the owner comes out to take it. If one signal fails she tries another, a flexibility biologists hardly expected from so small a brain. If the weaver starts to pump its web, freeze.',
    start: () => { if(TUT.spider.dead) tutReviveSpider(); },
    goals: [{t: 'Leap to the small leaf with the web hanging from its tip, and land softly', need: 1, tick: () => sp.mode === 'ground' && sp.plat === TUT.L3 ? 1 : 0},
            {t: `Hold ${K('Q', 'RB')} by its tip to pluck the silk. ${K('R', 'LB')} changes the signal`, need: 2, tick: (e, dt) => sp.plucking ? dt : 0},
            {t: `When it comes close, leap on it ${K('Space', 'A')}`, need: 1, tick: () => TUT.spider.dead ? 1 : 0}]},
  {name: 'Into the Forest', text: 'Below, in the leaf litter, the real hunt waits: spitting spiders, house spiders lurking in their tubes, orb-weavers, and a mantis that hunts her in turn. Portia goes down to meet them.',
    goals: [{t: `Leap from the leaf and balloon ${K('Space', 'A')} down into the forest`, need: 1, tick: () => 0}]}
];

// the practice orb-weaver is the one spider that comes back (wild ones stay dead): a fresh one at its hub for a replay
function tutReviveSpider(){
  const p = TUT.spider;
  Object.assign(p, {dead: false, deadT: 0, alert: 0, temp: p.temp0, close: 0, idleT: 0, drain: 0, flip: 0, held: false, dropped: false, limp: 0, fallH: 0, hl: 0, state: 'hub', wary: 0});
  p.pos.copy(p.orb.C); p.fwd.set(0, -1, 0);
}

/* ---------- the narration panel ---------- */
function tutDraw(){
  const el = TUT.el || (TUT.el = $('#tut')), st = TUT_STEPS[TUT.i];
  el.querySelector('.tu-pre').textContent = `FIELD NOTES · ${TUT.i + 1} OF ${TUT_STEPS.length}`;
  el.querySelector('.tu-name').textContent = st.name;
  el.querySelector('.tu-text').innerHTML = st.text;
  el.querySelector('.tu-goals').innerHTML = st.goals.map(g => `<li><i></i><span>${g.t}</span><b><u></u></b></li>`).join('');
  el.classList.remove('done'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
}
function tutBars(){
  const st = TUT_STEPS[TUT.i], lis = TUT.el.querySelectorAll('.tu-goals li');
  st.goals.forEach((g, k) => { const f = Math.min(1, (TUT.g[k] || 0)/g.need), li = lis[k]; if(!li) return;
    li.classList.toggle('ok', f >= 1); li.classList.toggle('now', f < 1 && st.goals.slice(0, k).every((h, j) => (TUT.g[j] || 0) >= h.need));
    const b = li.querySelector('u'); const w = (f*100).toFixed(0) + '%'; if(b.style.width !== w) b.style.width = w; });
}
function tutGo(i){
  TUT.i = Math.max(0, Math.min(TUT_STEPS.length - 1, i)); TUT.g = TUT_STEPS[TUT.i].goals.map(() => 0); TUT.doneT = -1;
  store.set(TUT_STORE + '.step', TUT.i);
  const st = TUT_STEPS[TUT.i]; if(st.start) st.start();
  tutDraw(); tutBars();
}

/* ---------- putting her on the leaf, and taking her off it ---------- */
function tutPlace(){
  endBalloon(); if(sp.feed) sp.feed = null;
  Object.assign(sp, {mode: 'ground', plat: TUT.L1, vigor: 1, stuck: 0, charging: false, braked: false, committed: false, plop: false, holdIn: false, roll: null,
    line: false, lineFresh: false, pivot: null, anchorPlat: null, ropeL: 0, leapHit: null, aim: null, aimFixed: false, bounce: null});
  SLOWMO.on = SLOWMO.armed = false; SLOWMO.scale = 1;
  sp.pos.set(TUT.spawn.x, surfAt(TUT.L1, TUT.spawn.x, TUT.spawn.z), TUT.spawn.z); sp.vel.set(0, 0, 0); sp.yaw = TUT.spawnYaw;
  sp.m.visible = true; sp.m.scale.setScalar(1); sp.m.rotation.set(0, sp.yaw, 0); sp.m.position.copy(sp.pos); gaitRelease(sp.m);
  cam.yaw = sp.yaw; cam.target.copy(sp.pos); cam.swingDir = null; cam.swing = null; cam.swingT = 0;
  SEEN.last.copy(sp.pos); SEEN.speed = 0; TUT.prevPos.copy(sp.pos); TUT.prevMode = sp.mode; TUT.leap = null;
}
function tutStart(i = 0){
  TUT.on = true; store.set(TUT_STORE + '.done', '');
  tutPlace(); tutGo(i);
  document.getElementById('tut').hidden = false;
}
function tutStop(drop){
  TUT.on = false; store.set(TUT_STORE + '.done', '1');
  document.getElementById('tut').hidden = true;
  TUT.fly.gone = true; TUT.fly.respawn = Infinity; TUT.fly.m.visible = false;
  if(drop){ doomReset(); toast('Somewhere below, on the forest floor, the hunt begins.'); }
}
function tutToggle(){
  if(TUT.on) tutFade(() => tutStop(true));
  else { const done = store.get(TUT_STORE + '.done', '') === '1', at = +store.get(TUT_STORE + '.step', 0) || 0;
    tutFade(() => { tutStart(done && at >= TUT_STEPS.length - 1 ? 0 : at); toast('Back on the broad leaf. T leaves the field notes.'); }); }
}
// a brief dip to black around a move, so she isn't seen to jump
function tutFade(fn){
  const f = $('#tutfade'); if(TUT.fade) return;
  TUT.fade = {fn, t0: performance.now()}; f.hidden = false; f.style.opacity = 0; void f.offsetWidth; f.style.opacity = 1;
}
function tutFadeTick(){
  const F = TUT.fade; if(!F) return;
  const f = $('#tutfade'), e = performance.now() - F.t0;
  if(F.fn && e > 320){ const fn = F.fn; F.fn = null; fn(); f.style.opacity = 0; }
  if(e > 800){ f.hidden = true; TUT.fade = null; }
}
// after a death in the lessons, the fade brings a fresh Portia back to the leaf rather than the forest floor
function tutAfterDoom(){ if(TUT.on){ tutPlace(); TUT.g = TUT_STEPS[TUT.i].goals.map(() => 0); } }
// a debug snapshot somewhere else ends the lessons (no fade: it is a teleport on purpose)
function tutSnapLoaded(){ if(TUT.on && !TUT.surfs.has(sp.plat)){ TUT.on = false; document.getElementById('tut').hidden = true; } }

/* ---------- a goal can light up the leaf it sends her to: a slow, warm pulse of light ---------- */
const TUT_GLOW_C = new THREE.Color(0xffe6a0);
function tutGlow(){
  const st = TUT_STEPS[TUT.i], k = TUT.on && TUT.doneT < 0 ? st.goals.findIndex((g, j) => (TUT.g[j] || 0) < g.need) : -1;
  const want = k >= 0 && st.goals[k].glow ? st.goals[k].glow() : [], pulse = .5 - .5*Math.cos(performance.now()/1000*Math.PI*1.4);
  for(const L of [TUT.L1, TUT.L2, TUT.L3]){
    const m = L.mesh.material, on = want.includes(L);
    L.glowW = (L.glowW || 0) + ((on ? 1 : 0) - (L.glowW || 0))*.08;            // eases in and out between lessons
    const a = L.glowW*pulse;
    m.emissive.copy(L.glow0).lerp(TUT_GLOW_C, .22*a); m.emissiveIntensity = 1 + 1.1*a;
  }
}

/* ---------- every frame ---------- */
const TUT_FAR = 16;
function updateTutorial(dt){
  tutFadeTick(); tutGlow();
  const el = TUT.el || (TUT.el = $('#tut'));
  if(!TUT.on){ TUT.prevMode = sp.mode; return; }
  el.classList.toggle('veiled', introOpen());
  PRED.grace = Math.max(PRED.grace, 1);                                // the mantis doesn't climb 80 cm of bare stalk
  const st = TUT_STEPS[TUT.i];
  if(TUT.i < TUT_STEPS.indexOf(TUT_STEPS.find(s => s.name === 'The Orb-Weaver')) && !TUT.spider.dead) TUT.spider.alert = 0;   // the weaver sleeps until its lesson
  if(DOOM.t >= 0 || TUT.fade){ TUT.prevMode = sp.mode; TUT.prevPos.copy(sp.pos); return; }
  // what she did this frame
  const onS = (sp.mode === 'ground' || sp.mode === 'climb') && TUT.surfs.has(sp.plat);
  const e = {surf: onS, moved: onS ? Math.min(.3, sp.pos.distanceTo(TUT.prevPos)) : 0, under: onS && underLeaf() && sp.plat !== TUT.S,
    top: sp.mode === 'ground' && onS, landed: null, leap: null};
  const was = TUT.prevMode;
  if(sp.mode === 'air' && (was === 'ground' || was === 'climb' || was === 'hang') && sp.leapTilt) TUT.leap = {slow: false};
  if(TUT.leap && SLOWMO.on) TUT.leap.slow = true;
  if((was === 'air' || was === 'hang') && onS){ e.landed = sp.plat; e.leap = TUT.leap; TUT.leap = null; }
  if(was === 'air' && sp.mode === 'hang') TUT.braked = true;                 // caught on the line in flight (X, or a missed leap)
  if(sp.mode !== 'hang') TUT.braked = false;
  e.braked = TUT.braked;
  if(sp.mode !== 'air' && sp.mode !== 'hang' && !e.landed) TUT.leap = null;
  TUT.prevMode = sp.mode; TUT.prevPos.copy(sp.pos);
  // the lesson: only the first unfinished goal moves on
  if(TUT.doneT < 0){
    for(let k = 0; k < st.goals.length; k++){ const g = st.goals[k]; if((TUT.g[k] || 0) >= g.need) continue; TUT.g[k] = (TUT.g[k] || 0) + g.tick(e, dt); break; }
    if(st.goals.every((g, k) => TUT.g[k] >= g.need) && sp.mode !== 'feed'){ TUT.doneT = performance.now(); el.classList.add('done'); AUDIO.sfx.signal(); }
  } else if(performance.now() - TUT.doneT > 1800) tutGo(TUT.i + 1);
  tutBars();
  // off the plant: the last lesson ends in the forest; otherwise she is set back on her leaf
  const last = TUT.i === TUT_STEPS.length - 1;
  const away = Math.hypot(sp.pos.x - TUT.base.x, sp.pos.z - TUT.base.z) > TUT_FAR, hung = sp.line && sp.anchorPlat && TUT.surfs.has(sp.anchorPlat);
  const low = sp.pos.y < TUT.top - (hung ? 13 : sp.balloon ? 9 : 5);
  // (a vine or another plant brushing the leaf may be stepped onto; she is only sent back once it has taken her down)
  const lost = ((sp.mode === 'ground' || sp.mode === 'climb') && !TUT.surfs.has(sp.plat) && (sp.pos.y < TUT.top - 3 || away)) || ((sp.mode === 'air' || sp.mode === 'hang') && (low || away));
  if(!lost) return;
  if(last){ TUT.g[0] = 1; tutFade(() => { tutStop(true); store.set(TUT_STORE + '.step', 0); }); return; }
  const drift = !!sp.balloon || st.name === 'Ballooning';
  tutFade(() => { tutPlace(); toast(drift ? 'The breeze carries her off. In time she finds her way back to the leaf.'
    : st.lost || 'A fall does little harm to something this small. She climbs back to her leaf.'); });
}

// first visit: the lessons start on the leaf (after the intro); afterwards they wait for T
if(store.get(TUT_STORE + '.done', '') !== '1') tutStart(Math.min(TUT_STEPS.length - 1, +store.get(TUT_STORE + '.step', 0) || 0));
addEventListener('keydown', e => { if(e.code === 'KeyT' && !e.repeat && !introOpen() && !(e.target.matches && e.target.matches('input, textarea'))) tutToggle(); });
