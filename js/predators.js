'use strict';
// mantis predator and the doom sequence

/* =====================================================================
   PREDATORS — a praying mantis roams the forest: the soil, the logs and stumps, up the young trunks and
   along the branches, onto the leaves. It hunts Portia by sight, and sight sees only movement: standing still, or
   sneaking (C), hides her completely. Seen, she is stalked to where she was last seen. The mantis seizes her in its
   raptorial forelegs and devours her, the screen fades to black, and another Portia takes up the hunt
   on the first leaf.
   ===================================================================== */
const PRED = {grace: 4};
const DOOM = {t: -1, by: null, reset: false};
const SEEN = {last: new V3(), speed: 0, init: false};
const prr = (a, b) => a + Math.random()*(b - a);

// ---- surfaces a predator can walk on, behind one interface: proj(v) the nearest point on it, norm(q), ok(q)
const predBlocks = S => !S.web && !S.thin && S.inside && (!S.tube || (S._Rmax ?? (S._Rmax = Math.max(...S._R))) > .12);
const PRED_GROUND = {
  id: 'pg',
  proj: v => new V3(v.x, floorAt(v.x, v.z) + .003, v.z),
  norm: q => { const e = .3, gx = floorAt(q.x + e, q.z) - floorAt(q.x - e, q.z), gz = floorAt(q.x, q.z + e) - floorAt(q.x, q.z - e);
    return new V3(-gx/(2*e), 1, -gz/(2*e)).normalize(); },
  ok: q => { if(Math.hypot(q.x, q.z) > AREA*.75) return false; const t = new V3(q.x, q.y + .12, q.z);
    for(const S of climbsNear(q.x, q.z, .3)) if(predBlocks(S) && S.inside(t, 0)) return false; return true; }
};
const PRED_WRAP = new Map();
function predClimb(S){
  let w = PRED_WRAP.get(S);
  if(!w) PRED_WRAP.set(S, w = {id: S.id, S, proj: v => S.project(v.clone()), norm: q => S.normal(q), ok: q => q.y > floorAt(q.x, q.z) - .05});
  return w;
}
function predPlat(p){
  let w = PRED_WRAP.get(p);
  if(!w) PRED_WRAP.set(p, w = {id: p.id, p,
    proj: v => { const [x, z] = clampTo(p, v.x, v.z); return new V3(x, surfAt(p, x, z) + .003, z); },
    norm: () => UP.clone(), ok: q => inPlat(p, q.x, q.z, .03)});
  return w;
}
function predCands(pos, reach, cur){
  const out = [PRED_GROUND];
  for(const S of climbsNear(pos.x, pos.z, reach + .3))
    if(!S.web && S.label !== 'leaf' && S.label !== 'vine' && S.project && S.normal && pos.y > S.y0 - reach && pos.y < S.y1 + reach) out.push(predClimb(S));
  for(const p of PLAT){
    if(p.kind === 'web' || p.kind === 'flower') continue;
    const e = Math.max(p.rx, p.rz) + reach;
    if(Math.abs(p.x - pos.x) < e && Math.abs(p.z - pos.z) < e && Math.abs(p.y - pos.y) < .8 + reach) out.push(predPlat(p));
  }
  if(cur && !out.includes(cur)) out.push(cur);
  return out;
}
// walk dist along the surfaces toward goal: each small step may hand over to any surface within reach, whichever
// carries it nearest the goal (up a trunk from the soil, out along a limb, onto a leaf from its stalk)
function predWalk(pr, goal, dist){
  const n = Math.max(1, Math.ceil(dist/.05)), sub = dist/n;
  for(let i = 0; i < n; i++){
    let best = null, bs = 1e9;
    for(const C of predCands(pr.pos, pr.reach, pr.surf)){
      const q = C === pr.surf ? pr.pos.clone() : C.proj(pr.pos), off = q.distanceTo(pr.pos);
      if(off > pr.reach) continue;
      const nn = C.norm(q), d = goal.clone().sub(q); d.addScaledVector(nn, -d.dot(nn));
      const L = d.length(); if(L > 1e-6) d.multiplyScalar(Math.min(sub, L)/L);
      const q2 = C.proj(q.add(d)); if(!C.ok(q2)) continue;
      const s = q2.distanceTo(goal) + off*.5 + (C === pr.surf ? 0 : .03);
      if(s < bs){ bs = s; best = {C, q2}; }
    }
    if(!best) return false;
    pr.surf = best.C; pr.pos.copy(best.q2);
  }
  return true;
}
// a hop: the landing nearest the goal within Lmax, on any surface (the mantis hops when stuck)
function predHopTarget(pr, goal, Lmax){
  const d = goal.clone().sub(pr.pos), D = d.length(); if(D < .05) return null;
  const L = Math.min(Lmax, D); d.normalize();
  let best = null, bs = pr.pos.distanceTo(goal) - .05;
  for(const a of [0, .45, -.45, .9, -.9]){
    const dir = d.clone().applyAxisAngle(pr.up, a), P = pr.pos.clone().addScaledVector(dir, L);
    for(const C of predCands(P, 1.1)){
      const q = C.proj(P); if(q.distanceTo(P) > 1.1 || !C.ok(q) || q.distanceTo(pr.pos) > Lmax*1.5) continue;
      const s = q.distanceTo(goal) + Math.abs(a)*.1;
      if(s < bs){ bs = s; best = {C, q}; }
    }
  }
  return best;
}
function predStartHop(pr, T, dur){
  const n1 = T.C.norm(T.q), D = pr.pos.distanceTo(T.q);
  pr.hop = {p0: pr.pos.clone(), p1: T.q.clone(), C: T.C, k: 0, dur: dur*(.7 + .3*Math.min(1.5, D)), H: .15 + .3*D,
    lift: pr.up.clone().add(n1).add(new V3(0, .6, 0)).normalize(), dir: T.q.clone().sub(pr.pos)};
}
function predHopTick(pr, dt){
  const h = pr.hop; h.k = Math.min(1, h.k + dt/h.dur);
  pr.pos.copy(h.p0).lerp(h.p1, h.k).addScaledVector(h.lift, Math.sin(Math.PI*h.k)*h.H);
  if(h.k >= 1){ pr.pos.copy(h.p1); pr.surf = h.C; pr.hop = null; return true; }
  return false;
}
// body frame from the surface normal and a heading turned toward `want`
function predOrient(pr, dt, want, rate = 4){
  const nrm = pr.hop ? pr.hop.lift.clone().lerp(pr.hop.C.norm(pr.hop.p1), pr.hop.k).normalize() : pr.surf.norm(pr.pos);
  pr.up.lerp(nrm, 1 - Math.exp(-(pr.hop ? 10 : 7)*dt)).normalize();
  const cur = pr.fwd.clone().addScaledVector(pr.up, -pr.fwd.dot(pr.up));
  if(cur.lengthSq() < 1e-6) cur.crossVectors(new V3(1, 0, 0), pr.up);
  cur.normalize();
  if(want && want.lengthSq() > 1e-10){
    const f = want.clone().addScaledVector(pr.up, -want.dot(pr.up));
    if(f.lengthSq() > 1e-8){ f.normalize(); if(cur.dot(f) < -.95) f.addScaledVector(new V3().crossVectors(pr.up, cur), .6).normalize();
      cur.lerp(f, 1 - Math.exp(-rate*dt)).normalize(); }
  }
  pr.fwd.copy(cur);
  const x = new V3().crossVectors(pr.up, pr.fwd).normalize(), z = new V3().crossVectors(x, pr.up);
  M4.makeBasis(x, pr.up, z); pr.m.quaternion.setFromRotationMatrix(M4); pr.m.position.copy(pr.pos);
}
// somewhere to go: a young trunk or a limb, a leaf, stump, rock or the log, or open soil — all near the play area
function predWanderGoal(pr){
  const r = Math.random(), near = (x, z, R) => Math.hypot(x - pr.pos.x, z - pr.pos.z) < R && Math.hypot(x, z) < 15;
  if(r < pr.climby){
    const L = CLIMBS.filter(S => !S.web && S.label === 'bark' && S.project && near(S.cx, S.cz, 11));
    if(L.length){
      const S = L[Math.random()*L.length | 0];
      if(S.tube){ const q = S._pts[Math.random()*S._pts.length | 0].clone().add(new V3(prr(-.3, .3), .5, prr(-.3, .3))); return S.project(q); }
      const a = prr(0, 6.28), y = Math.min(S.y1 - .5, S.y0 + prr(1.5, 7));
      return S.project(new V3(S.cx + Math.cos(a)*40, y, S.cz + Math.sin(a)*40));
    }
  }
  if(r < pr.climby + .35){
    const kinds = Math.random() < .65 ? ['leaf'] : ['log', 'stump', 'rock', 'fungus'];
    const L = PLAT.filter(p => kinds.includes(p.kind) && p !== START && near(p.x, p.z, 9));
    if(L.length){ const p = L[Math.random()*L.length | 0], q = randomIn(p, .15); q.y = surfAt(p, q.x, q.z); return q; }
  }
  for(let i = 0; i < 20; i++){
    const a = prr(0, 6.28), d = prr(2, 7), x = pr.pos.x + Math.cos(a)*d, z = pr.pos.z + Math.sin(a)*d;
    if(Math.hypot(x, z) > 15 || Math.hypot(x - START.x, z - START.z) < 2.5) continue;
    const q = PRED_GROUND.proj(new V3(x, 0, z)); if(PRED_GROUND.ok(q)) return q;
  }
  return pr.home.clone();
}
// what it sees: only Portia moving, and not sneaking
function portiaVisible(){ return DOOM.t < 0 && PRED.grace <= 0 && !sp.sneaking && (SEEN.speed > .12 || sp.mode === 'air'); }
function predSense(pr, dt){
  const vis = portiaVisible() && pr.eyeWorld().distanceTo(sp.pos) < pr.range;
  if(vis){
    pr.sees = true; pr.seenT = 0; pr.last.copy(sp.pos);
    if(!pr.hunting){ pr.hunting = true; pr.goal = null; pr.pause = 0; pr.best = 1e9; pr.stuckT = 0;
      if(time - pr.toastT > 12){ toast(pr.spotMsg); pr.toastT = time; } }
  } else {
    pr.sees = false;
    if(pr.hunting && (pr.seenT += dt) > 8){ pr.hunting = false; pr.goal = null; pr.pause = prr(1, 3);
      if(time - pr.lostT > 12){ toast(pr.lostMsg); pr.lostT = time; } }
  }
}
// progress toward the goal; no headway for a while means stuck
function predProgress(pr, goal, dt){
  const d = pr.pos.distanceTo(goal);
  if(d < pr.best - .12){ pr.best = d; pr.stuckT = 0; } else pr.stuckT += dt;
  return d;
}

// ---- the praying mantis: long green prothorax, triangular head on a swivel, big compound eyes, spined raptorial
// forelegs folded in prayer, four long thin walking legs, wing covers over a long abdomen. About 5 cm.
function makeMantis(){
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: .5}, o));
  const GRN = mat(0x7fb547), LIME = mat(0xa9d266), WING = mat(0x93c457, {roughness: .35, transparent: true, opacity: .92}),
        DOT = mat(0x1d2a0c), SPN = mat(0x5d7f2c);
  const SPH = new THREE.SphereGeometry(1, 18, 12), CONE = new THREE.ConeGeometry(.007, .04, 5).rotateX(Math.PI);
  const add = (par, o) => { o.castShadow = true; par.add(o); return o; };
  const ell = (par, m, sx, sy, sz, x, y, z) => { const o = add(par, new THREE.Mesh(SPH, m)); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };
  const tubeX = (par, len, r0, r1, m) => add(par, new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8).rotateZ(-Math.PI/2).translate(len/2, 0, 0), m));
  const tubeZ = (par, len, r0, r1, m) => add(par, new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8).rotateX(Math.PI/2).translate(0, 0, len/2), m));
  const joint = (par, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };
  // abdomen in overlapping segments, tip curling up a little; wing covers on top
  for(let i = 0; i < 6; i++){ const t = i/5; ell(body, GRN, .12 - t*.035, .095 - t*.025, .12, 0, .3 + t*t*.06, -.12 - t*.7).rotation.x = .1 + t*.15; }
  ell(body, WING, .14, .028, .42, 0, .39, -.4).rotation.x = .08;
  ell(body, LIME, .02, .012, .38, 0, .42, -.38).rotation.x = .08;                         // the green vein down the cover
  ell(body, GRN, .085, .075, .17, 0, .28, .02);                                           // meso/metathorax
  const pro = joint(body, 0, .3, .12); pro.rotation.x = -.6;                                // the long neck-like prothorax
  tubeZ(pro, .5, .045, .035, GRN); ell(pro, GRN, .062, .045, .09, 0, 0, .42);
  // the head: a broad inverted triangle, eyes at the upper corners, tapering to the mouthparts at the chin
  const head = joint(pro, 0, .01, .53); head.rotation.x = .95;
  const HEADG = mat(0x86b83e, {roughness: .42}),
        CEYE = new THREE.MeshPhysicalMaterial({color: 0xb4d455, roughness: .3, clearcoat: 1, clearcoatRoughness: .15}),
        PUP = mat(0x141c08, {roughness: .7}), MOUTH = mat(0x6f6232, {roughness: .45}), MTIP = mat(0x3b2a17, {roughness: .4}),
        OCEL = new THREE.MeshPhysicalMaterial({color: 0xcfe88a, roughness: .1, clearcoat: 1}), ANT = mat(0xc4a46c, {roughness: .5});
  const capsule = new THREE.SphereGeometry(1, 32, 24), cp = capsule.attributes.position;
  for(let i = 0; i < cp.count; i++){
    let x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const w = .2 + .8*sstep(-1, .6, y);                                                     // wide at the vertex, narrow at the chin
    x *= w; z *= z < 0 ? .55 : .7 + .2*w;                                                   // flat behind, the face a shallow shield
    y -= .1*x*x;                                                                            // the vertex dips between the eyes
    cp.setXYZ(i, x, y, z);
  }
  capsule.computeVertexNormals();
  const hc = add(head, new THREE.Mesh(capsule, HEADG)); hc.scale.set(.12, .135, .055); hc.position.set(0, -.015, 0);
  ell(head, HEADG, .042, .02, .005, 0, -.05, .036);                                          // clypeus, a broad low plate
  ell(head, MOUTH, .018, .012, .008, 0, -.082, .03);                                         // labrum
  // compound eyes: big glossy ovoids bulging out of the upper corners, the same green as the head, each with a
  // small dark pseudopupil facing forward that seems to follow you
  for(const s of [-1, 1]){
    const eg = joint(head, s*.1, .045, .004); eg.rotation.z = -s*.2;
    const er = new V3(.05, .068, .05);
    ell(eg, CEYE, er.x, er.y, er.z, 0, 0, 0);
    const u = new V3(s*.12, -.05, 1).normalize(), t = 1/Math.hypot(u.x/er.x, u.y/er.y, u.z/er.z);
    const pd = ell(eg, PUP, .0062, .0075, .003, 0, 0, 0); pd.position.copy(u).multiplyScalar(t - .0015);
    pd.quaternion.setFromUnitVectors(new V3(0, 0, 1), u);
    // antenna: a green socket and scape between the eyes, then a long thin tan flagellum sweeping up and out
    ell(head, LIME, .01, .01, .006, s*.028, .066, .033);
    const a = joint(head, s*.028, .068, .033); a.rotation.set(-1.15, s*.3, 0);
    tubeZ(a, .03, .006, .005, LIME);
    const fl = joint(a, 0, 0, .03); fl.rotation.x = .12; tubeZ(fl, .75, .004, .0015, ANT);
    // maxillary palps folded beside the mouth
    const pa = joint(head, s*.024, -.088, .03); pa.rotation.set(1.2, 0, s*.25);
    tubeZ(pa, .025, .005, .004, MOUTH); const pb = joint(pa, 0, 0, .025); pb.rotation.x = .9;
    tubeZ(pb, .02, .004, .003, MTIP);
  }
  for(const [x, y] of [[0, .086], [-.016, .074], [.016, .074]]) ell(head, OCEL, .005, .005, .004, x, y, .036);   // three ocelli
  const jaw = [-1, 1].map(s => {                                                            // mandibles, dark-tipped
    const j = joint(head, s*.011, -.103, .028);
    ell(j, MOUTH, .012, .016, .01, 0, 0, 0); ell(j, MTIP, .006, .009, .006, -s*.004, -.013, .003);
    return j;
  });
  const fore = [-1, 1].map(s => {
    const coxa = joint(pro, s*.055, -.03, .4); coxa.rotation.y = s*.1; tubeZ(coxa, .2, .03, .024, GRN);
    const femur = joint(coxa, 0, 0, .2); tubeZ(femur, .3, .032, .022, GRN);
    for(let i = 0; i < 6; i++){ const c = add(femur, new THREE.Mesh(CONE, SPN)); c.position.set((i % 2 - .5)*.02, -.026, .06 + i*.04); }
    ell(femur, DOT, .012, .012, .012, -s*.03, .0, .1);                                      // the dark eye-spot on the inner face
    const tibia = joint(femur, 0, -.01, .3); tubeZ(tibia, .2, .02, .012, GRN);
    for(let i = 0; i < 5; i++){ const c = add(tibia, new THREE.Mesh(CONE, SPN)); c.position.set(0, -.018, .03 + i*.035); c.scale.setScalar(.8); }
    const tar = joint(tibia, 0, 0, .2); tar.rotation.x = -.6; tubeZ(tar, .1, .008, .005, SPN);
    return {coxa, femur, tibia};
  });
  const legs = [];
  for(const s of [-1, 1]){
    const sg = joint(body, 0, 0, 0); sg.scale.x = s;
    [[.08, -.55, 1, 0], [-.04, .75, 1.2, 1]].forEach(([z, yaw, k, i]) => {
      const hip = joint(sg, .06, .26, z); hip.rotation.order = 'YZX'; hip.rotation.y = yaw; hip.rotation.z = .55; tubeX(hip, .42*k, .016, .012, GRN);
      const knee = joint(hip, .42*k, 0, 0); knee.rotation.z = -1.8; tubeX(knee, .5*k, .012, .008, GRN);
      const tar = joint(knee, .5*k, 0, 0); tar.rotation.z = 1.15; tubeX(tar, .14*k, .007, .005, SPN);
      legs.push({hip, knee, yaw, ph: (i + (s > 0 ? 0 : 1)) % 2*Math.PI});
    });
  }
  root.userData.parts = {body, pro, head, jaw, fore, legs};
  return root;
}
function poseMantis(pr, o){
  const P = pr.m.userData.parts, t = pr.t;
  P.body.position.set(0, (o.bob || 0), (o.sway || 0));
  P.pro.rotation.x = -.6 - (o.rear || 0)*.35;
  for(const L of P.legs){
    const ph = pr.walkPh + L.ph, w = o.walk || 0;
    L.hip.rotation.y = L.yaw + Math.sin(ph)*.3*w;
    L.hip.rotation.z = .55 + Math.max(0, Math.cos(ph))*.35*w + (o.spread || 0)*.4;
    L.knee.rotation.z = -1.8 + (o.spread || 0)*.9;
  }
  // forelegs: ext 0 = folded in prayer, 1 = flung out; grip closes the tibiae on the catch
  const ext = o.ext || 0, grip = o.grip || 0;
  for(const F of P.fore){
    F.coxa.rotation.x = 1.3 - ext*.85 - grip*.25 + Math.sin(t*1.3)*.02;
    F.femur.rotation.x = -1.5 + ext*.9 + grip*.2;
    F.tibia.rotation.x = 2.7 - ext*1.8 + grip*.25;
  }
  P.jaw.forEach((j, i) => { j.rotation.z = (i ? 1 : -1)*(o.chew ? .4 + .4*Math.sin(t*22) : .1); });
}

// ---- the predator
function makePred(kind){
  const m = makeMantis(), home = new V3(-2.6, 0, 11.4);
  const pr = {kind, m, home, pos: new V3(), up: new V3(0, 1, 0), fwd: new V3(0, 0, 1), surf: PRED_GROUND, t: Math.random()*10, walkPh: 0,
    reach: .32, range: 6, climby: .4, hunting: false, sees: false, seenT: 0, last: new V3(),
    goal: null, pause: prr(1, 3), best: 1e9, stuckT: 0, hop: null, state: 'roam', kt: 0, toastT: -99, lostT: -99,
    motion: 0, temp: .42, self: false, hl: 0,
    spotMsg: 'A praying mantis has seen you move! Freeze, or sneak away (C).', lostMsg: 'The mantis has lost sight of you.'};
  m.userData.owner = pr; m.rotation.order = 'YXZ';
  const P = m.userData.parts;
  pr.eyeWorld = () => P.head.getWorldPosition(new V3());
  pr.mouthWorld = () => P.head.localToWorld(new V3(0, -.1, .06));
  scene.add(m); m.traverse(o => { if(o.isMesh) drawables.push(o); });
  predHome(pr);
  return pr;
}
function predHome(pr){
  pr.pos.copy(PRED_GROUND.proj(pr.home)); pr.surf = PRED_GROUND; pr.up.set(0, 1, 0); pr.hop = null; pr.state = 'roam'; pr.kt = 0;
  pr.hunting = false; pr.sees = false; pr.goal = null; pr.pause = prr(2, 4); pr.best = 1e9; pr.stuckT = 0;
  const a = Math.random()*6.28; pr.fwd.set(Math.sin(a), 0, Math.cos(a));
  pr.m.scale.setScalar(1);
  predOrient(pr, 1, null);
}

// ---- Portia in its grip
function holdPortia(at, q, twitch, shrink = 1){
  sp.pos.copy(at); sp.vel.set(0, 0, 0); sp.m.position.copy(at); if(q) sp.m.quaternion.copy(q);
  sp.m.scale.setScalar(shrink); gaitRelease(sp.m); sp.charging = false;
  poseSpider(sp.m, twitch > 0 ? {twitch: Math.sin(time*46)*.45*twitch, raise: .6*twitch, air: 1} : {crouch: 1, grab: 1});
}
function doomStart(pr){
  if(sp.feed) endFeed(false);
  if(sp.balloon) endBalloon();
  sp.line = false; sp.stuck = 0; sp.charging = false; sp.roll = null;
  DOOM.t = 0; DOOM.by = pr; DOOM.reset = false; DOOM.from = sp.pos.clone(); DOOM.q = sp.m.quaternion.clone();
  pr.hunting = false; pr.sees = false;
}

function updMantis(pr, dt){
  const P = pr.m.userData.parts;
  pr.t += dt;
  if(pr.state === 'strike'){                                     // flung out, snapped shut, then devoured
    pr.kt += dt; const k = pr.kt;
    const ext = k < .12 ? sstep(0, .12, k) : 1 - sstep(.12, .26, k), grip = sstep(.16, .3, k);
    const hp = P.head.localToWorld(new V3(0, -.12, .17));
    if(k < .1) holdPortia(DOOM.from, null, 1);
    else holdPortia(DOOM.from.clone().lerp(hp, sstep(.1, .24, k)), pr.m.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, Math.PI, 0))), 1);
    const eat = k > .5;
    if(eat){ const bite = Math.sin(pr.t*3.2); P.head.rotation.x = .95 + .18*Math.max(0, bite); }
    if(k > .5) holdPortia(hp, null, Math.max(0, 1 - (k - .5)/1.5), Math.max(.35, 1 - (k - .5)*.22));
    poseMantis(pr, {ext, grip, chew: eat, rear: 1 - sstep(.3, .8, k)*.6});
    predOrient(pr, dt, null);
    pr.motion = k < .3 ? 1 : .3;
    return;
  }
  predSense(pr, dt);
  let want = null, walk = 0, sway = 0;
  if(pr.hop){ predHopTick(pr, dt); want = pr.hop ? pr.hop.dir : null; }
  else if(pr.hunting){
    const spAt = sp.pos.clone().addScaledVector(sp.plat && sp.mode === 'climb' ? sp.plat.normal(sp.pos) : UP, .05);
    const reachPt = P.head.getWorldPosition(new V3());
    if(pr.sees && reachPt.distanceTo(spAt) < .85 && spAt.clone().sub(pr.pos).dot(pr.fwd) > 0){
      pr.state = 'strike'; pr.kt = 0; doomStart(pr); return;
    }
    const d = predProgress(pr, pr.last, dt);
    if(d > .45 && pr.stuckT < 3){ const b = pr.pos.clone(); predWalk(pr, pr.last, .55*dt); want = pr.pos.clone().sub(b); walk = 1; }
    else if(d > .45 && pr.stuckT >= 3){ const T = predHopTarget(pr, pr.last, 1.2); pr.stuckT = 0; pr.best = d; if(T) predStartHop(pr, T, .35); }
    if(walk === 0) want = pr.last.clone().sub(pr.pos);
  } else if(pr.pause > 0){ pr.pause -= dt; sway = Math.sin(pr.t*2.6)*.025; }       // swaying like a leaf in a breeze
  else {
    if(!pr.goal){ pr.goal = predWanderGoal(pr); pr.best = 1e9; pr.stuckT = 0; }
    const d = predProgress(pr, pr.goal, dt);
    if(d < .3){ pr.goal = null; pr.pause = prr(3, 9); }
    else if(pr.stuckT > 2.5){ const T = predHopTarget(pr, pr.goal, 1.2); if(T) predStartHop(pr, T, .35); else pr.goal = null; pr.stuckT = 0; pr.best = d; }
    else { const b = pr.pos.clone(); predWalk(pr, pr.goal, .38*dt); want = pr.pos.clone().sub(b); walk = 1; sway = Math.sin(pr.t*7)*.012; }
  }
  predOrient(pr, dt, want, pr.hunting ? 2.5 : 4);
  pr.walkPh += dt*9*walk;
  // the head swivels to keep its eyes on her (or on where she was)
  const look = pr.hunting ? pr.last : null;
  if(look){ const l = P.pro.worldToLocal(look.clone()); P.head.rotation.y += (Math.max(-1, Math.min(1, Math.atan2(l.x, l.z))) - P.head.rotation.y)*(1 - Math.exp(-6*dt)); }
  else P.head.rotation.y += (Math.sin(pr.t*.4)*.35 - P.head.rotation.y)*(1 - Math.exp(-2*dt));
  P.head.rotation.x = .95;
  poseMantis(pr, {walk, sway, spread: pr.hop ? Math.sin(Math.PI*pr.hop.k) : 0, rear: pr.hunting ? .5 : 0});
  pr.motion = walk ? .5 : pr.hop ? .8 : .04;
}

const PREDS = [makePred('mantis')];
PREDS[0].update = updMantis;

// ---- the fade: "It is the end for you.." to black, then "...but your sisters continue the hunt." and a new Portia
function doomReset(){
  Object.assign(sp, {mode:'ground', plat: START, vigor: 1, stuck: 0, charging: false, braked: false, anchorPlat: null, line: false,
    roll: null, committed: false, holdIn: false, plop: false});
  sp.pos.set(START.x, START.y, START.z); sp.vel.set(0, 0, 0); sp.yaw = 0;
  sp.m.visible = true; sp.m.scale.setScalar(1); sp.m.rotation.set(0, 0, 0); sp.m.position.copy(sp.pos); gaitRelease(sp.m);
  for(const pr of PREDS) predHome(pr);
  PRED.grace = 4; SEEN.last.copy(sp.pos); SEEN.speed = 0;
}
function doomTick(dt){
  const el = $('#doom'); if(DOOM.t < 0){ if(!el.hidden) el.hidden = true; return; }
  DOOM.t += dt; const t = DOOM.t;
  if(el.hidden) el.hidden = false;
  const bg = t < 3.6 ? sstep(.9, 3.6, t) : 1 - sstep(6.8, 9, t);
  el.querySelector('.dm-bg').style.opacity = bg.toFixed(3);
  el.querySelector('.dm-a').style.opacity = (sstep(1.4, 2.4, t)*(1 - sstep(4.3, 4.9, t))).toFixed(3);
  el.querySelector('.dm-b').style.opacity = (sstep(5.4, 6.3, t)*(1 - sstep(7.6, 8.8, t))).toFixed(3);
  if(t >= 5.1 && !DOOM.reset){ DOOM.reset = true; doomReset(); }
  if(t >= 9){ DOOM.t = -1; DOOM.by = null; el.hidden = true; }
}
function updatePredators(dt){
  if(!SEEN.init){ SEEN.init = true; SEEN.last.copy(sp.pos); }
  const v = sp.pos.distanceTo(SEEN.last)/Math.max(dt, 1e-4); SEEN.last.copy(sp.pos);
  SEEN.speed += (Math.min(v, 5) - SEEN.speed)*(1 - Math.exp(-12*dt));
  if(DOOM.t < 0 || DOOM.reset) PRED.grace = Math.max(0, PRED.grace - dt);
  for(const pr of PREDS) pr.update(pr, dt);
  doomTick(dt);
}
