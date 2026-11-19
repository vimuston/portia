'use strict';
// sense updates and camera

function attn(srcPlat){
  if(srcPlat && srcPlat.silk && ((sp.mode === 'ground' && sp.plat && sp.plat.silk === srcPlat.silk) || (sp.mode === 'hang' && sp.anchorPlat && sp.anchorPlat.silk === srcPlat.silk))) return 1;
  if(sp.mode !== 'ground') return .3;
  if(srcPlat === sp.plat) return 1;
  if(srcPlat && srcPlat.ground && sp.plat.ground) return .75;
  return .4;
}

function updateSenses(dt, t){
  const wa = .6 + Math.sin(t*.07)*.9 + Math.sin(t*.23)*.3;
  updateWind(dt, t);
  SU.uWind.value.set(Math.cos(wa), Math.sin(wa), .28 + .18*(.5 + .5*Math.sin(t*.31)) + wind.gust*1.1);
  const vib = [], hear = [], chem = [], gust = [];
  for(const f of flies){
    if(f.gone) continue;
    if(f.vib > 0) vib.push([f.pos, f.vib*attn(f.plat)]);
    if(f.hear > 0) hear.push([f.pos, f.hear]);
    if(f.state === 'fly') gust.push([f.pos, .7]);
    else chem.push([f.pos, .3]);
  }
  if(!male.gone){ if(male.vib > 0) vib.push([male.pos, male.vib*attn(male.plat)*.9]);
    chem.push([male.pos, male.dead ? .3 : .95]); }
  for(const p of PREY){
    if(p.vib > 0) vib.push([p.pos, p.vib*attn(p.plat)]);
    if(!p.dead) chem.push([p.pos, .45]); else if(p.deadT < 30) chem.push([p.pos, .3*(1 - p.deadT/30)]);
    if(p.kind === 'argiope' && p.state === 'pump') gust.push([p.pos, .5]);
  }
  for(const h of husks) if(h.age < 30) chem.push([h.m.position, .25*(1 - h.age/30)]);
  const cyc = t % 4.2; if(cyc < 1.6 && Math.sin(t*55) > 0) hear.push([cricket.pos, .8]);
  for(let i = pulses.length - 1; i >= 0; i--){ const p = pulses[i]; p.amp *= Math.exp(-p.decay*dt); if(p.amp < .02) pulses.splice(i, 1); else vib.push([p.pos, p.amp]); }
  for(let i = gusts.length - 1; i >= 0; i--){ const g = gusts[i]; g.amp *= Math.exp(-2.5*dt); if(g.amp < .02) gusts.splice(i, 1); else gust.push([g.pos, g.amp]); }
  const fill = (arr, U) => { arr.sort((a, b) => b[1] - a[1]); U.forEach((u, i) => { const e = arr[i]; e ? u.set(e[0].x, e[0].y + .02, e[0].z, e[1]) : u.set(0, 0, 0, 0); }); };
  fill(vib, SU.uVib.value); fill(hear, SU.uHear.value); fill(chem, SU.uChem.value); fill(gust, SU.uGust.value);
  let felt = 0;
  for(const [p, a] of vib) felt += a*Math.pow(.5 + .5*Math.sin(p.distanceTo(sp.pos)*2.6 - t*6.5), 6)*Math.exp(-p.distanceTo(sp.pos)*.11);
  for(const [p, a] of gust) felt += a*Math.exp(-p.distanceToSquared(sp.pos)*.5);
  for(const [p, a] of hear) felt += a*.3*Math.exp(-p.distanceTo(sp.pos)*.3);
  sp.felt += (felt - sp.felt)*(1 - Math.exp(-10*dt));
}

const _v = new V3();
// The camera orbits in a frame whose "up" follows the surface she clings to: under a leaf it turns over, on a
// trunk it lies along the bark, so she always reads right-side up. The frame is carried along by the smallest
// rotation each frame (so the view never spins), and back on level ground any leftover twist is folded into yaw.
const camQ = new THREE.Quaternion(), camUp = new V3(0, 1, 0);
const camFwd = () => new V3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)).applyQuaternion(camQ);
const camRight = () => new V3(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw)).applyQuaternion(camQ);
// the rotation taking the camera's up onto a surface normal, used to carry camera-relative input onto her surface while
// the view's roll catches up. It pitches over the camera's right axis first (the way she rolls over a rim, and the way
// the view follows), then takes the smallest turn for what's left: straight 'smallest rotation' is ill-defined when the
// two are nearly opposite (just after she curls under a leaf), and there it sent forward back toward the rim
function upToSurf(u, n){
  const r = camRight(); r.addScaledVector(u, -r.dot(u));
  const m = n.clone().addScaledVector(r.normalize(), -n.dot(r));
  if(m.lengthSq() < .09) return new THREE.Quaternion().setFromUnitVectors(u, n);
  m.normalize();
  const q1 = new THREE.Quaternion().setFromAxisAngle(r, Math.atan2(r.dot(new V3().crossVectors(u, m)), u.dot(m)));
  return new THREE.Quaternion().setFromUnitVectors(m, n).multiply(q1);
}
function camFrame(dt){
  // POV mode (cam.pov, on by default): the view's up follows whatever she clings to (bark, stone, the log, under a
  // leaf), so when she hangs upside down the view does too. Off: the view stays level everywhere except the big trees.
  // Either way, near the floor the roll is eased out so the ground doesn't tilt as she steps onto a surface.
  const pov = cam.pov !== false;
  // rounding a leaf's rim she rolls over it as she walks round: the view turns with her by exactly the same
  // rotation, frame by frame, so it stays behind her the whole way over instead of trailing and catching up afterwards
  if(pov && sp.roll){
    const r = sp.roll, axis = r.axis, ph = (r.a || 0)/Math.PI;
    if(cam.rollRef !== r){ cam.rollRef = r; cam.rollA = 0; cam.rollU0 = camUp.clone(); }
    const turn = ph*(r.leaf ? r.A : Math.PI);
    camQ.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, turn - cam.rollA)).normalize(); cam.rollA = turn;
    camUp.copy(UP).applyQuaternion(camQ);
    if(r.leaf){
      // the view may not lean quite as her body does as she sets off (it smooths the blade's tilt toward the rim), and
      // not always in the plane she rolls in: as it turns with her it closes that gap, so it ends level on the far
      // face with nothing left to catch up
      const body = r.up0.clone().applyAxisAngle(axis, turn), want = cam.rollU0.clone().applyAxisAngle(axis, turn).lerp(body, ph).normalize();
      camQ.premultiply(new THREE.Quaternion().setFromUnitVectors(camUp, want)).normalize(); camUp.copy(UP).applyQuaternion(camQ);
    }
    cam.nSm = camUp.clone();
    return;
  }
  // on an orb web the view's up is always the sheet's normal on her face, POV or not: the view stands behind her as
  // she stands, so her left and right are the screen's (locked onto its spider, A/D step her along them)
  const onSurf = sp.mode === 'climb' && sp.plat && (sp.plat.web || (pov ? true : sp.plat.tree));
  // feeding on an orb, she still stands on its face (the meal's F.up): the view stays tilted to her through the meal
  const webFeed = sp.mode === 'feed' && sp.feed && sp.feed.p.orb && !sp.feed.midair && sp.feed.up;
  let tu = webFeed ? sp.feed.up.clone() : onSurf ? sp.plat.normal(sp.pos).clone() : UP.clone();
  tu.normalize();
  if(onSurf){
    const clr = sp.pos.y - floorAt(sp.pos.x, sp.pos.z), lo = pov && !sp.plat.tree ? .04 : .25, span = pov && !sp.plat.tree ? .25 : .55;
    const f = Math.max(0, Math.min(1, (clr - lo)/span)), k = f*f*(3 - 2*f);
    if(k < 1){ const ang = Math.acos(Math.max(-1, Math.min(1, tu.y)))*k, ax = new V3().crossVectors(UP, tu);
      if(ax.lengthSq() < 1e-8) ax.copy(camRight());
      tu = UP.clone().applyAxisAngle(ax.normalize(), ang); }
  }
  // leaf folds, stone facets and bark ridges make the raw normal twitch from step to step: follow a smoothed one, and
  // roll toward it gently, so the view turns with her evenly rather than in jolts
  if(!cam.nSm) cam.nSm = tu.clone();
  if(cam.nSm.dot(tu) < .5) cam.nSm.copy(tu); else cam.nSm.lerp(tu, 1 - Math.exp(-8*dt)).normalize();   // a real change of surface isn't smoothed away
  tu = cam.nSm.clone();
  if(camUp.dot(tu) < -.97) tu.addScaledVector(camFwd(), .35).normalize();                  // turning right over: roll forward, not sideways
  const gap = Math.min(1, (1 - camUp.dot(tu))/.6);                                              // small wobbles roll gently, a big turn (onto a new face) quickly
  const nu = camUp.clone().lerp(tu, 1 - Math.exp(-(3.5 + 7*gap)*dt)).normalize();
  camQ.premultiply(new THREE.Quaternion().setFromUnitVectors(camUp, nu)).normalize(); camUp.copy(UP).applyQuaternion(camQ);
  if(tu.y > .999 && camUp.y > .9999){ const f = new V3(0, 0, 1).applyQuaternion(camQ); cam.yaw += Math.atan2(f.x, f.z); camQ.identity(); camUp.set(0, 1, 0); }
}
// POV camera: while she moves forward, the view drifts round behind her heading, gently, and not for a couple of
// seconds after you have turned it yourself. Only while you push mostly forward: following a sideways walk would turn
// 'right' with it and send her round in a circle, and walking back toward the camera shouldn't spin it round.
function followBehind(dt){
  const last = cam.lastPos; cam.lastPos = sp.pos.clone();
  if(cam.pov === false || !last || dt <= 0 || cam.swing != null || cam.swingDir || sp.roll || sp.mode === 'air' || sp.mode === 'hang' || cam.lockOn) return;
  if(performance.now() - (cam.userT || -1e9) < 2500) return;
  const iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - (pad.ly || 0), ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + (pad.lx || 0);
  if(iz < .3 || Math.abs(ix) > iz) return;
  const v = sp.pos.clone().sub(last).divideScalar(dt), spd = v.length();
  if(spd < .08 || spd > 4) return;
  const d = v.applyQuaternion(camQ.clone().invert());
  if(Math.hypot(d.x, d.z) < .5*spd) return;
  const hy = Math.atan2(d.x, d.z);
  if(angDiff(cam.yaw, hy) > 1.9) return;
  cam.yaw = lerpAngle(cam.yaw, hy, 1 - Math.exp(-1.4*Math.min(1, spd/.5)*dt));
}
// On an orb weaver's web (an Argiope's, or a garden orb-weaver's) with its spider at home, and on the same face of
// the sheet as it, the view locks onto it: it swings round behind her to look at the spider, and holds there while
// she moves. The spider stands on the web's +n face (its body's up is the web normal); a dead one, or one dropped
// from its web, holds nothing. Returns the occupant, or null.
function webLock(){
  const S = sp.mode === 'climb' && sp.plat && sp.plat.web ? sp.plat : null, p = S && S.silk, O = S && S.orb;
  if(!p || !O || p.dead || p.dropped || p.held || p.orb !== O) return null;
  const a = p.pos.clone().sub(O.C).dot(O.n), occSide = Math.abs(a) > .004 ? Math.sign(a) : 1;
  return occSide === S.side ? p : null;
}
let _smallOcc = null, _smallOccN = -1;
function smallOccluders(){
  if(_smallOccN !== OCCLUDERS.length){ _smallOccN = OCCLUDERS.length;
    _smallOcc = OCCLUDERS.filter(m => { const g = m.geometry; if(!g.boundingSphere) g.computeBoundingSphere(); return g.boundingSphere.radius < 40; }); }
  return _smallOcc;
}
function updateCamera(dt){
  const occ = cam.lockOn = webLock();
  camFrame(dt);
  cam.lockW = (cam.lockW || 0) + ((occ ? 1 : 0) - (cam.lockW || 0))*(1 - Math.exp(-4*dt));
  if(cam.lockW < 1e-3) cam.lockW = 0;
  if(occ) cam.lockP = occ;                                                       // easing out, the view keeps tracking the spider it let go of
  if(cam.lockW > 0 && cam.lockP) cam.lockP.m.getWorldPosition(cam.lockAt || (cam.lockAt = new V3()));
  let lockPitch = null;
  if(occ){
    // aim from her to the spider, leaning in toward the silk from her face, so the camera stands out on her side of
    // the sheet looking across it rather than edge-on along it (and the aim stays defined when the spider is
    // straight above or below her). Yaw and pitch both follow it; your own pitch is kept for when the lock lets go.
    const S = sp.plat, aim = cam.lockAt.clone().sub(sp.pos);
    if(aim.lengthSq() > 1e-6){
      aim.normalize().addScaledVector(S.normal(sp.pos), -.6).normalize().applyQuaternion(camQ.clone().invert());
      const yw = Math.atan2(aim.x, aim.z);
      cam.yaw = lerpAngle(cam.yaw, yw, 1 - Math.exp(-6*cam.lockW*dt));
      lockPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, -Math.asin(Math.max(-1, Math.min(1, aim.y)))));
      cam.swing = null; cam.swingDir = null;
    }
  }
  followBehind(dt);
  if(cam.swing != null){                                                       // swing to face a world heading
    const d = new V3(Math.sin(cam.swing), 0, Math.cos(cam.swing)).applyQuaternion(camQ.clone().invert()), sw = Math.atan2(d.x, d.z);
    cam.yaw = lerpAngle(cam.yaw, sw, 1 - Math.exp(-5*dt)); if(angDiff(cam.yaw, sw) < .08) cam.swing = null; }
  else if(cam.swingDir){                                                       // swing to look along a direction on her surface (e.g. up the trunk)
    const d = cam.swingDir.clone().applyQuaternion(camQ.clone().invert());
    if((cam.swingT = (cam.swingT || 0) + dt) > 2){ cam.swingDir = null; cam.swingT = 0; }
    else if(Math.hypot(d.x, d.z) > .2){ const sw = Math.atan2(d.x, d.z); cam.yaw = lerpAngle(cam.yaw, sw, 1 - Math.exp(-5*dt)); if(angDiff(cam.yaw, sw) < .05 && camUp.dot(sp.mode === 'climb' ? sp.plat.normal(sp.pos) : UP) > .98){ cam.swingDir = null; cam.swingT = 0; } } }
  // the point the camera orbits sits off her surface: out from bark and stone, below her under a leaf (and only a leaf
  // well clear of the floor), but never downward under the log or a stone overhang, where that is into the soil
  const climbing = sp.mode === 'climb' && sp.plat && !sp.plat.web, sn = climbing ? sp.plat.normal(sp.pos) : camUp;
  const under = climbing && sp.plat.thin && sn.y < -.3 && sp.pos.y - floorAt(sp.pos.x, sp.pos.z) > .5;
  // rounding a leaf's rim the point turns over with her (the view's up turns with her body): left below the blade
  // until she lands on top, it would have to pass up through it, and the view would collapse into her eyes
  const tDir = climbing && !sp.roll && (under || sn.y > -.2) ? sn : camUp;
  // on a leaf top her logical height is the blade's base level, but the blade folds up toward its edges and its
  // surface can sit well above that: orbit from the surface her feet are on, or the pivot sits inside the leaf,
  // every line of sight is blocked at once, and the view collapses into her eyes
  const pivot = sp.pos.clone();
  if(sp.mode === 'ground' && sp.plat && sp.plat.leaf) pivot.y = Math.max(pivot.y, surfAt(sp.plat, pivot.x, pivot.z));
  const tgt = pivot.clone().addScaledVector(tDir, cam.tY ?? (climbing ? .3 : .18));   // cam.tY: a debug override
  cam.target.lerp(tgt, 1 - Math.exp(-8*dt));
  // the look angle is always yours: full range (negative = from below, looking up), and it follows quickly
  // under a leaf the view stays level and looks up at her from below: your whole pitch range maps onto the angles
  // below the blade (steeply under her … nearly edge-on), eased in and out as she goes under or comes back over
  cam.under = (cam.under || 0) + ((under && cam.pov === false ? 1 : 0) - (cam.under || 0))*(1 - Math.exp(-4*dt));
  const pu = -1.25 + (cam.pitch - CAM_PITCH_MIN)/(CAM_PITCH_MAX - CAM_PITCH_MIN)*1.17;
  let pw = cam.pitch + (pu - cam.pitch)*cam.under;
  if(lockPitch !== null) pw += (lockPitch - pw)*cam.lockW;                     // locked onto a web's spider (webLock)
  cam.pitchEff += (pw - cam.pitchEff)*(1 - Math.exp(-12*dt));
  // the point the camera orbits must itself be clear of solids (at a root/trunk join it can fall inside the
  // neighbour): walk it back toward her body until it is
  const solidAt = (q, m) => q.y < floorAt(q.x, q.z) + m || climbsNear(q.x, q.z, .3).some(S => !S.web && S.inside(q, m));
  if(solidAt(cam.target, .05)){ const base = pivot.clone().addScaledVector(tDir, .07), q = new V3();
    for(let f = 1; f >= 0; f -= .1){ q.copy(base).lerp(cam.target, f); if(!solidAt(q, .05) || f <= 0){ cam.target.copy(q); break; } } }
  cam.target.y = Math.max(cam.target.y, soilTop(cam.target.x, cam.target.z) + .05);    // whatever else, never below the soil
  const T = cam.target;
  const offAt = (yw, pt) => { const c = Math.cos(pt); return new V3(-Math.sin(yw)*c, Math.sin(pt), -Math.cos(yw)*c).applyQuaternion(camQ); };
  // how far the camera can sit out along a line of sight: stop short of any occluder mesh, then march the line out
  // from her and stop short of any solid (bark, roots, branches, stone, leaves, the soil), keeping a little
  // clearance so the near plane never cuts into a surface
  // (treeM: a wider berth from the big trees past the first stretch, whose bark mesh bulges beyond its solid, so a
  // line grazing along the trunk isn't taken for clear)
  const sight = (o, far, meshes = OCCLUDERS, treeM = .06) => {
    let w = far;
    if(meshes){ ray.set(T, o); ray.far = far; const hit = ray.intersectObjects(meshes, false)[0]; if(hit) w = Math.max(.06, hit.distance - .08); }
    const q = new V3();
    for(let d = .04; d < w; d += Math.min(.1, .03 + d*.04)){ q.copy(T).addScaledVector(o, d);
      let blocked = q.y < floorAt(q.x, q.z) + .06;
      if(!blocked) for(const S of climbsNear(q.x, q.z, .3)){ if(S.web) continue; if(S.inside(q, S.tree && d > .15 ? treeM : .06)){ blocked = true; break; } }
      if(blocked){ w = Math.max(.04, d - .05); break; } }
    return w;
  };
  // a trunk, stem or rock right behind her, or a second leaf lying just over hers (both common by the trees) would
  // squeeze the orbit in until the view dropped into her eyes. Instead the camera slides round the obstacle,
  // sideways, then up, or flattens out to look in under a leaf overhead, to the nearest angle with room, and eases
  // back once your own angle is clear. Looking up from below, zoomed right in, or under a leaf, the squeeze into her
  // eyes is still what you want, so it is left alone there.
  let dY = 0, dP = 0;
  const need = Math.min(cam.dist, .8);
  if(cam.dist > .45 && cam.pitch > -.15 && cam.under < .5){
    // the solid march first; a line it finds clear is confirmed against the small meshes (a leaf's blade and its
    // solid proxy differ a little), at most a few raycasts a frame. The giant trunks are left to the march: their
    // solids are exact, and their meshes are most of what a raycast costs
    // A slot that still proves blocked once the camera has settled in it (the bark mesh, which only the final line
    // of sight tests) is struck off until she moves on
    let casts = 4;
    if(!cam.badAt || cam.badAt.distanceToSquared(sp.pos) > .15*.15){ cam.bad = []; cam.badAt = sp.pos.clone(); }
    const pitchAt = p => Math.min(1.45, cam.pitchEff + p);
    const isBad = (y, p) => cam.bad.some(b => angDiff(cam.yaw + y, b.yaw) < .3 && Math.abs(p - b.p) < .2);
    const roomAt = (y, p, floor) => { if((y || p) && isBad(y, p)) return 0;
      const o = offAt(cam.yaw + y, pitchAt(p)), r = sight(o, need, null, .18);
      return r < floor || casts-- <= 0 ? Math.min(r, floor - 1e-3) : Math.min(r, sight(o, need, smallOccluders(), .18)); };
    const pY = cam.dodgeY || 0, pP = cam.dodgeP || 0, sg = pY < 0 ? -1 : 1;
    if(roomAt(0, 0, need*.9) < need*.9){
      if((pY || pP) && roomAt(pY, pP, need*.9) >= need*.9){ dY = pY; dP = pP; }    // the slot found last frame is still clear: stay in it
      else {
        const flat = cam.pitchEff > .2 ? .06 - cam.pitchEff : null, pitches = [0, .35, flat, .7].filter(p => p !== null);
        let best = .45, found = false;                                         // short of this the view would drop into her eyes anyway
        for(const p of pitches){
          for(const y of [0, .35*sg, -.35*sg, .7*sg, -.7*sg, 1.05*sg, -1.05*sg, 1.4*sg, -1.4*sg, 1.75*sg, -1.75*sg]){
            if(!y && !p) continue;
            const r = roomAt(y, p, best);
            if(r >= need*.9){ dY = y; dP = p; found = true; break; }
            if(r > best){ best = r; dY = y; dP = p; } }
          if(found) break; } }
    }
  }
  // ease into a clear slot, faster the further the view has already squeezed in: dropping past the rim of the leaf
  // she walked off, the blade cuts the line of sight at once and a slow swing would leave the view in her eyes meanwhile
  const squeeze = Math.max(0, 1 - (cam.distEff ?? need)/need), kD = 1 - Math.exp(-(4 + 22*squeeze)*dt);
  cam.dodgeY = (cam.dodgeY || 0) + (dY - (cam.dodgeY || 0))*kD; cam.dodgeP = (cam.dodgeP || 0) + (dP - (cam.dodgeP || 0))*kD;
  if(Math.abs(cam.dodgeY) < 1e-3) cam.dodgeY = 0; if(Math.abs(cam.dodgeP) < 1e-3) cam.dodgeP = 0;
  const off = offAt(cam.yaw + cam.dodgeY, Math.min(1.45, cam.pitchEff + cam.dodgeP));
  let want = sight(off, cam.dist);
  if((dY || dP) && want < .45 && Math.abs(cam.dodgeY - dY) < .08 && Math.abs(cam.dodgeP - dP) < .08 && cam.bad && cam.bad.length < 24)
    cam.bad.push({yaw: cam.yaw + dY, p: dP});
  cam.distEff = want < cam.distEff ? want : cam.distEff + (want - cam.distEff)*(1 - Math.exp(-4*dt));
  camera.position.copy(T).addScaledVector(off, cam.distEff);
  { const P = camera.position; let fl = soilTop(P.x, P.z);                       // clear of the floor and of any litter edge beside it,
    for(let i = 0; i < 6; i++){ const a = i*1.047; fl = Math.max(fl, soilTop(P.x + Math.cos(a)*.12, P.z + Math.sin(a)*.12) - .02); }   // so the near plane never cuts a curl
    P.y = Math.max(fl + .1, P.y);
    // last guard: if the camera still sits inside bark, stone or a root, slide it in toward her until it's clear
    const inSolid = q => climbsNear(q.x, q.z, .3).some(S => !S.web && S.inside(q, .04));
    if(inSolid(P)){ const from = P.clone(), q = new V3();
      for(let f = .9; f >= 0; f -= .1){ q.copy(T).lerp(from, f); if(!inSolid(q)){ P.copy(q); break; } if(f < .05) P.copy(T); } } }
  const cf = camFwd(), look = T.clone().addScaledVector(cf, cam.ahead).addScaledVector(camUp, .16*cam.ahead);
  if(cam.lockW > 0 && cam.lockAt) look.lerp(cam.lockAt, cam.lockW);           // the locked-on spider sits square in the view
  // when the view is squeezed in against her (zoomed right in, or the orbit pushed in by the ground or bark as you
  // look up), the camera ducks into her eyes instead of into her body: it slides to the top of her head and looks
  // where the pitch points, so looking up from the floor or a trunk becomes looking up through her eyes
  const BP = sp.m.userData.parts.body; BP.updateWorldMatrix(true, false);
  const near = Math.min(camera.position.distanceTo(T), camera.position.distanceTo(BP.getWorldPosition(new V3())));
  const eT = 1 - Math.max(0, Math.min(1, (near - .16)/.22));
  cam.eye = (cam.eye || 0) + (eT*eT*(3 - 2*eT) - (cam.eye || 0))*(1 - Math.exp(-6*dt));
  camera.up.copy(camUp);
  if(cam.eye > .002){
    const E = sp.m.userData.parts.eye; E.updateWorldMatrix(true, false); const Ew = E.getWorldPosition(new V3());
    const el = Math.max(-1.3, Math.min(1.4, -cam.pitchEff*1.15)), ce = Math.cos(el);
    const dEye = new V3(Math.sin(cam.yaw)*ce, Math.sin(el), Math.cos(cam.yaw)*ce).applyQuaternion(camQ);
    const dOrb = look.clone().sub(camera.position).normalize(), D = dOrb.lerp(dEye, cam.eye).normalize();
    camera.position.lerp(Ew, cam.eye); camera.lookAt(camera.position.clone().add(D));
  } else camera.lookAt(look);
  camera.updateMatrixWorld();
  SU.uInvVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  SU.uCamPos.value.copy(camera.position);
  SU.uCfCam.value.copy(camera.position);
  { const B = sp.m.userData.parts.body.getWorldPosition(new V3()); SU.uCfT.value.set(B.x, B.y, B.z, cam.eye > .5 || sp.mode === 'feed' ? 0 : 1); }
  SU.uCamYaw.value = Math.atan2(cf.z, cf.x);
  SU.uVib.value.forEach((u, i) => {
    const o = SU.uVibScr.value[i];
    if(u.w <= 0){ o.set(0, 0, 0); return; }
    _v.set(u.x, u.y, u.z); const front = _v.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
    _v.project(camera); o.set((_v.x*.5 + .5)*R.W, (_v.y*.5 + .5)*R.H, front ? 1 : 0);
  });
}
