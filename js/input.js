'use strict';
// HUD, intro, look panel, keyboard/mouse/gamepad input

/* =====================================================================
   HUD + INPUT
   ===================================================================== */
const keys = {};
const CAM_PITCH_MIN = -1.2, CAM_PITCH_MAX = 1.35;
const cam = {yaw: 0, pitch: .42, pitchEff: .42, dist: 1.6, distEff: 1.6, ahead: .5, target: sp.pos.clone()};
const ray = new THREE.Raycaster();
const SENSES = [
  {k:'1', name:'SIGHT', desc:'dim and smeared; colour is heat; anything that moves flares white'},
  {k:'2', name:'VIBRATION', desc:'tremor through leaf, log and soil: the glyphs ripple outward from the source'},
  {k:'3', name:'HEARING', desc:'airborne buzz and chirp: glyphs shiver in place'},
  {k:'4', name:'SCENT', desc:'plumes drift downwind: the text undulates'}
];
const senseOn = [1, 1, 1, 1];
function drawSenses(){
  $('#senses').innerHTML = SENSES.map((s, i) => `<div class="sense${senseOn[i] ? '' : ' off'}" data-i="${i}">
    <span class="k">${s.k}</span><span class="t"><b>${s.name}</b><span>${s.desc}</span></span></div>`).join('');
  SU.uOn.value.set(senseOn[0], senseOn[1], 0, senseOn[2]); SU.uChemOn.value = senseOn[3];
}
drawSenses();
$('#senses').addEventListener('click', e => { const d = e.target.closest('.sense'); if(d){ senseOn[+d.dataset.i] ^= 1; drawSenses(); } });

function drawStyle(){}   // the look is fixed: braille glyphs (no view options)
function setSize(k){ R.glyph = k; store.set('size.v2', k); resize(); drawStyle(); }
function setView(k){ R.view = k; drawStyle(); }
const cycle = (obj, cur, d = 1) => { const ks = Object.keys(obj); return ks[(ks.indexOf(cur) + d + ks.length) % ks.length]; };
drawStyle();

/* ---------- gamepad (standard mapping). Left stick: analog walk — the tilt sets the pace, so a light touch sneaks.
   Right stick: look/aim. A: hold to gauge, release to leap. X: hold to raise the front legs. B: tie the dragline here. Y: cut it. RB: hold to pluck.
   LB: next pluck signal. D-pad up/down: zoom. View/Back: glyphs/3D. Menu/Start: hide HUD. ---------- */
const pad = {lx: 0, ly: 0, rx: 0, ry: 0, a: false, b: false, x: false, y: false, lb: false, rb: false, up: false, down: false, back: false, start: false, sneak: false, connected: false};
const padPrev = {};
function pollPad(){
  Object.assign(padPrev, pad);
  let g = window.__padSim || null;                        // (tests can inject a fake pad)
  if(!g && navigator.getGamepads){ for(const q of navigator.getGamepads()) if(q && q.connected){ g = q; break; } }
  if(!g){ Object.assign(pad, {lx: 0, ly: 0, rx: 0, ry: 0, a: false, b: false, x: false, y: false, lb: false, rb: false, up: false, down: false, back: false, start: false, sneak: false, sprint: false, connected: false}); return; }
  const ax = g.axes || [], bt = g.buttons || [], btn = i => !!(bt[i] && (bt[i].pressed || bt[i].value > .5));
  const dz = v => Math.abs(v) < .12 ? 0 : Math.sign(v)*(Math.abs(v) - .12)/.88;
  let lx = ax[0] || 0, ly = ax[1] || 0; const mg = Math.hypot(lx, ly);           // radial dead zone keeps the slowest speeds usable
  if(mg < .08){ lx = ly = 0; } else { const k = Math.min(1, (mg - .08)/.9)/mg; lx *= k; ly *= k; }
  Object.assign(pad, {lx, ly, rx: dz(ax[2] || 0), ry: dz(ax[3] || 0), a: btn(0), b: btn(1), x: btn(2), y: btn(3), lb: btn(4), rb: btn(5),
    back: btn(8), start: btn(9), up: btn(12), down: btn(13), left: btn(14), right: btn(15), sneak: (bt[6] ? bt[6].value > .3 : false) || btn(10), sprint: bt[7] ? bt[7].value > .3 : false, connected: true});
  if(!padPrev.connected) toast('Controller connected — the left stick sets your pace.');
}
const pressed = k => pad[k] && !padPrev[k], released = k => !pad[k] && padPrev[k];
function cyclePluck(d){ pluckIdx = (pluckIdx + d + PLUCKS.length) % PLUCKS.length; flash(PLUCKS[pluckIdx].name, 'PLUCK SIGNAL  ' + PLUCKS[pluckIdx].glyph); }
// a big word in the middle of the screen that fades away
let flashT = 0;
function flash(big, small){ $('#flash').innerHTML = `<small>${small}</small>${big}`; flashT = 1.6; }
// intro: title → controls → hunting. Open on every page load and with G; it swallows game keys while open.
const intro = {el: $('#intro'), i: 0, scenes: [...document.querySelectorAll('#intro .in-scene')], logoRaf: 0};
const introOpen = () => !intro.el.hidden;
function decodeLogo(){   // each letter flickers through braille glyphs, then settles
  // Time is accumulated per frame with each step clamped, so a long stall (the rest of the game loading and
  // compiling shaders right after the intro opens on page load) pauses the decode instead of skipping past it.
  const word = 'PORTIA', el = $('#logo');
  let t = 0, last = 0;
  cancelAnimationFrame(intro.logoRaf);
  const draw = () => {
    let s = '', done = true;
    for(let k = 0; k < word.length; k++){
      if(t > 350 + k*150) s += word[k];
      else { s += String.fromCharCode(0x2801 + Math.floor(Math.random()*254)); done = false; }
    }
    el.textContent = s;
    return done;
  };
  const step = now => {
    if(last) t += Math.min(50, now - last);
    last = now;
    if(!draw() && introOpen()) intro.logoRaf = requestAnimationFrame(step); else el.textContent = word;
  };
  draw();   // scrambled from the start, so the plain word never flashes before the decode
  intro.logoRaf = requestAnimationFrame(step);
}
function introShow(i){
  intro.i = Math.max(0, Math.min(intro.scenes.length - 1, i));
  intro.scenes.forEach((s, k) => s.classList.toggle('on', k === intro.i));
  intro.el.querySelectorAll('.in-dots button').forEach((b, k) => b.setAttribute('aria-current', k === intro.i));
  intro.el.querySelector('[data-go="-1"]').disabled = intro.i === 0;
  $('#in-next').textContent = intro.i === intro.scenes.length - 1 ? 'begin ▸' : 'next ▸';
  if(intro.i === 0) decodeLogo();
}
function introNext(){ if(intro.i >= intro.scenes.length - 1) toggleGuide(false); else introShow(intro.i + 1); }
function toggleGuide(on){
  const open = on === undefined ? !introOpen() : on;
  intro.el.hidden = !open;
  if(open) introShow(0);
}
intro.el.addEventListener('click', e => {
  const b = e.target.closest('button');
  if(!b){ if(!e.target.closest('.in-scene')) introNext(); return; }   // click the backdrop to advance
  if(b.dataset.to) introShow(+b.dataset.to);
  else if(b.dataset.go === '1') introNext();
  else if(b.dataset.go === '-1') introShow(intro.i - 1);
  b.blur();
});
// (index.html opens the guide once every script has loaded and the first frame is drawn)
function padActions(dt){
  if(!pad.connected) return;
  if(introOpen()){ if(pressed('a')) introNext(); if(pressed('x')) introShow(intro.i - 1); if(pressed('b') || pressed('back')) toggleGuide(false); return; }
  if(pad.rx){ cam.swing = null; cam.swingDir = null; }
  if(sp.charging && aimPt.pad){ aimPt.x = Math.min(innerWidth, Math.max(0, aimPt.x + pad.rx*700*dt)); aimPt.y = Math.min(innerHeight, Math.max(0, aimPt.y + pad.ry*700*dt)); }
  else { cam.yaw -= pad.rx*2.6*dt; cam.pitch = Math.min(CAM_PITCH_MAX, Math.max(CAM_PITCH_MIN, cam.pitch + pad.ry*1.7*dt)); }
  if(pressed('a') && (sp.mode === 'ground' || sp.mode === 'hang' || sp.mode === 'climb') && sp.stuck <= 0){
    sp.charging = true; sp.aimShake = 0;
    const ahead = sp.pos.clone().add(camFwd().multiplyScalar(1.2)).project(camera);
    aimPt.x = (ahead.x*.5 + .5)*innerWidth; aimPt.y = (.5 - ahead.y*.5)*innerHeight; aimPt.pad = true; updateAim(true); }
  if(released('a') && sp.charging) jump();
  if(pressed('a') && sp.mode === 'air' && !sp.plop) startBalloon();
  if(released('a') && sp.balloon) endBalloon();
  if(pressed('b')) dropLine();
  if(pressed('lb')) cyclePluck(1);
  if(pressed('sneak')) toggleMove('sneak');
  if(pressed('sprint')) toggleMove('dash');
  if(pressed('up')) cam.dist = Math.max(.12, cam.dist*.85);
  if(pressed('down')) cam.dist = Math.min(7, cam.dist*1.15);
  if(pressed('back')) toggleGuide();
  if(pressed('start')) $('#hud').classList.toggle('hidehud');
  const flick = Math.hypot(pad.lx, pad.ly) > .7 && Math.hypot(padPrev.lx || 0, padPrev.ly || 0) <= .7;
  if(sp.stuck > 0 && (pressed('a') || pressed('x') || pressed('b') || flick)) sp.stuck = Math.max(.01, sp.stuck - .3);   // struggle
}

// contrast is fixed at 1.20 (the slider is gone)
cellMat.uniforms.uCon.value = 1.2;

/* ---------- LOOK LAB panel (V): filters, colour grades, glow, Portia highlight, post. Everything is remembered. ---------- */
const LOOK_PRESETS = {
  'all off':{filter:'clean', grade:'natural', vig:0, scan:0, grain:0, chroma:0},          // plain 3D: no filter, grade, glow, highlight or post
  'hero glow':{pGlow:1.2, pGlowR:4, pBoost:.4, pTint:.35, wDim:.25, glow:.6},
  'oil spotlight':{filter:'oil', grade:'golden hour', spot:.7, spotR:.35, pOut:1, outCol:'accent', pBoost:.3},
  'watercolour':{filter:'watercolor', grade:'pastel', herStyle:'clean', pOut:1, outCol:'black'},
  'retro CRT':{filter:'crt', grade:'kodachrome', glow:1, glowThr:.5, vig:.8},
  'miniature':{filter:'tilt', grade:'vivid', dof:.8, pBoost:.2},
  'dream':{filter:'dreamy', grade:'morning mist', glow:1.2, glowWarm:.5, pGlow:.8},
  'noir focus':{grade:'bleach bypass', wDesat:.9, pTint:.6, pColor:'#ff3b6b', glow:.5, pGlow:.6},
  'neon night':{filter:'neon', grade:'moonlight', glow:1.6, glowThr:.3, glowSize:1.5},
  // your picks
  'golden miniature':{"filter":"tilt","braille":"classic","grade":"golden hour","size":"XXXS","detail":1,"herStyle":"same","fAmt":0.65,"fScale":2.05,"dens":1,"cap":1,"dot":1,"stag":0,"edges":1,"bloom":0.5,"glow":0,"glowThr":0.55,"glowSize":1,"glowWarm":0,"gradeAmt":0.9,"sat":0.6,"bright":1,"gamma":1,"pColor":"#ffd84a","outCol":"accent","pTint":0,"pBoost":1,"pOut":0,"pGlow":0.25,"pGlowR":4,"pPulse":0,"wDim":0.35,"wDesat":0,"spot":0,"spotR":0.35,"dFade":0,"dof":0.1,"vig":0,"scan":0.11,"grain":0.14,"chroma":0.75},
  'vivid oil':{"filter":"oil","braille":"classic","grade":"vivid","size":"XXXS","detail":1,"herStyle":"same","fAmt":0.7,"fScale":2.05,"dens":1,"cap":1,"dot":1,"stag":0,"edges":1,"bloom":0.5,"glow":0,"glowThr":0.55,"glowSize":1,"glowWarm":0,"gradeAmt":0.9,"sat":0.7,"bright":1.15,"gamma":1,"pColor":"#ffd84a","outCol":"accent","pTint":0,"pBoost":0,"pOut":0,"pGlow":0.25,"pGlowR":4,"pPulse":0,"wDim":0,"wDesat":0,"spot":0,"spotR":0.35,"dFade":0,"dof":0.3,"vig":0,"scan":0.11,"grain":0.14,"chroma":0.75},
  'gouache spotlight':{"filter":"gouache","braille":"classic","grade":"vivid","size":"XXXS","detail":1,"herStyle":"same","fAmt":0.7,"fScale":1.3,"dens":1,"cap":1,"dot":1,"stag":0,"edges":1,"bloom":0.5,"glow":0,"glowThr":0.55,"glowSize":1,"glowWarm":0,"gradeAmt":0.9,"sat":0.7,"bright":1.15,"gamma":1,"pColor":"#ffd84a","outCol":"accent","pTint":0,"pBoost":0,"pOut":0,"pGlow":0.25,"pGlowR":3.5,"pPulse":0,"wDim":0.1,"wDesat":0,"spot":0.35,"spotR":0.25,"dFade":0,"dof":0.25,"vig":0,"scan":0.11,"grain":0.14,"chroma":0.75}
};
const LOOK_SLIDERS = {
  FILTER:[['fAmt','strength',0,1,.05], ['fScale','scale',.5,3,.05]],
  BRAILLE:[['dens','density',.4,2,.05], ['cap','max fill',.15,1,.05], ['dot','dot size',.3,1.6,.05], ['stag','row stagger',0,1,.05], ['edges','edge strokes',0,1,1], ['bloom','glyph bloom',0,2,.05]],
  GLOW:[['glow','glow',0,3,.05], ['glowThr','threshold',0,1,.05], ['glowSize','size',.5,3,.05], ['glowWarm','warmth',0,1,.05]],
  COLOUR:[['gradeAmt','grade strength',0,1.5,.05], ['sat','saturation',0,2,.05], ['bright','brightness',.5,2,.05], ['gamma','gamma',.5,2,.05]],
  PORTIA:[['pTint','tint',0,1,.05], ['pBoost','boost',0,1,.05], ['pOut','outline',0,3,.25], ['pGlow','her glow',0,2,.05], ['pGlowR','glow radius',1,10,.5], ['pPulse','glow pulse',0,1,.05],
          ['wDim','dim world',0,.9,.05], ['wDesat','desat world',0,1,.05], ['spot','spotlight',0,1,.05], ['spotR','spot radius',.1,1,.05], ['dFade','depth fade',0,1,.05], ['dof','depth of field',0,1,.05]],
  POST:[['vig','vignette',0,1,.05], ['scan','scanlines',0,.4,.01], ['grain','grain',0,.3,.01], ['chroma','chromatic',0,4,.25]]
};
const P_SWATCH = ['#ffd84a', '#ff3b6b', '#3bf0ff', '#7dff4a', '#ffffff', '#ff8a1e', '#b06bff', '#ff2bd6'];
// the grade in JS too, so each grade's button can show a few natural colours (leaf, bark, sky, flesh) through it
function gradeJS(c, g){
  const [T, N, E, C, S, V, F] = [g.temp || 0, g.tint || 0, g.expo || 1, g.con || 1, g.sat || 1, g.vib || 0, g.fade || 0];
  const off = h => { if(!h) return [0, 0, 0]; const x = hexRGB(h), l = .2126*x[0] + .7152*x[1] + .0722*x[2]; return x.map(v => v - l); };
  const sh = off(g.sh), hi = off(g.hi), L = x => .2126*x[0] + .7152*x[1] + .0722*x[2], ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
  c = [c[0]*E*(1 + T*.14 + N*.04), c[1]*E*(1 - N*.08), c[2]*E*(1 - T*.14 + N*.04)].map(v => (v - .45)*C + .45);
  const l = Math.min(1, Math.max(0, L(c))); c = c.map((v, i) => v + sh[i]*(1 - ss(0, .55, l))*.8 + hi[i]*ss(.45, 1, l)*.8);
  const mx = Math.max(...c), mn = Math.min(...c), s = S*(1 + V*(1 - Math.min(1, Math.max(0, (mx - mn)*2)))), ll = L(c);
  return c.map(v => Math.min(1, Math.max(0, F + Math.max(0, ll + (v - ll)*s)*(1 - F))));
}
const SAMPLES = [[.18, .32, .12], [.36, .25, .16], [.62, .72, .62], [.78, .55, .4], [.06, .07, .05]];
const css = c => `rgb(${c.map(v => Math.round(v*255)).join(',')})`;
const lookBuilt = {size: LOOK.size, detail: LOOK.detail, braille: LOOK.braille, dot: LOOK.dot};
function applyLook(){
  const fu = finalMat.uniforms, cu = compMat.uniforms, g = GRADES[LOOK.grade] || {};
  if(LOOK.size !== lookBuilt.size || LOOK.detail !== lookBuilt.detail){ R.glyph = LOOK.size; resize(); }
  else if(LOOK.braille !== lookBuilt.braille || (LOOK.dot !== lookBuilt.dot && LOOK.braille === 'round')) buildAtlas(R.cw, R.ch);
  Object.assign(lookBuilt, {size: LOOK.size, detail: LOOK.detail, braille: LOOK.braille, dot: LOOK.dot});
  fu.uMode.value = BRAILLE_STYLES[LOOK.braille].mode; fu.uDot.value = LOOK.dot; fu.uStag.value = LOOK.stag; fu.uBloom.value = LOOK.bloom;
  const fm = filterMat.uniforms; fm.uF.value = Math.max(0, FILTERS[LOOK.filter].id); fm.uAmt.value = LOOK.fAmt; fm.uScale.value = LOOK.fScale;
  LU.uDens.value = LOOK.dens; LU.uCap.value = LOOK.cap; LU.uEdges.value = LOOK.edges;
  LU.uPTint.value = LOOK.pTint; LU.uPBoost.value = LOOK.pBoost; LU.uWDim.value = LOOK.wDim; LU.uWDesat.value = LOOK.wDesat; LU.uDFade.value = LOOK.dFade;
  LU.uPCol.value.set(...hexRGB(LOOK.pColor));
  cu.uPOutCol.value.set(...(LOOK.outCol === 'black' ? [0, 0, 0] : LOOK.outCol === 'accent' ? hexRGB(LOOK.pColor) : [1, 1, 1]));
  brightMat.uniforms.uThr.value = LOOK.glowThr; brightMat.uniforms.uWarm.value = LOOK.glowWarm;
  const off = h => { if(!h) return [0, 0, 0]; const x = hexRGB(h), l = .2126*x[0] + .7152*x[1] + .0722*x[2]; return x.map(v => v - l); };
  cu.uGAmt.value = LOOK.gradeAmt; cu.uTemp.value = g.temp || 0; cu.uTint.value = g.tint || 0; cu.uGExpo.value = g.expo || 1; cu.uGCon.value = g.con || 1;
  cu.uGSat.value = g.sat || 1; cu.uVib.value = g.vib || 0; cu.uFade.value = g.fade || 0; cu.uSh.value.set(...off(g.sh)); cu.uHi.value.set(...off(g.hi));
  const F = {uGlow:'glow', uVig:'vig', uScan:'scan', uGrain:'grain', uChroma:'chroma', uBright:'bright', uGamma:'gamma', uSat:'sat',
    uPOut:'pOut', uPGlow:'pGlow', uPGlowR:'pGlowR', uPPulse:'pPulse', uSpot:'spot', uSpotR:'spotR', uDof:'dof'};
  for(const u in F) cu[u].value = LOOK[F[u]];
  store.set('look.v3', JSON.stringify(LOOK));
}
function drawLook(){
  const el = $('#look'), btn = (k, v, label) => `<button data-k="${k}" data-v="${v}" aria-pressed="${LOOK[k] === v}">${label}</button>`;
  const sl = ([k, l, lo, hi, st]) => `<label class="con"><span class="l">${l}</span><input type="range" data-s="${k}" min="${lo}" max="${hi}" step="${st}" value="${LOOK[k]}"><span class="v">${(+LOOK[k]).toFixed(st >= 1 ? 0 : 2)}</span></label>`;
  const S = k => LOOK_SLIDERS[k].map(sl).join(''), braille = LOOK.filter === 'braille';
  el.innerHTML = `
    <div class="lk-h"><b>LOOK LAB</b><span>Ctrl+Shift+V hides · dbl-click resets</span></div>
    <div class="row2"><button data-act="random">randomize</button><button data-act="reset">reset</button><button data-act="copy">copy settings</button></div>
    <div class="sec"><div class="label">PRESETS</div><div class="opts">${Object.keys(LOOK_PRESETS).map(p => `<button data-preset="${p}">${p}</button>`).join('')}</div></div>
    <div class="sec"><div class="label">FILTER <span>${FILTERS[LOOK.filter].name}</span></div>
      <div class="opts">${Object.entries(FILTERS).map(([k, f]) => btn('filter', k, f.name)).join('')}</div>
      ${braille ? `<div class="label">BRAILLE STYLE</div><div class="opts">${Object.keys(BRAILLE_STYLES).map(k => btn('braille', k, k === 'hd' ? 'HD dots' : k)).join('')}</div>
        <div class="label">CELL SIZE</div><div class="opts">${Object.keys(GLYPH).map(k => btn('size', k, `${k} ${GLYPH[k].join('×')}`)).join('')}</div>
        <div class="label">SCENE DETAIL <span>for HD dots</span></div><div class="opts">${[1, 2, 3].map(d => btn('detail', d, d + '×')).join('')}</div>${S('BRAILLE')}` : S('FILTER')}</div>
    <div class="sec"><div class="label">GLOW</div>${S('GLOW')}</div>
    <div class="sec"><div class="label">COLOUR GRADE <span>${LOOK.grade}</span></div>
      <div class="pal">${Object.entries(GRADES).map(([k, g]) => `<button data-k="grade" data-v="${k}" aria-pressed="${LOOK.grade === k}"><i style="background:linear-gradient(90deg,${SAMPLES.map(c => css(gradeJS(c, g))).join(',')})"></i>${k}</button>`).join('')}</div>
      ${S('COLOUR')}</div>
    <div class="sec"><div class="label">PORTIA <span>make her stand out</span></div>
      <div class="sw">${P_SWATCH.map(c => `<button data-k="pColor" data-v="${c}" style="background:${c}" aria-pressed="${LOOK.pColor === c}"></button>`).join('')}<input type="color" data-c="pColor" value="${LOOK.pColor}"></div>
      <div class="label">HER LOOK <span>clean = unfiltered 3D</span></div><div class="opts">${Object.keys(HER_STYLES).map(k => btn('herStyle', k, k)).join('')}</div>
      <div class="label">OUTLINE COLOUR</div><div class="opts">${['white', 'black', 'accent'].map(k => btn('outCol', k, k)).join('')}</div>
      ${S('PORTIA')}</div>
    <div class="sec"><div class="label">POST</div>${S('POST')}</div>`;
}
function setLook(patch, redraw = true){ Object.assign(LOOK, patch); applyLook(); if(redraw) drawLook(); }
function randomLook(){
  const pick = o => { const ks = Object.keys(o); return ks[Math.floor(Math.random()*ks.length)]; }, r = (a, b) => a + Math.random()*(b - a);
  setLook(Object.assign({}, LOOK_BASE, {filter: pick(FILTERS), grade: pick(GRADES), fScale: r(.7, 1.6), gradeAmt: r(.7, 1.2),
    glow: Math.random() < .6 ? r(.3, 1.6) : 0, glowThr: r(.35, .75), glowSize: r(.8, 2), glowWarm: r(0, .6),
    pColor: P_SWATCH[Math.floor(Math.random()*P_SWATCH.length)], outCol: pick({white: 1, black: 1, accent: 1}), herStyle: Math.random() < .25 ? 'clean' : 'same',
    pTint: r(0, .6), pBoost: r(.1, .5), pOut: Math.random() < .35 ? 1 : 0, pGlow: r(.2, 1.2), pGlowR: r(2, 6), wDim: r(0, .35), wDesat: r(0, .5),
    spot: Math.random() < .3 ? r(.4, .9) : 0, dFade: r(0, .5), dof: Math.random() < .3 ? r(.3, .9) : 0, vig: r(.2, .8), grain: r(0, .06)}));
}
{
  const el = $('#look');
  el.hidden = true;                                                      // dev tool: hidden, Ctrl+Shift+V opens it
  drawLook(); applyLook();
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.k){ let v = b.dataset.v; if(b.dataset.k === 'detail') v = +v; setLook({[b.dataset.k]: v}); }
    else if(b.dataset.preset){ setLook(Object.assign({}, LOOK_BASE, LOOK_PRESETS[b.dataset.preset])); toast(`look: ${b.dataset.preset}`); }
    else if(b.dataset.act === 'random'){ randomLook(); toast(`look: ${FILTERS[LOOK.filter].name} · ${LOOK.grade}`); }
    else if(b.dataset.act === 'reset'){ setLook(Object.assign({}, LOOK_DEF)); toast('look reset'); }
    else if(b.dataset.act === 'copy'){ const s = JSON.stringify(LOOK); try { navigator.clipboard.writeText(s); toast('look settings copied'); } catch(err){ toast(s); } }
    b.blur();
  });
  el.addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.s){ const v = +t.value; t.nextElementSibling.textContent = v.toFixed(+t.step >= 1 ? 0 : 2); setLook({[t.dataset.s]: v}, false); }
    if(t.dataset.c){ setLook({[t.dataset.c]: t.value}, false); }
  });
  el.addEventListener('change', e => { if(e.target.dataset.c) drawLook(); });
  el.addEventListener('dblclick', e => { const k = e.target.dataset && e.target.dataset.s; if(k) setLook({[k]: LOOK_DEF[k]}); });
  el.addEventListener('pointerup', e => { if(e.target.matches('input[type=range]')) e.target.blur(); });   // hand the keys back to the spider
  el.addEventListener('keydown', e => { if(e.target.matches('input[type=range]') && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.target.blur(); });
}
function toggleLook(){ const el = $('#look'); el.hidden = !el.hidden; }

let toastT = 0;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); toastT = 2.4; }

// sneak (C / LT) and dash (Shift / RT) are toggles; turning one on turns the other off
let moveMode = null, shiftSolo = false;
function toggleMove(m){
  moveMode = moveMode === m ? null : m;
  for(const el of document.querySelectorAll('.mv-sneak')){ el.textContent = moveMode === 'sneak' ? 'sneaking' : 'sneak'; el.classList.toggle('on', moveMode === 'sneak'); }
  for(const el of document.querySelectorAll('.mv-dash')){ el.textContent = moveMode === 'dash' ? 'dashing' : 'dash'; el.classList.toggle('on', moveMode === 'dash'); }
}
addEventListener('keydown', e => {
  if(introOpen()){   // the intro owns the keyboard while it's up
    if(e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if(e.repeat) return;
    if(['ArrowRight', 'Enter', 'Space', 'KeyD'].includes(e.code)) introNext();
    else if(['ArrowLeft', 'KeyA'].includes(e.code)) introShow(intro.i - 1);
    else if(e.code === 'Escape' || e.code === 'KeyG') toggleGuide(false);
    return;
  }
  if(e.repeat){ if(e.code === 'Space') e.preventDefault(); return; }
  keys[e.code] = true;
  if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftSolo = true; else shiftSolo = false;   // Shift toggles dash on release, unless it was a modifier (Shift+R)
  if(e.code === 'KeyC') toggleMove('sneak');
  if(e.code === 'Space'){ e.preventDefault(); if((sp.mode === 'ground' || sp.mode === 'hang' || sp.mode === 'climb') && sp.stuck <= 0){ sp.charging = true; sp.aimShake = 0; updateAim(true); } else if(sp.mode === 'air' && !sp.plop) startBalloon(); }
  if(sp.stuck > 0 && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) sp.stuck = Math.max(.01, sp.stuck - .3);
  if(e.code === 'KeyX') dropLine();
  if(e.code === 'KeyR') cyclePluck(e.shiftKey ? -1 : 1);
  // senses are always on (no 1-4 toggles)
  if(e.code === 'KeyG') toggleGuide(true);
  if(e.code === 'KeyH') $('#hud').classList.toggle('hidehud');
  if(e.code === 'KeyV' && e.ctrlKey && e.shiftKey){ e.preventDefault(); toggleLook(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && shiftSolo && !introOpen()){ shiftSolo = false; toggleMove('dash'); }if(e.code === 'Space' && sp.charging) jump(); if(e.code === 'Space' && sp.balloon) endBalloon(); });
addEventListener('blur', () => { for(const k in keys) keys[k] = false; sp.charging = false; });
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = {x:e.clientX, y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if(!drag) return;
  cam.swing = null; cam.swingDir = null; cam.yaw -= (e.clientX - drag.x)*.006; cam.pitch = Math.min(CAM_PITCH_MAX, Math.max(CAM_PITCH_MIN, cam.pitch + (e.clientY - drag.y)*.004));
  drag = {x:e.clientX, y:e.clientY};
});
canvas.addEventListener('pointerup', () => drag = null);
canvas.addEventListener('wheel', e => { cam.dist = Math.min(7, Math.max(.12, cam.dist*(1 + Math.sign(e.deltaY)*.1))); }, {passive:true});
