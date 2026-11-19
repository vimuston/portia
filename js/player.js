'use strict';
// simulation: leap physics, updateSpider, flies, male

/* =====================================================================
   SIMULATION
   ===================================================================== */
const G = 52;                                  // strong gravity + fast take-off: snappy, not floaty
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI; return a + d*t; };
const aimAngle = () => 1.2 - (cam.pitch - .05)/1.2*.85;
const leapSpeed = c => (3 + c*8.4)*1.93;       // reach kept as gravity rose (v ∝ √G): quick, flat, decisive leaps; the top end reaches Argiope from the leaves by her orb

function findLanding(prev, next){
  let best = null;
  for(const p of PLAT) if(prev.y >= p.y - .001 && next.y <= p.y && inPlat(p, next.x, next.z) && (!best || p.y > best.y)) best = p;
  if(!best && next.y <= floorAt(next.x, next.z)) best = GROUND;
  return best;
}
function simulate(pos, vel, maxT, out){
  const p = pos.clone(), v = vel.clone(), q = new V3(), dt = 1/60;
  for(let t = 0; t < maxT; t += dt){
    q.copy(p); v.y -= G*dt; p.addScaledVector(v, dt); p.y += .5*G*dt*dt;
    if(out) out.push(p.clone());
    const L = findLanding(q, p); if(L) return L;
  }
  return null;
}
// the leap she's gauging: velocity for a given scatter (yaw/pitch offsets, speed factor), including the push off bark
// where the pointer is: the mouse, or (on a controller) a point the right stick steers across the screen
const aimPt = {x: null, y: null, pad: false};
addEventListener('pointermove', e => { aimPt.x = e.clientX; aimPt.y = e.clientY; aimPt.pad = false; });
// march the pointer's ray through the world until it meets something she could land on
function pickTarget(px, py){
  const W = innerWidth || 1280, H = innerHeight || 800;
  const ndc = new V3(px/W*2 - 1, -(py/H*2 - 1), .5).unproject(camera), o = camera.position.clone(), d = ndc.sub(o).normalize();
  if(!isFinite(d.x + d.y + d.z + o.x + o.y + o.z)) return {pos: sp.pos.clone().add(new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw))), hit: false};
  const p = new V3(), q = new V3(); let t = .05;
  // an Argiope in its orb: pointing at her aims at her (seen edge-on, the sheet itself is too thin to pick out)
  let argB = null, argO = null, tA = -1;
  for(const O of ORBS){ const A = O.spider; if(A.dead || A.dropped || O.edge(0) < .3) continue;   // (a web not spun yet gives her nothing to land on)
    const b = A.m.userData.parts.body.getWorldPosition(new V3()), tb = b.clone().sub(o).dot(d);
    if(tb > 0 && o.clone().addScaledVector(d, tb).distanceTo(b) < .3 && (!argB || tb < tA)){ argB = b; argO = O; tA = tb; } }   // only if the ray passes over her
  for(const P of PLAT) if(P._br === undefined) P._br = platR(P) + .01;   // bounding radius: cheap reject before the outline test
  for(let i = 0; i < 260 && t < 26; i++){
    q.copy(p); p.copy(o).addScaledVector(d, t);
    // well above the baked coarse soil (and the litter on it)? then she can't be at the floor: skip the full noise lookup
    const fy = LIT.h && Math.abs(p.x) < LIT.R - 1 && Math.abs(p.z) < LIT.R - 1 && p.y > litSoil(p.x, p.z) + .25 && p.y > litTop(p.x, p.z) ? -Infinity : floorAt(p.x, p.z);
    if(p.y <= fy){ p.y = fy; return {pos: p.clone(), hit: true, plat: GROUND}; }
    if(argB && t >= tA){ const h = argB.clone(); argO.S.project(h); return {pos: h, hit: true, plat: argO.S}; }
    if(i > 0 && !argB){ const hw = orbContact(q, p, false); if(hw){ const O = hw.orb; return {pos: hw.addScaledVector(O.n, -Math.sign(o.clone().sub(O.C).dot(O.n) || 1)*.005), hit: true, plat: O.S}; } }   // an orb: wherever the ray passes through it, out to its frame
    for(const P of PLAT){ if(P.ground || (argB && P === sp.plat)) continue; const bx = p.x - P.x, bz = p.z - P.z; if(bx*bx + bz*bz > P._br*P._br || !inPlat(P, p.x, p.z)) continue; const sy = surfAt(P, p.x, p.z);
      if(i > 0 && q.y >= sy && p.y <= sy + .002){ p.y = sy; return {pos: p.clone(), hit: true, plat: P}; } }
    const cm = Math.max(.015, (.02 + t*.012)*.6);                                  // half a ray step (and a bit): a thin limb is never stepped over
    for(const S of climbsNear(p.x, p.z, .3)){ if(S.web || (argB && sp.plat && S.top === sp.plat)) continue; if(climbMay(S, p, cm) && S.inside(p, cm)){
      // a leaf blade reached from above (the ray was over its top a step ago): she's looking at the top, so aim there, not underneath
      if(S.thin && S.top && i > 0 && q.y >= surfAt(S.top, q.x, q.z) - LEAF_TH*.5){ const h = p.clone(); h.y = surfAt(S.top, h.x, h.z); return {pos: h, hit: true, plat: S.top}; }
      const h = p.clone(); S.project(h); return {pos: h, hit: true, plat: S}; } }
    t += .02 + t*.012;
  }
  return {pos: o.addScaledVector(d, 3), hit: false};
}
// the launch that lands on target: an arc that rises a little above the straight line, steeper for short hops;
// beyond her reach she gives it everything along the same heading
const LEAP_MAX = () => leapSpeed(1);
// upside-down under a leaf: her own blade is overhead, so she can only push off downward
const underLeaf = () => sp.mode === 'climb' && sp.plat && sp.plat.thin && sp.plat.top && sp.plat.normal(sp.pos).y < -.3;
function solveLeap(T, thOff = 0, plat = null){
  const from = sp.pos, dx = T.x - from.x, dz = T.z - from.z, d = Math.hypot(dx, dz), h = T.y - from.y, vmax = LEAP_MAX();
  const yaw = d > 1e-3 ? Math.atan2(dx, dz) : sp.yaw, el = Math.atan2(h, Math.max(d, .01));
  let th = Math.min(1.35, Math.max(.3, el + (d < .5 ? .72 : d < 1.5 ? .42 : .3) + thOff));
  // a leaf top above her: come down onto it, not up into its underside or rim (still dropping ~27° as she reaches it)
  if(plat && !plat.ground && plat.kind !== 'climb' && h > 0 && d > .05) th = Math.min(1.35, Math.max(th, Math.atan(2*h/d + .5) + Math.max(0, thOff)));
  let v, ok = true;
  if(underLeaf() && h < -.02){                                              // drop away below the blade: launch at or under the horizontal
    th = Math.min(-.03, el*.15 + Math.min(0, thOff)*.3);   // flat is cheapest; steeper only for a drop close below
    if(d < .03){ th = -Math.PI/2 + .01; v = .5; }
    else { const den = 2*Math.cos(th)**2*(d*Math.tan(th) - h); v = den > 1e-6 ? Math.sqrt(G*d*d/den) : vmax; }
  }
  else if(d < .03) v = Math.sqrt(2*G*Math.max(.06, h + .06)), th = Math.PI/2 - .01;
  else { const den = 2*Math.cos(th)**2*(d*Math.tan(th) - h); v = den > 1e-6 ? Math.sqrt(G*d*d/den) : vmax; }
  if(v > vmax){ v = vmax; ok = false; th = Math.min(th, .8); }
  const out = new V3(Math.sin(yaw)*v*Math.cos(th), v*Math.sin(th), Math.cos(yaw)*v*Math.cos(th));
  if(!isFinite(out.x + out.y + out.z)) return {v: new V3(0, 3, 0), ok: false, yaw: sp.yaw, frac: .3};
  return {v: out, ok, yaw, frac: v/vmax};
}
// something in the way of the plain arc? try a loftier or flatter one that clears it and reaches the target
function bestLeap(T, plat){
  const sol = solveLeap(T, 0, plat); if(!plat || !sol.ok) return sol;
  const same = L => L && (L === plat || L.top === plat || plat.top === L || L.climb === plat || plat.climb === L);
  // simulate lazily, in preference order: stop at the first arc that lands on the very surface she aimed at
  // (a leaf's top, not its underside); failing that, the first that lands on the other face of it
  let alt = null;
  for(const o of [0, .25, .5, -.15, .75, 1.0]){
    const s = o ? solveLeap(T, o, plat) : sol; if(!s.ok) continue;
    const h = predictLeap(s.v.clone(), null, plat && plat.web ? T : null); if(!h) continue;
    if(h.plat === plat) return s;
    if(!alt && same(h.plat)) alt = s;
  }
  return alt || sol;
}
// the aim only changes when the pointer, the camera or the spider does: skip the ray march and arc search otherwise
const aimArc = {aim: null, plat: null, pos: new V3(NaN, NaN, NaN), pts: [], hit: null};
const aimKey = {x: NaN, y: NaN, px: NaN, py: NaN, pz: NaN, mode: null, plat: null, cam: new Float32Array(16)};
function updateAim(force = false){
  if(aimPt.x == null){ aimPt.x = (innerWidth || 1280)/2; aimPt.y = (innerHeight || 800)*.62; }
  camera.updateMatrixWorld();
  const ce = camera.matrixWorld.elements, K = aimKey;
  let same = !force && sp.aim && K.x === aimPt.x && K.y === aimPt.y && K.mode === sp.mode && K.plat === sp.plat
    && Math.abs(K.px - sp.pos.x) < 1e-4 && Math.abs(K.py - sp.pos.y) < 1e-4 && Math.abs(K.pz - sp.pos.z) < 1e-4;
  for(let i = 0; i < 16 && same; i++) if(Math.abs(K.cam[i] - ce[i]) > 1e-5) same = false;
  if(same) return;
  K.x = aimPt.x; K.y = aimPt.y; K.mode = sp.mode; K.plat = sp.plat; K.px = sp.pos.x; K.py = sp.pos.y; K.pz = sp.pos.z; K.cam.set(ce);
  if(sp.mode === 'ground' || sp.mode === 'climb') sp.launchSet = new Set(climbsNear(sp.pos.x, sp.pos.z, .4).filter(S => S.inside(sp.pos, .07)));   // as jump() will reckon it, not the last leap's
  const pick = pickTarget(aimPt.x, aimPt.y), sol = pick.hit ? bestLeap(pick.pos, pick.plat) : solveLeap(pick.pos);
  sp.aim = {target: pick.pos, vel: sol.v, ok: sol.ok && pick.hit, yaw: sol.yaw, plat: pick.plat || null};
  sp.charge = sol.frac;                                                    // drives the crouch and the effort it costs
}
function leapVel(dyaw = 0, dpitch = 0, ks = 1){
  const v = (sp.aim ? sp.aim.vel : new V3(0, 3, 0)).clone();
  if(dyaw || dpitch || ks !== 1){ v.applyAxisAngle(UP, dyaw); const hz = Math.hypot(v.x, v.z), sp2 = v.length()*ks, a = Math.atan2(v.y, hz) + dpitch;
    v.set(v.x/(hz || 1)*sp2*Math.cos(a), sp2*Math.sin(a), v.z/(hz || 1)*sp2*Math.cos(a)); }
  return v;
}
// follow the arc until it meets something she'd stop on: a top, the soil, bark or stone, a leaf from below, the orb
function predictLeap(v, out, goal = sp.aim && sp.aim.plat && sp.aim.plat.web ? sp.aim.target : null){
  const p = sp.pos.clone(), q = new V3(), dt = 1/60, own = sp.plat, inPlane = inOrbPlane(sp.pos);
  for(let t = 0; t < 3; t += dt){
    q.copy(p); v.y -= G*dt; p.addScaledVector(v, dt); p.y += .5*G*dt*dt; if(out) out.push(p.clone());
    const hw = orbHit(q, p, inPlane, goal); if(hw){ const O = hw.orb; return {pos: hw, n: O.n.clone().multiplyScalar(Math.sign(q.clone().sub(O.C).dot(O.n)) || 1), t, plat: O.S}; }
    const near = climbsNear(p.x, p.z, .5), segL = q.distanceTo(p);
    if(segL > .04 && near.length){ const n = Math.min(10, Math.ceil(segL/.04)), pt = new V3();                      // sweep between steps, as the real flight does: thin branches are never skipped
      for(let k = 1; k < n; k++){ pt.lerpVectors(q, p, k/n);
        for(const S of near){ if(S.thin || S.web || (t < .2 && fromOwn(S, own)) || !climbMay(S, pt, .04)) continue; if(S.inside(pt, .04) && !(S.topAt && S.topAt(pt, v))){ const h = pt.clone(); S.project(h); return {pos: h, n: S.normal(h), t, plat: S}; } } } }
    for(const S of near){
      if(t < .2 && fromOwn(S, own)) continue;
      if(S.thin && S.crossDown && !S.web && v.y < 0 && S.crossDown(q, p) && !passOwn(S.top, t)){ const h = p.clone(); h.y = surfAt(S.top, h.x, h.z) + .003; return {pos: h, n: UP.clone(), t, plat: S.top}; }
      if(S.thin && S.crossUp && S.crossUp(q, p)){ const h = p.clone(); S.project(h); return {pos: h, n: S.normal(h), t, plat: S}; }
      if(!S.thin && climbMay(S, p, .04) && S.inside(p, .04) && !(S.topAt && S.topAt(p, v))){ const h = p.clone(); S.project(h); return {pos: h, n: S.normal(h), t, plat: S}; }
    }
    const L = findLanding(q, p);
    if(L && !passOwn(L, t)){ const h = p.clone(); h.y = L.ground ? floorAt(h.x, h.z) : surfAt(L, h.x, h.z) + .003;
      const n = L.ground ? (() => { const [gx, gz] = slopeAt(h.x, h.z); return new V3(-gx, 1, -gz).normalize(); })() : UP.clone();
      return {pos: h, n, t, plat: L}; }
  }
  return null;
}
// how unsure the leap is (radians of scatter): more power, a moving aim and low vigor all widen it; holding steady narrows it
function leapSpread(){ return (.012 + .03*sp.charge + .06*(sp.aimShake || 0))*(1.6 - .6*sp.vigor); }
const randn = () => Math.sqrt(-2*Math.log(Math.random() + 1e-9))*Math.cos(6.2832*Math.random());
const fromOwn = (S, from) => (!!from && (S === from || S.top === from || from.climb === S || from.under === S || (from.top && from.top === S))) || (sp.launchSet && sp.launchSet.has(S));
const passOwn = (L, t) => (L === sp.leftFrom || (!!sp.leftFrom && sp.leftFrom.top === L)) && t < .45 && !(sp.aim && (sp.aim.plat === L || (sp.aim.plat && sp.aim.plat.top === L)));   // leaping off her own leaf toward somewhere else
function startAir(){                                  // the dragline (if tied) stays anchored where it was tied
  if(sp.plat) sp.leftFrom = sp.plat; sp.airT = 0; sp.leapTilt = null; sp.planeLaunch = inOrbPlane(sp.pos); sp.orbGoal = null;   // off the leaf at its frame, in its plane: only a true pass through the orb holds her
  if(!sp.line){ sp.anchor.copy(sp.pos); sp.anchorPlat = sp.plat; }
  sp.mode = 'air'; sp.plat = null;
  sp.braked = false; sp.committed = false; sp.ropeL = sp.line ? sp.pos.distanceTo(sp.anchor) : 0; sp.plop = false;
}
// bite through the dragline: she falls free, a loose strand stays hanging from the anchor
function cutLine(){
  if(!sp.line) return;
  sp.lineFresh = false;
  const tail = sp.pos.clone(), pts = [];
  for(let k = 0; k <= 10; k++){ const t = k/10; pts.push(sp.anchor.clone().lerp(tail, t*.45).add(new V3(Math.sin(t*6)*.015*t, -t*t*.05, Math.cos(t*5)*.01*t))); }
  const ln = hot(new THREE.Line(segsFrom(pts), silkM(.7)), .3); scene.add(ln); drawables.push(ln); gums.push({ln, t: 9});
  sp.line = false; sp.braked = false; sp.committed = true;
  if(sp.mode === 'hang'){ sp.mode = 'air'; sp.charging = false; toast('You bite through the dragline and drop.'); }
  else toast('You bite the dragline free.');
}
const pulses = [];
const gusts = [];
function jump(){
  if(!sp.aimFixed) updateAim(); sp.aimFixed = false;
  sp.launchSet = new Set(climbsNear(sp.pos.x, sp.pos.z, .4).filter(S => S.inside(sp.pos, .07)));          // whatever she is standing on or against as she springs
  const sg = leapSpread(); let v = null, hit = null;                              // she's good, not perfect...
  const want = sp.aim && sp.aim.ok ? sp.aim.plat : null, same = L => L && want && (L === want || L.top === want || want.top === L || L.climb === want || want.climb === L);
  for(let k = 0; k < 8 && !v; k++){ const c = leapVel(randn()*sg, randn()*sg*.6, 1 + randn()*sg*.7);
    if(!want) v = c; else { const h = predictLeap(c.clone()); if(h && same(h.plat)) v = c, hit = h; } }
  if(!v) v = leapVel();                                                          // ...but a leap aimed at a surface reaches it
  if(!hit) hit = predictLeap(v.clone());
  const leapHit = hit && hit.plat ? {plat: hit.plat, pos: hit.pos.clone(), t: hit.t + 1/60} : null;   // where this arc lands (predictLeap's t is the step before the hit)
  const fromBark = sp.mode === 'climb' && !underLeaf() ? sp.plat.normal(sp.pos) : null; sp.leftFrom = sp.plat;
  if(sp.mode === 'ground' || sp.mode === 'climb') startAir();
  else { sp.mode = 'air'; sp.braked = false; sp.committed = false; sp.ropeL = sp.pos.distanceTo(sp.anchor); }
  sp.tried = null; sp.vel.copy(v); sp.airT = 0; sp.aimWanted = sp.aim ? sp.aim.plat : null; sp.leapHit = leapHit; sp.orbGoal = sp.aim && sp.aim.ok && sp.aim.plat && sp.aim.plat.web ? sp.aim.target.clone() : null;
  if(fromBark){ sp.pos.addScaledVector(fromBark, .03); sp.climbGrace = .4; }    // clear of the bark by a hair; no extra push, so she flies the arc she aimed
  sp.heat = Math.min(1, sp.heat + .25 + sp.charge*.3);                 // leaping warms her muscles
  sp.climbGrace = Math.max(sp.climbGrace, .2);
  sp.yaw = sp.aim ? sp.aim.yaw : sp.yaw; sp.charging = false; sp.charge = 0;
  const cl = (x, a) => Math.max(-a, Math.min(a, x));                   // this leap's lean (see the air pose in updateSpider)
  sp.leapTilt = {roll: cl(randn()*.2, .38), pitch: .08 + Math.random()*.14, yaw: cl(randn()*.08, .16), ph: Math.random()*6.28};
  gusts.push({pos: sp.pos.clone(), amp: .9}); pulses.push({pos: sp.pos.clone(), amp: .5, decay: 6});
}
// at the top of the line: haul up over the edge and hop a short way in, turning to face the middle of the
// surface (camera follows), so holding W doesn't carry her straight back off the edge
// a line tied on a leaf's top and hanging below it doesn't pass through the blade: it lies across the leaf from the knot
// and bends over the rim. That point on the rim is what she swings from and is hauled up to. It stays put while she
// hangs below it (the silk grips the leaf), and lets go once she swings back up above the rim. null: the line runs free
function ropePivot(){
  const P = sp.anchorPlat;
  if(!sp.line || !P || !P.leaf){ sp.pivot = null; return null; }
  if(sp.pivot){ if(sp.pos.y <= sp.pivot.y + .02) return sp.pivot; sp.pivot = null; }
  const a = sp.anchor, b = sp.pos;
  if(inPlat(P, b.x, b.z)) return null;                                          // under the blade, not yet past a rim: no rim to name
  let through = false;
  for(let k = 1; k <= 16 && !through; k++){ const q = a.clone().lerp(b, k/16); through = inPlat(P, q.x, q.z) && q.y < surfAt(P, q.x, q.z) - .01; }
  if(!through) return null;
  const dir = new V3(b.x - a.x, 0, b.z - a.z); if(dir.lengthSq() < 1e-6) dir.copy(platOut(P, a.x, a.z));
  if(dir.lengthSq() < 1e-8) return null; dir.normalize();
  let lo = 0, hi = 2*platR(P);                                                     // out from the knot toward her, to the rim
  for(let i = 0; i < 24; i++){ const m = (lo + hi)/2; if(inPlat(P, a.x + dir.x*m, a.z + dir.z*m)) lo = m; else hi = m; }
  if(lo < .03) return null;                                                        // tied right at the rim: it hangs straight off it
  const x = a.x + dir.x*lo, z = a.z + dir.z*lo;
  return sp.pivot = new V3(x, surfAt(P, x, z), z);
}
// at: where the line comes over the leaf's rim (ropePivot), when it lies across the leaf; else the knot
function climbOver(at = null){
  const p = sp.anchorPlat, K = at || sp.anchor; sp.pivot = null;
  if(p.kind === 'climb' || p.ground){ sp.pos.copy(sp.anchor); land(p); toast('Back up the line.'); return; }
  const inw = at ? new V3(sp.anchor.x - at.x, 0, sp.anchor.z - at.z) : new V3();   // over the rim: in along the line, toward the knot
  if(inw.lengthSq() < 1e-6) inw.copy(platOut(p, K.x, K.z).negate());              // otherwise inward across the nearest rim
  if(inw.lengthSq() < 1e-8) inw.set(-Math.sin(sp.yaw), 0, -Math.cos(sp.yaw));
  inw.normalize();
  let d = .26; for(let i = 0; i < 6 && !inPlat(p, K.x + inw.x*d, K.z + inw.z*d, .06); i++) d *= .7;
  sp.pos.copy(K); sp.pos.y = surfAt(p, K.x, K.z) + .01;
  sp.mode = 'air'; sp.plop = true; sp.braked = false; sp.committed = false; sp.charging = false;
  sp.vel.set(inw.x*d/.16, 3, inw.z*d/.16); sp.yaw = Math.atan2(inw.x, inw.z);
  cam.swing = sp.yaw; sp.holdIn = true;
  toast('You haul yourself over the edge.');
}
// rounding a leaf's edge: the body rolls 180° about the rim (top → edge → underside, or back), legs paddling,
// then the feet take hold on the other face. The camera swings to face back in across the leaf.
function startRoll(pivot, out, done){
  const P = sp.m.userData.parts;
  sp.roll = {d0: Math.max(0, pivot.clone().sub(sp.pos).dot(out)), t: 0, dur: .55, q0: sp.m.quaternion.clone(), up0: (P.up || UP).clone().normalize(), pivot, out, done};
  const inw = out.clone().negate(); sp.charging = false;
  if(cam.pov === false){ cam.swing = Math.atan2(inw.x, inw.z); sp.holdIn = true; }   // POV: the view rolls over the rim with her instead, so forward stays forward
}
function wrapUnder(S, x, z){
  const [q, o] = S.rimPoint(x, z), inw = o.clone().negate();
  startRoll(q, o, () => { enterClimb(S, q.clone().addScaledVector(inw, .12), inw); sp.climbHead.copy(inw); });
  if(!sp.underHint){ sp.underHint = true; toast('You curl round the edge onto the underside. Walk off its rim to come back up.'); }
}
// walking off a leaf's rim with another walkable surface a short way below: she steps off and drops onto it
// rather than curling round onto the underside. Only when the fall really lands there (not the soil, not far down).
// A plain step off falls almost straight down (gravity is strong), so a lower leaf with even a small gap past the
// rim would be missed: failing that, she reaches for the nearest top within a leg span ahead and hops across to it.
const DROP_MAX = 2.2, DROP_REACH = .55;
function dropToBelow(dir, spd){
  const own = sp.plat, f = new V3(dir.x, 0, dir.z).normalize(), v = f.clone().multiplyScalar(Math.max(.5, spd)); v.y = .15;
  const was = [sp.leftFrom, sp.launchSet];
  sp.leftFrom = own; sp.launchSet = new Set(climbsNear(sp.pos.x, sp.pos.z, .4).filter(S => S.inside(sp.pos, .07)));
  const good = h => h && h.plat && !h.plat.ground && h.plat.kind !== 'climb' && h.plat !== own && h.plat !== own.under
    && sp.pos.y - h.pos.y > .03 && sp.pos.y - h.pos.y < DROP_MAX;
  let h = predictLeap(v.clone());
  if(!good(h)){ const r = reachBelow(own, f); h = null;
    if(r){ const sol = bestLeap(r.pos, r.plat), hh = sol.ok ? predictLeap(sol.v.clone()) : null; if(good(hh)){ h = hh; v.copy(sol.v); sp.yaw = sol.yaw; } } }
  if(!h){ [sp.leftFrom, sp.launchSet] = was; return false; }
  startAir(); sp.vel.copy(v); sp.committed = true; sp.charging = false; sp.tried = null;
  sp.leapHit = {plat: h.plat, pos: h.pos.clone(), t: h.t + 1/60};
  toast('You step off the edge and drop to the leaf below.');
  return true;
}
// the nearest walkable top (not her own, not the soil) a little below her and within a leg span, in the half she faces
function reachBelow(own, f){
  let best = null; const P = sp.pos;
  for(const L of PLAT){
    if(L === own || L.ground || L.kind === 'climb' || Math.hypot(L.x - P.x, L.z - P.z) > platR(L) + DROP_REACH) continue;
    for(let i = 1; i <= 6; i++) for(let j = -4; j <= 4; j++){
      const d = DROP_REACH*i/6, a = Math.atan2(f.x, f.z) + j*.3, x = P.x + Math.sin(a)*d, z = P.z + Math.cos(a)*d;
      if(!inPlat(L, x, z, .08) || inPlat(own, x, z)) continue;
      const y = surfAt(L, x, z), dy = P.y - y; if(dy < .03 || dy > DROP_MAX) continue;
      const cost = d + .5*Math.abs(j)*.3*d + .15*dy;                                // nearest first, straight ahead preferred
      if(!best || cost < best.cost) best = {plat: L, pos: new V3(x, y + .003, z), cost};
    }
  }
  return best;
}
// overlapping tops: where another walkable top lies just above hers (its rim over her leaf, or the two touching),
// that is the surface her feet meet; well above is headroom she walks under
// A rim higher up but within a leg's reach she climbs onto as she crosses under it (her front feet are already up
// on it: placeTop); once she is under a leaf, anything above STEP_UP is headroom she walks under
const STEP_UP = .08, REACH_UP = .22;
const nearTop = (L, x, z) => !(L.ground || L.kind === 'climb' || Math.abs(L.x - x) > platR(L) || Math.abs(L.z - z) > platR(L)) && inPlat(L, x, z);
function stepUpTo(own, x, z){
  const y0 = surfAt(own, x, z); let best = null, by = 0;
  for(const L of PLAT){
    if(L === own || !nearTop(L, x, z)) continue;
    const y = surfAt(L, x, z), dy = y - y0;
    if(dy > .003 && (dy < STEP_UP || (dy < REACH_UP && !inPlat(L, sp.pos.x, sp.pos.z))) && (!best || y > by)){ best = L; by = y; }
  }
  return best;
}
// a foot on a leaf-like top: one reaching out under the rim of a higher top (a leaf lying over hers, not yet climbed)
// goes up onto it; one left out past her own rim (the leaf she just climbed from) stays on the top below, if in reach
function placeTop(pl, v){
  const own = inPlat(pl, v.x, v.z), y0 = surfAt(pl, ...clampTo(pl, v.x, v.z)); let best = null, by = 0;
  for(const L of PLAT){
    if(L === pl || !nearTop(L, v.x, v.z)) continue;
    const y = surfAt(L, v.x, v.z), dy = own ? y - y0 : y0 - y;
    if(own ? dy > .003 && dy < REACH_UP && !inPlat(L, sp.pos.x, sp.pos.z) : dy > -.01 && dy < REACH_UP)
      if(!best || y > by){ best = L; by = y; } }
  if(!best) return placeOn(pl, v);
  v.y = by + .002; return v;
}
function rollOnTop(S, v){
  const [q, o] = S.rimPoint(v.x, v.z), inw = o.clone().negate();
  startRoll(q, o, () => { sp.mode = 'ground'; sp.plat = S.top; sp.pos.copy(q).addScaledVector(inw, .12); sp.pos.y = surfAt(S.top, sp.pos.x, sp.pos.z); sp.yaw = Math.atan2(inw.x, inw.z); });
}
// ballooning: she tips up her abdomen and lets fine silk stream into the breeze. The threads catch the air:
// she drifts downwind, sinks slowly in still air and lifts on gusts. Release to let them go.
const BALLOON_N = 7;
const balloonGeo = new THREE.BufferGeometry().setFromPoints(Array.from({length: BALLOON_N*2*8}, () => new V3()));
const balloonSilk = hot(new THREE.LineSegments(balloonGeo, new THREE.LineBasicMaterial({color:0xfff6e4, transparent:true, opacity:.8})), .45);
balloonSilk.frustumCulled = false; balloonSilk.visible = false; scene.add(balloonSilk); drawables.push(balloonSilk);
function startBalloon(){
  if(sp.balloon || sp.stuck > 0) return;
  const hv = new V3(sp.vel.x, 0, sp.vel.z), hs = hv.length();
  sp.balloon = {t: 0, len: 0, seed: rnd()*10, dir: hs > .05 ? hv.divideScalar(hs) : new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw)), spd: Math.max(.9, Math.min(2.4, hs*.45))};
  if(sp.line){ sp.line = false; toast('The dragline parts as the breeze takes your silk.'); }
  sp.committed = true; sp.braked = false; sp.leapHit = null;
}
function endBalloon(){ if(!sp.balloon) return; sp.balloon = null; sp.committed = false; }
function windVec(){ const w = SU.uWind.value; return new V3(w.x, 0, w.y).multiplyScalar(w.z); }
// touchdown: her legs soak up the hit, the body sinking and dipping its nose, then springing back a hair past rest and
// settling (a damped spring, stronger the harder she came down). Played in updateSpider's surface pose.
function landBounce(v){ const s = v.length(); if(s > .6) sp.bounce = {t: 0, a: Math.min(1, .45 + s/9)}; }
function land(p){
  endBalloon(); sp.leapHit = null; if(sp.mode === 'air') landBounce(sp.vel);
  const plop = sp.plop; sp.plop = false;
  if(p.kind === 'climb'){ enterClimb(p, sp.pos.clone(), null); return; }   // back up the line onto bark or stone
  pulses.push({pos: sp.pos.clone(), amp: plop ? .5 : 1.1, decay: 3});
  sp.mode = 'ground'; sp.plat = p; sp.pos.y = surfY(p, sp.pos.x, sp.pos.z); sp.vel.set(0, 0, 0); sp.braked = false;
  let caught = null;
  for(const f of flies) if(!f.gone && !f.held && f.state !== 'fly' && f.pos.distanceTo(sp.pos) < .75){ caught = f; break; }
  if(p.silk) p.silk.alert += .6*(1 - .85*wind.gust);
  if(plop){}
  else if(caught && catchFly(caught)) return;
  else if(strike()){ return; }
  else for(const f of flies) if(!f.gone && !f.held && f.state !== 'fly' && f.pos.distanceTo(sp.pos) < 2.4) flyAway(f);
  if(p === MALE_LEAF && !sp.mated) toast('A male is displaying here. Keep still and let him come to you.');
}
function catchFly(f){
  if(sp.stuck > 0 || f.held) return false;
  const falling = sp.mode === 'air', vy = sp.vel.y;
  endBalloon(); sp.caught++; f.fly = true; f.airborne = f.state === 'fly' || sp.mode === 'air'; f.state = 'held';
  pulses.push({pos: f.pos.clone(), amp: 1.4, decay: .7});
  const F = startFeed(f, null, f.airborne ? null : f.plat, .17, .35);
  if(f.airborne) F.base.copy(sp.pos);                // snatched in the air: she feeds where she hangs...
  if(falling) F.fall = new V3(0, vy, 0);             // ...but with no line to hang from she drops with it, fangs in, and feeds where she lands
  toast('You land on the fly — fangs in, venom pumping.');
  return true;
}
// a fly in her fangs, or its husk: shrunken, the abdomen sucked flat, its colour and sheen gone dull. The dulling
// only ever darkens (black bristles and legs must not fade up to grey), and the whole fly shrinks as feedTick expects
function flyLook(f, d){
  const m = f.m, U = m.userData;
  if(!U.mats){ U.mats = []; m.traverse(o => { if(o.material && o.material.color && !U.mats.some(e => e.m === o.material))
    U.mats.push({m: o.material, c0: o.material.color.clone(), e0: o.material.emissive ? o.material.emissive.clone() : null, mt0: o.material.metalness, r0: o.material.roughness}); }); }
  for(const e of U.mats){
    const c = e.m.color.copy(e.c0).lerp(DEAD_C, .85*d); c.r = Math.min(c.r, e.c0.r); c.g = Math.min(c.g, e.c0.g); c.b = Math.min(c.b, e.c0.b);
    if(e.e0) e.m.emissive.copy(e.e0).multiplyScalar(1 - d);
    if(e.mt0 != null){ e.m.metalness = e.mt0*(1 - d); e.m.roughness = e.r0 + (.9 - e.r0)*d; }   // the wet sheen of a live fly gone
  }
  U.ab.scale.copy(U.ab0).multiply(new V3(1 - .55*d, 1 - .75*d, 1 - .35*d)); U.th.scale.copy(U.th0).multiply(new V3(1 - .2*d, 1 - .25*d, 1 - .12*d));
  m.scale.setScalar(1 - .15*d);
}
function flyAway(f, from){
  const choices = (f.homes || HUNT).filter(p => p !== f.plat);   // a fly with homes (the tutorial's) keeps to them
  const to = choices[Math.floor(rnd()*choices.length)];
  f.state = 'fly'; f.from = from ? from.clone() : f.pos.clone(); f.to = randomIn(to); f.toPlat = to; f.t = 0;
  f.dur = 1.3 + f.from.distanceTo(f.to)*.22;
}

// A or D on its own: she sidles. Jumping spiders keep their big front eyes on whatever they are watching and slip
// sideways across their own facing, crab-like, rather than turning to walk off (from footage of a jumping spider sidling
// along a tank wall in a short video: body square to the camera throughout, carried in quick ~5 cm shoves about 6-7 times a second,
// each a frame or two of motion then a beat of stillness, the leading legs reaching out sideways as the trailing ones push)
const SIDLE = {k: .6, hz: 6.5, on: .4, peak: 2.3, rest: .15};
function sidleSide(going, ix, iz){
  const s = going && Math.abs(ix) > .3 && Math.abs(iz) < .35*Math.abs(ix) ? Math.sign(ix) : 0;
  if(!s) sp.sidleT = 0;
  return s;
}
// pace through one sidle cycle: a quick sine-shaped shove, then a near-stop while the feet catch up
function sidlePulse(dt){
  sp.sidleT = (sp.sidleT || 0) + dt;
  const u = (sp.sidleT*SIDLE.hz) % 1;
  return u < SIDLE.on ? SIDLE.peak*Math.sin(Math.PI*u/SIDLE.on) : SIDLE.rest;
}

function updateSpider(dt){
  const fwd = camFwd(), right = camRight();      // in the camera's frame: on a trunk or under a leaf, W is 'up the screen'
  const ix = Math.max(-1, Math.min(1, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + pad.lx));
  const iz = Math.max(-1, Math.min(1, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - pad.ly));
  const mag = Math.min(1, Math.hypot(ix, iz));                 // analog pace: stick tilt (keys give full pace)
  sp.sneaking = moveMode === 'sneak';                                               // C / RT toggles stalking
  const stalk = sp.sneaking;
  sp.sprinting = moveMode === 'dash';                                               // Shift / LT toggles the snap-and-dart dash
  if(sp.holdIn && (mag < .15 || cam.swing == null)) sp.holdIn = false;
  const held = sp.holdIn;      // after climbing over: wait for a fresh push or the camera
  sp.noise = 0; sp.plucking = false; sp.webGrace = Math.max(0, (sp.webGrace || 0) - dt); sp.climbGrace = Math.max(0, (sp.climbGrace || 0) - dt); sp.handT = Math.max(0, (sp.handT || 0) - dt); sp.lunge = Math.max(0, sp.lunge - dt); sp.tap = Math.max(0, sp.tap - dt);
  sp.vigor = Math.min(1, sp.vigor + dt*.01);
  if(sp.stuck > 0){
    sp.stuck -= dt; sp.charging = false; sp.speed = 0;
    if(sp.stuckKind === 'web') sp.pos.copy(sp.stuckPos);
    if(sp.stuck <= 0){
      if(sp.stuckKind === 'web'){ const side = Math.sign(sp.pos.clone().sub(ARG.C).dot(ARG.n) + (sp.anchor.x - ARG.C.x)*.01) || 1; sp.pos.addScaledVector(ARG.n, side*.2); sp.webGrace = 1.2;
        sp.mode = 'air'; sp.vel.set(0, -.5, 0); sp.braked = false; sp.committed = false; if(!sp.anchorPlat) sp.anchor.copy(sp.pos); }
      toast('You tear free.');
    }
    sp.m.position.copy(sp.pos);
    gaitRelease(sp.m); sp.m.position.copy(sp.pos);
    poseSpider(sp.m, {walk: .8, phase: time*30, hang: sp.mode === 'hang'});
    return;
  }
  if(sp.mode === 'feed'){ feedTick(dt); return; }
  if(sp.roll){
    const r = sp.roll; r.t += dt/r.dur; const e = Math.min(1, r.t), a = Math.PI*e*e*(3 - 2*e);
    const axis = new V3().crossVectors(r.up0, r.out); if(axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    const up = r.up0.clone().applyAxisAngle(axis, a);
    sp.pos.copy(r.pivot).addScaledVector(r.out, -(a < Math.PI/2 ? r.d0*Math.cos(a) : -.12*Math.cos(a))).addScaledVector(up, .012);
    sp.m.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axis, a).multiply(r.q0)); sp.m.position.copy(sp.pos);
    gaitRelease(sp.m); poseSpider(sp.m, {walk: .7, phase: time*20}); sp.speed = .3;
    if(e >= 1){ sp.roll = null; r.done(); }
    return;
  }
  if(sp.charging) updateAim();
  sp.speed = 0;
  if(sp.mode === 'ground'){
    const dir = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix), ahead = fwd.clone();
    if(cam.pov !== false && dir.lengthSq() > 1e-6){ const q = upToSurf(camUp, UP); dir.applyQuaternion(q); dir.y = 0; ahead.applyQuaternion(q); }   // POV: the view may still be rolling back level
    ahead.y = 0; if(ahead.lengthSq() < 1e-6) ahead.set(Math.sin(sp.yaw), 0, Math.cos(sp.yaw)); ahead.normalize();
    if(sp.holdIn) dir.set(0, 0, 0);
    let spd = 0, lead = 0;
    let yawTo = sp.yaw;
    sp.turnWant = 0;
    const going = dir.lengthSq() > 1e-6 && !sp.charging, snapOK = going && sp.sprinting && !sp.noSnap;
    if(going) dir.normalize();
    const side = sidleSide(going, ix, iz);              // A/D alone: she sidles, eyes kept on what lies ahead of the camera
    const err = going ? angDelta(sp.yaw, side ? Math.atan2(ahead.x, ahead.z) : Math.atan2(dir.x, dir.z)) : 0, mid = sp.pc && sp.pc.ph === 'burst';
    const room = snapOK && !mid ? dartRoomGround(sp.pos, dir, PACE.maxD + .04) : 0;
    // no room to dart (right at a trunk or the leaf's edge, pushing on): she walks over instead
    const snappy = snapOK && (mid || (settled() && (Math.abs(err) > .45 || room - .03 >= PACE.minD)));
    const pc = paceTick(sp, dt, snappy, mag, err, room);
    if(going){ spd = (side ? SIDLE.k : 1)*(stalk ? .05 : 1.1)*mag; const want = side ? Math.atan2(ahead.x, ahead.z) : Math.atan2(dir.x, dir.z);
      if(!snappy){
        sp.turnWant = Math.max(-1, Math.min(1, angDelta(sp.yaw, want)))*(stalk ? 3.5 : 9);           // rad/s she means to turn
        yawTo = lerpAngle(sp.yaw, want, 1 - Math.exp(-(stalk ? 5 : 10 + 8*mag)*dt));
      } else { yawTo = sp.yaw + pc.dYaw; sp.turnWant = Math.max(-20, Math.min(20, pc.rate)); lead = pc.lead; spd = pc.v; } }   // walking: snaps and freezes
    if(sp.charging && sp.aim){ yawTo = lerpAngle(sp.yaw, sp.aim.yaw, 1 - Math.exp(-14*dt)); sp.turnWant = Math.max(-1, Math.min(1, angDelta(sp.yaw, sp.aim.yaw)))*9; }
    sp.yaw = snappy ? yawTo : gaitTurn(sp.m, sp.yaw, yawTo);                                  // a snap swivels first; the feet catch up
    // she walks where her eyes point: travel follows the body's actual facing, and she only picks up pace
    // once that facing comes round to where you steer (a hard turn is made on the spot first)
    if(spd > 0){
      const face = new V3(0, 0, 1).applyQuaternion(sp.m.quaternion); face.y = 0;
      if(face.lengthSq() < .04) face.set(Math.sin(sp.yaw), 0, Math.cos(sp.yaw));
      face.normalize();
      if(side){                                    // sideways across her own facing, once that facing has come round to the front
        const al = face.dot(ahead), k = (al > 0 ? al*al : 0)*(snappy || stalk ? 1 : sidlePulse(dt));
        const lat = new V3(face.z, 0, -face.x); dir.copy(lat.multiplyScalar(Math.sign(dir.dot(lat)) || 1));
        spd *= k; lead *= k;
      } else { const al = face.dot(dir); spd *= al > 0 ? al*al : 0; lead *= al > 0 ? al*al : 0; dir.copy(face); }
    }
    // the legs move her: feet reach ahead at the intended pace; the body follows only as fast as the
    // standing legs push it and only as far as they can stretch (Portia's halting gait falls out of this)
    sp.moveVel.copy(dir).multiplyScalar(snappy ? lead : spd);
    if(!snappy && !stalk) spd *= .25 + .75*gaitSupport(sp.m);       // a dart is carried on whipping legs; a stalk glides on its slow wave
    spd *= gaitLimit(sp.m, dir.clone().multiplyScalar(spd*dt), snappy ? 1.02 : .93);   // a dart may pull the standing legs taut
    const nx = sp.pos.x + dir.x*spd*dt, nz = sp.pos.z + dir.z*spd*dt;
    const wall = spd > 0 && sp.climbGrace <= 0 ? climbHit(nx, sp.pos.y + .05, nz, dir) : null;   // a trunk or stem in her way, from the soil or from a leaf whose blade runs into it
    const up = !sp.plat.ground && spd > 0 ? stepUpTo(sp.plat, nx, nz) : null;
    if(up){ sp.plat = up; sp.pos.set(nx, surfAt(up, nx, nz), nz); }                               // another leaf lies over hers: walk up onto its top, not under it
    else if(snappy && spd > 0 && (wall || !inPlat(sp.plat, nx, nz))){ pc.t = pc.dur; spd = 0; }   // a dart stops at the edge of its surface
    else if(wall){ enterClimb(wall, new V3(nx, sp.pos.y + .06, nz), dir); return; }
    else if(sp.plat.ground){ const r = Math.hypot(nx, nz), k = r > 30 ? 30/r : 1; sp.pos.set(nx*k, floorAt(nx*k, nz*k), nz*k); }
    else if(inPlat(sp.plat, nx, nz)){ sp.pos.set(nx, surfAt(sp.plat, nx, nz), nz); }   // her height rides the blade's droop and fold, or the camera and the next step start inside it
    else if(spd > 0 && sp.plat.climb && sp.plat.climb.canEnter(new V3(nx, 0, nz))){ enterClimb(sp.plat.climb, new V3(nx, surfAt(sp.plat, nx, nz) - .05, nz), dir); return; }   // over the rim, down the side
    else if(spd > 0 && sp.plat.under && dropToBelow(dir, spd)) return;            // a leaf just below the rim: step down onto it
    else if(spd > 0 && sp.plat.under){ wrapUnder(sp.plat.under, nx, nz); return; }
    else if(spd > 0){ startAir(); sp.vel.set(dir.x*spd, 0, dir.z*spd); sp.charging = false; toast(sp.line ? 'You step off the edge — the dragline holds.' : 'You step off the edge — no dragline tied.'); }
    // on a leaf top she stands on the blade, not at its base level: out on a big leaf's drooping tip the two are a body
    // length or more apart, and the camera's orbit and her leaps start from here
    if(sp.mode === 'ground' && sp.plat.leaf) sp.pos.y = surfAt(sp.plat, sp.pos.x, sp.pos.z);
    sp.speed = paceSpeed(spd, snappy, dt, 1.1*mag); sp.phase += Math.max(spd, dir.lengthSq() > 0 ? .2 : 0)*dt*16;
    if(sp.mode === 'ground' && sp.plat.silk) sp.noise = sp.speed*(stalk ? .05 : Math.min(1, sp.speed/1.1))*(1 - .85*wind.gust);   // slow steps are quiet steps
    if((keys.KeyQ || pad.rb) && !sp.charging && sp.mode === 'ground'){
      if(sp.plat.silk) doPluck(dt);
      else if(!sp.pluckWarned){ toast('Nothing to pluck here — stand on silk or a web-anchored leaf.'); sp.pluckWarned = true; }
    } else sp.pluckWarned = false;
  } else if(sp.mode === 'climb'){
    // on bark or stone: camera-relative input mapped onto the surface; pushing into it climbs
    const S = sp.plat, n = S.normal(sp.pos), inp = held ? new V3() : fwd.clone().multiplyScalar(iz).addScaledVector(right, ix), t = new V3();
    // POV camera: its frame lags her surface for a moment as she rounds an edge, so camera-forward can point into the
    // new face (which the 'push into it climbs' rule below would turn straight back the way she came). Carry the input
    // through the same rotation that takes the camera's up onto her surface: forward stays forward over the edge
    const fa = fwd.clone();
    if(cam.pov !== false && inp.lengthSq() > 1e-6){ const q = upToSurf(camUp, n); inp.applyQuaternion(q); fa.applyQuaternion(q); }
    // a camera-space direction laid onto the surface; pushing into it climbs
    const onSurf = (v, out) => { const into = -v.dot(n); out.copy(v).addScaledVector(n, -v.dot(n)).addScaledVector(S.intoDir || UP, into); if(out.lengthSq() < 1e-4) out.copy(UP); return out.normalize(); };
    let spd = 0, herr = 0, lead = 0;
    const going = inp.lengthSq() > 1e-6 && !sp.charging, snapOK = going && sp.sprinting && !sp.noSnap;
    const side = sidleSide(going, ix, iz), head = new V3();     // A/D alone: sidle across the bark, facing the way W would climb
    if(going){
      onSurf(inp.normalize(), t); head.copy(side ? onSurf(fa.normalize(), new V3()) : t);
      spd = (side ? SIDLE.k : 1)*(stalk ? .04 : .75)*mag;
      const hd = sp.climbHead.clone().addScaledVector(n, -sp.climbHead.dot(n));          // heading error, signed about the surface normal
      if(hd.lengthSq() > 1e-6){ hd.normalize(); herr = Math.atan2(n.dot(new V3().crossVectors(hd, head)), hd.dot(head)); }
    }
    const mid = sp.pc && sp.pc.ph === 'burst', room = snapOK && !mid ? dartRoomClimb(S, sp.pos, t, PACE.maxClimb + .04) : 0;
    const snappy = snapOK && (mid || (settled() && (Math.abs(herr) > .45 || room - .03 >= PACE.minD)));   // at the rim or a join: climb over at a walk
    if(going && !snappy){
      if(sp.climbHead.dot(head) < -.3){ const sd = new V3().crossVectors(n, sp.climbHead); if(sd.lengthSq() > 1e-6) sp.climbHead.addScaledVector(sd.normalize(), .35).normalize(); }   // reversing: pivot round, never blend through zero
      sp.climbHead.lerp(head, 1 - Math.exp(-(stalk ? 2.5 : 6)*dt));
    }
    const pc = paceTick(sp, dt, snappy, mag, herr, room);
    sp.turnWant = snappy ? Math.max(-20, Math.min(20, pc.rate)) : 0;
    if(snappy){ sp.climbHead.applyAxisAngle(n, pc.dYaw); lead = pc.lead; spd = pc.v; }                    // snap round on the bark, dart, freeze
    sp.climbHead.addScaledVector(n, -sp.climbHead.dot(n));
    if(sp.climbHead.lengthSq() < 1e-4){ sp.climbHead.set(0, 0, 1).applyQuaternion(sp.m.quaternion).addScaledVector(n, -new V3(0, 0, 1).applyQuaternion(sp.m.quaternion).dot(n));
      if(sp.climbHead.lengthSq() < 1e-4) sp.climbHead.set(0, 1, 0).addScaledVector(n, -n.y); if(sp.climbHead.lengthSq() < 1e-4) sp.climbHead.set(1, 0, 0); }
    sp.climbHead.normalize();
    if(spd > 0){                                                   // travel along the body's facing on the surface
      // the facing is carried over the fold from the body's own up to this surface's normal, not flattened onto it: just
      // past a join (trunk onto a limb) the body still stands on the old surface, and "down the trunk" flattened onto a
      // limb's top points into the crease, so she crawled round the limb's flank and never walked out along it
      const face = new V3(0, 0, 1).applyQuaternion(sp.m.quaternion), bu = sp.m.userData.parts.up;
      if(bu && bu.dot(n) > -.95) face.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(bu.clone().normalize(), n));
      face.addScaledVector(n, -face.dot(n));
      if(face.lengthSq() > .04){ face.normalize();
        if(side){ const al = face.dot(head), k = (al > 0 ? al*al : 0)*(snappy || stalk ? 1 : sidlePulse(dt)), lat = new V3().crossVectors(n, face);
          if(lat.lengthSq() > 1e-6){ lat.normalize().multiplyScalar(Math.sign(lat.dot(t)) || 1); spd *= k; lead *= k; t.copy(lat); } }
        else { const al = face.dot(t); spd *= al > 0 ? al*al : 0; lead *= al > 0 ? al*al : 0; t.copy(face); } }
    }
    sp.moveVel.copy(t).multiplyScalar(snappy ? lead : spd);
    if(!snappy && !stalk) spd *= .25 + .75*gaitSupport(sp.m);
    spd *= gaitLimit(sp.m, t.clone().multiplyScalar(spd*dt), snappy ? 1.02 : .93);
    const np = sp.pos.clone().addScaledVector(t, spd*dt); S.project(np);
    if(snappy && spd > 0 && (np.distanceTo(sp.pos) > spd*dt*3 + .02 || climbLeaves(S, np, t))){ pc.t = pc.dur; spd = 0; np.copy(sp.pos); }   // a dart stops short of the rim, the soil or another solid
    if(spd > 0){                                                          // walking into another solid: step onto it instead of through it
      for(const S2 of climbsNear(np.x, np.z, .4)){
        if(S2 === S || S2.thin || S2.web || !S2.inside(np, .015)) continue;
        if(sp.handT > 0 && S2 === sp.handFrom) continue;                       // no flicking straight back at the join
        if(t.dot(S2.normal(np)) > -.05) continue;                              // only when she is walking into it
        const q = np.clone(); S2.project(q); sp.handFrom = S; sp.handT = .6; sp.plat = S2; sp.pos.copy(q);
        // her heading folds over the join with the surface (down a trunk onto a limb's top becomes out along the limb);
        // flattened onto the limb instead, "down" off a near-level top is mostly noise and sent her round its flank
        const n2 = S2.normal(q); sp.climbHead.copy(t); if(n.dot(n2) > -.95) sp.climbHead.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(n, n2));
        sp.climbHead.addScaledVector(n2, -sp.climbHead.dot(n2)); if(sp.climbHead.lengthSq() < 1e-4) sp.climbHead.set(0, 1, 0); sp.climbHead.normalize();
        // off a trunk onto a limb she sets off straight along it: arriving on its flank, the folded heading runs across
        // the limb at a slant, and held keys then spiralled her round underneath it
        if(S2.tube && !S.tube && S2._pts){ const P = S2._pts; let bi = 0, bd = 1e9;
          for(let i = 0; i + 1 < P.length; i++){ const d = P[i].distanceToSquared(q) + P[i + 1].distanceToSquared(q); if(d < bd){ bd = d; bi = i; } }
          const ax = P[bi + 1].clone().sub(P[bi]); ax.addScaledVector(n2, -ax.dot(n2));
          if(ax.lengthSq() > 1e-8){ ax.normalize(); const c = ax.dot(sp.climbHead); if(Math.abs(c) > .3) sp.climbHead.copy(ax).multiplyScalar(Math.sign(c)); } }
        // off a trunk onto a limb (or back): the view levels or tilts, which would turn what W means and walk her straight
        // back where she came from. Swing the camera to look along her new heading so held keys keep carrying her on.
        // The young trees' crown limbs are 'tree' too (the view turns with them), so trunk <-> limb is told apart by 'tube'
        // there the view's up turns over with her, so the swing has to keep re-aiming along her heading as it does (swingDir)
        if(S.tree && S2.tree && !!S.tube !== !!S2.tube){ cam.swingDir = sp.climbHead.clone(); cam.swingT = 0; cam.swing = null; sp.handT = 1; }
        else if(!!S.tree !== !!S2.tree){ const hz = Math.hypot(sp.climbHead.x, sp.climbHead.z); if(hz > .3){ cam.swing = Math.atan2(sp.climbHead.x, sp.climbHead.z); cam.swingDir = null; } sp.handT = 1; }
        sp.speed = spd; return;
      }
    }
    if(spd > 0 && S.web && S.atEdge(np, t)){
      if(webExit(np, t)) return;                                         // off the orb's frame onto what it is slung from
      if(!(sp.webFlipT > performance.now()/1000)){                       // nothing beyond: round the frame thread onto the other face
        // a real 180° roll about the thread, as at a leaf's rim. Just flipping the side would leave the body upright on
        // the old face: its up follows the feet's normals by lerp, and a lerp toward the exact opposite never turns
        // the orb sways along its normal (a few cm when the Argiope pumps it), so the pivot rides with the web and the
        // far face is set outright: re-reading it from a world point after the roll can land back on the old one
        const n0 = S.normal(np), out = t.clone().addScaledVector(n0, -t.dot(n0)).normalize(), inw = out.clone().negate(), piv = np.clone();
        const pivL = np.clone().sub(S.orb.g.position), face = -S.side;
        sp.webFlipT = performance.now()/1000 + .55 + .8;
        startRoll(piv, out, () => {
          S.side = face;
          const at = S.project(pivL.clone().add(S.orb.g.position).addScaledVector(inw, .12));   // on the sheet itself, so enterClimb keeps the face
          enterClimb(S, at, inw); S.side = face;
          cam.swingDir = sp.climbHead.clone(); cam.swingT = 0; cam.swing = null;
          pulses.push({pos: sp.pos.clone(), amp: .3, decay: 6});
        });
        cam.swingDir = inw.clone(); cam.swingT = 0; cam.swing = null;   // look back in across the web (startRoll's yaw-only swing can't on an upright sheet)
        toast('You curl round the frame thread onto the other face of the web.');
        sp.speed = spd; return;
      }
    }
    if(spd > 0 && S.thin && S.top && S.atRim(np, t)){ rollOnTop(S, np); return; }   // round a leaf's edge back onto its top
    if(spd > 0 && S.top && S.atRim(np, t)){                                // over the rim onto the top
      const r = S.rimLand(np, t); sp.mode = 'ground'; sp.plat = S.top; sp.pos.copy(r.pos); sp.yaw = r.yaw;
      if(r.swing){ cam.swing = r.yaw; sp.holdIn = true; }
    } else if(spd > 0 && t.y < 0 && S.atBottom(np)){                        // back down onto the soil
      sp.mode = 'ground'; sp.plat = GROUND; sp.pos.copy(S.soilExit(np, n));
      sp.yaw = Math.atan2(n.x, n.z); sp.climbGrace = .5;
    } else sp.pos.copy(np);
    sp.speed = paceSpeed(spd, snappy, dt, .75*mag); sp.phase += spd*dt*16;
    if(S.silk){                                                         // on the orb: footsteps and plucks travel through the silk
      sp.noise = sp.speed*(stalk ? .05 : Math.min(1, sp.speed/.75))*(1 - .85*wind.gust);
      if((keys.KeyQ || pad.rb) && !sp.charging) doPluck(dt);
    }
  } else {
    const prev = sp.pos.clone();
    if(sp.mode === 'hang'){
      if(!sp.charging){
        const reel = Math.max(-1, Math.min(1, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + pad.ly));
        sp.ropeL = Math.max(.15, sp.ropeL + reel*1.1*dt);
        if(sp.anchorPlat && sp.anchorPlat.silk) sp.noise = Math.abs(reel)*.35*(1 - .85*wind.gust);
        sp.vel.addScaledVector(right, ix*3.2*dt);
      }
      sp.vel.multiplyScalar(1 - Math.min(1, .6*dt));
    }
    if(sp.balloon && sp.mode === 'air'){
      const b = sp.balloon; b.t += dt; b.len = Math.min(1.6, b.len + dt*5);
      const k = Math.min(1, .35 + b.len/1.6), w = windVec(), gust = wind.gust;
      // she sails on along the line of her leap; the stick turns her gently and trims her pace (the breeze is ignored)
      const steer = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix);
      if(steer.lengthSq() > .01){ const turn = Math.max(-1, Math.min(1, b.dir.x*steer.z - b.dir.z*steer.x)); b.dir.applyAxisAngle(UP, -turn*.9*dt).normalize();
        b.spd = Math.max(.6, Math.min(2.6, b.spd + b.dir.dot(steer)*.8*dt)); }
      const air = b.dir.clone().multiplyScalar(b.spd).add(new V3(0, -.3 + .2*Math.sin(b.t*1.3 + b.seed), 0));
      sp.vel.lerp(air, 1 - Math.exp(-4.5*k*dt));
      sp.vel.y -= G*(1 - k)*dt;                                                                          // full drag once the threads are out
      sp.pos.addScaledVector(sp.vel, dt);
      sp.heat = Math.max(0, sp.heat - dt*.02);
    } else { sp.vel.y -= G*dt; sp.pos.addScaledVector(sp.vel, dt); sp.pos.y += .5*G*dt*dt; }   // exact parabola: the flight matches the solved arc at any frame rate
    if(sp.mode === 'hang' || sp.braked){
      // she swings from where the line leaves the leaf; the part lying across the blade doesn't give
      const piv = ropePivot(), O = piv || sp.anchor, lay = piv ? piv.distanceTo(sp.anchor) : 0;
      if(piv) sp.ropeL = Math.max(sp.ropeL, lay + .15);
      const L = sp.ropeL - lay, r = sp.pos.clone().sub(O), d = r.length();
      if(d > L){
        r.divideScalar(d); const k = 1 - Math.exp(-14*dt);
        sp.pos.copy(O).addScaledVector(r, d + (L - d)*k);
        const vr = sp.vel.dot(r); if(vr > 0) sp.vel.addScaledVector(r, -vr*(.6 + .4*k));
      }
      if(L <= .2 && sp.pos.distanceTo(O) < .3 && sp.anchorPlat){ climbOver(piv); return; }
    }
    // a spider within reach mid-flight takes her before the silk it sits on does
    if(sp.mode === 'air' && !sp.plop){ const pr = preyAt(sp.pos, .26); if(pr && !(sp.tried || (sp.tried = new Set())).has(pr)){ sp.tried.add(pr); if(pounce(pr)) return; } }
    const hw = sp.webGrace > 0 ? null : orbHit(prev, sp.pos, sp.planeLaunch, sp.orbGoal);
    if(hw){
      const W = hw.orb.S;
      if(!(sp.climbGrace > 0 && sp.leftFrom === W)){ W.side = W.sideFrom(prev, sp.vel); enterClimb(W, hw, sp.vel.clone());
        pulses.push({pos: hw.clone(), amp: .7, decay: 4}); hw.orb.spider.alert += .35; toast('You catch hold of the orb’s radii.'); return; }
    }
    if(sp.mode === 'air') sp.airT = (sp.airT || 0) + dt;
    // a leap flies exactly the arc she gauged and lands where its prediction (the aim ring) said, whatever the frame
    // rate: sampling the same arc at other instants could clip or miss a leaf rim the prediction didn't
    const LH = sp.mode === 'air' && !sp.braked && !sp.balloon && !sp.plop ? sp.leapHit : null;
    if(LH && sp.airT >= LH.t - 1e-6){
      const P = LH.plat; if(P.web) P.side = P.sideFrom(prev, sp.vel); sp.pos.copy(LH.pos);
      if(P.kind === 'climb'){ enterClimb(P, sp.pos.clone(), sp.vel.clone()); pulses.push({pos: sp.pos.clone(), amp: .6, decay: 4}); toast(P.thin ? 'You land upside-down under the leaf.' : 'You land on the ' + P.label + ' and grip.'); }
      else land(P);
      return;
    }
    if(!LH){
    if(!sp.plop && sp.mode === 'air'){                                         // sweep the step so thin things are never skipped
      const segL = prev.distanceTo(sp.pos);
      if(segL > .03){ const n = Math.min(14, Math.ceil(segL/.03));
        sweep: for(let k = 1; k < n; k++){ const pt = prev.clone().lerp(sp.pos, k/n);
          for(const S of climbsNear(pt.x, pt.z, .4)){ if(S.thin || (sp.climbGrace > 0 && fromOwn(S, sp.leftFrom))) continue; if(S.inside(pt, .04)){ sp.pos.copy(pt); break sweep; } } } }
    }
    if(!sp.plop && sp.mode === 'air' && sp.vel.y < 0) for(const S of climbsNear(sp.pos.x, sp.pos.z, .6)){
      if(S.thin && S.crossDown && !S.web && S.crossDown(prev, sp.pos) && !passOwn(S.top, sp.airT || 0)){ land(S.top); return; }
    }
    if(!sp.plop) for(const S of climbsNear(sp.pos.x, sp.pos.z, .6)){
      if(S.thin && S.crossUp && S.crossUp(prev, sp.pos)){                  // up into a leaf from below
        const graced = sp.climbGrace > 0 && fromOwn(S, sp.leftFrom);                     // only the surface she just left is ignored
        if(sp.mode === 'air' && !graced){ enterClimb(S, sp.pos.clone(), sp.vel.clone()); pulses.push({pos: sp.pos.clone(), amp: .6, decay: 4}); toast('You land upside-down under the leaf.'); return; }
        sp.pos.y = surfAt(S.top, sp.pos.x, sp.pos.z) - LEAF_TH - .02; sp.vel.y = -Math.abs(sp.vel.y)*.2;            // otherwise bump off it
      }
      const hit = S.inside(sp.pos, .04);
      const fromAbove = S.thin && S.top && !S.web && prev.y >= surfAt(S.top, prev.x, prev.z) - .01;
      if(hit && sp.mode === 'air' && (S.topAt(sp.pos, sp.vel) || fromAbove) && !passOwn(S.top, sp.airT || 0)){ land(S.top); return; }
      if(hit && sp.mode === 'air' && !(sp.climbGrace > 0 && fromOwn(S, sp.leftFrom))){ enterClimb(S, sp.pos.clone(), sp.vel.clone()); pulses.push({pos: sp.pos.clone(), amp: .6, decay: 4}); toast('You land on the ' + S.label + ' and grip.'); return; }
      if(S.thin) continue;
      if(sp.mode === 'hang' && S.inside(sp.pos, .17)) S.pushOut(sp.pos, sp.vel, .17);   // on a line her whole body swings clear
      if(sp.mode === 'hang' && !sp.charging && S.inside(sp.pos, .22)){        // touching bark on the line: push toward it to grab on
        const inp = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix), n = S.normal(sp.pos);
        if(inp.lengthSq() > .04 && inp.normalize().dot(new V3(n.x, 0, n.z).normalize()) < -.3){
          enterClimb(S, sp.pos.clone(), inp); pulses.push({pos: sp.pos.clone(), amp: .4, decay: 5}); toast('You grab the ' + S.label + '.'); return; }
        if(!sp.gripHint){ sp.gripHint = true; toast('Bark within reach — push toward it to grab on.'); }
      }
    }
    // the hop over the rim at the top of a line comes down on the leaf's real surface: out at the rim a blade curls and
    // droops below its base level, which is all findLanding looks for, and she fell straight past it to the floor
    { const A = sp.anchorPlat; if(sp.plop && sp.mode === 'air' && sp.vel.y < 0 && A && A.leaf && inPlat(A, sp.pos.x, sp.pos.z) && sp.pos.y <= surfAt(A, sp.pos.x, sp.pos.z)){ land(A); return; } }
    const L = findLanding(prev, sp.pos);
    if(L && !(sp.mode === 'air' && passOwn(L, sp.airT || 0))){ land(L); return; }
    }
    for(const f of flies) if(!f.gone && !f.held && f.pos.distanceTo(sp.pos) < .38){ if(catchFly(f)) return; break; }
    if(sp.mode === 'air' && !sp.braked){
      const d = sp.pos.distanceTo(sp.anchor); sp.ropeL = Math.max(sp.ropeL, d);
      if(sp.line && d > 12){ sp.line = false; toast('The dragline paid out to its end and parted.'); }
      if(sp.vel.y < 0 && !sp.committed && !sp.plop && sp.line && sp.anchorPlat && !sp.anchorPlat.ground){   // (never the hop back over the rim)
        // the line only catches a leap that is going somewhere she didn't aim (or a fall she didn't choose)
        const h = sp.leapHit || predictLeap(sp.vel.clone()), aimedSoil = sp.aimWanted === GROUND, intended = h && (!h.plat || !h.plat.ground || aimedSoil);
        if(intended) sp.committed = true;
        else { sp.braked = true; sp.mode = 'hang'; sp.leapHit = null; sp.ropeL = Math.max(.4, Math.min(Math.max(d, 1.2), sp.anchor.y - floorAt(sp.anchor.x, sp.anchor.z) - .35)); sp.charging = false;
          pulses.push({pos: sp.anchor.clone(), amp: .7, decay: 4});
          toast('Missed — caught on your dragline. W/S reel, A/D swing, SPACE leap.'); }
      }
    }
  }
  // pose: on a surface the body rides on its planted feet; in the air the legs are posed
  const m = sp.m; sp.posture = !!(keys.KeyF || pad.x) && !sp.plucking; const raiseT = sp.charging ? .4 + sp.charge*.6 : sp.posture ? 1 : 0;   // hold F: front legs raised high
  if(raiseT > 0) sp.raiseLvl = sp.raiseW < .05 ? raiseT : sp.raiseLvl + (raiseT - sp.raiseLvl)*(1 - Math.exp(-20*dt));
  sp.raiseW += ((raiseT > 0 ? 1 : 0) - sp.raiseW)*(1 - Math.exp(-(raiseT > 0 ? 14 : 9)*dt));      // ~0.12 s up, a little slower down
  const raise = sp.raiseW > .02 ? sp.raiseLvl : 0, rw = sp.raiseW*sp.raiseW*(3 - 2*sp.raiseW);
  if(sp.mode === 'ground' || sp.mode === 'climb'){
    if(sp.speed === 0) sp.moveVel.multiplyScalar(Math.exp(-12*dt)); sp.airPitch = null; sp.leapTilt = null;
    const climbing = sp.mode === 'climb';
    const pc = sp.pc || {}, snap = sp.sprinting && !sp.charging && !sp.noSnap, tidy = pc.ph === 'freeze' && pc.t < PACE.cad*2, hold = pc.ph === 'freeze' && !tidy;   // a freeze opens with one beat that tucks any straggling feet back under her
    bodyOnFeet(m, dt, sp.pos, climbing ? sp.climbHead : new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw)), climbing ? sp.plat.normal(sp.pos) : UP, snap, sp.sneaking);
    // each snap ends with the body dropping a hair onto its freshly planted feet
    let give = 0, nod = 0;                                               // landing bounce: + sinks, - rebounds
    if(sp.bounce){ const B = sp.bounce; B.t += dt;
      // one deep, slowish sink and a single smooth return, no oscillation: t·e^(1-t/τ), peaking (=a) at τ
      const spring = t => t > 0 ? B.a*(t/.15)*Math.exp(1 - t/.15) : 0;
      give = spring(B.t); nod = spring(B.t - .045);                      // the head lags the body: it keeps going down as the body turns back up
      if(B.t > .9){ sp.bounce = null; give = nod = 0; } }               // back to ~2% by now (slow motion waits for this)
    sp.bounceNod = Math.max(give, nod);
    // the body sways with the abdomen's shiver (last frame's, so the feet are solved against it); on landing, inertia
    // pitches her nose down as she sinks, and the head nods on through, then swings back
    { const J = sp.idle, B = m.userData.parts.body; B.rotation.set((J ? J.bx : 0) + .17*give, J ? J.by : 0, J ? J.bz : 0); }
    m.userData.parts.head.rotation.x = .1*nod;
    // idle dip: last frame's, so the feet are solved against it; the landing drop is capped so the dipped head stays clear of the surface
    poseSpider(m, {raise, crouch: sp.charging ? sp.charge : 0, bob: (pc.jolt ? -.007*m.userData.parts.s*Math.sin(Math.PI*(1 - pc.jolt)) : 0) - (sp.idle ? sp.idle.dip*.014*m.userData.parts.s : 0) - .026*m.userData.parts.s*give});
    const cad = snap && (pc.ph === 'burst' || tidy) ? {t: pc.t, per: tidy ? PACE.cad : pc.cad, min: tidy ? .5 : 0} : null, onIt = snap && (pc.ph === 'burst' || pc.ph === 'freeze');
    gaitUpdate(m, dt, {vel: sp.moveVel, up: m.userData.parts.up, place: onIt ? dartPlace : playerPlace, sneak: sp.sneaking, snap, hold, cad, turn: sp.turnWant || 0, free: L => L.k === 0 && raise > 0});
    // raised front legs swing up out of their last standing pose; the lunge throws the body forward a touch
    for(const L of m.userData.parts.legs) if(L.free && L.ikA && rw < .999){
      for(let j = 0; j < 5; j++) L.joints[j].rotation.x = L.ikA[j] + (L.joints[j].rotation.x - L.ikA[j])*rw;
      L.yawG.rotation.y = L.ikY + angDelta(L.ikY, L.yawG.rotation.y)*rw;
    }
    if(sp.plucking){                                                     // first legs tug the thread on each pluck, alternating sides
      for(const L of m.userData.parts.legs) if(L.k === 0 && !L.free && L.planted){
        const pull = pluckStroke(L.side), fb = m.userData.parts.body.worldToLocal(L.foot.clone());
        if(pull > 0){ fb.lerp(L.yawG.position, .12*pull); fb.y += .02*pull*(1 - pull); legIK(L, fb); }
      }
    }
    m.userData.parts.body.position.z = sp.lunge > 0 ? Math.sin(Math.PI*Math.max(0, Math.min(1, (.3 - sp.lunge - .05)/.22)))*.035 : 0;
  } else {
    gaitRelease(m); m.position.set(sp.pos.x, sp.pos.y, sp.pos.z); m.rotation.y = sp.yaw;
    if(sp.bounce){ sp.bounce = null; m.userData.parts.body.rotation.x = 0; m.userData.parts.head.rotation.x = 0; }   // off again before the landing settled
    if(sp.mode === 'hang'){ m.rotation.x += (Math.PI/2 - m.rotation.x)*Math.min(1, dt*6); m.rotation.z *= .85; sp.airPitch = m.rotation.x; sp.leapTilt = null; }   // hanging straight, head down
    else {   // nose follows the arc: she rocks up off the push and tips head-down to land front feet first
      const t = sp.airT || 0, LH = sp.leapHit, k = LH && LH.t > 0 ? Math.min(1, t/LH.t) : null;
      // never flown dead level: each leap carries its own lean (rolled to a side, nose a touch high, slightly skewed),
      // swelling in off the push and wobbling as she flies, then mostly righted just before touchdown
      const TL = sp.leapTilt, e = TL ? ss01(t/.12)*(k != null ? 1 - .7*ss01((k - .8)/.2) : 1) : 0;
      const hz = Math.hypot(sp.vel.x, sp.vel.z), tgt = -Math.atan2(sp.vel.y, hz)*.75 - (TL ? TL.pitch*e : 0);
      sp.airPitch = sp.airPitch == null ? tgt*.3 : sp.airPitch + (tgt - sp.airPitch)*(1 - Math.exp(-12*dt));
      m.rotation.x = sp.airPitch; if(hz > 1e-4) m.rotation.y = Math.atan2(sp.vel.x, sp.vel.z) + (TL ? TL.yaw*e : 0);
      m.rotation.z = TL ? (TL.roll + .05*Math.sin(t*11 + TL.ph))*e : 0; }
    m.userData.parts.body.position.z = 0; m.userData.parts.body.rotation.set(0, 0, 0);
    let launch = 0, land = 0, flight = null;
    if(sp.mode === 'air' && !sp.balloon){
      const t = sp.airT || 0, LH = sp.leapHit;
      launch = sp.plop ? 0 : 1 - ss01(t/.25);                                  // hind legs snap out straight behind, then ease to a trail
      if(LH && LH.t > 0) flight = Math.min(1, t/LH.t);                          // each leg pair turns to its landing pose at its own point
      else land = ss01(-sp.vel.y/3);                                            // a fall: legs fan out as she drops
    }
    poseSpider(m, {raise: raise*rw, air: sp.mode === 'air', launch, land, flight, hang: sp.mode === 'hang' && !sp.charging, wave: sp.plucking ? time*25 : 0});
  }
  // standing still a while she looks about: now and then she cocks her head to one side and holds it there, and a
  // front leg lifts and slowly feels the air ahead before settling back on its foothold, one leg at a time
  { const P = m.userData.parts, legsDown = sp.mode === 'ground' || sp.mode === 'climb', pcs = sp.pc || {};
    const I = sp.idle || (sp.idle = {t: 0, roll: 0, rTgt: 0, rT: 2, pr: null, wait: 1, side: 1, dip: 0, dipTgt: 0, dipT: 3, shk: 0, shkT: 4, bx: 0, by: 0, bz: 0});
    const ok = legsDown && sp.speed < .02 && !sp.charging && !sp.posture && !sp.plucking && !sp.feed && raise === 0 && pcs.ph !== 'burst';
    I.t = ok ? I.t + dt : 0; const on = I.t > 1.5;
    if(on){
      I.rT -= dt; if(I.rT <= 0){                                                          // a quizzical tilt, like a puzzled dog, held 5-8 s
        if(I.rTgt){ I.rTgt = 0; I.rT = rr(2, 5); } else { I.rTgt = (rnd() < .5 ? -1 : 1)*rr(.26, .36); I.rT = rr(5, 8); } }
    } else { I.rTgt = 0; I.rT = rr(1, 3); }
    I.roll += (I.rTgt - I.roll)*(1 - Math.exp(-(on ? 2.5 : 10)*dt));
    P.head.rotation.z = I.roll;
    // now and then she settles a little lower on her legs, holds it, and rises again
    if(on){ I.dipT -= dt; if(I.dipT <= 0){ if(I.dipTgt){ I.dipTgt = 0; I.dipT = rr(3, 7); } else { I.dipTgt = rr(.5, 1); I.dipT = rr(1.2, 3); } } }
    else { I.dipTgt = 0; I.dipT = rr(2, 5); }
    I.dip += (I.dipTgt - I.dip)*(1 - Math.exp(-(on ? 3 : 12)*dt));
    // and a short shiver runs through the abdomen: a quick flutter, side to side and up and down, dying away
    if(on){ I.shkT -= dt; if(I.shkT <= 0){ I.shk = rr(.45, .85); I.shkD = I.shk; I.shkT = rr(7, 16); } } else I.shk = 0;
    if(I.shk > 0){ I.shk = Math.max(0, I.shk - dt); const f = I.shk/I.shkD, a = Math.sin(Math.PI*f)*(.6 + .4*f), t = I.t;
      const sx = Math.sin(t*41), sy = Math.sin(t*33 + 1.3), sz = Math.sin(t*37 + .6);
      P.abd.rotation.x += a*.085*sx; P.abd.rotation.y = a*.11*sy; P.abd.rotation.z = a*.055*sz;
      I.bx = -a*.018*sx; I.by = -a*.03*sy; I.bz = a*.02*sz; }                         // the front of the body rocks back against it, a little
    else { P.abd.rotation.y = P.abd.rotation.z = 0; I.bx = I.by = I.bz = 0; }
    if(I.pr){
      const L = I.pr.L; I.pr.t += dt; const k = I.pr.t/I.pr.dur;
      if(!on || L.free || L.step || !L.planted || k >= 1){ I.pr = null; I.wait = rr(.8, 2.6); }
      else {
        const ss = x => x*x*(3 - 2*x), e = ss(Math.min(1, k/.3))*ss(Math.min(1, (1 - k)/.25)), t = I.pr.t, s = P.s;
        const fb = P.body.worldToLocal(L.foot.clone()), front = L.k === 0;
        if(front && I.pr.high){                                                          // held up high, waved slowly overhead
          fb.y += e*(.12 + .015*Math.sin(t*3.1))*s;
          fb.z += e*(.01 + .012*Math.sin(t*1.7))*s;
          fb.x += e*L.side*(.015 + .012*Math.sin(t*2.3 + .4))*s;
        } else if(front){
          fb.y += e*(.05 + .012*Math.sin(t*4.3))*s;                                     // lifted, bobbing gently
          fb.z += e*(.024 + .014*Math.sin(t*2.1 + .7))*s;                               // reaching ahead and drawing back
          fb.x += e*L.side*(.008 + .01*Math.sin(t*1.6))*s;                              // and sweeping a touch outward
        } else fb.y += e*(I.pr.high ? .05 : .02)*s;                                    // another leg: raised a little (now and then higher) and set down again
        legIK(L, fb);
      }
    } else if(on){
      I.wait -= dt;
      if(I.wait <= 0){                                                                  // mostly the front legs, now and then one of the others
        const other = rnd() < .25, k = other ? 1 + Math.floor(rnd()*3) : 0, side = other ? (rnd() < .5 ? -1 : 1) : (I.side = -I.side);
        const L = P.legs.find(L => L.k === k && L.side === side && L.planted && !L.step && !L.free);
        const high = rnd() < (other ? .3 : .35);                                       // every few raises one goes much higher
        if(L) I.pr = {L, t: 0, high, dur: other ? rr(.7, 1.2) : rr(1.8, 3)*(high ? 1.25 : 1)}; else I.wait = .3; }
    }
  }
  updateHair(m, dt);
  // palps
  { const P = m.userData.parts; let st;
    if(sp.mode === 'air') st = 'air'; else if(sp.mode === 'hang') st = 'hang';
    else if(sp.plucking || sp.charging) st = 'rest';
    else if(sp.speed > .02) st = 'tap';
    else { sp.palpT = (sp.palpT || 0) - dt; const sc = scentNear(sp.pos);
      if(sp.palpT <= 0 || (sc > .45 && sp.palpSt !== 'taste')){ const r = rnd(); sp.palpSt = (sc > .45 && r < .85) || r < .45 ? 'taste' : r < .78 ? 'groom' : 'rest'; sp.palpT = rr(1.4, 3.6); }
      st = sp.palpSt; sp.palpK = sc; }
    animatePalps(P, st, time, dt, sp.palpK || 0, sp.plucking ? pluckStroke : null, sp.bounce ? 1.1*(sp.bounceNod || 0) : 0); }   // the landing nod folds them up off the leaf
  // body heat: exertion warms her, rest lets her settle back
  sp.heat = Math.max(0, Math.min(1, sp.heat + (sp.speed*.08 + sp.charge*.15)*dt - .05*dt));
  sp.temp = .6 + .22*sp.heat;
  const P = m.userData.parts; P.hairM.color.copy(P.hairBase).lerp(new THREE.Color(1, 1, 1), Math.min(1, sp.felt)); P.furM.color.copy(P.hairM.color); if(m === sp.m) for(const k in VCM) VCM[k].color.setScalar(1 + .7*Math.min(1, sp.felt));
  if(sp.lineFresh && sp.pos.distanceTo(sp.anchor) > .3) sp.lineFresh = false;   // she has left the knot: X now cuts
  rope.visible = sp.line && !sp.plop;
  balloonSilk.visible = !!sp.balloon;
  if(sp.balloon){
    m.updateMatrixWorld(true); const tail = P.spinner.getWorldPosition(new V3()), b = sp.balloon, pa = balloonGeo.attributes.position;
    const flow = b.dir.clone().multiplyScalar(-.7).add(new V3(0, 1, 0)).normalize(), side = new V3().crossVectors(flow, UP).normalize();
    if(side.lengthSq() < .01) side.set(1, 0, 0);
    const up2 = new V3().crossVectors(side, flow).normalize(); let i = 0;
    for(let k = 0; k < BALLOON_N; k++){
      const a = k/BALLOON_N*6.283 + b.seed, spread = .12 + .08*Math.sin(k*2.1), L = b.len*(.75 + .35*Math.sin(k*1.7 + b.seed));
      let prev = tail.clone();
      for(let j = 1; j <= 8; j++){
        const f = j/8, wav = Math.sin(time*(3 + k*.4) + f*5 + k)*.06*f;
        const q = tail.clone().addScaledVector(flow, L*f).addScaledVector(side, (Math.cos(a)*spread + wav)*f).addScaledVector(up2, (Math.sin(a)*spread + wav*.6)*f);
        pa.setXYZ(i++, prev.x, prev.y, prev.z); pa.setXYZ(i++, q.x, q.y, q.z); prev = q;
      }
    }
    pa.needsUpdate = true;
  }
  tieMark.visible = sp.line;
  if(sp.line){ tieMark.position.copy(sp.anchor); const k = 1 + .25*Math.sin(time*6); tieMark.scale.setScalar(k); tieMark.children[1].quaternion.copy(camera.quaternion); }
  if(rope.visible){
    m.updateMatrixWorld(true); const tail = P.spinner.getWorldPosition(new V3());
    if(sp.mode !== 'hang' && !sp.braked) sp.pivot = null;
    const pa = ropeGeo.attributes.position, mid = sp.pivot || sp.anchor;           // over the rim, the line is drawn bent there
    pa.setXYZ(0, sp.anchor.x, sp.anchor.y, sp.anchor.z); pa.setXYZ(1, mid.x, mid.y, mid.z); pa.setXYZ(2, tail.x, tail.y, tail.z); pa.needsUpdate = true;
  }
  // aim steadiness: swinging the aim around shakes the estimate; it settles within a few tenths of a second
  { const tg = sp.aim ? sp.aim.target : sp.pos, mv = sp.aimLast ? tg.distanceTo(sp.aimLast)/Math.max(.3, tg.distanceTo(sp.pos)) : 0;
    sp.aimLast = tg.clone(); sp.aimShake = Math.min(1, (sp.aimShake || 0)*Math.exp(-dt/.3) + (sp.charging ? mv*1.5 : 0)); }
  dots.visible = sp.charging; aimRing.visible = false; sp.aimPrey = null;
  if(sp.charging){
    // the arc only changes with the aim (or where she stands): reuse last frame's flight otherwise
    const PC = aimArc; if(PC.aim !== sp.aim || PC.plat !== sp.plat || !PC.pos.equals(sp.pos)){ PC.pts = []; PC.hit = predictLeap(leapVel(), PC.pts); PC.aim = sp.aim; PC.plat = sp.plat; PC.pos.copy(sp.pos); }
    const pts = PC.pts, hit = PC.hit, end = hit ? pts.length : Math.floor(pts.length*.6);
    for(let i = 0; i < DOTS; i++){
      const f = (i + 1)/(DOTS + 1), pp = pts[Math.min(pts.length - 1, Math.floor(f*end))] || sp.pos, k = (1 - f*.5)*(i < 2 ? .4 : 1);
      M4.compose(pp, Q.identity(), new V3(k, k, k)); dots.setMatrixAt(i, M4);
    }
    dots.instanceMatrix.needsUpdate = true;
    if(hit){
      const dist = Math.hypot(hit.pos.x - sp.pos.x, hit.pos.z - sp.pos.z) + Math.abs(hit.pos.y - sp.pos.y)*.4;
      const r = Math.min(1.5, .09 + dist*leapSpread()*1.8)*(1 + .04*Math.sin(time*9));
      aimRing.visible = true; aimRing.position.copy(hit.pos).addScaledVector(hit.n, .012);
      aimRing.quaternion.setFromUnitVectors(new V3(0, 0, 1), hit.n); aimOuter.scale.set(r, r, 1); aimFill.scale.set(r, r, 1);
      // the prey inside the landing estimate, nearest its centre (spiders by where their body stands, as the bite reckons it)
      let preyIn = null, bd = 1e9;
      for(const q of [...PREY, male]){ if(q.dead || (q === male && !maleIsPrey())) continue; const d = q.m.userData.parts.body.getWorldPosition(new V3()).distanceTo(hit.pos); if(d < r + .12 && d < bd){ bd = d; preyIn = q; } }
      for(const f of flies){ if(f.gone || f.held || f.state === 'fly') continue; const d = f.pos.distanceTo(hit.pos); if(d < r + .1 && d < bd){ bd = d; preyIn = f; } }
      if(!sp.aim.ok) preyIn = null;
      sp.aimPrey = preyIn;
      aimRingM.color.set(!sp.aim.ok ? 0x9a9488 : preyIn ? 0xff7a30 : 0xffe0a0); aimFill.material.color.copy(aimRingM.color);
      aimOwner.temp = preyIn ? .82 : TEMP.preview;
    }
  }
  hlTick(dt, sp.aimPrey); fangTick(P, sp.aimPrey ? 1 : 0, dt);   // prey in her sights: fangs bared, prey burning bright
  sp.hunger = Math.max(0, sp.hunger - dt*.006);
}

// the fly's six legs. Walking is an alternating tripod (front and hind of one side with the middle of the other),
// the stride timed to its pace; grooming is what house flies do whenever they stop: front legs raised and rubbed
// against each other, front legs wiped over the head, or hind legs rubbed together and stroked back over the wings.
// In flight the legs hang; in her fangs they kick, then curl in as it dies. Per leg: s swings it back (+) or
// forward (-), l lifts it, f folds the knee
function flyLegTick(f, dt, t){
  const U = f.m.userData, L = U.legs; if(!L) return;
  const st = f.held ? 'held' : f.state, e = 1 - Math.exp(-9*dt);
  f.walkW = (f.walkW || 0) + ((st === 'walk' ? 1 : 0) - (f.walkW || 0))*(1 - Math.exp(-12*dt));
  if(st === 'walk') f.gait = (f.gait || 0) + dt*.3/.04*Math.PI*2;
  const g = f.groom, w = t*15 + f.dir;                     // grooming strokes, a few a second
  let pitch = 0;
  for(let i = 0; i < 6; i++){
    const leg = L[i], sx = leg.sx, k = leg.k, side = sx > 0 ? Math.PI : 0;
    let s = 0, l = 0, fo = 0, y = 0;                     // y: the tibia swung in toward the midline at the knee
    if(st === 'groom'){
      const a = Math.sin(w + side), b = Math.cos(w + side);
      if(g === 'front' && k === 0){ s = -.2; l = -.3 + .06*b; fo = -1 + .2*b; y = -1.8 + .18*a; }   // femora beside the face, tarsi crossed in front of it, sawing
      else if(g === 'head' && k === 0){ const c = Math.sin(w*.7 + side), d = Math.cos(w*.7 + side); s = -.1 + .1*d; l = -.1 + .2*c; fo = -1.5 + .25*d; y = -1.9 + .2*c; }   // wiped over the eyes in loops
      else if(g === 'hind' && k === 2){                   // hind tarsi rubbed together behind the abdomen, then stroked forward over the wings
        const m = .5 + .5*Math.sin(w*.35);
        s = .8 + (.3 - .8)*m; l = -.4 + .6*m; fo = -1.1 - .4*m; y = .4 + .6*m + .15*a;
      }
      else if(k === 1) s = g === 'hind' ? .2 : -.3;       // the middle pair braces under the body
      pitch = g === 'hind' ? .14 : -.1;
    } else if(st === 'fly'){ l = -.4; fo = -.15; s = k === 2 ? .25 : 0; }
    else if(st === 'held'){
      const bite = sp.feed && sp.feed.t < BITE_T, limp = f.limp || 0;
      l = -.2*limp + (bite ? .25*Math.sin(t*31 + i*1.7) : 0); fo = .9*limp + (bite ? .3*Math.sin(t*23 + i*2.3) : 0);
    }
    leg.s += (s - leg.s)*e; leg.l += (l - leg.l)*e; leg.f += (fo - leg.f)*e; leg.y += (y - leg.y)*e;
    let ws = 0, wl = 0, wf = 0;
    if(f.walkW > .01){                                   // swing forward lifted, stance backward on the ground
      const ph = f.gait + (((sx < 0) === (k !== 1)) ? 0 : Math.PI), up = Math.max(0, Math.sin(ph));
      ws = Math.cos(ph)*.3*f.walkW; wl = up*.32*f.walkW; wf = up*.3*f.walkW;
    }
    leg.hip.rotation.y = sx*(leg.s + ws); leg.hip.rotation.z = sx*(leg.l + wl); leg.kn.rotation.z = -sx*(leg.f + wf); leg.kn.rotation.y = sx*leg.y;
  }
  if(!f.held){ f.pitch = (f.pitch || 0) + (pitch - (f.pitch || 0))*e; f.m.rotation.x = f.pitch; }
}

function updateFlies(dt, t){
  for(const f of flies){
    f.vib = 0; f.hear = 0; f.motion = 0;
    if(f.gone){
      f.respawn -= dt;
      if(f.respawn <= 0){ f.gone = false; f.m.visible = true; const a = rnd()*6.28, H = f.homes && f.homes[0]; f.plat = null;
        flyAway(f, H ? new V3(H.x + Math.cos(a)*5, H.y + 2, H.z + Math.sin(a)*5) : new V3(Math.cos(a)*14, 6, Math.sin(a)*14)); f.pos.copy(f.from); }
      continue;
    }
    f.t += dt;
    const w = f.m.userData.wings;
    if(f.held){                                    // in her fangs (feedTick places it): wings whirr against the venom, then still
      const bite = sp.feed && sp.feed.t < BITE_T;
      w.forEach((p, i) => p.rotation.z = (i ? 1 : -1)*(bite ? .3 + Math.sin(t*95)*.6 : .05 + .5*(f.limp || 0)));
      f.motion = 0; f.vib = bite ? .6 : 0; f.temp += ((bite ? .8 : .7 - .3*(f.drain || 0)) - f.temp)*(1 - Math.exp(-2*dt));
      flyLook(f, f.drain || 0); flyLegTick(f, dt, t); f.pos.copy(f.m.position); continue;
    }
    let tTarget;
    if(f.state === 'fly'){
      const k = Math.min(1, f.t/f.dur), dist = f.from.distanceTo(f.to);
      const prev = f.pos.clone();
      f.pos.lerpVectors(f.from, f.to, k).add(new V3(Math.sin(t*7 + f.dir)*.15*(1 - k), Math.sin(k*Math.PI)*(1 + dist*.18), Math.cos(t*6)*.15*(1 - k)));
      const d = f.pos.clone().sub(prev); if(d.lengthSq() > 1e-8) f.m.rotation.y = Math.atan2(d.x, d.z);
      w.forEach((p, i) => p.rotation.z = (i ? 1 : -1)*(.2 + Math.sin(t*90)*.7));
      f.motion = 1; f.hear = 1; tTarget = .95;                         // flight muscles run hot
      if(k >= 1){ f.state = 'walk'; f.plat = f.toPlat; f.pos.y = f.homes ? surfY(f.plat, f.pos.x, f.pos.z) : f.plat.y; f.t = 0; f.dir = rnd()*6.28; }
    } else {
      w.forEach((p, i) => p.rotation.z = (i ? 1 : -1)*.05);
      if(f.state === 'walk'){
        f.dir += (rnd() - .5)*dt*6;
        const nx = f.pos.x + Math.sin(f.dir)*.3*dt, nz = f.pos.z + Math.cos(f.dir)*.3*dt;
        if(inPlat(f.plat, nx, nz, .12)){ f.pos.x = nx; f.pos.z = nz; if(f.homes) f.pos.y = surfY(f.plat, nx, nz); } else f.dir += 2.2;
        f.m.rotation.y = f.dir;
        f.motion = .55; f.vib = Math.sin(t*26 + f.dir) > -.2 ? .9 : .35; tTarget = .72;
        if(f.t > 2.5 + rnd()*3){ f.state = 'groom'; f.t = 0; f.groom = ['front', 'head', 'hind', 'front'][Math.floor(rnd()*4)]; }
      } else {
        f.motion = .15; f.vib = .25; f.hear = Math.sin(t*1.7 + f.dir*3) > .85 ? .45 : 0; tTarget = .64;
        if(f.t > 1.5 + rnd()*3){ if(rnd() < .25) flyAway(f); else { f.state = 'walk'; f.t = 0; } }
      }
      if(f.state !== 'fly' && sp.mode === 'ground' && sp.speed > .7 && f.pos.distanceTo(sp.pos) < 1.8) flyAway(f);
    }
    f.temp += (tTarget - f.temp)*(1 - Math.exp(-1.5*dt));
    f.m.position.copy(f.pos); flyLegTick(f, dt, t);
  }
  for(const h of husks){ h.age += dt; h.temp = h.floor + (.7 - h.floor)*Math.exp(-h.age/14);
    if(h.fallH > 0){ h.fallV += 9*dt; h.fallH = Math.max(0, h.fallH - h.fallV*dt); h.m.position.y = h.y0 + h.fallH; if(h.fallH === 0) pulses.push({pos: h.m.position.clone(), amp: .25, decay: 6}); } }
}

// courtship: he displays on his leaf. If she stands on it and keeps still, he judges her calm, edges in and
// mounts her; moving, raising her legs or leaping scares him off. After mating her eggs are fertile.
// after mating he lingers beside her. Hunger strikes her and her gaze swings to him: leap on him and drain him, or he
// loses his nerve after MALE_NERVE seconds, leaps off into the undergrowth and is gone
// the dance: bursts of quick side-steps between held poses, front legs pumping up and down; he wants MALE_DANCE seconds
// of her stillness before he dares approach, and he always comes in from behind her
const MALE_NERVE = 7, MALE_DANCE = 14, maleIsPrey = () => male.state === 'linger' && !male.dead && !male.gone;
// his escape, in Portia's saccadic style: a few jerky swivels on the spot, a snap-dart off to one side, a freeze,
// a pivot to face out, a crouch, then one fast low leap off the leaf head first
function fleeMale(dt){
  const F = male.fl, P = male.m.userData.parts; F.t += dt;
  const ease = u => 1 - (1 - Math.min(1, u))**3;
  const swivel = (to, dur) => { F.from = male.m.rotation.y; F.to = to; F.sw = 0; F.swDur = dur; };
  if(F.swDur){ F.sw += dt; male.m.rotation.y = F.from + angDelta(F.from, F.to)*ease(F.sw/F.swDur); if(F.sw >= F.swDur) F.swDur = 0; }
  const next = (ph, extra) => { F.ph = ph; F.t = 0; Object.assign(F, extra || {}); };
  let vel = new V3(), pose = {crouch: .3};
  if(F.ph === 'twitch'){                                       // jerky swivels, a twitching abdomen, tiny jolts in place
    if(F.t > .13*F.n){ F.n++; swivel(F.yaw0 + rr(-.7, .7), .06);
      const j = rr(-.025, .025), sx = Math.cos(F.yaw0), sz = -Math.sin(F.yaw0);
      const [cx, cz] = clampTo(male.plat, male.pos.x + sx*j, male.pos.z + sz*j); vel.set(cx - male.pos.x, 0, cz - male.pos.z).divideScalar(Math.max(dt, 1e-4)); male.pos.x = cx; male.pos.z = cz; }
    pose = {crouch: .5, raise: .35, wave: male.t*30, twitch: Math.sin(F.t*55)*.3};
    if(F.t > .75){                                             // dart off to one side of her, partly away
      const s = rnd() < .5 ? -1 : 1, a = F.away, dir = new V3(a.z*s*.85 + a.x*.5, 0, -a.x*s*.85 + a.z*.5).normalize();
      let D = 0; while(D < .45 && inPlat(male.plat, male.pos.x + dir.x*(D + .03), male.pos.z + dir.z*(D + .03), .05)) D += .03;
      next('pivot', {dir, D, after: 'dart'}); swivel(Math.atan2(dir.x, dir.z), .07); }
  }
  else if(F.ph === 'pivot'){ pose = {crouch: .45}; if(F.t > .08) next(F.after, {done: 0}); }
  else if(F.ph === 'dart'){                                    // surge, run, brake along the leaf, legs whipping
    const dur = .09 + F.D*.45, u = Math.min(1, F.t/dur), e = paceShape(u), v = F.D/(dur*.775)*e;
    vel.copy(F.dir).multiplyScalar(v); male.pos.addScaledVector(vel, dt);
    pose = {crouch: .35, bob: -.004};
    if(u >= 1) next('freeze');
  }
  else if(F.ph === 'freeze'){ pose = {crouch: .4};
    if(F.t > .18){                                             // face out over the nearest edge, away from her
      const a = F.away, dir = new V3(a.x + F.dir.x*.6, 0, a.z + F.dir.z*.6).normalize();
      next('pivot', {dir, after: 'crouch'}); swivel(Math.atan2(dir.x, dir.z), .09); } }
  else if(F.ph === 'crouch'){ pose = {crouch: 1, raise: .15};
    if(F.t > .12){ next('air', {v: F.dir.clone().multiplyScalar(3.4).add(new V3(0, 1.5, 0))}); male.m.rotation.y = Math.atan2(F.dir.x, F.dir.z);
      pulses.push({pos: male.pos.clone(), amp: .6, decay: 5}); } }
  if(F.ph === 'air'){                                          // head first, nose following the arc
    F.v.y -= 9*dt; male.pos.addScaledVector(F.v, dt); male.m.position.copy(male.pos);
    male.m.rotation.x = -Math.atan2(F.v.y, Math.hypot(F.v.x, F.v.z))*.7;
    gaitRelease(male.m); poseSpider(male.m, {air: 1}); updateHair(male.m, dt); male.motion = 1; male.vib = 0;
    if(F.t > 1.1){ male.gone = true; male.m.visible = false; }
    return;
  }
  male.pos.y = male.plat.y; male.m.position.x = male.pos.x; male.m.position.z = male.pos.z;
  gaitBody(male.m, dt, male.pos.y);
  animatePalps(P, 'taste', male.t, dt, 1); updateHair(male.m, dt);
  poseSpider(male.m, pose);
  gaitUpdate(male.m, dt, {vel, snap: true, turn: F.swDur ? angDelta(F.from, F.to)/F.swDur : 0, place: v => placeOn(male.plat, v), free: L => L.k === 0 && !!pose.raise});
  male.motion = F.ph === 'dart' ? 1 : .5; male.vib = F.ph === 'twitch' ? .6 : .3;
}
function updateMale(dt){
  male.t += dt; male.state = male.state || 'display'; male.calm = male.calm || 0;
  if(male.gone) return;
  if(male.dead){
    if(male.held){ const bite = sp.feed && sp.feed.t < BITE_T; gaitRelease(male.m);
      poseSpider(male.m, bite ? {twitch: Math.sin(male.t*48)*.4, raise: .5} : {crouch: 1, grab: 1}); }
    else { gaitRelease(male.m); male.m.position.set(male.pos.x, male.pos.y, male.pos.z); male.m.rotation.set(0, male.yaw || 0, 0); poseSpider(male.m, {crouch: 1, grab: 1});
      if(male.fallH > 0){ male.fallV += 9*dt; male.fallH = Math.max(0, male.fallH - male.fallV*dt); } }
    deadLook(male, dt); if(!male.held && male.fallH > 0) male.m.position.y += male.fallH;
    male.deadT += dt; male.motion = 0; male.vib = 0; male.temp += (.5 - male.temp)*(1 - Math.exp(-.1*dt)); return;
  }
  if(male.state === 'flee'){ fleeMale(dt); return; }
  if(male.state === 'linger'){
    male.lt += dt;
    if(male.lt > 2.6 && !male.pang){ male.pang = true;
      cam.swingDir = null; cam.swing = Math.atan2(male.pos.x - sp.pos.x, male.pos.z - sp.pos.z);
      toast('You feel a sudden pang of hunger, and your gaze shifts toward the male.');
      encCard('A SUDDEN PANG OF HUNGER', 'PORTIA LABIATA', 'THE SPENT SUITOR', 'Leap on him and devour him before he flees.'); }
    if(male.pang && (male.stare += dt) > MALE_NERVE*.6 && !male.timid){ male.timid = true; toast('He grows timid under your stare…'); }
    if(male.stare > MALE_NERVE){
      const d = new V3(male.pos.x - sp.pos.x, 0, male.pos.z - sp.pos.z); if(d.lengthSq() < 1e-6) d.set(1, 0, 0);
      d.normalize(); male.state = 'flee'; male.fl = {ph: 'twitch', t: 0, away: d, yaw0: male.m.rotation.y, from: male.m.rotation.y, to: male.m.rotation.y, n: 0};
      pulses.push({pos: male.pos.clone(), amp: .6, decay: 5}); toast('He loses his nerve and leaps away into the undergrowth.');
      encCard('', 'PREY ESCAPED', 'HE IS GONE', ''); return;
    }
  }
  const still = sp.mode === 'ground' && sp.plat === male.plat && !sp.mated && sp.speed < .02 && !sp.charging && !sp.posture && !sp.plucking;
  const dF = Math.hypot(sp.pos.x - male.pos.x, sp.pos.z - male.pos.z);
  const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);                       // her facing; he mounts from behind
  const rear = new V3(sp.pos.x - fx*.15, male.plat.y, sp.pos.z - fz*.15), dR = Math.hypot(rear.x - male.pos.x, rear.z - male.pos.z);
  if(male.state === 'display'){ male.calm = still && dF < 1.6 ? male.calm + dt : Math.max(0, male.calm - dt*1.5);
    if(male.calm > MALE_DANCE){ male.state = 'approach'; toast('He stops dancing and edges toward you…'); } }
  else if(male.state === 'approach'){
    if(!still){ male.state = 'display'; male.calm = 0; toast('He startles and backs off. Keep still while he courts you.'); }
    else if(dR < .04){ male.state = 'mount'; male.mt = 0; toast('He climbs onto you. Keep still…'); }
  }
  else if(male.state === 'mount'){
    male.mt += dt;
    if(sp.mode !== 'ground' || sp.speed > .05 || sp.charging){ male.state = 'leave'; male.cool = 8; toast('He tumbles off. Mating interrupted.'); }
    else if(male.mt > 5){ sp.mated = true; male.state = 'linger'; male.lt = 0; male.stare = 0; bossWin('MATED', 'YOUR EGGS ARE FERTILE'); }
    if(male.state === 'mount'){
      // on her back towards the rear, facing the way she faces, leaning forward over her, rocking gently
      const P = male.m.userData.parts, up = UP.clone().applyQuaternion(sp.m.quaternion), fwd = new V3(0, 0, 1).applyQuaternion(sp.m.quaternion);
      const rock = Math.sin(male.mt*2.2)*.012;
      gaitRelease(male.m); male.m.position.copy(sp.m.position).addScaledVector(up, .085).addScaledVector(fwd, -.1 + rock);
      male.m.quaternion.copy(sp.m.quaternion); male.m.rotateX(.16 + rock*2);
      poseSpider(male.m, {hang: true, wave: male.t*5}); animatePalps(P, 'taste', male.t, dt, 1); updateHair(male.m, dt);
      male.pos.copy(sp.pos); male.motion = .3; male.vib = .3; return;
    }
    male.pos.set(sp.pos.x - Math.sin(sp.yaw)*.2, male.plat.y, sp.pos.z - Math.cos(sp.yaw)*.2);       // dropped beside her
    const [cx, cz] = clampTo(male.plat, male.pos.x, male.pos.z); male.pos.x = cx; male.pos.z = cz; male.m.rotation.set(0, male.m.rotation.y, 0);
  }
  else if(male.state === 'leave'){ male.cool -= dt; male.calm = 0; if(male.cool <= 0) male.state = 'display'; }
  const cyc = male.t % 18, dancing = male.state === 'display' && cyc < 16;   // sixteen seconds of dance, a short breather
  const toF = Math.atan2(sp.pos.x - male.pos.x, sp.pos.z - male.pos.z);
  const side = new V3(Math.cos(toF), 0, -Math.sin(toF));
  // the dance: a quick burst sideways to the next spot, then a held pose with the front legs pumping; his legs decide
  // how far he actually gets each frame
  const BURST = 1.6, MOVE = .5, SPOTS = [.28, .08, -.28, -.08], bi = Math.floor(male.t/BURST), bt = male.t - bi*BURST;
  const bk = Math.min(1, bt/MOVE), bs = bk*bk*(3 - 2*bk), o0 = SPOTS[(bi + 3) % 4], o1 = SPOTS[bi % 4];
  const darting = dancing && bt < MOVE;
  let want = new V3(male.plat.x, male.plat.y, male.plat.z).addScaledVector(side, dancing ? o0 + (o1 - o0)*bs : 0);
  if(male.state === 'approach'){
    // circle round to her rear: while he's beside or ahead of her, aim wide of her flank first
    const rx = male.pos.x - sp.pos.x, rz = male.pos.z - sp.pos.z, ahead = rx*fx + rz*fz, lat = rx*fz - rz*fx;
    want = ahead > -.08 ? new V3(sp.pos.x - fx*.12 + fz*Math.sign(lat || 1)*.2, male.plat.y, sp.pos.z - fz*.12 - fx*Math.sign(lat || 1)*.2) : rear.clone();
    want.sub(male.pos).clampLength(0, dt*.12).add(male.pos); }                                       // slow, careful steps
  if(male.state === 'linger'){ const d = new V3(male.pos.x - sp.pos.x, 0, male.pos.z - sp.pos.z).normalize(); want = male.pos.clone().addScaledVector(d, male.timid ? dt*.06 : 0);
    const [cx, cz] = clampTo(male.plat, want.x, want.z); want.x = cx; want.z = cz; }
  if(male.state === 'leave'){ const d = new V3(male.pos.x - sp.pos.x, 0, male.pos.z - sp.pos.z).normalize(); want = male.pos.clone().addScaledVector(d, dt*.3);
    const [cx, cz] = clampTo(male.plat, want.x, want.z); want.x = cx; want.z = cz; }
  const delta = want.clone().sub(male.pos); delta.y = 0;
  const P = male.m.userData.parts;
  if(P.inited) delta.multiplyScalar((.3 + .7*gaitSupport(male.m))*gaitLimit(male.m, delta));
  male.pos.add(delta); male.pos.y = male.plat.y;
  const vel = delta.clone().divideScalar(Math.max(dt, 1e-4));
  male.m.position.x = male.pos.x; male.m.position.z = male.pos.z;
  male.m.rotation.y = gaitTurn(male.m, male.m.rotation.y, lerpAngle(male.m.rotation.y, toF, 1 - Math.exp(-4*dt)));
  gaitBody(male.m, dt, male.pos.y);
  animatePalps(male.m.userData.parts, dancing ? 'taste' : 'rest', male.t, dt, dancing ? 1 : 0); updateHair(male.m, dt);
  // held pose: both front legs pump up and down, slightly out of step; mid-dart: legs flung high and spread
  const pumpT = male.t*7, raise = !dancing ? .2 : darting ? 1.05 : .5 + .45*Math.sin(pumpT);
  poseSpider(male.m, {raise, pump: dancing && !darting ? .18*Math.sin(pumpT*.5) : 0, wave: darting ? Math.PI/2 : male.t*1.5,
    bob: dancing ? (darting ? .015 : Math.max(0, Math.sin(pumpT))*.02) : 0, twitch: dancing ? Math.sin(male.t*19)*.08 : 0});
  gaitUpdate(male.m, dt, {vel, place: v => placeOn(male.plat, v), free: L => L.k === 0});
  male.motion = dancing ? .6 : .04;
  male.vib = dancing ? ((Math.sin(male.t*19) > .2 ? 1 : .2)*(Math.sin(male.t*1.6) > -.3 ? 1 : .3)) : 0;
  male.temp += ((dancing ? .82 : .66) - male.temp)*(1 - Math.exp(-.8*dt));   // the display is hard work
}
