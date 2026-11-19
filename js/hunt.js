'use strict';
// prey AI, pounce/feeding, silk lines, plucking, aim markers

const PREY = [];
function addPrey(p){ p.m.userData.owner = p; PREY.push(Object.assign(p, {alert:0, motion:0, vib:0, temp:.56, temp0:.56, dead:false, deadT:0, phase:0, t:rr(2, 6), close:0, idleT:0})); return p; }
const SCY = [PLAT[2], PLAT[6]].map((pl, i) => {
  scytodesWeb(pl);
  const home = randomIn(pl, .4);
  const p = addPrey({kind:'scytodes', name:'Scytodes pallida · spitting spider', m: makeScytodes(), plat: pl, home, pos: home.clone(), yaw: rnd()*6.28, state:'idle'});
  p.want = p.yaw; pl.silk = p; return p;
});
const BADU = addPrey({kind:'badumna', name:'Badumna longinqua · grey house spider', m: makeBadumna(), site: BAD, plat: BAD.plat, pos: BAD.mouth.clone(), yaw: 0,
  state:'retreat', pref: 'fly', interest: 0, rush: 0, sulk: 0, known: false, peekT: 0});
BAD.plat.silk = BADU;
const ARGI = addPrey({kind:'argiope', name:'Argiope · St Andrew’s Cross spider', m: makeArgiope(), plat: ARG.side, pos: ARG.C.clone(), state:'hub', wary: 0, fwd: new V3(0, -1, 0), orb: ARG});
ARG.side.silk = ARGI; ARG.above.silk = ARGI;
const WEB = webSurface(ARG); WEB.silk = ARGI;
Object.assign(ARG, {S: WEB, spider: ARGI}); ORBS.push(ARG);
// ---- a second Argiope, up in a young tree: a quarter orb slung in the angle under one of its limbs, its frame laid
// on the bark of the trunk and the limb's underside. Hung where the limb leaves the trunk, about 26 up, and shaped from
// the limb as it actually grew. It draws on its own random stream, so the seeded world after it is unchanged.
const ARG2 = (() => {
  let seed = 90917; const rn = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const rr2 = (a, b) => a + rn()*(b - a);
  const tr = TREE_LIST.find(([x, z]) => Math.hypot(x + 4.8, z - 13.2) < .01); if(!tr) return null;
  const ctr = new V3(tr[0], 0, tr[1]), trunk = CLIMBS.find(S => S.tree && !S._pts && S.cx === tr[0] && S.cz === tr[1]);
  const limb = CLIMBS.filter(S => S.tree && S._pts && Math.hypot(S._pts[0].x - ctr.x, S._pts[0].z - ctr.z) < tr[2]*1.1)
    .sort((a, b) => Math.abs(a._pts[0].y - 26) - Math.abs(b._pts[0].y - 26))[0];
  if(!trunk || !limb) return null;
  const LP = limb._pts, LR = limb._R, up = new V3(0, 1, 0);
  const u = new V3(LP[4].x - ctr.x, 0, LP[4].z - ctr.z).normalize(), n = new V3().crossVectors(u, up).normalize();
  const lx = LP.map(q => q.clone().sub(ctr).dot(u)), ly = LP.map((q, k) => q.y - (Array.isArray(LR) ? LR[k] : LR));
  const under = x => { for(let k = 0; k + 1 < lx.length; k++) if(x <= lx[k + 1]){ const f = Math.max(0, (x - lx[k])/(lx[k + 1] - lx[k])); return ly[k] + (ly[k + 1] - ly[k])*f; } return ly[ly.length - 1]; };
  const trunkR = y => { const q = ctr.clone().addScaledVector(u, tr[2]*2); q.y = y; trunk.project(q); return Math.hypot(q.x - ctr.x, q.z - ctr.z); };
  // the corner: on the bark, just under the limb. Frame: down the trunk, a sagging arc out to the limb, back along its underside
  const Rw = 5.5, xK = trunkR(LP[0].y)*.99, yK = under(xK) - .04, xe = xK + Rw*.95, aL = Math.atan2(under(xe) - yK, xe - xK);
  const pts = [[xK, yK], [xK, yK - Rw]];
  for(let k = 1; k < 9; k++){ const a = -Math.PI/2 + (aL + Math.PI/2)*k/9, r = Rw*(.97 + rr2(-.02, .02)); pts.push([xK + Math.cos(a)*r, yK + Math.sin(a)*r]); }
  const xE = xK + Math.cos(aL)*Rw; pts.push([xE, under(xE) - .03]);
  for(let k = 3; k >= 1; k--){ const x = xK + (xE - xK)*k/4; pts.push([x, under(x) - .03]); }
  const m = (-Math.PI/2 + aL)/2, cx = xK + Math.cos(m)*Rw*.42, cy = yK + Math.sin(m)*Rw*.42;
  const C = ctr.clone().addScaledVector(u, cx); C.y = cy;
  const F2 = pts.map(([x, y]) => [x - cx, y - cy]), R = Math.max(...F2.map(([x, y]) => Math.hypot(x, y)));
  const O = {C, n, u, R, corner: true, trunk, limb};
  O.g = hot(new THREE.Group(), .3); scene.add(O.g);
  buildOrbWeb(O, O.g, F2, rr2, rn); tagSilk(O.g);
  return O;
})();
const WEB2 = ARG2 && webSurface(ARG2);
const ARGI2 = ARG2 && addPrey({kind:'argiope', name:'Argiope · St Andrew’s Cross spider', m: makeArgiope(), plat: WEB2, pos: ARG2.C.clone(), state:'hub', wary: 0, fwd: new V3(0, -1, 0), orb: ARG2});
if(ARG2){ WEB2.silk = ARGI2; Object.assign(ARG2, {S: WEB2, spider: ARGI2}); ORBS.push(ARG2); }

// the spiders added later each draw on their own random stream (both the world's and the textures'), so the seeded
// world generated after them is unchanged
function ownStream(s, f){ const s0 = seed, t0 = texSeed; seed = s; texSeed = s + 7; try { return f(); } finally { seed = s0; texSeed = t0; } }
// ---- more spitting spiders, up on the higher leaves
const SCY2 = ownStream(51511, () => [PLAT[9], PLAT[10], PLAT[11]].map(pl => {
  scytodesWeb(pl);
  const home = randomIn(pl, .4);
  const p = addPrey({kind:'scytodes', name:'Scytodes pallida · spitting spider', m: makeScytodes(), plat: pl, home, pos: home.clone(), yaw: rnd()*6.28, state:'idle'});
  p.want = p.yaw; pl.silk = p; return p;
}));
// ---- a second house spider, up a young tree: its retreat in a crack in the bark about 9 up, the lacy sheet slung
// out from the trunk toward the clearing and tied to the bark above
const BAD2 = ownStream(72733, () => {
  const tr = TREE_LIST.find(([x, z]) => Math.hypot(x - 14, z - 3) < .01); if(!tr) return null;
  const trunk = CLIMBS.find(S => S.tree && !S._pts && S.cx === tr[0] && S.cz === tr[1]); if(!trunk) return null;
  const ctr = new V3(tr[0], 0, tr[1]), out = new V3(-tr[0], 0, -tr[1]).normalize(), y = hAt(tr[0], tr[1]) + 9;
  const q = ctr.clone().addScaledVector(out, tr[2]*2); q.y = y; trunk.project(q);
  const sd = ctr.clone().sub(q).setY(0).normalize(), ax = new V3().crossVectors(sd, UP).normalize();
  const mouth = q.clone().addScaledVector(sd, .02), RX = 1.35, RZ = 1.25, center = mouth.clone().addScaledVector(sd, -(RX + .02)); center.y = mouth.y - .04;
  const plat = {id:'WEB-B2', kind:'web', x:center.x, y:center.y, z:center.z, rx:RX, rz:RZ, rot: Math.atan2(-sd.z, sd.x)};
  PLAT.push(plat);
  const B = {ax, sd, mouth, plat, bark: trunk, high: true}; badumnaWeb(B);
  B.spider = addPrey({kind:'badumna', name:'Badumna longinqua · grey house spider', m: makeBadumna(), site: B, plat, pos: mouth.clone(), yaw: 0,
    state:'retreat', pref: 'fly', interest: 0, rush: 0, sulk: 0, known: false, peekT: 0});
  plat.silk = B.spider; return B;
});
const BAD_SITES = [BAD, BAD2].filter(Boolean);
// ---- the garden orb-weavers up in the air (life.js BUILDERS). Each spins its web slowly: radii, then the sticky spiral
// turn by turn, finished in ten minutes; five minutes after one starts, the next one starts, and so on round. It rests
// at the hub on the finished web, takes it down and begins again. The web is walkable only as far out as it is spun
const SPIN = {radii: 120, done: 600, down: 840, cycle: 900, gap: 300};
const ARAN = ownStream(91919, () => BUILDERS.map((B, i) => {
  const O = {C: B.C, n: B.n, u: B.u, R: B.R, g: B.g, B, walk: 0, builder: true};
  O.edge = () => O.walk;
  const S = webSurface(O);
  const p = addPrey({kind:'araneus', name:'Araneus · garden orb-weaver', m: B.m, plat: S, pos: B.C.clone(), state:'hub', fwd: new V3(0, -1, 0), orb: O,
    bt: ((-i*SPIN.gap) % SPIN.cycle + SPIN.cycle) % SPIN.cycle});
  S.silk = p; Object.assign(O, {S, spider: p}); ORBS.push(O); return p;
}));

// mimicry signals Portia can pluck into silk
const PLUCKS = [
  {id:'midge', name:'tiny midge', glyph:'⠁   ⠂   ⠁'},
  {id:'fly',   name:'struggling fly', glyph:'⣿⡇⣷⣿'},
  {id:'calm',  name:'calming taps', glyph:'⠂  ⠂'}
];
let pluckIdx = 0;
const wind = {gust: 0, next: 5, end: 0};
function updateWind(dt, t){
  if(t > wind.next){ wind.end = t + rr(2.2, 4); wind.next = wind.end + rr(5, 12); }
  const target = t < wind.end ? 1 : 0;
  wind.gust += (target - wind.gust)*(1 - Math.exp(-(target ? 2.5 : 1.2)*dt));
}
const onSilkOf = p => ((sp.mode === 'ground' || sp.mode === 'climb') && sp.plat && sp.plat.silk === p) || (sp.mode === 'hang' && sp.anchorPlat && sp.anchorPlat.silk === p);
const preyNoise = p => onSilkOf(p) ? sp.noise : 0;
const preyPluck = p => sp.plucking && sp.plat && sp.plat.silk === p ? PLUCKS[pluckIdx].id : null;

// slab: also count a point just off the sheet (moving along it). Not when she started in the sheet's own plane (the leaf at
// its frame): then only a true pass through it counts, or every leap along the web would snag at its near edge
// (inOrbPlane gives the orb whose plane q lies in, or null)
const inOrbPlane = q => ORBS.find(O => { const d = q.clone().sub(O.C).sub(O.g.position); return Math.abs(d.dot(O.n)) < .12 && d.addScaledVector(O.n, -d.dot(O.n)).length() < O.R*1.4; }) || null;
// a leap from inside the orb's plane runs along the sheet: it takes hold only where she aimed on it (goal), never on the way
// Every orb is tried; a hit comes back as a point carrying .orb. inPlane: the orb she launched from the plane of
function orbHit(a, b, inPlane, goal){
  for(const O of ORBS){ const h = orbHit1(a, b, inPlane === O, goal, O); if(h){ h.orb = O; return h; } }
  return null;
}
function orbHit1(a, b, inPlane, goal, O){
  if(!inPlane) return orbContact1(a, b, true, O);
  if(!goal || b.distanceTo(goal) > .35) return null;
  const C = O.C.clone().add(O.g.position), r = b.clone().sub(C), h = r.dot(O.n); if(Math.abs(h) > .14) return null;
  r.addScaledVector(O.n, -h); return r.length() < O.edge(Math.atan2(r.y, r.dot(O.u))) ? C.add(r) : null;
}
function orbContact(a, b, slab = true){
  for(const O of ORBS){ const h = orbContact1(a, b, slab, O); if(h){ h.orb = O; return h; } }
  return null;
}
function orbContact1(a, b, slab, O){
  const {n, u} = O, C = O.C.clone().add(O.g.position), da = a.clone().sub(C).dot(n), db = b.clone().sub(C).dot(n);
  let hit = null;
  if((da > 0) !== (db > 0)) hit = a.clone().lerp(b, da/(da - db));
  else if(slab && Math.abs(db) < .05) hit = b.clone();
  if(!hit) return null;
  const r = hit.clone().sub(C); r.addScaledVector(n, -r.dot(n));
  return r.length() < O.edge(Math.atan2(r.y, r.dot(u))) ? hit : null;     // out to the real frame, not a circle inside it
}
function webPoint(q, maxR, O = ARG){               // the nearest point on O's sheet, kept inside its frame
  const {C, u, n} = O, r = q.clone().sub(C); let a = r.dot(u), b = r.y; const L = Math.hypot(a, b), lim = Math.min(maxR, O.edge(Math.atan2(b, a))*.92);
  if(L > lim){ a *= lim/L; b *= lim/L; }
  return C.clone().addScaledVector(u, a).add(new V3(0, b, 0)).addScaledVector(n, .01);
}
function stepToward(p, target, speed, dt, plat){
  const dx = target.x - p.pos.x, dz = target.z - p.pos.z, L = Math.hypot(dx, dz);
  if(L < 1e-3) return 0;
  let st = Math.min(L, speed*dt);
  if(p.m.userData.parts.inited){ st *= .3 + .7*gaitSupport(p.m); st *= gaitLimit(p.m, new V3(dx/L*st, 0, dz/L*st)); }
  const nx = p.pos.x + dx/L*st, nz = p.pos.z + dz/L*st;
  if(!plat || inPlat(plat, nx, nz, .08)){ p.pos.x = nx; p.pos.z = nz; }
  p.yaw = gaitTurn(p.m, p.yaw, lerpAngle(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8*dt))); p.phase += st*40;
  return L;
}
function argMove(p, target, speed, dt, dash){   // dash: a strike, not a walk; the legs trail rather than set the pace
  const d = target.clone().sub(p.pos), L = d.length();
  if(L < .01) return L;
  let st = Math.min(L, speed*dt);
  if(p.m.userData.parts.inited && !dash){ st *= .3 + .7*gaitSupport(p.m); st *= gaitLimit(p.m, d.clone().multiplyScalar(st/L)); }
  p.pos.addScaledVector(d, st/L);
  p.fwd.lerp(d.normalize(), 1 - Math.exp(-6*dt)); p.phase += st*35;
  return L;
}
const gums = [];
function stickInWeb(pt, O = ARG){
  sp.stuck = 4.5; sp.stuckKind = 'web'; sp.stuckPos = pt.clone(); sp.stuckOrb = O; sp.pos.copy(pt); sp.vel.set(0, 0, 0); sp.charging = false; sp.leapHit = null;
  pulses.push({pos: pt.clone(), amp: 1.3, decay: 2});
  const p = O.spider;   // a moment to feel where the struggle is (longer when it must first climb back up its dragline)
  if(p && !p.dead){ p.wrapDelay = p.state === 'drop' ? 1.4 : .9; p.state = 'wrap'; }
  toast('Caught in the sticky spiral! Tap WASD to struggle free before it reaches you.');
}
// Argiope's orb is sticky between the hub and the frame: a leap that comes down in it, rather than onto the spider or the
// frame threads at the rim, is glued fast. Leaps taken from on the web itself (she knows her footing) are spared.
const STICKY_OUT = .7;   // the sticky spiral reaches this fraction of the way out to the frame
function onOrbRim(O, q){   // is q out on the dry frame band, beyond the sticky spiral?
  const C = O.C.clone().add(O.g.position), r = q.clone().sub(C); r.addScaledVector(O.n, -r.dot(O.n));
  return r.length() > O.edge(Math.atan2(r.y, r.dot(O.u)))*STICKY_OUT;
}
// She takes hold of the sheet as on any landing (same face, same stance as walking on it), and there she is pinned
function webGlue(O, pt, prev, vel){
  const p = O.spider; if(!p || p.dead || p.kind !== 'argiope' || sp.leftFrom === O.S || onOrbRim(O, pt)) return false;
  const W = O.S; enterClimb(W, pt.clone(), vel.clone(), W.sideFrom(prev, vel));
  stickInWeb(sp.pos.clone(), O); return true;
}
function knockOff(){
  if(DOOM.t >= 0) return;                        // she is already dead where she fell
  if(sp.mode === 'ground' && !sp.plat.ground){ startAir(); const a = rnd()*6.28; sp.vel.set(Math.cos(a)*1.4, 1.4, Math.sin(a)*1.4); }
  else if(sp.mode === 'climb'){ const n = sp.plat.normal(sp.pos); startAir(); sp.vel.copy(n).multiplyScalar(1.6); sp.vel.y += .4; sp.climbGrace = .5; }
}
function hurt(amount, msg){
  if(DOOM.t >= 0) return;
  sp.vigor -= amount; toast(msg); pulses.push({pos: sp.pos.clone(), amp: 1.2, decay: 2});
  if(sp.vigor <= 0) die();
}
// a fatal bite: the same fade as the mantis kill (predators.js), with Portia dying where she was bitten. The
// spider whose update dealt the bite (KILLER_NOW) stays to feed on her
let KILLER_NOW = null;
function die(by = KILLER_NOW){ doomStart(null); wrapClear();
  if(by && !by.dead){ DOOM.killer = by; DOOM.lag = 1.6; DOOM.eatT = 0;
    if(WRAPPERS.has(by.kind)){ DOOM.lag = WRAP_T; wrapStart(); } } }   // the fade comes as the wrapping ends: she goes out a white bundle
const WRAPPERS = new Set(['argiope', 'badumna']);   // web spiders that swathe what they kill before feeding
// ---- the orb-weaver swathes what it kills before it feeds: rocking over the body, it draws silk from its
// spinnerets and throws it round her band on band, end to end, until she is a pale bundle. Then the bite and the drain.
// The cocoon is one long line in her body's frame, so it rides her death curl; it is revealed a little at a time.
const WRAP_T = 4.5, WRAP_N = 1400;
function wrapStart(){
  const S = sp.m.userData.parts, B = S.body; sp.m.updateMatrixWorld(true);
  const a = B.worldToLocal(S.head.getWorldPosition(new V3())), b = B.worldToLocal(S.abd.getWorldPosition(new V3()));
  const ax = b.clone().sub(a), L = Math.max(.02, ax.length()); ax.normalize();
  const e1 = new V3(0, 1, 0).addScaledVector(ax, -ax.y); if(e1.lengthSq() < 1e-4) e1.set(1, 0, 0).addScaledVector(ax, -ax.x); e1.normalize();
  const e2 = new V3().crossVectors(ax, e1), p0 = a.clone().addScaledVector(ax, -.4*L), span = 1.9*L, R = .5*L, pts = [];
  let th = 0;
  for(let i = 0; i < WRAP_N; i++){
    const u = i/(WRAP_N - 1), s = .5 - .5*Math.cos(u*Math.PI*21);   // sweeps end to end and back, layer over layer
    th += .5 + rnd()*.3;
    const r = R*Math.sqrt(Math.max(.06, 1 - (2*s - 1)**2))*(1 + .2*u + .1*(rnd() - .5));
    pts.push(p0.clone().addScaledVector(ax, s*span).addScaledVector(e1, Math.cos(th)*r).addScaledVector(e2, Math.sin(th)*r));
  }
  const ln = hot(new THREE.Line(segsFrom(pts), silkM(.9, 0xfbf8ee)), .3); ln.geometry.setDrawRange(0, 0); ln.frustumCulled = false;
  const thread = hot(new THREE.Line(segsFrom([new V3(), new V3()]), silkM(.75)), .3); thread.frustumCulled = false; thread.visible = false;
  // the silk film: as the bands pile up they close into a pale skin over her, thickening until she is hidden
  const shroud = hot(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({color:0xf4efe2, roughness:.9, transparent:true, opacity:0, depthWrite:false})), .3);
  shroud.position.copy(p0).addScaledVector(ax, span/2); shroud.quaternion.setFromUnitVectors(new V3(0, 0, 1), ax); shroud.scale.set(R*1.3, R*1.3, span*.56);
  B.add(ln, shroud); scene.add(thread); drawables.push(ln, thread, shroud);
  DOOM.wrap = {ln, thread, shroud, pts, t: 0, spin: 0, L, R};
}
// her body during the wrap: turned crosswise on the silk, lifted a little in its legs, and rolled about her long axis
// like a spit while the bands go on; she keeps the last angle once it stops. Called after corpseTick has posed her.
const sstepH = (a, b, x) => { x = Math.max(0, Math.min(1, (x - a)/(b - a))); return x*x*(3 - 2*x); };
function wrapCorpsePose(){
  const W = DOOM.wrap; if(!W) return;
  const P = sp.m.userData.parts, k = sstepH(0, .45, W.t), q0 = sp.m.quaternion.clone();
  const c = P.body.position.clone(), pivot = sp.m.position.clone().add(c.clone().applyQuaternion(q0));
  // crosswise: her long axis square across the line to the orb-weaver, her back still to the silk's normal side
  const up = new V3(0, 1, 0).applyQuaternion(q0), K = DOOM.killer;
  const toK = K ? K.m.userData.parts.body.getWorldPosition(new V3()).sub(pivot) : new V3(1, 0, 0).applyQuaternion(q0);
  toK.addScaledVector(up, -toK.dot(up)); if(toK.lengthSq() < 1e-8) toK.set(1, 0, 0).applyQuaternion(q0); toK.normalize();
  const kf = K ? new V3(0, 0, -1).applyQuaternion(K.m.quaternion) : toK.clone();   // square to the way it faces, not just the line to it
  kf.addScaledVector(up, -kf.dot(up)); if(kf.lengthSq() < 1e-8) kf.copy(toK); kf.normalize();
  const z = new V3().crossVectors(up, kf); if(z.dot(new V3(0, 0, 1).applyQuaternion(q0)) < 0) z.negate();   // the nearer way round
  M4.makeBasis(new V3().crossVectors(up, z), up, z);
  const baseQ = q0.clone().slerp(new THREE.Quaternion().setFromRotationMatrix(M4), k);
  const q = baseQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), W.spin));
  sp.m.quaternion.copy(q);
  if(K && K.orb){
    // an orb-weaver turns her in front of its face: drawn in off the silk to just beyond its fangs, at her own height off the sheet
    const f = argFace(K), fw = new V3(0, 0, 1).applyQuaternion(K.m.quaternion); fw.addScaledVector(up, -fw.dot(up)).normalize();
    const tgt = f.addScaledVector(fw, W.R*1.4); tgt.addScaledVector(up, pivot.clone().sub(tgt).dot(up));
    pivot.lerp(tgt, k).addScaledVector(up, k*c.y*.6);
  } else pivot.addScaledVector(up, k*c.y*.6).addScaledVector(toK, -k*.06);   // lifted a little, and held out at the end of its legs
  sp.m.position.copy(pivot).sub(c.applyQuaternion(q));
  W.pivot = pivot; W.baseQ = baseQ;   // her frame, unrolled
}
// rolling her is legwork, hand over hand: on each stroke one front leg (left, then right) reaches off the silk, hooks
// her near side and yanks it round, then lets go and goes back to its foothold. Between pulls she keeps rolling,
// slowly, as the other legs keep her turning: fast, slow, fast, slow. Strokes differ in length and pace.
function strokeTick(W, dt){
  const S = W.sk || (W.sk = {i: 0, t: -.45, D: .45, A: 1.3, base: 0, pull: 0, u: 0, drift: 0});   // the first waits for her to be turned
  S.t += dt;
  if(S.t >= S.D){ S.base += S.A; S.i++; S.t = 0; S.D = rr(.35, .6); S.A = rr(.9, 1.7); }
  S.u = Math.max(0, S.t)/S.D; S.pull = S.t < 0 ? 0 : sstepH(.18, .68, S.u);
  if(S.i || S.t > 0) S.drift += dt*1.1;               // the slow roll between pulls
  W.spin = S.base + S.A*S.pull + S.drift;
}
function wrapLegs(p){
  const W = DOOM.wrap, S = W && W.sk; if(!S || S.t < 0 || !W.pivot) return;
  const A = p.m.userData.parts, side = S.i % 2 ? 1 : -1, L = A.legs.find(l => l.k === 0 && l.side === side);
  if(!L || !L.foot) return;
  p.m.updateMatrixWorld(true);
  const w = sstepH(0, .2, S.u)*(1 - sstepH(.7, .95, S.u));          // out to her, hold through the pull, back to the silk
  const toA = A.body.getWorldPosition(new V3()).sub(W.pivot).applyQuaternion(W.baseQ.clone().invert());
  const ang = Math.atan2(toA.y, toA.x) - S.A*.5 + S.A*S.pull;         // hooks her short of the near side and drags it past
  const grip = new V3(Math.cos(ang)*W.R*1.15, Math.sin(ang)*W.R*1.15, side*.3*W.L).applyQuaternion(W.baseQ).add(W.pivot);
  const foot = L.foot.clone().lerp(grip, w).addScaledVector(grip.clone().sub(W.pivot).normalize(), .02*Math.sin(Math.PI*sstepH(0, .22, S.u)));   // a little lift as it reaches in
  legIK(L, A.body.worldToLocal(foot));
}
// the orb-weaver's abdomen while it wraps: bent up at the waist and swung part way toward her, its tip circling as it
// pays out silk. Pivots at the pedicel; the rest pose is kept to restore
function wrapAbdomen(p, t, on){
  const A = p.m.userData.parts, abd = A.abd;
  if(!abd.userData.rest){ abd.geometry.computeBoundingBox(); abd.userData.rest = {p: abd.position.clone(), q: abd.quaternion.clone(), al: abd.geometry.boundingBox.max.z}; }
  const R = abd.userData.rest;
  if(!(on > 0)){ abd.position.copy(R.p); abd.quaternion.copy(R.q); return; }
  const pv = R.p.clone(); pv.z += R.al*.9;                              // the waist, just behind the carapace
  const a0 = R.p.clone().sub(pv).normalize();
  const tgt = A.body.worldToLocal(sp.m.userData.parts.body.getWorldPosition(new V3())).sub(pv).normalize();
  const side = new V3().crossVectors(a0, new V3(0, 1, 0)).normalize();
  const d = a0.clone().addScaledVector(tgt, .45)   // held low, tip a little toward her
    .addScaledVector(side, .035*Math.cos(t*9)).addScaledVector(new V3(0, 1, 0), .02*Math.sin(t*9)).normalize();   // a small weave
  const qd = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(a0, d), on);
  abd.quaternion.copy(qd).multiply(R.q); abd.position.copy(pv).add(R.p.clone().sub(pv).applyQuaternion(qd));
}
function wrapTick(p, dt){
  const W = DOOM.wrap; W.t += dt;
  strokeTick(W, dt);
  const n = Math.min(WRAP_N, Math.floor(W.t/WRAP_T*WRAP_N)); W.ln.geometry.setDrawRange(0, n);
  W.shroud.material.opacity = .9*sstepH(.25, 1, W.t/WRAP_T);
  // the live strand: from its spinnerets (the tip of its abdomen) to the newest turn
  const A = p.m.userData.parts, R = A.abd.userData.rest;
  const spin = A.abd.localToWorld(new V3(0, 0, -(R ? R.al : .1)*.98)), tip = sp.m.userData.parts.body.localToWorld(W.pts[Math.max(0, n - 1)].clone());
  W.thread.geometry.setFromPoints([spin, tip]); W.thread.visible = W.t < WRAP_T;
}
function wrapClear(){
  const W = DOOM.wrap; if(!W) return;
  W.ln.removeFromParent(); scene.remove(W.thread);
  W.shroud.removeFromParent();
  for(const o of [W.ln, W.thread, W.shroud]){ const i = drawables.indexOf(o); if(i >= 0) drawables.splice(i, 1); o.geometry.dispose(); }
  if(DOOM.killer){ DOOM.killer.m.userData.parts.body.rotation.z = 0; if(WRAPPERS.has(DOOM.killer.kind)) wrapAbdomen(DOOM.killer, 0, 0); }
  DOOM.wrap = null;
}
// an orb-weaver's face: how far ahead of its origin the front of its carapace sits, and that point in the world
function argFaceZ(p){ const A = p.m.userData.parts; if(A.faceZ == null){ A.cara.geometry.computeBoundingBox(); A.faceZ = A.cara.position.z + A.cara.geometry.boundingBox.max.z; } return A.faceZ; }
function argFace(p){ const A = p.m.userData.parts; p.m.updateMatrixWorld(true); return A.body.localToWorld(new V3(0, 0, argFaceZ(p))); }
// the killer walks up to the corpse, fangs to it, and feeds, head dipping as it chews
const EAT_D = .13;
const eatD = p => p.kind === 'badumna' ? .2 : EAT_D;   // the house spider is much bigger than her: its fangs reach further out
function eatCorpse(p, dt){
  const at = DOOM.at, EAT_D = eatD(p);
  let d;
  if(p.kind === 'argiope'){                         // along its own silk, to the point nearest her, its face a jaw's length short
    const reach = argFaceZ(p) + EAT_D, O = p.orb;
    const aim = webPoint(at.clone().add(p.pos.clone().sub(at).setLength(reach)), O.R, O);
    p.motion = argMove(p, aim, .5, dt, true) > .02 ? .4 : 0; d = p.pos.distanceTo(at) - argFaceZ(p);   // no gait limit: a leg at full stretch must not stall it a step short of her
    const to = at.clone().sub(O.g.position).sub(p.pos); to.addScaledVector(O.n, -to.dot(O.n));   // and turned to face her
    if(to.lengthSq() > 1e-6) p.fwd.lerp(to.normalize(), 1 - Math.exp(-6*dt));
  } else { d = Math.hypot(at.x - p.pos.x, at.z - p.pos.z);
    if(d > EAT_D){                                  // straight to her: the legs catch up (no gait limit, so it can't stall)
      const st = Math.min(d - EAT_D, .3*dt); p.pos.x += (at.x - p.pos.x)/d*st; p.pos.z += (at.z - p.pos.z)/d*st;
      p.yaw = lerpAngle(p.yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z), 1 - Math.exp(-8*dt)); p.phase += st*40; p.motion = .4; }
    else { p.motion = 0; p.yaw = lerpAngle(p.yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z), 1 - Math.exp(-6*dt)); } }
  if(DOOM.eatT > 0 || d <= EAT_D + .04){             // out of reach (she fell off its silk), it just waits
    if(DOOM.wrap && DOOM.wrap.t < WRAP_T) wrapTick(p, dt);    // the orb-weaver wraps her first
    else { if(DOOM.wrap){ DOOM.wrap.thread.visible = false; DOOM.wrap.t += dt; strokeTick(DOOM.wrap, dt); }   // still turning her as the light goes
      DOOM.eatT += dt; } }
  p.vib = 0;
}
function eatPose(p, t){
  const P = p.m.userData.parts, W = DOOM.wrap;
  const on = W && W.t > 0 ? sstepH(0, .3, W.t)*(1 - sstepH(WRAP_T, WRAP_T + .4, W.t)) : 0;
  if(W && W.t > 0 && W.t < WRAP_T){                 // leaning into each pull as it throws the silk
    const S = W.sk; P.body.rotation.z = S ? .05*(S.i % 2 ? 1 : -1)*Math.sin(Math.PI*S.pull) : 0; P.body.rotation.x = -.14; }   // head up, abdomen down
  else { if(W) P.body.rotation.z = 0; if(DOOM.eatT > 0){ const k = Math.min(1, DOOM.eatT*2); P.body.rotation.x = k*(.22 + .1*Math.max(0, Math.sin(t*5.5))); } }
  if(W && WRAPPERS.has(p.kind)){
    // it stands up tall on its legs, so the abdomen can curl down and forward with its spinnerets to her
    P.body.position.y += WRAP_RISE*(P.s/1.7)*on; p.m.updateMatrixWorld(true);   // scaled to its size (the orb-weaver's s is 1.7)
    if(on > 0) for(const L of P.legs) if(L.foot && !L.free) legIK(L, P.body.worldToLocal(L.foot.clone()));   // feet stay on the silk
    wrapAbdomen(p, t, on); wrapLegs(p);              // still rolling her as it feeds, into the fade
  }
}
const WRAP_RISE = .06;
function killPrey(p){
  p.dead = true; p.deadT = 0; p.state = 'dead'; p.drain = 0; p.flip = 0; sp.caught++;
  pulses.push({pos: p.pos.clone(), amp: 1.4, decay: .7});
  toast({scytodes: 'You drop onto it from behind — it never turned. Fangs in, venom pumping.',
         badumna: 'You leap onto the house spider on its own sheet — fangs in, venom pumping.',
         argiope: 'You land on it in the orb — fangs in, venom pumping.',
         araneus: p.orb && p.orb.walk < .3 ? 'You snatch it off its half-spun threads — fangs in, and you fall together.' : 'You take the orb-weaver on its own web — fangs in, venom pumping.'}[p.kind]);
}
// ---- the kill is a leap: land on a spider and bite. A burst of rapid fang strokes pumps the venom in; then she
// seizes it in her front legs and palps, lifts it off its feet in her fangs, and drains it over 5 s, the body
// shrivelling as she sucks; then she lets the husk drop. The hunger it fills comes with the draining, not the bite.
const BITE_T = .55, GRAB_T = .45, DRAIN_T = 5, FEED_T = BITE_T + GRAB_T + DRAIN_T;
const HOLD_D = .19;                                // her stance sits this far behind where the prey stood
function preyAt(pos, r){ let best = null, bd = r; for(const p of [...PREY, male]){ if(p.dead || (p === male && !maleIsPrey())) continue; const d = p.m.userData.parts.body.getWorldPosition(new V3()).distanceTo(pos); if(d < bd){ bd = d; best = p; } } return best; }
function pounce(p){
  if(sp.stuck > 0) return false;
  if(p.kind === 'scytodes' && angDiff(p.yaw, Math.atan2(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z)) < .6){ spit(p); return false; }   // at its face: spat on
  if(p.kind === 'badumna' && (p.state === 'retreat' || p.state === 'peek')) return false;
  if(p.kind === 'argiope' && p.state === 'drop') return false;   // already falling away on its dragline
  if(p.kind === 'argiope' && p.state === 'pump'){ toast('The web is bucking — you cannot get a grip.'); return false; }
  if(p.kind === 'argiope' && p.state === 'lunge'){ toast('It meets you fangs-first.'); die(p); return false; }
  if(p === male){                                  // the spent suitor: no defence but flight
    p.dead = true; p.deadT = 0; p.drain = 0; p.flip = 0; sp.caught++; endBalloon();
    pulses.push({pos: p.pos.clone(), amp: 1.4, decay: .7}); AUDIO.sfx.bite(); toast('You turn on your mate. Fangs in, venom pumping.');
    startFeed(p, null, p.plat, HOLD_D, .8); return true;
  }
  killPrey(p); endBalloon();
  // the face she bites from: the one she is on, or leapt from; a leap along the web can drift through its plane
  // before it reaches her, and that mustn't flip her onto the far face
  const O = p.orb, fromWeb = O && (sp.plat === O.S || (sp.mode === 'air' && sp.leftFrom === O.S));
  // an orb-weaver caught where its web is not yet spun (out on a bare radius): nothing holds her, and she falls with it
  if(O && O.edge(0) < .3){ const F = startFeed(p, UP.clone(), null, HOLD_D, .55); F.fall = new V3(); F.midair = true; p.airborne = true; return true; }
  const up = O ? O.n.clone().multiplyScalar(fromWeb ? O.S.side : Math.sign(sp.pos.clone().sub(p.m.getWorldPosition(new V3())).dot(O.n)) || 1) : null;
  const F = startFeed(p, up, O ? null : p.plat, HOLD_D, .55);
  if(p.kind === 'badumna') F.base.y = Math.max(F.base.y, F.p0.y);
  return true;
}
// the bite, for spider or fly alike. Her stance: on the prey's own surface, just behind it, facing it along the
// line she came in on. gain: the hunger the drain fills
function startFeed(p, up, plat, holdD, gain){
  const q0 = p.m.getWorldQuaternion(new THREE.Quaternion()), p0 = p.m.getWorldPosition(new V3());
  // on bark, stone or under a leaf (climbing it, or a fly snatched from the air just off it, or just after leaping
  // from it): she feeds braced on that surface, its normal her up, and climbs on from there afterwards; the view
  // stays tilted to her through the meal (camFrame)
  let bark = null;
  if(!p.orb){
    // a leaf's underside only from below the blade: its solid takes in the top face too
    const below = S => !S.thin || !S.top || sp.pos.y < surfAt(S.top, sp.pos.x, sp.pos.z) - LEAF_TH*.5;
    const near = S => { const q = sp.pos.clone(); S.project(q); return q.distanceTo(sp.pos) < .25; };
    if(sp.mode === 'climb' && sp.plat && !sp.plat.web) bark = sp.plat;
    else if(p.fly && sp.mode !== 'ground'){
      const L = sp.leftFrom;
      bark = climbsNear(sp.pos.x, sp.pos.z, .3).find(S => !S.web && S.inside(sp.pos, .08) && below(S))
        || (L && L.kind === 'climb' && !L.web && (sp.airT || 0) < .4 && below(L) && near(L) ? L : null);
    }
    if(bark){ up = bark.normal(sp.pos).clone().normalize(); plat = null; }
  }
  if(!up) up = UP.clone().applyQuaternion(q0);
  const flat = v => v.addScaledVector(up, -v.dot(up));
  let fw = flat(p0.clone().sub(sp.pos));
  if(fw.lengthSq() < 1e-6) fw = flat(new V3(0, 0, 1).applyQuaternion(q0));
  fw.normalize();
  const base = p0.clone().addScaledVector(fw, -holdD);
  if(bark) bark.project(base);
  if(plat){ const [x, z] = clampTo(plat, base.x, base.z); base.set(x, surfY(plat, x, z), z); }
  sp.feed = {p, t: 0, base, up, fw, q0, p0, venT: 0, gain, bark}; p.held = true; p.limp = 0; p.hl = 1; p.drain = 0;
  sp.mode = 'feed'; sp.vel.set(0, 0, 0); sp.charging = false; sp.braked = false; sp.committed = false; sp.plop = false; sp.aimPrey = null;
  return sp.feed;
}
const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3 - 2*x); };
function feedTick(dt){
  const F = sp.feed, p = F.p, P = p.m.userData.parts, S = sp.m.userData.parts; F.t += dt;
  if(F.fall){                                                            // caught mid-leap: she falls with her prey until she lands
    const prev = F.base.clone(); F.fall.y -= G*dt; const d = F.fall.clone().multiplyScalar(dt); F.base.add(d); F.p0.add(d);
    const L = findLanding(prev, F.base);
    if(L){ const [x, z] = clampTo(L, F.base.x, F.base.z), y = surfY(L, x, z); F.p0.y += y - F.base.y; F.base.set(x, y, z);
      F.fall = null; p.airborne = false; p.plat = L; pulses.push({pos: F.base.clone(), amp: .9, decay: 3}); }
  }
  const biting = F.t < BITE_T, lift = smooth01((F.t - BITE_T)/GRAB_T), k = Math.max(0, Math.min(1, (F.t - BITE_T - GRAB_T)/DRAIN_T));
  // her body: braced on the surface, lunging forward and down onto the prey for the bite, rearing back a little as she lifts it
  M4.makeBasis(new V3().crossVectors(F.up, F.fw), F.up, F.fw); sp.m.quaternion.setFromRotationMatrix(M4);
  const lunge = biting ? smooth01(F.t/.12) : 1 - lift;
  sp.pos.copy(F.base).addScaledVector(F.fw, .05*lunge); sp.m.position.copy(sp.pos); sp.speed = 0;
  sp.m.rotateX(.32*lunge - .12*lift);
  gaitRelease(sp.m);
  const sip = Math.sin(time*5.5);                                        // the slow pump of sucking
  poseSpider(sp.m, {crouch: biting ? .9 : .55 - .25*lift, grab: biting ? smooth01(F.t/.25) : 1, bob: biting ? Math.sin(F.t*90)*.004 : sip*.0012, twitch: .04*sip*(1 - lunge)});
  animatePalps(S, 'grip', time, dt);
  // fangs: rapid strokes while the venom goes in, then sunk and held
  fangTick(S, biting ? .55 + .45*Math.abs(Math.sin(F.t*42)) : .85, dt, true);
  updateHair(sp.m, dt);
  // venom: each stroke a small shudder through the surface; the prey flares hot in her sight, then fades as it dies
  if(biting && (F.venT -= dt) <= 0){ F.venT = .075; pulses.push({pos: F.p0.clone(), amp: .35, decay: 9}); }
  p.hl = biting ? .7 + .3*Math.abs(Math.sin(F.t*42)) : Math.max(0, (p.hl || 0) - dt*1.2);
  hlTick(dt, null);
  // the prey: spasms under the bite, goes limp, then hangs from her fangs held in legs and palps
  p.deadT = 0; p.drain = Math.max(p.drain || 0, k); p.limp = biting ? 0 : Math.max(p.limp || 0, Math.min(1, .35 + k*1.4));
  sp.m.updateMatrixWorld(true);
  const tip = new V3(), w = new V3(); for(const f of S.fangs){ tip.add(f.drop.getWorldPosition(w)); } tip.multiplyScalar(1/S.fangs.length);
  const hfw = F.fw.clone(), U = hfw.clone().multiplyScalar(-.8).addScaledVector(F.up, .6).normalize();   // its back turned to her face
  const Z = F.up.clone().addScaledVector(U, -F.up.dot(U)).normalize();                                     // its head up, legs hanging away from her
  const sway = .06*Math.sin(time*1.3), Zs = Z.clone().applyAxisAngle(U, sway);
  M4.makeBasis(new V3().crossVectors(U, Zs), U, Zs); const qH = new THREE.Quaternion().setFromRotationMatrix(M4);
  const sc = 1 - .15*k, hb = (P ? P.body.position.y : .055)*sc, posH = tip.clone().addScaledVector(U, -((P ? .03*(P.s || 1) : .035)*sc + hb));
  p.m.position.copy(F.p0).lerp(posH, lift); p.m.quaternion.copy(F.q0).slerp(qH, lift);
  sp.hunger = Math.min(1, sp.hunger + (k > 0 && k < 1 ? dt*F.gain/DRAIN_T : 0)); sp.vigor = Math.min(1, sp.vigor + (k > 0 ? dt*.06 : 0));
  if(k >= 1) endFeed(true);                                             // no letting go early: she feeds to the end
}
// she opens her fangs and the husk drops: from her jaws to the surface beneath (to the forest floor, for Argiope)
function endFeed(drained){
  const F = sp.feed, p = F.p; sp.feed = null;
  p.held = false; p.limp = 1; p.drain = Math.max(p.drain || 0, .5);
  const at = p.m.position.clone();
  if(p.fly){                                     // the fly's husk drops to the leaf or log; a new fly comes in later
    const surf = p.airborne || !p.plat ? GROUND : p.plat, [x, z] = clampTo(surf, at.x, at.z), y = surfY(surf, x, z);
    leaveHusk(new V3(x, y, z), surf.ground ? TEMP.soil : TEMP.leaf, {fallH: Math.max(0, at.y - y - .09), drain: p.drain, yaw: Math.atan2(F.fw.x, F.fw.z) + rr(-.8, .8)});
    p.gone = true; p.m.visible = false; p.respawn = 7; p.state = 'walk'; p.drain = 0; flyLook(p, 0); p.m.rotation.set(0, 0, 0);
    if(F.bark){ enterClimb(F.bark, F.base.clone(), F.fw.clone()); }
    else if(p.airborne){ sp.mode = 'air'; sp.pos.copy(F.base); sp.vel.set(0, 0, 0); sp.m.rotation.set(0, Math.atan2(F.fw.x, F.fw.z), 0); }
    else { sp.mode = 'ground'; sp.plat = surf; sp.pos.copy(F.base); }
    sp.yaw = Math.atan2(F.fw.x, F.fw.z); p.airborne = false;
    toast(drained ? 'Drained. You let the shrivelled fly drop.' : 'You let the fly drop, half-drained.'); return;
  }
  if(F.midair && F.fall){                         // the meal ended still falling: let go of the husk and fly on
    p.dropped = true; p.airborne = false; p.pos.set(at.x, floorAt(at.x, at.z), at.z); p.fallH = Math.max(0, at.y - p.pos.y); p.fallV = 0; p.yaw = Math.atan2(F.fw.x, F.fw.z);
    sp.mode = 'air'; sp.pos.copy(F.base); sp.vel.set(0, 0, 0); sp.m.rotation.set(0, Math.atan2(F.fw.x, F.fw.z), 0); sp.yaw = Math.atan2(F.fw.x, F.fw.z);
    toast(drained ? 'Drained. You let the shrivelled husk drop.' : 'You let it drop, half-drained.'); return;
  }
  if(F.midair){ p.dropped = true; p.airborne = false; }   // fell with it and landed: the husk lies where she fed (p.plat, the landing)
  if(p.orb && !F.midair){ p.dropped = true; p.pos.set(at.x, floorAt(at.x, at.z), at.z); }
  else { const [x, z] = clampTo(p.plat, at.x, at.z); p.pos.set(x, surfY(p.plat, x, z), z); if(p.kind === 'badumna') p.pos.y = Math.max(p.pos.y, F.p0.y); }
  p.fallH = Math.max(0, at.y - p.pos.y); p.fallV = 0; p.yaw = Math.atan2(F.fw.x, F.fw.z) + rr(-.8, .8); p.flip = 0;
  // back onto the face she fed from. F.base is already in world space (it rides the sway): taking the sway off again
  // set her a few cm off the plane, and enterClimb's setSide then flipped her to whichever way the orb was swinging
  if(p.orb && !F.midair){ const S = p.orb.S, face = Math.sign(F.up.dot(p.orb.n)) || 1; enterClimb(S, F.base.clone(), F.fw.clone(), face); }
  else if(F.bark) enterClimb(F.bark, F.base.clone(), F.fw.clone());
  else { sp.mode = 'ground'; sp.plat = p.plat; sp.pos.copy(F.base); sp.yaw = Math.atan2(F.fw.x, F.fw.z); }
  toast(drained ? 'Drained. You let the shrivelled husk drop.' : 'You let it drop, half-drained.');
}
// landing near a spider counts as landing on it
function strike(){ const p = preyAt(sp.pos, .42); return !!p && pounce(p); }
function enterClimb(S, at, hint, side){   // side: the face the caller already settled on (a web); otherwise taken from `at`
  sp.leapHit = null;
  const was = sp.mode; if(was === 'air') landBounce(sp.vel);
  if(side) S.side = side; else if(S.setSide) S.setSide(at);
  if(S.web) S.lastOff = S.orb.g.position.clone();
  endBalloon();
  S.project(at); sp.pos.copy(at); sp.mode = 'climb'; sp.plat = S; sp.vel.set(0, 0, 0); sp.braked = false; sp.committed = false; sp.plop = false;
  const n = S.normal(at), h = hint ? hint.clone() : new V3(0, 1, 0), into = -h.dot(n);
  h.addScaledVector(n, -h.dot(n)).addScaledVector(S.intoDir || UP, into);   // pressing into the surface means "up" (round a leaf rim: under)
  if(h.lengthSq() < 1e-4) h.set(0, 1, 0);
  sp.climbHead = h.addScaledVector(n, -h.dot(n)).normalize();
  if(was !== 'climb' && !sp.roll){ cam.swingDir = sp.climbHead.clone(); cam.swingT = 0; cam.swing = null; }   // a new surface: look the way she climbs
}
// Portia walks the orb freely; at its frame she steps across onto whatever is within a short reach beyond it:
// the soil, a leaf or other top, or bark, stone and stems. Nothing in reach: the frame holds her
function webExit(q, t){
  const WEB = sp.plat;                              // the orb she is stepping off
  for(const r of [.08, .16, .24]){
    const a = q.clone().addScaledVector(t, r);
    if(a.y <= floorAt(a.x, a.z) + .06){ sp.mode = 'ground'; sp.plat = GROUND; sp.pos.set(a.x, floorAt(a.x, a.z), a.z); sp.yaw = Math.atan2(t.x, t.z); sp.climbGrace = .5; sp.handFrom = WEB; sp.handT = .6; return true; }
    for(const P of PLAT){ if(P.ground || !inPlat(P, a.x, a.z)) continue; const y = surfAt(P, a.x, a.z);
      if(Math.abs(a.y - y) < .1){ sp.mode = 'ground'; sp.plat = P; sp.pos.set(a.x, surfY(P, a.x, a.z), a.z); sp.yaw = Math.atan2(t.x, t.z); sp.handFrom = WEB; sp.handT = .6; return true; } }
    for(const S2 of climbsNear(a.x, a.z, .4)){
      if(S2.web || !S2.near(a)) continue;
      const h = a.clone(); S2.project(h); if(h.distanceTo(a) > .07) continue;
      sp.handFrom = WEB; sp.handT = .6; enterClimb(S2, h, t.clone()); return true;
    }
  }
  return false;
}
function climbHit(x, y, z, dir){
  for(const S of climbsNear(x, z, .5)) if(S.hit(x, y, z, dir)) return S;
  return null;
}
// X: no line → tie one here. Line just tied and she hasn't left the knot → let go and hang. In flight on a line →
// clamp it and hang where she is. Any other time there is a line (hanging, walked away, climbed back up to the
// knot) → cut it; the next X ties a fresh one.
function dropLine(){
  if(sp.stuck > 0) return;
  const onSurface = sp.mode === 'ground' || sp.mode === 'climb';
  if(sp.line){
    if(sp.lineFresh && onSurface && sp.pos.distanceTo(sp.anchor) < .3){ sp.lineFresh = false; dropOnLine(); }
    else if(sp.mode === 'air' && !sp.plop && sp.anchorPlat) catchLine();
    else cutLine();
    return;
  }
  if(!onSurface) return;
  if(sp.mode === 'ground' && sp.plat.ground){ toast('Nothing up here to tie silk to — fix a line on a leaf, log, stone or bark.'); return; }
  sp.line = true; sp.lineFresh = true; sp.anchor.copy(sp.pos); sp.anchorPlat = sp.plat; sp.ropeL = 0;
  pulses.push({pos: sp.pos.clone(), amp: .35, decay: 5});
  toast('Dragline tied — X again to let go and hang; after that X cuts it.');
}
// clamp the dragline mid-flight: the line stops paying out and she swings from it at the length it has now
function catchLine(){
  const d = sp.pos.distanceTo(sp.anchor);
  sp.braked = true; sp.mode = 'hang'; sp.leapHit = null; sp.charging = false; sp.lineFresh = false;
  sp.ropeL = Math.max(.4, Math.min(d, sp.anchor.y - floorAt(sp.anchor.x, sp.anchor.z) - .35));
  pulses.push({pos: sp.anchor.clone(), amp: .5, decay: 4});
  toast('You clamp the dragline and hang. W/S reel, A/D swing, SPACE leap, X cut.');
}
// let go onto the tied line. On a leaf or other top she pays the line out to the nearest rim and slips over it
// (the knot moves to the rim, so the silk never runs through the leaf); on bark she pushes off it; under a leaf
// or on the orb she simply drops
function dropOnLine(){
  const P = sp.plat, out = new V3();
  if(sp.mode === 'ground'){
    out.copy(platOut(P, sp.pos.x, sp.pos.z));
    if(out.lengthSq() < 1e-8) out.set(Math.sin(sp.yaw), 0, Math.cos(sp.yaw));   // dead centre: over the edge she faces
    out.normalize();
    let lo = 0, hi = 2*platR(P);
    for(let i = 0; i < 24; i++){ const m = (lo + hi)/2; if(inPlat(P, sp.pos.x + out.x*m, sp.pos.z + out.z*m)) lo = m; else hi = m; }
    const rx = sp.pos.x + out.x*lo, rz = sp.pos.z + out.z*lo;
    sp.anchor.set(rx, surfAt(P, rx, rz), rz);
    startAir();
    sp.pos.copy(sp.anchor).addScaledVector(out, .08); sp.pos.y -= .06;
    sp.yaw = Math.atan2(-out.x, -out.z);                                    // facing back in, toward the leaf she left
  } else {
    const n = P.normal(sp.pos), thin = P.thin || P.web;
    out.set(n.x, 0, n.z); if(out.lengthSq() > 1e-6) out.normalize();
    startAir();
    if(thin) sp.pos.y -= .06; else sp.pos.addScaledVector(n, .25);
  }
  sp.mode = 'hang'; sp.braked = true; sp.committed = false; sp.charging = false;
  sp.ropeL = Math.max(.45, sp.pos.distanceTo(sp.anchor) + .2);
  sp.vel.set(out.x*.4, 0, out.z*.4);
  pulses.push({pos: sp.anchor.clone(), amp: .4, decay: 5});
  toast('You let go onto your dragline. W/S reel, A/D swing, SPACE leap.');
}
// the shape of one pluck stroke for a given side: the striking side pulls hard, the other follows lightly
function pluckStroke(side){ if(!(sp.tap > 0)) return 0; const k = Math.sin(Math.PI*(1 - sp.tap/.12)); return k*(side === sp.pluckSide ? 1 : .3); }
function doPluck(dt){
  sp.plucking = true; sp.pluckT -= dt;
  if(sp.pluckT > 0) return;
  const id = PLUCKS[pluckIdx].id; let amp = 0, next = .2;
  if(id === 'midge'){ amp = .25; next = rr(.45, .85); }                 // a tiny midge: faint, lone ticks far apart
  else if(id === 'fly'){ const burst = (time % 1) < .55; amp = burst ? rr(.7, 1) : 0; next = burst ? rr(.04, .1) : .06; }
  else if(id === 'male'){ const ph = time % .9; amp = ph < .4 ? .5 : 0; next = ph < .4 ? .16 : .9 - ph; }
  else { amp = .2; next = .9; }
  sp.pluckT = next;
  if(amp > 0){ pulses.push({pos: sp.pos.clone(), amp, decay: 7}); sp.tap = .12; sp.pluckSide = -(sp.pluckSide || 1); }
  return amp;   // > 0 when a stroke landed this frame (the sound hooks on this)
}
// the dead stay dead: every spider in the forest can be eaten once (the kill orbs along the top count them)
function deadTick(p, dt){
  if(!p.dead) return false;
  p.deadT += dt; p.temp = .3 + (p.temp0 - .3)*Math.exp(-p.deadT/12); p.motion = 0; p.vib = 0;
  return true;
}
// the dead are unmistakable: colour drains to a dull grey-brown, the abdomen shrivels as she feeds, and once she
// lets go the husk rolls belly-up with its legs curled in
const DEAD_C = new THREE.Color(.2, .18, .16);
function deadLook(p, dt){
  const P = p.m.userData.parts;
  if(!P.mats){ P.mats = []; p.m.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for(const m of ms) if(m.color && !P.mats.some(e => e.m === m)) P.mats.push({m, c0: m.color.clone()}); }); P.abdS = P.abd ? P.abd.scale.clone() : null; }
  const fed = sp.feed && sp.feed.p === p, d = p.dead ? Math.max(.45, p.drain || 0) : 0;
  p.grey = (p.grey || 0) + (d - (p.grey || 0))*(1 - Math.exp(-3*dt));
  for(const e of P.mats) e.m.color.copy(e.c0).lerp(DEAD_C, .75*p.grey);
  const dr = p.dead ? p.drain || 0 : 0;
  if(P.abd && P.abdS){ const k = 1 - .55*dr; P.abd.scale.set(P.abdS.x*k, P.abdS.y*k*.7 + P.abdS.y*.3*(1 - dr), P.abdS.z*(.65 + .35*k)); }   // sucked flat and wrinkled
  P.body.scale.setScalar(1 - .15*dr);                                                                                                     // the whole husk shrinks a little
  if(p.held) return;                                                                                                                       // in her fangs: she places it
  const flat = !p.orb || p.dropped;
  p.flip = (p.flip || 0) + ((p.dead && !fed && flat ? 1 : 0) - (p.flip || 0))*(1 - Math.exp(-4*dt));
  if(flat && p.flip > .001){ const e = p.flip*p.flip*(3 - 2*p.flip), hb = P.body.position.y;
    p.m.rotation.z = Math.PI*e; p.m.position.y = p.pos.y + (2*hb + .02)*e; }
  else if(flat) p.m.rotation.z = 0;
}

// Scytodes pallida, the spitter. Whatever comes onto its leaf in front of it, or leaps at its face, is spat on: glued
// down in a mess of venomous silk there is no tearing free of. It never hurries after that: it walks slowly round to
// her back, bites, and feeds. Only from behind, or dropping from above, can she take it.
const SCY_SPIT_R = 1.8, SCY_CREEP = .1, SCY_RING = .28, SCY_BACK = .17;
function updScytodes(p, dt){
  if(deadTick(p, dt)) return;
  const dx = sp.pos.x - p.pos.x, dz = sp.pos.z - p.pos.z, dist = Math.hypot(dx, dz), near = dist < 3 && Math.abs(sp.pos.y - p.pos.y) < .8;
  const pk = preyPluck(p), faceP = Math.atan2(dx, dz), front = angDiff(p.yaw, faceP);
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*1.4 + (pk ? dt*.6 : 0) - dt*.12);
  p.motion = 0; p.vib = 0;
  if(p.state === 'spat'){
    if(sp.stuck > 0 && sp.stuckKind === 'gum' && DOOM.t < 0){ scyCreep(p, dt); return; }
    p.state = 'idle'; spatClear();                            // she was put somewhere else (a reset, a snapshot)
  }
  if(p.state === 'idle'){
    p.t -= dt; if(p.t <= 0){ p.want = p.yaw + rr(-2.2, 2.2); p.t = rr(5, 9); }
    if(p.alert > .45 && near) p.want = faceP;                 // feels you through its silk and turns to face you
    if(pk && near) p.state = 'lured';
  }
  if(p.state === 'lured'){                                    // plucking draws it toward you, front first
    p.want = faceP;
    if(!pk){ p.idleT += dt; if(p.idleT > 3){ p.state = 'idle'; p.idleT = 0; } } else p.idleT = 0;
    if(front < .5 && dist > .38){ stepToward(p, sp.pos, .22, dt, p.plat); p.motion = .4; p.vib = .5; }
  }
  const d = angDelta(p.yaw, p.want); p.yaw = gaitTurn(p.m, p.yaw, p.yaw + Math.max(-1.4*dt, Math.min(1.4*dt, d))); if(Math.abs(d) > .05) p.motion = Math.max(p.motion, .2);
  // on its leaf, in front of it, and it knows you are there: spat on
  if(DOOM.t < 0 && sp.stuck <= 0 && sp.mode === 'ground' && onSilkOf(p) && dist < SCY_SPIT_R && front < .55 && (p.alert > .45 || p.state === 'lured')) spit(p);
}
// round to her back, slowly, keeping a little off her (circling if it starts in front of her), then the bite
function scyCreep(p, dt){
  const her = sp.pos, hf = new V3(0, 0, 1).applyQuaternion(sp.m.quaternion); hf.y = 0;
  const back = hf.lengthSq() > 1e-6 ? Math.atan2(-hf.x, -hf.z) : sp.yaw + Math.PI;
  const rx = p.pos.x - her.x, rz = p.pos.z - her.z, r = Math.hypot(rx, rz), a = Math.atan2(rx, rz), off = angDelta(a, back);
  const behind = Math.abs(off) < .35, R = behind ? SCY_BACK : Math.max(SCY_RING, r - .25);
  const at = s => { const a2 = a + s*Math.min(Math.abs(off), .7); return [her.x + Math.sin(a2)*R, her.z + Math.cos(a2)*R]; };
  if(!p.side){ const s0 = Math.sign(off) || 1; p.side = inPlat(p.plat, ...at(s0)) || !inPlat(p.plat, ...at(-s0)) ? s0 : -s0; }   // round the side that stays on the leaf
  const [tx, tz] = clampTo(p.plat, ...(behind ? [her.x + Math.sin(back)*R, her.z + Math.cos(back)*R] : at(p.side)));
  const L = stepToward(p, new V3(tx, p.pos.y, tz), SCY_CREEP, dt, null);
  [p.pos.x, p.pos.z] = clampTo(p.plat, p.pos.x, p.pos.z);
  p.motion = .25; p.vib = .2;
  // headway is getting nearer her back; held up at the leaf's rim, it tries the other way round, then makes do
  const m = Math.abs(off)*.3 + r;
  if(m < p.creepBest - .005){ p.creepBest = m; p.creepT = 0; } else p.creepT += dt;
  if(p.creepT > 1.5 && !p.flipped){ p.side = -p.side; p.flipped = true; p.creepT = 0; p.creepBest = 1e9; }
  if((behind && L < .03) || (p.creepT > 2 && r < .45) || p.creepT > 6){
    p.yaw = Math.atan2(her.x - p.pos.x, her.z - p.pos.z);
    toast('It reaches your back and bites. The venom spreads.'); die();
  }
}
// the spit: a zigzag jet of glue from its fangs to her, then band on band of it slapped across her and stuck to the
// leaf either side. Thick, pale strands (tubes, not hairline silk), sized to her body, laid on over a fraction of a second.
// The bands ride her own frame; the jet hangs in the world between them.
const SPAT = [];
const spatMat = () => new THREE.MeshStandardMaterial({color: 0xf3edd8, roughness: .3, emissive: 0x2c2a20, transparent: true, opacity: rr(.3, .55), depthWrite: false});
function spatTube(pts, rad, delay, dur, parent){
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(24, pts.length*3), rad, 5);
  const o = hot(new THREE.Mesh(g, spatMat()), .2); o.frustumCulled = false; g.setDrawRange(0, 0);
  parent.add(o); drawables.push(o); SPAT.push({o, delay, dur, n: g.index.count}); return o;
}
function spit(p){
  p.state = 'spat'; p.creepBest = 1e9; p.creepT = 0; p.side = 0; p.flipped = false;
  if(sp.mode !== 'ground'){                                   // caught mid-leap: it pins her to its leaf
    const [x, z] = clampTo(p.plat, sp.pos.x, sp.pos.z); sp.pos.set(x, surfY(p.plat, x, z), z);
    Object.assign(sp, {mode: 'ground', plat: p.plat, braked: false, committed: false, plop: false}); sp.m.position.copy(sp.pos);
  }
  sp.stuck = 1e9; sp.stuckKind = 'gum'; sp.stuckPos = sp.pos.clone(); sp.charging = false; sp.vel.set(0, 0, 0); sp.aim = null;
  poseSpider(sp.m, GLUED_POSE); gaitRelease(sp.m);
  // her size, in her own frame: the body for the arch of each band, the legs for where it is stuck down
  const P = sp.m.userData.parts, q0 = sp.m.quaternion.clone(), x0 = sp.m.position.clone();
  sp.m.quaternion.identity(); sp.m.position.set(0, 0, 0); sp.m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(P.head).union(new THREE.Box3().setFromObject(P.abd)), all = new THREE.Box3().setFromObject(sp.m);
  sp.m.quaternion.copy(q0); sp.m.position.copy(x0); sp.m.updateMatrixWorld(true);
  const L = bb.max.z - bb.min.z, Wb = (bb.max.x - bb.min.x)/2, top = bb.max.y, cx = (bb.max.x + bb.min.x)/2;
  const reach = Math.max(Wb*1.6, Math.min(all.max.x, -all.min.x)*.6), rad = L*.0035;
  // the jet: from its fangs to the middle of her back, zigzagging as the glue does
  const a = p.pos.clone().add(new V3(Math.sin(p.yaw)*.13, .05, Math.cos(p.yaw)*.13)), b = sp.m.localToWorld(new V3(cx, top*.9, (bb.max.z + bb.min.z)/2));
  const perp = new V3(-(b.z - a.z), 0, b.x - a.x).normalize(), zz = [];
  for(let k = 0; k <= 30; k++){ const t = k/30, w = Math.sin(t*Math.PI)*(k % 2 ? 1 : -1); zz.push(a.clone().lerp(b, t).addScaledVector(perp, w*L*.05).add(new V3(0, Math.sin(t*Math.PI)*L*.12 + w*L*.02, 0))); }
  spatTube(zz, rad*1.3, 0, .12, scene);
  // the bands: across her, front to back, each a zigzag arch from the leaf on one side over her to the leaf on the other
  // messy: uneven bands at odd angles, some stopping short, the zigzag ragged and loose
  const N = 26;
  for(let k = 0; k < N; k++){
    const z0 = bb.min.z - L*.15 + (L*1.3)*(k + rr(0, 1))/N, skew = rr(-.9, .9), amp = L*rr(.01, .06), pts = [];
    const W0 = reach*rr(.4, 1.1), W1 = reach*rr(.4, 1.1), n = 10 + Math.floor(rnd()*14);
    const t0 = rnd() < .25 ? rr(.1, .35) : 0, t1 = rnd() < .25 ? rr(.65, .9) : 1;   // a quarter fall short on one side or the other
    for(let i = 0; i <= n; i++){
      const t = t0 + (t1 - t0)*i/n, x = cx - W0 + (W0 + W1)*t, u = (x - cx)/Wb;
      const z = z0 + skew*(x - cx) + amp*(i % 2 ? 1 : -1)*rr(.3, 1.3)*Math.sin(Math.PI*t) + L*rr(-.015, .015);
      const zf = Math.max(0, 1 - ((z - (bb.max.z + bb.min.z)/2)/(L*.55))**2);   // lower over her ends
      const y = Math.abs(u) < 1 ? top*Math.sqrt(1 - u*u)*(.55 + .45*zf) + rad*1.5 + L*rr(0, .025) : rad*1.2 + Math.max(0, .5*top*(1 - (Math.abs(u) - 1)*1.4)) + L*rr(0, .03);
      pts.push(new V3(x, Math.max(rad, y), z));
    }
    spatTube(pts, rad*rr(.5, 1.4), .1 + k*.02, .12, sp.m);
  }
  pulses.push({pos: a, amp: .8, decay: 4}); gusts.push({pos: a, amp: .6});
  toast('Spat on — glued down in venomous silk. There is no getting free.');
}
function spatTick(dt){
  for(const s of SPAT){ if(s.t == null) s.t = 0; s.t += dt; const k = Math.max(0, Math.min(1, (s.t - s.delay)/s.dur)); s.o.geometry.setDrawRange(0, Math.floor(k*s.n/3)*3); }
}
function spatClear(){ for(const {o} of SPAT){ o.removeFromParent(); const i = drawables.indexOf(o); if(i >= 0) drawables.splice(i, 1); o.geometry.dispose(); o.material.dispose(); } SPAT.length = 0; }
// glued down: crouched flat, abdomen pressed to the leaf, legs still
const GLUED_POSE = {crouch: 1, abdDown: 1};
function updBadumna(p, dt){
  if(deadTick(p, dt)) return;
  const BAD = p.site;
  const pk = preyPluck(p), home = BAD.mouth.clone().addScaledVector(BAD.sd, .14);
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*1.2 - dt*.15);
  p.motion = 0; p.vib = 0;
  if(p.sulk > 0) p.sulk -= dt;
  // footsteps on its sheet read as prey blundering in: once it is sure, it bursts out and runs her down. Only getting
  // off its silk saves her; then, having missed, it keeps to its tube a while
  if(p.alert > 1 && p.sulk <= 0 && p.state !== 'lunge' && onSilkOf(p) && DOOM.t < 0){ p.state = 'lunge'; p.alert = 1; p.interest = 0; toast('It felt your footsteps — the house spider rushes out at you!'); }
  if(p.state === 'lunge'){
    p.pos.y += (BAD.plat.y - p.pos.y)*(1 - Math.exp(-14*dt));        // out of the tube mouth onto the sheet
    const dx = sp.pos.x - p.pos.x, dz = sp.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    p.motion = 1; p.vib = 1.2;
    if(DOOM.t >= 0) p.state = 'back';
    else if(!onSilkOf(p)){ p.state = 'back'; p.sulk = 12; p.alert = .3; toast('You got off its sheet in time. It goes back and stays hidden a while.'); }
    else if(d < .2){ toast('The house spider drives its fangs into you.'); die(); p.state = 'back'; p.alert = 0; }
    else {                                                           // a dash: no gait limit, the legs scramble to keep up
      const st = Math.min(d, 1.9*dt); p.pos.x += dx/d*st; p.pos.z += dz/d*st; p.phase += st*40;
      p.yaw = gaitTurn(p.m, p.yaw, lerpAngle(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-14*dt)));
    }
  }
  if(p.state === 'retreat' || p.state === 'peek'){
    if(pk && p.sulk <= 0){
      if(pk === p.pref){ p.interest += dt*.32; p.peekT = 1; }        // only a heavy struggling fly is worth leaving the tube for
      else p.interest = Math.max(0, p.interest - dt*.08);
    } else p.interest = Math.max(0, p.interest - dt*.08);
    p.peekT = Math.max(0, p.peekT - dt);
    p.state = p.peekT > 0 ? 'peek' : 'retreat';
    const tgt = p.state === 'peek' ? BAD.mouth.clone().addScaledVector(BAD.sd, -.08) : home;
    // walk (legs and all) to the mouth or back into the tube, slowly, always facing out of the retreat
    const left = stepToward(p, tgt, p.state === 'peek' ? .12 : .09, dt, null), out = Math.atan2(-BAD.sd.x, -BAD.sd.z);
    p.yaw = gaitTurn(p.m, p.yaw, lerpAngle(p.yaw, out, 1 - Math.exp(-10*dt))); p.pos.y += (tgt.y - p.pos.y)*(1 - Math.exp(-3*dt));
    if(left > .02){ p.motion = .2; p.vib = .2; }
    if(p.state === 'peek'){ p.motion = Math.max(p.motion, .25); p.vib = .3; }
    if(p.interest >= 1){ p.state = 'out'; p.rush = pk === 'fly' ? .8 : .3; p.idleT = 0; p.known = true; p.close = 0; toast('It comes out of its retreat…'); }
  }
  if(p.state === 'out'){
    const rt = {fly: 1, midge: .35, male: .2, calm: 0}[pk] ?? 0;
    p.rush += (rt - p.rush)*(1 - Math.exp(-(pk === 'calm' ? 2.2 : .9)*dt));
    if(!pk || sp.plat !== BAD.plat){ p.idleT += dt; if(p.idleT > 4) p.state = 'back'; } else p.idleT = 0;
    p.pos.y = BAD.plat.y;
    const d = Math.hypot(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z);
    if(d > .36){ stepToward(p, sp.pos, .22 + p.rush*1.0, dt, null); p.motion = .3 + p.rush*.6; p.vib = .4 + p.rush*.6; p.close = 0; }
    else if(p.rush > .6){ hurt(.5, 'It rushes you — the bite of a bigger spider.'); knockOff(); p.state = 'back'; }
    else { p.close += dt; if(p.close > 1.5){ hurt(.35, 'It recognises you — and bites.'); knockOff(); p.state = 'back'; p.close = 0; } }
  }
  if(p.state === 'back'){
    p.rush = 0;
    if(stepToward(p, BAD.mouth, .25, dt, null) < .05){ p.state = 'retreat'; p.interest = 0; }
    p.motion = .3; p.vib = .4;
  }
}
// is she in the air and about to pass within reach of p? Her arc is followed for the next half second
function leapComing(p){
  if(sp.mode !== 'air' || sp.plop || sp.stuck > 0 || sp.webGrace > 0) return false;   // (webGrace: just torn free and falling)
  const at = p.pos.clone().add(p.orb.g.position), q = new V3();
  for(let k = 1; k <= 10; k++){ const t = k*.05;
    q.copy(sp.pos).addScaledVector(sp.vel, t); if(!sp.balloon) q.y -= .5*G*t*t;
    if(q.distanceTo(at) < .5) return true; }
  return false;
}
// the drop: down its dragline fast, a wait hanging there, then hand over hand back up to the hub. Back home with her
// still on its silk, it knows what she is and comes straight for her
function argDrop(p, dt, onWeb){
  const {C, n} = p.orb, hub = C.clone().addScaledVector(n, .01);
  p.vib = 0; p.motion = 0;
  if(p.dropT > 0){ argMove(p, p.dropTo, 7, dt, true); p.fwd.lerp(new V3(0, -1, 0), 1 - Math.exp(-6*dt)); p.dropT -= dt; return; }
  p.motion = .3;
  if(argMove(p, hub, .45, dt, true) > .03) return;
  p.fwd.set(0, -1, 0); p.wary = 8;
  if(onWeb && DOOM.t < 0){ p.state = 'lunge'; p.alert = 1; toast('Back at the hub, it feels you on its silk — it lunges!'); }
  else { p.state = 'hub'; p.alert = .5; }
}
// the dragline it hangs from, hub to body, shown only while it is off its web
function argDropLine(p){
  const on = p.state === 'drop' || (p.state === 'wrap' && p.pos.distanceTo(p.orb.C) > .3 && Math.abs(p.pos.clone().sub(p.orb.C).dot(p.orb.n)) > .05);
  if(!on){ if(p.dropLine) p.dropLine.visible = false; return; }
  if(!p.dropLine){ p.dropLine = hot(new THREE.Line(segsFrom([new V3(), new V3()]), silkM(.8)), .3); p.dropLine.frustumCulled = false; scene.add(p.dropLine); drawables.push(p.dropLine); }
  const g = p.orb.g.position, a = p.orb.C.clone().add(g), b = p.pos.clone().add(g), pos = p.dropLine.geometry.attributes.position;
  pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true; p.dropLine.visible = true;
}
function updArgiope(p, dt, t){
  if(deadTick(p, dt)) return;
  const pk = preyPluck(p), O = p.orb, {C, n, R} = O;
  const rel = sp.pos.clone().sub(C), offPlane = Math.abs(rel.dot(n)), radial = rel.addScaledVector(n, -rel.dot(n)).length();
  const nearWeb = offPlane < 1 && radial < R + .6;
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*2.4 - dt*(pk === 'male' ? .7 : .15));
  p.motion = 0; p.vib = 0;
  if(p.wary > 0) p.wary -= dt;
  // the pump is a test: it shakes the orb and feels for anything that moves against the shaking. Real prey is
  // already stuck and struggles in rhythm with it; a hunter creeping on the silk gives itself away. Hold still and
  // it settles back on the hub; move, and it lunges straight down the threads at you.
  // resting at the hub (or on its way back there), it watches: a leap coming at it and it lets go, dropping on its
  // dragline out of reach. Busy with a plucked "prey" (walk, rush) it has eyes for nothing else
  if((p.state === 'hub' || p.state === 'return') && DOOM.t < 0 && leapComing(p)){
    p.state = 'drop'; p.dropT = rr(4, 6); p.dropFrom = p.pos.clone();
    const far = -Math.sign(sp.pos.clone().sub(C).dot(n)) || 1;   // behind the sheet, away from her
    p.dropTo = p.pos.clone().add(new V3(0, -R*.6, 0)).addScaledVector(n, far*.35);
    pulses.push({pos: p.pos.clone().add(O.g.position), amp: .5, decay: 5}); toast('It saw you coming — the orb-weaver drops from its web!');
  }
  // on the sheet itself (or hanging at it): the leaves its frame is tied to carry her steps and plucks to it, but only a
  // hunter out on its threads draws the strike
  const onSheet = (sp.mode === 'climb' && sp.plat === O.S) || (sp.mode === 'hang' && nearWeb);
  if(p.state === 'drop'){ argDrop(p, dt, onSheet); argDropLine(p); return; }
  argDropLine(p);
  if(p.state !== 'pump' && p.state !== 'wrap' && p.state !== 'rush' && p.state !== 'lunge' && pk !== 'male' && p.alert > 1 && DOOM.t < 0){ p.state = 'pump'; p.pumpT = 3; p.alert = .4; toast('The orb-weaver pumps its web — freeze, or it will strike!'); }
  if(p.state === 'pump'){
    p.pumpT -= dt; p.vib = 1.4; p.motion = .5;
    const moving = sp.speed > 0 || sp.plucking || (sp.mode === 'hang' && (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD));
    if(moving && onSheet && DOOM.t < 0){ p.state = 'lunge'; p.alert = 1; toast('It felt you move — the orb-weaver lunges!'); }
    else if(p.pumpT <= 0) p.state = 'hub';
  }
  if(p.state === 'lunge'){                                   // fast and fatal; only getting off its silk saves her
    p.motion = 1; p.vib = 1.3;
    if(DOOM.t >= 0) p.state = 'return';
    else if(!onSheet){ p.state = 'return'; p.wary = 15; p.alert = .6; toast('You got off the web in time. It stays wary.'); }
    else if(argMove(p, webPoint(sp.pos, R, O), 3.5, dt, true) < .3){ toast('The orb-weaver drives its fangs into you.'); die(); p.state = 'return'; p.alert = 0; }
  }
  if(p.state === 'hub'){
    argMove(p, C.clone().addScaledVector(n, .01), .3, dt); p.fwd.lerp(new V3(0, -1, 0), 1 - Math.exp(-3*dt));
    if(pk && p.wary <= 0) p.state = pk === 'fly' ? 'rush' : (pk === 'calm' ? 'hub' : 'walk');
  }
  if(p.state === 'walk' || p.state === 'rush'){
    if(pk === 'fly') p.state = 'rush';
    const rush = p.state === 'rush';
    argMove(p, webPoint(sp.pos, R*.85, O), rush ? 1.0 : (pk === 'male' ? .12 : .2), dt);
    p.motion = rush ? .9 : .4; p.vib = rush ? 1.1 : .5;
    if(!pk){ p.idleT += dt; if(p.idleT > 3){ p.state = 'return'; p.idleT = 0; } } else p.idleT = 0;
    if(p.pos.distanceTo(sp.pos) < .45){
      if(rush){ hurt(.6, 'The orb-weaver rushes out and wraps you in silk.'); knockOff(); p.state = 'return'; }
      else { p.close += dt; if(p.close > 1.8){ hurt(.4, 'It realises what you are — and bites.'); knockOff(); p.state = 'return'; p.close = 0; } }
    } else p.close = 0;
  }
  if(p.state === 'return'){ if(argMove(p, C.clone().addScaledVector(n, .01), .35, dt) < .03) p.state = 'hub'; p.motion = .3; }
  if(p.state === 'wrap'){
    const far = p.pos.distanceTo(sp.stuckPos) > .6;   // from afar (back up its dragline) it hurries
    if(sp.stuck <= 0 || sp.stuckKind !== 'web') p.state = 'return';
    else if((p.wrapDelay -= dt) > 0){ p.vib = .6; }
    else if(argMove(p, webPoint(sp.stuckPos, R, O), far ? 1.3 : .7, dt, far) < .18){ toast('It reaches you in the sticky spiral, and bites.'); die(); p.state = 'return'; }   // held fast to the end
    p.motion = .8; p.vib = 1;
  }
}
// the garden orb-weaver at work, on its clock p.bt (see SPIN). Footsteps or plucks on its silk make it freeze, feeling
// the threads, until all is quiet again; it never takes its web down while she is on it. A dead one's web stays as it was, for good
function updAraneus(p, dt){
  if(deadTick(p, dt)) return;
  const O = p.orb, B = O.B, {C, u, v, R, N, NR, path} = B;
  p.motion = 0; p.vib = 0;
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*2 + (preyPluck(p) ? dt*.6 : 0) - dt*.3);
  if(p.state === 'freeze' ? p.alert > .15 : p.alert > .7){ p.state = 'freeze'; return; }
  let T = p.bt + dt;
  if(p.bt <= SPIN.down && T > SPIN.down && onSilkOf(p)) T = SPIN.down;
  p.bt = T = T % SPIN.cycle;
  let walk = R, fade = 1, pos = null, fwd = null;
  if(T < SPIN.radii){                                      // the radii, one by one: out from the hub, then back along it
    const fr = T/SPIN.radii, k = Math.min(NR - 1, Math.floor(fr*NR)), ph = fr*NR - k, a = k/NR*6.283;
    const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
    pos = C.clone().addScaledVector(d, .02 + (R - .02)*Math.sin(ph*Math.PI)); fwd = d.multiplyScalar(ph < .5 ? 1 : -1);
    B.rL.geometry.setDrawRange(0, 2*k + (ph > .5 ? 2 : 0)); B.sL.geometry.setDrawRange(0, 0); walk = 0; p.state = 'radii';
  } else if(T < SPIN.done){                                // the sticky spiral, turn by turn outward, the builder walking it
    const x = (T - SPIN.radii)/(SPIN.done - SPIN.radii)*N, i = Math.min(N - 1, Math.floor(x));
    pos = path[i].clone().lerp(path[i + 1], x - i); fwd = path[i + 1].clone().sub(path[i]);
    B.rL.geometry.setDrawRange(0, 2*NR); B.sL.geometry.setDrawRange(0, 2*i);
    walk = Math.min(R, pos.distanceTo(C) + .15); p.state = 'spin';
  } else {                                                 // finished: back to the hub to wait; later it takes the web down
    B.rL.geometry.setDrawRange(0, 2*NR); B.sL.geometry.setDrawRange(0, 2*N);
    if(T >= SPIN.down){ fade = 1 - (T - SPIN.down)/(SPIN.cycle - SPIN.down); walk = 0; }
    if(argMove(p, C, .35, dt) > .03){ p.state = 'return'; p.motion = .3; }
    else { p.state = T >= SPIN.down ? 'down' : 'hub'; p.fwd.lerp(new V3(0, -1, 0), 1 - Math.exp(-3*dt)); }
  }
  if(pos){
    p.phase += pos.distanceTo(p.pos)*35; p.pos.copy(pos); p.motion = .35; p.vib = .3;
    if(fwd.lengthSq() > 1e-10){ fwd.normalize(); if(p.fwd.dot(fwd) < -.5) fwd.addScaledVector(new V3().crossVectors(O.n, p.fwd).normalize(), 1.5);   // turn round through the side
      p.fwd.lerp(fwd, 1 - Math.exp(-6*dt)); }
  }
  O.walk = walk;
  B.mats.forEach((mt, k) => mt.opacity = [.55, .45, .4][k]*fade);
}
function updatePrey(dt, t){
  for(const p of PREY){
    KILLER_NOW = p;
    if(DOOM.killer === p && DOOM.t >= 0 && !DOOM.reset) eatCorpse(p, dt);
    else if(p.kind === 'scytodes') updScytodes(p, dt); else if(p.kind === 'badumna') updBadumna(p, dt); else if(p.kind === 'araneus') updAraneus(p, dt); else updArgiope(p, dt, t);
    KILLER_NOW = null;
    if(!p.dead) p.temp += ((p.motion > .6 ? .72 : .56) - p.temp)*(1 - Math.exp(-.8*dt));
    // pose: walking prey are carried on planted feet; resting or dead ones hold a pose
    const vNow = p.pos.clone().sub(p.prevPos || p.pos).divideScalar(Math.max(dt, 1e-4));
    p.velW = (p.velW || new V3()).lerp(vNow, 1 - Math.exp(-12*dt)); p.prevPos = p.pos.clone();
    if(p.held){                                                    // in her fangs: feedTick places it; it spasms, then goes limp
      const bite = sp.feed && sp.feed.t < BITE_T;
      gaitRelease(p.m); poseArach(p.m, bite ? {walk: 1, phase: t*48, bob: Math.sin(t*70)*.003} : {limp: p.limp || 0});
    } else if(p.orb && !p.dropped){
      const O = p.orb, z = p.fwd.clone().normalize(), y = O.n.clone(), x = new V3().crossVectors(y, z);
      M4.makeBasis(x, y, z); p.m.quaternion.setFromRotationMatrix(M4); p.m.position.copy(p.pos).add(O.g.position);
      if(!p.dead && p.state !== 'hub' && p.state !== 'pump' && p.state !== 'freeze' && p.state !== 'down' && p.state !== 'drop'){
        // feet grip the silk: footholds lie on the (swaying) web plane, "up" is the web normal
        const c = O.C.clone().add(O.g.position);
        poseArach(p.m, {});
        gaitUpdate(p.m, dt, {vel: p.velW, up: O.n, stepDur: .2, free: () => false,
          place: v => v.addScaledVector(O.n, -v.clone().sub(c).dot(O.n) + .002)});
      } else { gaitRelease(p.m); poseArach(p.m, {cross: !p.dead, pump: p.state === 'pump' ? t*30 : 0, curl: p.dead}); }
    } else {
      p.m.position.x = p.pos.x; p.m.position.z = p.pos.z; p.m.rotation.y = p.yaw;
      const onSurface = !p.dead && !(p.kind === 'badumna' && (p.state === 'retreat' || p.state === 'peek'));
      if(onSurface){
        gaitBody(p.m, dt, p.pos.y); poseArach(p.m, {});
        gaitUpdate(p.m, dt, {vel: p.velW, place: v => placeOn(p.plat, v), free: () => false});
      } else {
        gaitRelease(p.m); p.m.position.y = p.pos.y; p.m.rotation.x = p.m.rotation.z = 0;
        // in the tube the legs cycle whenever the body actually travels (not off the motion/alert level), so it walks out to the mouth
        const sp2 = Math.hypot(p.velW.x, p.velW.z), walk = p.dead ? 0 : Math.min(1, sp2/.04);
        poseArach(p.m, {curl: p.dead, tuck: !p.dead && p.kind === 'badumna' && p.state === 'retreat' && walk < .5, walk, phase: p.phase});
      }
    }
    if(DOOM.killer === p) eatPose(p, t);
    deadLook(p, dt);
    if(p.fallH > 0){ p.fallV += 9*dt; p.fallH = Math.max(0, p.fallH - p.fallV*dt); p.m.position.y += p.fallH;   // the dropped husk falls,
      if(p.fallH === 0) pulses.push({pos: p.pos.clone(), amp: .3, decay: 6}); }                                // and lands with a faint tap
  }
  spatTick(dt);
  for(let i = gums.length - 1; i >= 0; i--){ const g = gums[i]; g.t -= dt; if(g.t <= 0){ scene.remove(g.ln); drawables.splice(drawables.indexOf(g.ln), 1); gums.splice(i, 1); } }
  // webs tremble in the breeze; the orb bucks when pumped
  for(const O of ORBS) O.g.position.copy(O.n).multiplyScalar(Math.sin(t*7)*(.006 + wind.gust*.03)*(O.corner ? .4 : 1) + (O.spider.state === 'pump' ? Math.sin(t*32)*.05 : 0));   // bark holds a corner web stiffer
  for(const B of BAD_SITES) B.g.position.y = Math.sin(t*6)*wind.gust*.015;
  if(sp.mode === 'climb' && sp.plat && sp.plat.web && !sp.roll){          // she and her footholds ride the swaying, bucking orb
    const off = sp.plat.orb.g.position.clone(), d = off.clone().sub(sp.plat.lastOff || off); sp.plat.lastOff = off;
    if(d.lengthSq() > 0){ sp.pos.add(d); sp.m.position.add(d); for(const L of sp.m.userData.parts.legs){ L.foot.add(d); if(L.step){ L.step.from.add(d); L.step.to.add(d); } } }
  }
}


const ropeGeo = new THREE.BufferGeometry().setFromPoints([new V3(), new V3(), new V3()]);   // knot, where it bends over a rim (or the knot again), her
const rope = hot(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({color:0xfff4dc})), .62); rope.frustumCulled = false; rope.visible = false; scene.add(rope);
// where the dragline is tied: a bright silk knot with a halo, so you always know whether and where you're attached
const tieMark = hot(new THREE.Group(), .95); tieMark.visible = false; scene.add(tieMark);
tieMark.add(new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), new THREE.MeshBasicMaterial({color:0xfff2c0})),
  new THREE.Mesh(new THREE.RingGeometry(.045, .055, 24), new THREE.MeshBasicMaterial({color:0xffe08a, side:THREE.DoubleSide, transparent:true, opacity:.85})));
const DOTS = 36;
const dots = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({color:0xffe0a0}), DOTS), TEMP.preview);
dots.frustumCulled = false; dots.visible = false; scene.add(dots);
// the landing estimate: a ring as wide as her likely error, a small mark at its centre; hot orange when prey is inside it
const aimOwner = {temp: TEMP.preview, motion: 0};
const aimRing = new THREE.Group(); aimRing.visible = false; aimRing.userData.owner = aimOwner; scene.add(aimRing);
const aimRingM = new THREE.MeshBasicMaterial({color:0xffe0a0, transparent:true, opacity:.9, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2});
const aimOuter = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), aimRingM), aimInner = new THREE.Mesh(new THREE.RingGeometry(0, .03, 16), aimRingM);
const aimFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({color:0xffe0a0, transparent:true, opacity:.12, side:THREE.DoubleSide, depthWrite:false}));
aimRing.add(aimOuter, aimInner, aimFill);
// the prey in her sights, ringed where the eye is on it (facing the camera, drawn over everything): the landing ring
// lies on the surface and goes edge-on or lost on a sheet of silk; this one reads from any angle
const lockMark = new THREE.Group(); lockMark.visible = false; lockMark.userData.owner = aimOwner; lockMark.renderOrder = 10; scene.add(lockMark);
const lockM = new THREE.MeshBasicMaterial({color:0xff5a20, transparent:true, opacity:.95, side:THREE.DoubleSide, depthTest:false, depthWrite:false});
for(let i = 0; i < 4; i++){ const g = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 10, 1, i*Math.PI/2 + .25, Math.PI/2 - .5), lockM); g.renderOrder = 10; lockMark.add(g); }
const lockR = q => q._lockR || (q._lockR = Math.max(.05, new THREE.Box3().setFromObject(q.m).getBoundingSphere(new THREE.Sphere()).radius*.8));
