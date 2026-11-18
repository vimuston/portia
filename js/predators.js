'use strict';
// mantis predator and the doom sequence

/* =====================================================================
   PREDATORS — a praying mantis lies in wait on a tree trunk. It roams up and down and around that one trunk and
   never leaves it: no limbs, leaves, soil or other trees. It hunts Portia by sight, and sight sees only movement: standing still, or
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
const PRED_WRAP = new Map(), TREE_WRAP = new Map();
function predClimb(S){
  let w = PRED_WRAP.get(S);
  if(!w) PRED_WRAP.set(S, w = {id: S.id, S, proj: v => S.project(v.clone()), norm: q => S.normal(q), ok: q => q.y > floorAt(q.x, q.z) - .05});
  return w;
}
// a tree-dweller's view of the same bark: only the part held well clear of the soil counts, so the trunk base and
// the root flare are no way down
const TREE_CLEAR = 1.6;   // never lower than this on its trunk: it keeps to the bark well above the litter
const treeBark = S => !S.web && S.label === 'bark' && !S.top && !S.log && S.project && S.normal;
function predTree(S){
  let w = TREE_WRAP.get(S);
  if(!w) TREE_WRAP.set(S, w = {id: S.id, S, tree: true, proj: v => S.project(v.clone()), norm: q => S.normal(q), ok: q => q.y > floorAt(q.x, q.z) + TREE_CLEAR});
  return w;
}
function predPlat(p){
  let w = PRED_WRAP.get(p);
  if(!w) PRED_WRAP.set(p, w = {id: p.id, p,
    proj: v => { const [x, z] = clampTo(p, v.x, v.z); return new V3(x, surfAt(p, x, z) + .003, z); },
    norm: () => UP.clone(), ok: q => inPlat(p, q.x, q.z, .03)});
  return w;
}
function predCands(pos, reach, cur, trunk){
  if(trunk) return [predTree(trunk)];                           // its own trunk and nothing else
  const out = [PRED_GROUND];
  for(const S of climbsNear(pos.x, pos.z, reach + .3))
    if(!S.web && S.label !== 'leaf' && S.label !== 'vine' && S.project && S.normal && pos.y > S.y0 - reach && pos.y < S.y1 + reach) out.push(predClimb(S));
  for(const p of PLAT){
    if(p.kind === 'web' || p.kind === 'flower') continue;
    const e = platR(p) + reach;
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
    for(const C of predCands(pr.pos, pr.reach, pr.surf, pr.trunk)){
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
    for(const C of predCands(P, 1.1, null, pr.trunk)){
      const q = C.proj(P); if(q.distanceTo(P) > 1.1 || !C.ok(q) || q.distanceTo(pr.pos) > Lmax*1.5) continue;
      const s = q.distanceTo(goal) + Math.abs(a)*.1;
      if(s < bs){ bs = s; best = {C, q}; }
    }
  }
  return best;
}
function predStartHop(pr, T, dur){
  const n1 = T.C.norm(T.q), D = pr.pos.distanceTo(T.q);
  pr.hop = {p0: pr.pos.clone(), p1: T.q.clone(), C: T.C, k: 0, dur: D > 2 ? .3 + D*.12 : dur*(.7 + .3*Math.min(1.5, D)), H: D > 2 ? .4 + .08*D : .15 + .3*D,
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
// a spot on a trunk or limb, high enough off the soil
function predTreeSpot(S){
  for(let i = 0; i < 12; i++){
    let q;
    if(S.tube){ const pt = S._pts[Math.random()*S._pts.length | 0]; q = S.project(pt.clone().add(new V3(prr(-.3, .3), .5, prr(-.3, .3)))); }
    else { const a = prr(0, 6.28), y = Math.min(S.y1 - .5, floorAt(S.cx, S.cz) + prr(2.2, 5.5)); q = S.project(new V3(S.cx + Math.cos(a)*40, y, S.cz + Math.sin(a)*40)); }
    if(q && predTree(S).ok(q) && q.y < floorAt(q.x, q.z) + 6) return q;      // low enough to hunt from, not up in the canopy
  }
  return null;
}
function predWanderGoal(pr){
  const r = Math.random(), near = (x, z, R) => Math.hypot(x - pr.pos.x, z - pr.pos.z) < R && Math.hypot(x, z) < 15;
  if(pr.trunk){                                                 // another spot on its own trunk
    let best = null, bd = 1e9;                                 // a short shift: the nearest of a few spots, a body length or two away
    for(let i = 0; i < 8; i++){ const q = predTreeSpot(pr.trunk); if(!q) continue; const d = q.distanceTo(pr.pos);
      if(d > .4 && d < bd){ bd = d; best = q; } }
    return best || pr.home.clone();
  }
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
const PRED_FORGET = 8;
const PRED_STANDOFF = 1.0;   // how far short of a frozen Portia it halts while stalking   // seconds out of sight before it gives up the hunt (the boss bar drains over this)
// what it sees: only Portia moving, and not sneaking
function portiaVisible(){ return DOOM.t < 0 && PRED.grace <= 0 && !sp.sneaking && (SEEN.speed > .12 || sp.mode === 'air'); }
// a trunk-bound mantis only hunts what is on its own bark: Portia down in the litter is beneath its notice
const predCanReach = pr => !pr.trunk || (sp.mode === 'climb' && sp.plat === pr.trunk);
function predSense(pr, dt){
  const vis = portiaVisible() && predCanReach(pr) && pr.eyeWorld().distanceTo(sp.pos) < pr.range;
  if(vis){
    pr.sees = true; pr.seenT = 0; pr.last.copy(sp.pos);
    if(!pr.hunting){ pr.hunting = true; pr.goal = null; pr.pause = 0; pr.best = 1e9; pr.stuckT = 0; }
  } else {
    pr.sees = false;
    if(pr.hunting && (pr.seenT += dt) > PRED_FORGET){ pr.hunting = false; pr.goal = null; pr.pause = prr(8, 15); pr.gaveUp = true; }
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
  // the head: a rounded three-sided pyramid. One smooth skin is stretched over a few rounded lobes (the two compound
  // eyes at the upper tips, the narrow chin, the occiput behind where the neck joins, a low bulge of frons): each
  // surface direction takes a soft blend of the lobes' support points, so the faces between them come out flat-ish
  // and the tips round.
  const head = joint(pro, 0, .01, .53); head.rotation.x = .95;
  const HEADG = mat(0x86b83e, {roughness: .42}), MOUTH = mat(0x6f6232, {roughness: .45}), MTIP = mat(0x3b2a17, {roughness: .4}),
        OCEL = new THREE.MeshPhysicalMaterial({color: 0xcfe88a, roughness: .1, clearcoat: 1}), ANT = mat(0xc4a46c, {roughness: .5});
  const EYEC = new V3(.088, .045, 0), EYER = new V3(.042, .055, .042), EYEB = .009;   // the eye bulges EYEB past the skin
  const lobes = [[EYEC.clone(), EYER], [new V3(-EYEC.x, EYEC.y, EYEC.z), EYER],
    [new V3(0, -.1, .016), new V3(.019, .016, .016)],                                       // chin
    [new V3(0, .012, -.034), new V3(.046, .042, .03)],                                      // occiput
    [new V3(0, -.01, .016), new V3(.034, .045, .022)]];                                     // frons
  const hp = d => {                                                                          // the skin point facing direction d
    let hm = -1e9; const sp = lobes.map(([c, R]) => { const rd = Math.hypot(R.x*d.x, R.y*d.y, R.z*d.z), h = c.dot(d) + rd;
      hm = Math.max(hm, h); return {h, p: new V3(c.x + R.x*R.x*d.x/rd, c.y + R.y*R.y*d.y/rd, c.z + R.z*R.z*d.z/rd)}; });
    const out = new V3(); let W = 0;
    for(const {h, p} of sp){ const w = Math.exp(160*(h - hm)); out.addScaledVector(p, w); W += w; }
    return out.multiplyScalar(1/W);
  };
  const hg = new THREE.SphereGeometry(1, 72, 54), hpos = hg.attributes.position, hnrm = hg.attributes.normal, d = new V3();
  for(let i = 0; i < hpos.count; i++){
    d.fromBufferAttribute(hpos, i).normalize(); const q = hp(d);
    hpos.setXYZ(i, q.x, q.y, q.z); hnrm.setXYZ(i, d.x, d.y, d.z);                           // a support point's normal is its direction
  }
  const hm = add(head, new THREE.Mesh(hg, HEADG));
  const RC = new THREE.Raycaster(), hx = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));                                                          // a point on the skin, seen from inside
  const at = (x, y, z) => { RC.set(new V3(0, .01, -.01), new V3(x, y, z).normalize()); const h = RC.intersectObject(hx, false);
    return h.length ? h[h.length - 1].point : hp(new V3(x, y, z).normalize()); };
  // compound eyes: glossy caps over the two upper tips, a little paler than the head; the pseudopupil is a small
  // soft dark spot painted on, facing forward, that seems to follow you
  const ecv = document.createElement('canvas'); ecv.width = 256; ecv.height = 128;
  const g2 = ecv.getContext('2d'); g2.fillStyle = '#b7d35a'; g2.fillRect(0, 0, 256, 128);
  const rim = g2.createLinearGradient(0, 0, 256, 0);                                         // darker toward the back of the eye
  rim.addColorStop(0, 'rgba(60,80,20,.35)'); rim.addColorStop(.3, 'rgba(60,80,20,0)'); rim.addColorStop(.7, 'rgba(60,80,20,0)'); rim.addColorStop(1, 'rgba(60,80,20,.35)');
  g2.fillStyle = rim; g2.fillRect(0, 0, 256, 128);
  g2.save(); g2.translate(128, 64); g2.scale(1, 1.25);
  const pg = g2.createRadialGradient(0, 0, 0, 0, 0, 5.5);
  pg.addColorStop(0, 'rgba(14,20,5,.95)'); pg.addColorStop(.3, 'rgba(14,20,5,.75)'); pg.addColorStop(1, 'rgba(14,20,5,0)');
  g2.fillStyle = pg; g2.beginPath(); g2.arc(0, 0, 5.5, 0, 6.29); g2.fill(); g2.restore();
  const etex = new THREE.CanvasTexture(ecv); etex.colorSpace = THREE.SRGBColorSpace; etex.anisotropy = 4;
  const CEYE = new THREE.MeshPhysicalMaterial({map: etex, roughness: .28, clearcoat: 1, clearcoatRoughness: .12});
  for(const s of [-1, 1]){
    const look = new V3(s*.3, -.05, 1).normalize();                                          // where the pupil sits (uv centre is +x)
    const eg = new THREE.SphereGeometry(1, 40, 28).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), look));
    const eye = add(head, new THREE.Mesh(eg, CEYE)); eye.position.set(s*EYEC.x, EYEC.y, EYEC.z);
    eye.scale.set(EYER.x + EYEB, EYER.y + EYEB*1.2, EYER.z + EYEB);
    // antenna: a green socket and scape between the eyes, then a long thin tan flagellum sweeping up and out
    const sk = at(s*.36, .62, 1); ell(head, LIME, .009, .009, .005, sk.x, sk.y, sk.z);
    const a = joint(head, sk.x, sk.y, sk.z); a.rotation.set(-1.15, s*.3, 0);
    tubeZ(a, .03, .006, .005, LIME);
    const fl = joint(a, 0, 0, .03); fl.rotation.x = .12; tubeZ(fl, .75, .004, .0015, ANT);
    // maxillary palps folded beside the mouth
    const pa = joint(head, s*.017, -.1, .026); pa.rotation.set(1.2, 0, s*.25);
    tubeZ(pa, .025, .005, .004, MOUTH); const pb = joint(pa, 0, 0, .025); pb.rotation.x = .9;
    tubeZ(pb, .02, .004, .003, MTIP);
  }
  for(const [x, y] of [[0, .9], [-.12, .78], [.12, .78]]){ const o = at(x, y, 1); ell(head, OCEL, .0045, .0045, .003, o.x, o.y, o.z); }   // three ocelli
  ell(head, MOUTH, .014, .01, .007, 0, -.097, .03);           // labrum
  const jaw = [-1, 1].map(s => {                                                            // mandibles, dark-tipped
    const j = joint(head, s*.008, -.112, .024);
    ell(j, MOUTH, .011, .015, .009, 0, 0, 0); ell(j, MTIP, .006, .009, .006, -s*.004, -.012, .003);
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
      legs.push({sg, hip, knee, tar, yaw, side: s, i, A: .42*k, B: .5*k, C: .14*k, grp: (i + (s > 0 ? 0 : 1)) % 2,
        rest: new V3(.06 + Math.cos(yaw)*.655*k, -.008, -Math.sin(yaw)*.655*k), foot: new V3(), planted: false, step: null});
    });
  }
  // each foot's rest spot in its side's frame: where the default pose puts the tarsus tip (a relaxed ~60% stretch)
  root.updateMatrixWorld(true);
  for(const L of legs) L.rest = L.sg.worldToLocal(L.tar.localToWorld(new V3(L.C, 0, 0)));
  root.userData.parts = {body, pro, head, jaw, fore, legs};
  return root;
}
// ---- the mantis walks like the spiders do: every walking foot is planted on the surface and stays put while the
// body moves over it, bent onto its foothold by IK. A foot that falls a stride behind its rest spot (led ahead along
// the motion) steps there in an arc; the four legs go in diagonal pairs (L1+R2, R1+L2), a pair only lifting while the
// other stands, so it walks with the slow rocking gait of a real mantis.
const MPHI = -.1;                                                // the tarsus lies along the surface
function mantisLegIK(L, fw){
  const d = L.sg.worldToLocal(fw.clone()).sub(L.hip.position);
  L.hip.rotation.y = Math.atan2(-d.z, d.x);
  const {A, B, C} = L, cl = v => Math.max(-1, Math.min(1, v));
  const px = Math.hypot(d.x, d.z) - C*Math.cos(MPHI), py = d.y - C*Math.sin(MPHI);
  const D = Math.min(A + B - 1e-4, Math.max(Math.abs(A - B) + 1e-4, Math.hypot(px, py)));
  const t0 = Math.atan2(py, px) + Math.acos(cl((A*A + D*D - B*B)/(2*A*D)));        // knee up, as a mantis holds them
  const t1 = t0 - Math.PI + Math.acos(cl((A*A + B*B - D*D)/(2*A*B)));
  L.hip.rotation.z = t0; L.knee.rotation.z = t1 - t0; L.tar.rotation.z = MPHI - t1;
}
function mantisGaitRelease(pr){ for(const L of pr.m.userData.parts.legs){ L.planted = false; L.step = null; } pr.gv = null; }
function mantisGait(pr, dt, moved){
  const P = pr.m.userData.parts, up = pr.up;
  pr.m.updateMatrixWorld(true);
  const v = moved && dt > 0 ? moved.clone().multiplyScalar(1/dt) : new V3();
  pr.gv = pr.gv ? pr.gv.lerp(v, 1 - Math.exp(-10*dt)) : v;                      // smoothed, so a stalled frame doesn't jerk the lead
  const spd = pr.gv.length(), dur = Math.max(.13, .24 - spd*.15), stride = .11, tmp = new V3();
  const busy = g => P.legs.some(o => o.step && o.grp !== g);
  for(const L of P.legs){
    const des = pr.surf.proj(L.sg.localToWorld(L.rest.clone()).addScaledVector(pr.gv, dur*1.1 + .03));
    if(!L.planted){                                              // (re)plant: from where the foot hangs now, a quick step down
      const tip = L.tar.localToWorld(new V3(L.C, 0, 0));
      L.planted = true; L.foot.copy(tip); L.step = {from: tip, to: des, t: 0, dur: .15};
    }
    if(L.step){
      L.step.to.copy(des); L.step.t += dt/L.step.dur;
      const k = Math.min(1, L.step.t), e = k*k*(3 - 2*k);
      L.foot.lerpVectors(L.step.from, L.step.to, e).addScaledVector(up, Math.sin(Math.PI*k)*(.06 + spd*.05));
      if(k >= 1){ L.foot.copy(L.step.to); L.step = null; }
    } else {
      tmp.subVectors(L.foot, des); const vert = tmp.dot(up); tmp.addScaledVector(up, -vert);
      const err = tmp.length();
      if(err > 1.2) L.foot.copy(des);                                               // teleported: just plant
      else if((err > stride || Math.abs(vert) > .08 || (spd < .02 && err > .07)) && !busy(L.grp))
        L.step = {from: L.foot.clone(), to: des, t: 0, dur: spd < .02 ? .2 : dur};   // at rest it tidies its feet under it
    }
  }
  for(const L of P.legs) mantisLegIK(L, L.foot);
  // the body dips a touch while a pair is in the air
  const n = P.legs.filter(L => L.step).length;
  pr.bob = (pr.bob || 0) + ((n ? -.012 : 0) - (pr.bob || 0))*(1 - Math.exp(-12*dt));
}
function poseMantis(pr, o){
  const P = pr.m.userData.parts, t = pr.t;
  P.body.position.set(0, (o.bob || 0), (o.sway || 0));
  P.pro.rotation.x = -.6 - (o.rear || 0)*.35;
  if(o.air != null) for(const L of P.legs){                       // airborne (a hop): legs off their feet, flung wide
    L.hip.rotation.y = L.yaw; L.hip.rotation.z = .55 + o.air*.4; L.knee.rotation.z = -1.8 + o.air*.9; L.tar.rotation.z = 1.15;
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
  const pr = {kind, m, home, pos: new V3(), up: new V3(0, 1, 0), fwd: new V3(0, 0, 1), surf: PRED_GROUND, t: Math.random()*10,
    reach: .32, range: 6, climby: .4, tree: true, trunk: null, hunting: false, sees: false, seenT: 0, last: new V3(),
    goal: null, pause: prr(15, 40), best: 1e9, stuckT: 0, hop: null, state: 'roam', kt: 0, gaveUp: false,
    motion: 0, temp: .42, self: false, hl: 0};
  m.userData.owner = pr; m.rotation.order = 'YXZ';
  const P = m.userData.parts;
  pr.eyeWorld = () => P.head.getWorldPosition(new V3());
  pr.mouthWorld = () => P.head.localToWorld(new V3(0, -.1, .06));
  scene.add(m); m.traverse(o => { if(o.isMesh) drawables.push(o); });
  predHome(pr);
  return pr;
}
function predHome(pr){
  pr.pos.copy(PRED_GROUND.proj(pr.home)); pr.surf = PRED_GROUND; pr.up.set(0, 1, 0); pr.trunk = null;
  if(pr.tree){                                                   // up on the nearest trunk
    const T = CLIMBS.filter(S => treeBark(S) && !S.tube).sort((a, b) => Math.hypot(a.cx - pr.home.x, a.cz - pr.home.z) - Math.hypot(b.cx - pr.home.x, b.cz - pr.home.z))[0];
    if(T){ const g = floorAt(T.cx, T.cz), d = new V3(pr.home.x - T.cx, 0, pr.home.z - T.cz).normalize();
      pr.pos.copy(T.project(new V3(T.cx + d.x*40, g + 2.8, T.cz + d.z*40))); pr.surf = predTree(T); pr.trunk = T; pr.up.copy(T.normal(pr.pos)); pr.home.copy(pr.pos); }
  } pr.hop = null; pr.state = 'roam'; pr.kt = 0;
  pr.hunting = false; pr.sees = false; pr.goal = null; pr.pause = prr(15, 40); pr.best = 1e9; pr.stuckT = 0;
  const a = Math.random()*6.28; pr.fwd.set(Math.sin(a), 0, Math.cos(a));
  pr.m.scale.setScalar(1);
  predOrient(pr, 1, null);
  mantisGaitRelease(pr); pr.gp = null;
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
  DOOM.t = 0; DOOM.by = pr; DOOM.reset = false; DOOM.from = sp.pos.clone(); DOOM.at = sp.m.position.clone(); DOOM.q = sp.m.quaternion.clone();
  DOOM.flat = UP.clone().applyQuaternion(DOOM.q).y > .8;
  DOOM.killer = null; DOOM.lag = 0; DOOM.eatT = 0;
  const A = sp.m.userData.parts.abd; DOOM.abdS = A ? A.scale.clone() : null;   // lying on something level enough to roll belly-up on
  if(pr){ pr.hunting = false; pr.sees = false; }
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
    poseMantis(pr, {ext, grip, chew: eat, rear: 1 - sstep(.3, .8, k)*.6, bob: pr.bob});
    predOrient(pr, dt, null);
    mantisGait(pr, dt, null);
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
    // stalking a Portia that has frozen where it last saw her: halt a body length short and wait, rather than walk onto her
    const stop = !pr.sees && pr.last.distanceTo(sp.pos) < .3 ? PRED_STANDOFF : .45;
    const d = predProgress(pr, pr.last, dt);
    if(d > stop && pr.stuckT < 3){ const b = pr.pos.clone(); predWalk(pr, pr.last, .55*dt); want = pr.pos.clone().sub(b); walk = 1; }
    else if(d > stop && pr.trunk){ pr.stuckT = 0; pr.best = d; }   // as close as the bark gets her: wait there, and follow if she moves
    else if(d > stop && pr.stuckT >= 3){   // hop aims for the standoff point, not onto her (never off a trunk)
      const aim = stop > .45 ? pr.last.clone().add(pr.pos.clone().sub(pr.last).setLength(stop)) : pr.last;
      const T = predHopTarget(pr, aim, 1.2); pr.stuckT = 0; pr.best = d; if(T) predStartHop(pr, T, .35); }
    if(walk === 0) want = pr.last.clone().sub(pr.pos);
  } else if(pr.pause > 0){ pr.pause -= dt; sway = Math.sin(pr.t*2.6)*.025; }       // swaying like a leaf in a breeze
  else {
    if(!pr.goal){ pr.goal = predWanderGoal(pr); pr.best = 1e9; pr.stuckT = 0; }
    const d = predProgress(pr, pr.goal, dt);
    if(d < .3){ pr.goal = null; pr.pause = prr(25, 60); }   // a sit-and-wait hunter: long still spells, a short shift now and then
    else if(pr.stuckT > 2.5 && pr.trunk){ pr.goal = null; pr.pause = prr(10, 20); }   // on a trunk it never hops: pick another spot
    else if(pr.stuckT > 2.5){ const T = predHopTarget(pr, pr.goal, 1.2); if(T) predStartHop(pr, T, .35); else pr.goal = null; pr.stuckT = 0; pr.best = d; }
    else { const b = pr.pos.clone(); predWalk(pr, pr.goal, .38*dt); want = pr.pos.clone().sub(b); walk = 1; sway = Math.sin(pr.t*7)*.012; }
  }
  const p0 = pr.gp || pr.pos.clone();
  predOrient(pr, dt, want, pr.hunting ? 2.5 : 4);
  pr.gp = pr.pos.clone();
  // the head swivels to keep its eyes on her (or on where she was)
  const look = pr.hunting ? pr.last : null;
  if(look){ const l = P.pro.worldToLocal(look.clone()); P.head.rotation.y += (Math.max(-1, Math.min(1, Math.atan2(l.x, l.z))) - P.head.rotation.y)*(1 - Math.exp(-6*dt)); }
  else P.head.rotation.y += (Math.sin(pr.t*.4)*.35 - P.head.rotation.y)*(1 - Math.exp(-2*dt));
  P.head.rotation.x = .95;
  if(pr.hop){ mantisGaitRelease(pr); poseMantis(pr, {sway, air: Math.sin(Math.PI*pr.hop.k), rear: pr.hunting ? .5 : 0}); }
  else { poseMantis(pr, {sway, rear: pr.hunting ? .5 : 0, bob: pr.bob}); mantisGait(pr, dt, pr.pos.clone().sub(p0)); }
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
  if(DOOM.abdS && sp.m.userData.parts.abd) sp.m.userData.parts.abd.scale.copy(DOOM.abdS);
  wrapClear();
  if(DOOM.killer) DOOM.killer.m.userData.parts.body.rotation.x = 0;
  DOOM.killer = null;
  PRED.grace = 4; SEEN.last.copy(sp.pos); SEEN.speed = 0;
}
// bitten to death by a spider (no predator holds her): she convulses where she stands, her legs draw in, and on
// level ground she rolls belly-up like the husks she leaves
function corpseTick(t){
  const P = sp.m.userData.parts, twitch = 1 - sstep(.3, 1.5, t), curl = sstep(.5, 1.7, t);
  const e = DOOM.flat ? sstep(1.1, 2.0, t) : 0, up = UP.clone().applyQuaternion(DOOM.q);
  gaitRelease(sp.m); sp.charging = false; sp.vel.set(0, 0, 0);
  poseSpider(sp.m, {twitch: Math.sin(t*46)*.45*twitch, raise: .5*twitch*(1 - curl), crouch: 1 - curl, curl});
  sp.m.quaternion.copy(DOOM.q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI*e));
  sp.m.position.copy(DOOM.at).addScaledVector(up, (2*P.body.position.y + .01)*e);
  if(P.abd && DOOM.abdS){ const k = 1 - .4*sstep(0, 3, DOOM.eatT || 0); P.abd.scale.set(DOOM.abdS.x*k, DOOM.abdS.y*(.4 + .6*k), DOOM.abdS.z*(.7 + .3*k)); }   // sucked dry
}
function doomTick(dt){
  const el = $('#doom'); if(DOOM.t < 0){ if(!el.hidden) el.hidden = true; return; }
  DOOM.t += dt; const t = DOOM.t - (DOOM.lag || 0);   // a spider kill holds off the fade so you see it feed
  if(el.hidden) el.hidden = false;
  if(!DOOM.by && !DOOM.reset) corpseTick(DOOM.t);
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
