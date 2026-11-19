'use strict';
// jungle part 2: floor detail, crowns, builders, birds, caterpillars, ants

/* =====================================================================
   JUNGLE, PART 2 — a richer floor, tree crowns, and life: web-building spiders up high, birds, caterpillars, ants
   ===================================================================== */
// a point at distance s along a polyline (with its heading)
function pathAt(P, s){
  if(!P.cum){ P.cum = [0]; for(let i = 1; i < P.length; i++) P.cum.push(P.cum[i - 1] + P[i].distanceTo(P[i - 1])); P.len = P.cum[P.cum.length - 1]; }
  s = Math.max(0, Math.min(P.len - 1e-6, s)); let i = 1; while(i < P.length - 1 && P.cum[i] < s) i++;
  const a = P[i - 1], b = P[i], t = (s - P.cum[i - 1])/Math.max(1e-6, P.cum[i] - P.cum[i - 1]);
  return [a.clone().lerp(b, t), b.clone().sub(a).normalize()];
}
const groundPath = (x, z, n, step, wig = .4) => { const P = []; let a = rnd()*6.28; for(let k = 0; k < n; k++){ P.push(new V3(x, hAt(x, z) + .004, z)); a += rr(-wig, wig); x += Math.cos(a)*step; z += Math.sin(a)*step; } return P; };

const SEEDS = {list: []};
function updateSeedlings(dt, t){
  const {list, stem, cot, crl} = SEEDS; if(!stem) return;
  const live = SEEDS.live, w = live ? windVec() : new V3(.3, 0, .15), wl = Math.hypot(w.x, w.z) || 1e-6, g = live ? wind.gust : 0;   // (wind and SU exist once the game runs)
  const ax = new V3(w.z/wl, 0, -w.x/wl), qw = new THREE.Quaternion(), q = new THREE.Quaternion(), p = new V3(), tp = new V3(), sc = new V3(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
  for(let i = 0; i < list.length; i++){ const S = list[i];
    if(S.hide){ stem.setMatrixAt(i, Z); cot.setMatrixAt(i*2, Z); cot.setMatrixAt(i*2 + 1, Z); crl.setMatrixAt(i, Z); continue; }
    const wave = .5 + .5*Math.sin(t*1.2 - (S.x*w.x + S.z*w.z)/wl*.3);                   // gusts roll across the floor
    const lean = (.02 + .1*g*wave)*Math.min(1.2, wl + .2) + Math.sin(t*S.f + S.ph)*(.015 + .04*g) + Math.sin(t*S.f*2.7 + S.ph*2)*.005;
    qw.setFromAxisAngle(ax, lean);
    q.setFromEuler(E.set(S.ex, S.yaw, S.ez, 'XYZ')).premultiply(qw); p.set(S.x, S.y, S.z);
    M4.compose(p, q, sc.set(S.ss*.7, S.h, S.ss*.7)); stem.setMatrixAt(i, M4);
    tp.set(0, S.h, 0).applyQuaternion(q).add(p);                                         // leaves and curl ride the stem's tip
    if(S.open){ for(let k = 0; k < 2; k++){ const fl = Math.sin(t*S.f*1.6 + S.ph + k*1.9)*(.03 + .1*g) - (k ? -1 : 1)*lean*.3;
        q.setFromEuler(E.set(S.lx[k] + fl, S.yaw + k*Math.PI, 0, 'YXZ')).premultiply(qw); M4.compose(tp, q, sc.set(S.ss, S.ss, S.ss)); cot.setMatrixAt(i*2 + k, M4); }
      crl.setMatrixAt(i, Z); }
    else { cot.setMatrixAt(i*2, Z); cot.setMatrixAt(i*2 + 1, Z); q.setFromEuler(E.set(0, S.yaw, 0, 'YXZ')).premultiply(qw); M4.compose(tp, q, sc.set(S.ss, S.ss, S.ss)); crl.setMatrixAt(i, M4); }
  }
  stem.instanceMatrix.needsUpdate = cot.instanceMatrix.needsUpdate = crl.instanceMatrix.needsUpdate = true;
}
// ---- the floor: curled dead leaves, seedlings with uncurling leaves, puddles, bark chips, lichen, grit
{
  const c = new THREE.Color();
  const curl = hot(new THREE.InstancedMesh(leafGeo('lance', .12, .22, .7, .7, 6, 14), new THREE.MeshStandardMaterial({map: LEAF_TEX, roughness:.85, side:THREE.DoubleSide}), 1100), TEMP.litter);
  for(let i = 0; i < curl.count; i++){ const [x, z] = litterSpot(25*AK), s = rr(3, 8);                    // curled dead leaves 4–11 cm
    M4.compose(new V3(x, hAt(x, z) + .02*s, z), Q.setFromEuler(E.set(rr(-.6, .6), rnd()*6.3, rr(-.6, .6), 'YXZ')), new V3(s, s, s));
    if(underSheet(x, z, .15*s)) M4.makeScale(0, 0, 0).setPosition(x, -50, z);   // none under the sheet web: they'd poke through the silk
    curl.setMatrixAt(i, M4);
    c.setHSL(rr(.02, .13), rr(.35, .75), rr(.12, .34)); if(rnd() < .15) c.setHSL(rr(.0, .03), .6, .28); curl.setColorAt(i, c); }
  curl.receiveShadow = true; scene.add(curl); litterBake(curl); litterFinish();
  // seedlings: a thread of stem, two round seed-leaves (veined, translucent at the rim), some still unrolling a curl.
  // They nod and flutter in the breeze and lean over in the gusts (updateSeedlings re-poses them every frame).
  const COT_TEX = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w/2, h*.55, 4, w/2, h*.5, w*.6); g.addColorStop(0, '#f4f6e8'); g.addColorStop(.7, '#d8dcc8'); g.addColorStop(1, '#a6aa92');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 1500; i++){ const v = 180 + trnd()*75; x.fillStyle = `rgba(${v},${v},${v*.9},.2)`; x.fillRect(trnd()*w, trnd()*h, 1.2, 1.2); }
    x.strokeStyle = 'rgba(255,255,245,.95)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w/2, h); x.lineTo(w/2, h*.08); x.stroke();
    x.lineWidth = 1.4; x.strokeStyle = 'rgba(255,255,240,.75)';
    for(const sd of [-1, 1]) for(let k = 0; k < 3; k++){ const y = h*(.82 - k*.22); x.beginPath(); x.moveTo(w/2, y); x.quadraticCurveTo(w/2 + sd*w*.22, y - 6, w/2 + sd*w*.4, y - 26); x.stroke(); }
    x.lineWidth = .7; x.strokeStyle = 'rgba(255,255,240,.3)';
    for(let i = 0; i < 70; i++){ const px = trnd()*w, py = trnd()*h, a = trnd()*6.28; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a)*7, py + Math.sin(a)*7); x.stroke(); }
    for(let i = 0; i < 5; i++){ x.fillStyle = `rgba(120,100,60,${.2 + trnd()*.25})`; x.beginPath(); x.arc(trnd()*w, trnd()*h, 1 + trnd()*2, 0, 6.283); x.fill(); }
  }, [1, 1]);
  const SN = 420, stem = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(.0025, .0035, 1, 5).translate(0, .5, 0), new THREE.MeshStandardMaterial({color:0x8fb84a, roughness:.6}), SN), TEMP.stem);
  const cot = hot(new THREE.InstancedMesh(leafGeo('round', .018, .022, 0, .2, 4, 6).translate(0, 0, -.022), glowLeaf(new THREE.MeshStandardMaterial({color:0x9fd070, map: COT_TEX, bumpMap: COT_TEX, bumpScale: 1, roughness:.5, side:THREE.DoubleSide}), .12), SN*2), TEMP.leaf);
  const crl = hot(new THREE.InstancedMesh(crozierGeo(0, .012, .0028, {seg: 50, radial: 5}), new THREE.MeshStandardMaterial({color:0x9fd255, map: FIDDLE_TEX, roughness:.6}), SN), TEMP.leaf);
  for(let i = 0; i < SN; i++){ const [cx, cz] = i % 4 ? scatter(17*AK, 1) : MOSS_SPOTS[Math.floor(rnd()*MOSS_SPOTS.length)][0].toArray().filter((_, k) => k !== 1);
    const x = cx + rr(-.8, .8), z = cz + rr(-.8, .8), y = hAt(x, z), h = rr(.25, .8), yaw = rnd()*6.3, ss = rr(5, 8);   // seedlings 1–3 cm
    const S = {x, y, z, h, yaw, ss, ex: rr(-.2, .2), ez: rr(-.2, .2), lx: [rr(.1, .5), rr(.1, .5)], open: rnd() < .7, hide: underSheet(x, z, .2), ph: rnd()*6.3, f: rr(1.6, 3.2)};   // none under the sheet web
    SEEDS.list.push(S); c.setHSL(rr(.24, .32), rr(.4, .65), rr(.34, .48));
    cot.setColorAt(i*2, c); c.offsetHSL(rr(-.01, .01), 0, rr(-.04, .04)); cot.setColorAt(i*2 + 1, c); }
  Object.assign(SEEDS, {stem, cot, crl}); updateSeedlings(0, 0); SEEDS.live = true;
  scene.add(stem, cot, crl);
  // puddles in the hollows: dark, glassy, catching the sky
  const pm = new THREE.MeshStandardMaterial({color:0x1a2a2a, roughness:.03, metalness:.6, transparent:true, opacity:.85});
  for(let i = 0, n = 0; i < 100 && n < 15; i++){ const [x, z] = scatter(20*AK, 2); if(hAt(x, z) - broadH(x, z) > -.15 || nearPlat(x, z, 1)) continue; n++;
    const g = new THREE.CircleGeometry(1, 20); const q = g.attributes.position; for(let k = 1; k < q.count; k++){ const f = .75 + .25*Math.sin(k*1.7 + i); q.setXY(k, q.getX(k)*f, q.getY(k)*f); }
    const m = hot(new THREE.Mesh(g.rotateX(-Math.PI/2), pm), .3); const s = rr(.6, 1.6); m.scale.set(s, 1, s*rr(.6, 1)); m.position.set(x, hAt(x, z) + .02, z); m.rotation.y = rnd()*6.3; m.receiveShadow = true; scene.add(m); }
  const chips = hot(new THREE.InstancedMesh(new THREE.BoxGeometry(1, .25, .5), new THREE.MeshStandardMaterial({map: BARK_TEX_S, roughness:.95}), 650), TEMP.stick);
  for(let i = 0; i < chips.count; i++){ const [x, z] = litterSpot(22*AK), s = rr(.08, .3); chips.setMatrixAt(i, onGround(x, z, s*.1, rnd()*6.3, new V3(s, s, s), .4)); c.setHSL(rr(.05, .09), rr(.3, .5), rr(.18, .35)); chips.setColorAt(i, c); }
  const lich = hot(new THREE.InstancedMesh(new THREE.CircleGeometry(1, 9).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({roughness:.95}), 600), TEMP.moss);
  for(let i = 0; i < lich.count; i++){ const [x, z] = scatter(22*AK), s = rr(.1, .35); lich.setMatrixAt(i, onGround(x, z, .006, rnd()*6.3, new V3(s, 1, s*rr(.6, 1)), .1)); c.setHSL(rr(.16, .3), rr(.3, .6), rr(.3, .5)); lich.setColorAt(i, c); }
  const grit = hot(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), new THREE.MeshStandardMaterial({roughness:.9, flatShading:true}), 2800), TEMP.pebble);
  for(let i = 0; i < grit.count; i++){ const [x, z] = scatter(19*AK), s = rr(.004, .014); grit.setMatrixAt(i, onGround(x, z, 0, rnd()*6.3, new V3(s, s*.7, s), 1)); c.setHSL(rr(.06, .12), rr(.05, .3), rr(.15, .45)); grit.setColorAt(i, c); }
  scene.add(chips, lich, grit);
}

// ---- tree crowns: limbs that fork into branches that fork again, with side shoots along the way, ending in sprays of
// leaves. Every limb and branch thick enough to stand on is walkable, and broad leaves held level at the twig tips are
// landing pads: from the herbs round the foot she can leap blade to bark to limb to leaf, all the way up the crown.
{
  const leafSpots = [], pads = [], crownM = antiTile(new THREE.MeshStandardMaterial({color:0x8a7258, map: BARK_TEX_S, bumpMap: BARK_TEX_S, bumpScale: 1.5, roughness:.95}));
  const grow = (geos, start, dir, len, rad, depth, maxD) => {
    const end = start.clone().addScaledVector(dir, len), mid = start.clone().lerp(end, .5).add(new V3(rr(-.15, .15)*len, (depth ? rr(-.05, .12) : rr(-.15, .05))*len, rr(-.15, .15)*len));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const cAt = t => rad*(1 - .4*t);
    geos.push(taperedTube(curve, cAt, {seg: depth < 2 ? 12 : 6, radial: depth < 2 ? 10 : 6}));
    if(rad > .05){ const cp = curve.getPoints(10); tubeSurface(cp, cp.map((_, k) => cAt(k/10))).tree = true; }   // tree: the camera turns with the limb as with the trunk
    if(depth >= maxD || rad < .07){
      for(let k = 0; k < 8; k++) leafSpots.push(curve.getPoint(rr(.3, 1)).add(new V3(rr(-2.5, 2.5), rr(-1, 2), rr(-2.5, 2.5))));
      if(rnd() < .4) pads.push({at: end.clone(), dir: dir.clone(), rad: cAt(1)});
      return;
    }
    const nk = depth === 0 ? 3 : 2 + (rnd() < .5 ? 1 : 0);
    for(let k = 0; k < nk; k++){                                   // forks: the last at the tip, the rest along the branch
      const t = k === nk - 1 ? 1 : rr(.35, .85), at = curve.getPoint(t), d = dir.clone().applyAxisAngle(UP, rr(-.9, .9)).add(new V3(0, rr(-.05, .35), 0)).normalize();
      const side = new V3().crossVectors(d, UP).normalize(); d.applyAxisAngle(side.lengthSq() > .01 ? side : new V3(1, 0, 0), rr(-.35, .35)).normalize();
      grow(geos, at, d, len*rr(.55, .75), rad*rr(.55, .68), depth + 1, maxD);
    }
    if(depth < 2) for(let k = 0, ns = 1 + Math.floor(rnd()*2); k < ns; k++){   // short side shoots: branches of branches
      const t = rr(.2, .7), at = curve.getPoint(t), sgn = rnd() < .5 ? -1 : 1, d = dir.clone().applyAxisAngle(UP, sgn*rr(.9, 1.6)).add(new V3(0, rr(.1, .4), 0)).normalize();
      grow(geos, at, d, len*rr(.35, .5), cAt(t)*rr(.45, .6), depth + 2, maxD);
    }
  };
  for(const [x, z, r] of TREE_LIST){
    if(r > 5) continue;                                // the giants carry their crowns 20 m up, far out of sight in the haze
    const y0 = hAt(x, z), nLimbs = r > 3 ? 17 : 16, a0 = rnd()*6.28;
    // limbs spiralling up the trunk from 0.4 m to about 5 m: the lowest two within a hop of the tallest herbs at the
    // foot, the third about 26 up (the Argiope's web hangs under it)
    for(let i = 0; i < nLimbs; i++){
      const f = Math.max(0, i - 3)/(nLimbs - 4), a = a0 + i*2.4 + rr(-.3, .3), h = [rr(13, 15), rr(19, 21), rr(25, 27)][i] ?? 33 + f*137 + rr(-5, 5), out = new V3(Math.cos(a), 0, Math.sin(a));
      const start = new V3(x, y0 + h, z).addScaledVector(out, r*.85), dir = out.clone().add(new V3(0, rr(.15, .5), 0)).normalize();
      const geos = [];
      grow(geos, start, dir, rr(14, 24)*(1 - f*.4), r*rr(.18, .26)*(1 - f*.3), 0, f > .5 ? 2 : 3);
      // a mesh per limb: its bounding sphere stays tight, so the camera's sight rays only test the limbs they pass near
      const m = hot(new THREE.Mesh(mergeGeos(geos), crownM), TEMP.wood); m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
    }
  }
  const lg = leafGeo('lance', .18, .38, .35, .12, 6, 12), lm = hot(new THREE.InstancedMesh(lg, leafMat(0x4f8a3a, {amp: .06}), leafSpots.length), TEMP.leaf), c = new THREE.Color();
  leafSpots.forEach((p, i) => { const s = rr(.7, 1.7)*6; M4.compose(p, Q.setFromEuler(E.set(rr(-.5, .9), rnd()*6.3, rr(-.4, .4), 'YXZ')), new V3(s, s, s)); lm.setMatrixAt(i, M4); c.setHSL(rr(.22, .32), rr(.45, .7), rr(.2, .36)); lm.setColorAt(i, c); });
  scene.add(lm);                                     // (the canopy's shade comes from the sun's gap map, not from these)
  // the landing pads: a broad blade held level on a short stalk at the twig's tip, pointing on out along it (no sway,
  // so her feet match the surface); left off where it would cut into bark or crowd another leaf
  const padM = [0x4f8a3a, 0x5f9a42, 0x467a30].map(col => glowLeaf(new THREE.MeshStandardMaterial({color: col, map: LEAF_TEX, roughness:.55, side:THREE.DoubleSide})));
  const pq = new V3();
  for(const P of pads){
    const hd = new V3(P.dir.x, 0, P.dir.z); if(hd.lengthSq() < .01) continue; hd.normalize();
    const type = rnd() < .5 ? 'lance' : 'heart', w = rr(1.4, 2.4), l = w*(type === 'lance' ? rr(1.7, 2.1) : rr(1.3, 1.5)), droop = rr(.15, .3), fold = rr(.06, .12);
    const rot = Math.atan2(-hd.x, -hd.z), x = P.at.x + hd.x*l*.95, z = P.at.z + hd.z*l*.95, y = P.at.y + P.rad + .25;
    const p = {id:'L' + PLAT.length, kind:'leaf', pad:true, x, y, z, rx: w*.82, rz: l*.78, rot, leaf:{type, w, l, droop, fold}};
    if(inTrunk(x, z, platR(p))) continue;
    let hit = false;                                   // no twig or limb through the blade
    for(const [u, v] of [[0, 0], [0, -.6], [0, .6], [.6, 0], [-.6, 0]]){ const lx = u*w, lz = v*l;
      pq.set(x + lx*Math.cos(rot) + lz*Math.sin(rot), 0, z - lx*Math.sin(rot) + lz*Math.cos(rot)); pq.y = surfAt(p, pq.x, pq.z);
      if(climbsNear(pq.x, pq.z, .5).some(S => S.tube && S.inside(pq, .25))){ hit = true; break; } }
    if(hit || PLAT.some(o => o.leaf && leavesCrowd(p, o))) continue;
    const mat = padM[Math.floor(rnd()*padM.length)];
    const leaf = hot(new THREE.Mesh(leafGeo(type, w, l, droop, fold), mat), TEMP.leaf); leaf.position.set(x, y, z); leaf.rotation.set(0, rot, 0);
    leaf.castShadow = leaf.receiveShadow = true; scene.add(leaf); OCCLUDERS.push(leaf);
    leaf.add(new THREE.LineSegments(veinGeo(type, w, l, droop, fold), new THREE.LineBasicMaterial({color: mat.color.clone().lerp(new THREE.Color(0xe8f0b0), .45)})));
    const base = leaf.localToWorld(new V3(0, -.02, l*1.02)), stalk = new THREE.CatmullRomCurve3([P.at.clone(), P.at.clone().lerp(base, .5).add(new V3(0, .12, 0)), base]);
    scene.add(hot(new THREE.Mesh(new THREE.TubeGeometry(stalk, 6, .035, 5), crownM), TEMP.stem));
    PLAT.push(p); p.under = leafUnder(p);
  }
}

// ---- life up high: garden orb-weavers building their webs. Here only their silk and bodies are made; hunt.js makes
// each a prey with a walkable web, and spins it: radii first, then the spiral laid turn by turn with the builder walking
// it, a rest at the hub, then the web taken down (it fades) and started again.
const BUILDERS = [];
{
  const silk = (op) => new THREE.LineBasicMaterial({color:0xf2f0e6, transparent:true, opacity:op});
  for(const [x, y, z, rot, R] of [[-3.4, 17, -4.4, .6, 3.2], [5.6, 22, 3.2, 2.1, 3.8], [1.2, 28, -7.2, -.4, 3.4]]){   // orbs 20–25 cm across, half a metre up
    const C = new V3(x, hAt(x, z) + y, z), u = new V3(Math.cos(rot), 0, -Math.sin(rot)), v = UP.clone(), n = new V3().crossVectors(u, v).normalize();
    const P = (r, a) => C.clone().addScaledVector(u, Math.cos(a)*r).addScaledVector(v, Math.sin(a)*r);
    const frame = [], radii = [], spiral = [], NR = 26;
    for(let k = 0; k < 8; k++){ frame.push(P(R*1.08, k/8*6.283), P(R*1.08, (k + 1)/8*6.283)); }
    for(let k = 0; k < 4; k++){ const a = k/4*6.283 + .4, q = P(R*1.08, a); frame.push(q, q.clone().addScaledVector(q.clone().sub(C).normalize(), 14).add(new V3(0, rr(-3, 3), 0))); }
    for(let k = 0; k < NR; k++) radii.push(P(.02, k/NR*6.283), P(R, k/NR*6.283));
    const turns = 34, N = turns*NR, path = [];
    for(let i = 0; i <= N; i++){ const a = i/NR*6.283, r = .12 + (R*.95 - .12)*i/N; path.push(P(r, a)); }
    for(let i = 0; i < N; i++) spiral.push(path[i], path[i + 1]);
    const g = new THREE.Group(); scene.add(g);                   // the web's swaying group (its lines are laid in world space)
    const fm = silk(.55), rm = silk(.45), sm = silk(.4);
    const fL = new THREE.LineSegments(segsFrom(frame), fm), rL = new THREE.LineSegments(segsFrom(radii), rm), sL = new THREE.LineSegments(segsFrom(spiral), sm);
    [fL, rL, sL].forEach(o => o.userData.temp = SILK_T); g.add(fL, rL, sL);
    const m = makeArach({s:.85, cara:[.04, .028, .05], abd:[.065, .055, .075], legLen:[.36, .33, .24, .3], legTh:.006, hairs:[60, 120], spines:3,
      col:{cara:0x6a4a2a, abd:0x9a7440, leg:0x5a4024, hair:0xe0d0a8, band:0x2e2014, under:0x3a2a18}, eyes:[[.01, .022, .085], [.02, .02, .08]], bands:(k, j) => j === 1 ? [.2, .7] : j === 2 ? [.5] : []});
    rr(0, 40);                                                   // (a draw the old start-time took: the seeded world after it stays put)
    BUILDERS.push({C, u, v, n, R, path, sL, rL, fL, mats: [fm, rm, sm], m, g, N, NR});
  }
}

// ---- birds high over the canopy gaps: flap, glide, bank; their shadows sweep the floor
const BIRDS = [];
{
  // feathers: barred, edged pale, darker shafts (multiplied by each bird's plumage colour)
  const FEATHER_TEX = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#cfc8bb'; x.fillRect(0, 0, w, h);
    for(let r = 0; r < 9; r++) for(let k = 0; k < 8; k++){                    // overlapping, uneven feathers, each with a shaft and a pale fringe
      const fw = w/8*(.9 + trnd()*.5), fh = h/9*(1.5 + trnd()*.6), px = (k + (r % 2)*.5 + (trnd() - .5)*.3)/8*w, py = (r + (trnd() - .5)*.3)/9*h, tone = .75 + trnd()*.5, rot = (trnd() - .5)*.2;
      const g = x.createLinearGradient(0, py, 0, py + fh); g.addColorStop(0, `rgba(${70*tone|0},${62*tone|0},${52*tone|0},.55)`); g.addColorStop(.7, `rgba(${160*tone|0},${150*tone|0},${132*tone|0},.35)`); g.addColorStop(1, 'rgba(240,232,215,.55)');
      wrap9(w, h, (ox, oy) => { x.fillStyle = g; x.save(); x.translate(ox, oy); x.beginPath(); x.ellipse(px, py + fh*.5, fw*.5, fh*.5, rot, 0, 6.283); x.fill();
        x.strokeStyle = 'rgba(40,34,28,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py + fh*.1); x.lineTo(px, py + fh*.9); x.stroke(); x.restore(); }); }
    for(let i = 0; i < 900; i++){ x.strokeStyle = `rgba(40,34,28,${.08 + trnd()*.12})`; x.lineWidth = .6; const px = trnd()*w, py = trnd()*h, a = trnd() < .5 ? .5 : -.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + a*6, py + 6); x.stroke(); }   // barbs
  }, [1.4, 1.4]);
  // the spread wing in plan (span along +x, -y toward the trailing edge): the arm with scalloped secondaries, and the
  // hand with five slotted primaries ("fingers")
  const armShape = new THREE.Shape(); armShape.moveTo(0, .06);
  [[.12, .075], [.25, .07], [.32, .06]].forEach(([a, b]) => armShape.lineTo(a, b));
  armShape.lineTo(.32, -.13); for(let k = 0; k < 6; k++){ const xa = .32 - k*.055; armShape.quadraticCurveTo(xa - .027, -.2, xa - .055, -.14 - (k === 5 ? .04 : 0)); }
  armShape.lineTo(0, -.12); armShape.lineTo(0, .06);
  const handShape = new THREE.Shape(); handShape.moveTo(0, .06); handShape.lineTo(.2, .03);
  const FING = [[.44, -.01], [.46, -.06], [.44, -.11], [.39, -.15], [.32, -.17]];
  FING.forEach(([fx, fy], k) => { handShape.lineTo(fx - .03, fy + .02); handShape.quadraticCurveTo(fx + .02, fy + .005, fx - .01, fy - .025); handShape.lineTo(fx - .07, fy - .02 + (k === 4 ? -.01 : .012)); });
  handShape.lineTo(.12, -.2); handShape.lineTo(0, -.13); handShape.lineTo(0, .06);
  const tailShape = new THREE.Shape(); tailShape.moveTo(-.04, 0); tailShape.lineTo(-.13, -.26);
  for(let k = 0; k < 6; k++){ const xa = -.13 + k*.052; tailShape.quadraticCurveTo(xa + .026, -.3 + (k === 2 || k === 3 ? .03 : 0), xa + .052, -.26); }
  tailShape.lineTo(.04, 0); tailShape.lineTo(-.04, 0);
  // a plan shape lying flat (x across, z backward), with vertex colours: dark toward the tips, a pale covert bar
  const flat = (shape, f) => { const g = new THREE.ShapeGeometry(shape, 6).rotateX(Math.PI/2), P = g.attributes.position, col = [];
    for(let i = 0; i < P.count; i++){ const v = f(P.getX(i), P.getZ(i)); col.push(v, v, v); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
  const armG = flat(armShape, (x, z) => z < -.02 && z > -.06 ? 1.35 : z > .02 ? 1.1 : .85);
  const handG = flat(handShape, (x, z) => x > .3 ? .45 : x > .18 ? .7 : 1);
  const tailG = flat(tailShape, (x, z) => z > .2 ? .55 : 1);
  // body: a lathe teardrop along z (breast forward), pale on the belly; a round head with a dark eye-stripe
  const prof = [[0, -.42], [.03, -.36], [.07, -.24], [.105, -.1], [.12, .02], [.11, .14], [.085, .23], [.05, .29], [0, .31]].map(([r, z]) => new THREE.Vector2(r, z));
  const bodyG = new THREE.LatheGeometry(prof, 16).rotateX(Math.PI/2);
  { const P = bodyG.attributes.position, col = []; for(let i = 0; i < P.count; i++){ const y = P.getY(i), z = P.getZ(i); const v = y < -.02 ? 1.45 : y < .02 ? 1.2 : 1; col.push(v, v*.97, v*.9); }
    bodyG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const headG = new THREE.SphereGeometry(.085, 14, 10);
  { const P = headG.attributes.position, col = []; for(let i = 0; i < P.count; i++){ const y = P.getY(i), z = P.getZ(i), x = P.getX(i);
      const v = y < -.03 ? 1.4 : (Math.abs(y - .01) < .015 && Math.abs(x) > .05) ? .35 : y > .05 ? .8 : 1.1; col.push(v, v*.97, v*.9); }
    headG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const beakG = new THREE.ConeGeometry(.022, .085, 6).rotateX(Math.PI/2), eyeG = new THREE.SphereGeometry(.014, 6, 5);
  const PLUM = [[0x5a4a3a, 0xd8a030], [0x7a5530, 0x302418], [0x3a4a58, 0xe0c040], [0x9a4428, 0x2a2018], [0x4a4a46, 0xd06020]];
  for(let i = 0; i < 5; i++){
    const g = new THREE.Group(), [pc, bc] = PLUM[i];
    // a little self-light (the sky glow through the canopy), so from the floor they read as birds, not black cut-outs
    const em = new THREE.Color(pc).multiplyScalar(.55);
    const bm = new THREE.MeshStandardMaterial({color: pc, map: FEATHER_TEX, vertexColors:true, roughness:.75, emissive: em, emissiveMap: FEATHER_TEX});
    const wm = new THREE.MeshStandardMaterial({color: pc, map: FEATHER_TEX, vertexColors:true, roughness:.8, side:THREE.DoubleSide, emissive: em, emissiveMap: FEATHER_TEX});
    const body = new THREE.Mesh(bodyG, bm); g.add(body);
    const neck = new THREE.Group(); neck.position.set(0, .05, .27); g.add(neck);
    const head = new THREE.Mesh(headG, bm); neck.add(head);
    const beak = new THREE.Mesh(beakG, new THREE.MeshStandardMaterial({color: bc, roughness:.4})); beak.position.set(0, -.01, .1); neck.add(beak);
    for(const sx of [-1, 1]){ const eye = new THREE.Mesh(eyeG, new THREE.MeshStandardMaterial({color:0x0a0806, roughness:.15})); eye.position.set(sx*.062, .018, .045); neck.add(eye); }
    const tail = new THREE.Group(); tail.position.set(0, .01, -.38); g.add(tail); tail.add(new THREE.Mesh(tailG, wm));
    const wing = sx => {                                                   // shoulder → arm → wrist → hand, mirrored for the left
      const sh = new THREE.Group(); sh.position.set(sx*.07, .045, .06); sh.scale.x = sx; g.add(sh);
      const arm = new THREE.Mesh(armG, wm); sh.add(arm);
      const wr = new THREE.Group(); wr.position.set(.32, 0, 0); sh.add(wr); wr.add(new THREE.Mesh(handG, wm));
      return [sh, wr]; };
    const [wl, wlw] = wing(-1), [wr, wrw] = wing(1); g.traverse(o => { if(o.isMesh) o.castShadow = true; });
    const owner = {temp:.74, motion:.6, self:false}; g.userData.owner = owner; g.scale.setScalar(7); scene.add(g);   // ~18 cm birds, 35 cm wingspan
    BIRDS.push({g, wl, wr, wlw, wrw, tail, neck, owner, cx: rr(-10, 10), cz: rr(-10, 10), r: rr(20, 45), y: rr(38, 64), w: rr(.6, 1.1)*(rnd() < .5 ? -1 : 1), ph: rnd()*6.3, flapT: 0});
  }
}
function updateBirds(dt, t){
  for(const b of BIRDS){
    const a = b.ph + t*b.w, x = b.cx + Math.cos(a)*b.r, z = b.cz + Math.sin(a)*b.r*.7, y = b.y + Math.sin(t*.3 + b.ph)*4;
    const nx = b.cx + Math.cos(a + .05*Math.sign(b.w))*b.r, nz = b.cz + Math.sin(a + .05*Math.sign(b.w))*b.r*.7;
    const glide = Math.sin(t*.4 + b.ph*3) > .2, ph = t*14 + b.ph, f = glide ? .1 + Math.sin(t*2 + b.ph)*.03 : Math.sin(ph)*.8;
    b.g.position.set(x, y + (glide ? 0 : -Math.sin(ph)*.25), z); b.g.rotation.set(glide ? .04 : -.08, Math.atan2(nx - x, nz - z), -Math.sign(b.w)*.35, 'YXZ');
    // the shoulders flap (the left one mirrored); the wrist lags, folding the hand in on the upstroke
    const wrist = glide ? -.05 : Math.min(0, Math.sin(ph - .9))*.9 + .1;
    b.wl.rotation.z = -f; b.wr.rotation.z = f; b.wlw.rotation.z = b.wrw.rotation.z = wrist;   // (the wrist sits inside the mirrored frame)
    b.wr.rotation.y = glide ? 0 : Math.cos(ph)*.12; b.wl.rotation.y = -b.wr.rotation.y;
    b.tail.rotation.x = glide ? -.05 : Math.sin(ph + 1)*.08; b.neck.rotation.y = Math.sin(t*.7 + b.ph)*.25; b.neck.rotation.x = glide ? .05 : Math.sin(ph)*.05;
  }
}

// ---- caterpillars inching along leaves, the log and the soil
const CATS = [];
{
  const kinds = [{body:0x7ec23a, dots:0xf2e040, hair:0}, {body:0x1a1a12, dots:0xf0d020, hair:0}, {body:0xd86a1a, dots:0x40200a, hair:0xf0c070}, {body:0x5aa83a, dots:0xffffff, hair:0}];
  const paths = [];
  for(const p of PLAT.filter(q => q.kind === 'leaf' && q !== START).slice(2, 5)){ const P = []; const c = Math.cos(p.rot), s = Math.sin(p.rot);
    for(let k = 0; k <= 12; k++){ const lz = p.rz*(.85 - 1.7*k/12), lx = Math.sin(k*.6)*p.rx*.25, x = p.x + lx*c + lz*s, z = p.z - lx*s + lz*c; P.push(new V3(x, surfAt(p, x, z) + .004, z)); } paths.push(P); }
  { const ax = new V3(Math.sin(LOG.ang), 0, Math.cos(LOG.ang)), top = PLAT.find(q => q.kind === 'log'), P = [];
    for(let k = 0; k <= 16; k++){ const al = (k/16 - .5)*LOG.len*.8, q = new V3(LOG.x, 0, LOG.z).addScaledVector(ax, al); q.y = surfAt(top, q.x, q.z) + .004; P.push(q); } paths.push(P); }
  for(let i = 0; i < 3; i++){ const [x, z] = scatter(14*AK, 3); paths.push(groundPath(x, z, 20, .6)); }
  paths.forEach((P, i) => {
    const K = kinds[i % kinds.length], segs = [], rads = [], n = 12, SC = 2.6, owner = {temp:.5, motion:.15, self:false};
    const bodyC = new THREE.Color(K.body);
    const bm = new THREE.MeshStandardMaterial({color:K.body, roughness:.55}), dm = new THREE.MeshStandardMaterial({color:K.dots, roughness:.4});
    const hm = new THREE.MeshStandardMaterial({color:bodyC.clone().multiplyScalar(.55), roughness:.35});          // head capsule, darker & glossier
    const lm = new THREE.MeshStandardMaterial({color:bodyC.clone().multiplyScalar(.7), roughness:.7});           // prolegs
    const sm = new THREE.MeshBasicMaterial({color:0x111008});                                                    // spiracles, eyes, mandibles
    const hairM = new THREE.LineBasicMaterial({color: K.hair || bodyC.clone().lerp(new THREE.Color(0xf4f0d8), .6).getHex(), transparent:true, opacity: K.hair ? 1 : .75});
    const segG = new THREE.SphereGeometry(1, 16, 12), dotG = new THREE.SphereGeometry(1, 8, 6), legG = new THREE.CylinderGeometry(.6, 1, 1, 6);
    const g = new THREE.Group(); g.userData.owner = owner; scene.add(g);
    for(let k = 0; k < n; k++){
      const head = k === 0, r = head ? .0145 : .0155*(1 - Math.pow(k/n, 1.6)*.45);                             // fullest mid-body, tapering to the rear
      const sgm = new THREE.Group(), body = new THREE.Mesh(segG, head ? hm : bm);
      body.scale.set(r*1.05, r*.9, r*(head ? 1.0 : 1.12)); body.castShadow = true; sgm.add(body);             // slightly flattened, long ellipsoid rings
      if(!head){
        for(const sx of [-1, 1]){
          const dot = new THREE.Mesh(dotG, dm); dot.scale.setScalar(r*.2); dot.position.set(sx*r*.42, r*.78, 0); sgm.add(dot);    // dorsal spot pair
          const sp = new THREE.Mesh(dotG, sm); sp.scale.set(r*.06, r*.12, r*.12); sp.position.set(sx*r*1.02, r*.1, 0); sgm.add(sp); // spiracle
          if(k <= 3 || (k >= 6 && k <= 9) || k === n - 1){                                                   // 3 pairs of true legs, 4 prolegs, anal claspers
            const lg = new THREE.Mesh(legG, lm); const ln = k <= 3 ? r*.55 : r*.45; lg.scale.set(r*.2, ln, r*.2);
            lg.position.set(sx*r*.55, -r*.75, 0); lg.rotation.z = sx*.35; sgm.add(lg); }
        }
      } else {
        for(const sx of [-1, 1]){
          const e = new THREE.Mesh(dotG, sm); e.scale.setScalar(r*.13); e.position.set(sx*r*.55, r*.15, r*.75); sgm.add(e);       // stemmata
          const md = new THREE.Mesh(dotG, sm); md.scale.set(r*.15, r*.12, r*.25); md.position.set(sx*r*.25, -r*.45, r*.9); sgm.add(md); // mandibles
        }
        const ap = []; for(const sx of [-1, 1]) ap.push(new V3(sx*r*.45, r*.35, r*.85), new V3(sx*r*.75, r*.75, r*1.4));
        sgm.add(new THREE.LineSegments(segsFrom(ap), sm));                                                    // short antennae
      }
      const hp = [], nh = K.hair ? 26 : (head ? 6 : 12);                                                     // every species bristles; the woolly one is dense
      for(let j = 0; j < nh; j++){ const a = rr(-.15, Math.PI + .15), d = new V3(Math.cos(a), Math.sin(a) + .15, rr(-.35, .35)).normalize();
        const base = new V3(d.x*r*1.05, d.y*r*.9, d.z*r*1.1), len = K.hair ? rr(1.4, 2.4) : rr(.35, .7);
        hp.push(base, base.clone().addScaledVector(d, r*len)); }
      if(K.hair && !head) for(const sx of [-1, 1]){ const b = new V3(sx*r*.4, r*.85, 0);                      // tall dorsal tufts
        for(let j = 0; j < 5; j++) hp.push(b, b.clone().add(new V3(sx*rr(.1, .5)*r, rr(2.4, 3.2)*r, rr(-.4, .4)*r))); }
      sgm.add(new THREE.LineSegments(segsFrom(hp), hairM));
      sgm.scale.setScalar(SC); g.add(sgm); segs.push(sgm); rads.push(r*SC); }      // ~2.5 cm caterpillars
    const gaps = rads.map((r, k) => k ? (r + rads[k - 1])*.95 : 0);          // centre spacing < sum of radii → rings always overlap
    CATS.push({P, segs, gaps, owner, s: rr(.7, 1.2), dir: 1, speed: rr(.07, .12), ph: rnd()*6});
  });
}
function updateCats(dt, t){
  for(const c of CATS){
    if(!c.P.len) pathAt(c.P, 0);
    c.s += c.dir*c.speed*dt*(.6 + .4*Math.max(0, Math.sin(t*3 + c.ph)));
    if(c.s > c.P.len - .1){ c.dir = -1; } if(c.s < .7){ c.dir = 1; }
    let off = 0;
    c.segs.forEach((sg, k) => {
      const lift = Math.max(0, Math.sin(t*5 + c.ph - k*.55));           // travelling hump; humped rings bunch up so the body stays joined
      off += c.gaps[k]*(1 - .3*lift);
      const [p, d] = pathAt(c.P, c.s - c.dir*off), r = k ? c.gaps[k]/1.9 : .038;
      sg.position.copy(p).add(new V3(0, r*.9 + lift*r*.55, 0)); sg.lookAt(p.clone().addScaledVector(d, c.dir).add(new V3(0, r*.9, 0))); });
  }
}

// ---- ant colonies: a mound with its entrance, trails out to food; ants stream both ways, carrying leaf bits home
const ANTS = [], FOODS = [];
{
  for(const [mx, mz] of ANT_HILLS){                                               // the mound itself is part of the soil (see rawH)
    const gy = hAt(mx, mz);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(.18, 14).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x080503})); hole.position.set(mx, gy + .01, mz); scene.add(hole);
    const grains = hot(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), new THREE.MeshStandardMaterial({color:0x7a5a38, roughness:1, flatShading:true}), 700), TEMP.soil);
    for(let i = 0; i < 700; i++){ const a = rnd()*6.28, rr2 = Math.sqrt(rnd())*ANT_HILL_R*1.05, gx = mx + Math.cos(a)*rr2, gz = mz + Math.sin(a)*rr2, s = rr(.02, .045);
      M4.compose(new V3(gx, hAt(gx, gz) + s*.3, gz), Q.setFromEuler(E.set(rnd()*3, rnd()*3, 0)), new V3(s, s*.75, s)); grains.setMatrixAt(i, M4); }
    scene.add(grains);
    const trails = [];
    for(let k = 0; k < 3; k++){ const P = [new V3(mx, gy + .006, mz)]; let x = mx, z = mz, a = k/3*6.28 + rr(-.4, .4);
      for(let j = 0; j < 26; j++){ a += rr(-.25, .25); x += Math.cos(a)*.5; z += Math.sin(a)*.5; P.push(new V3(x, hAt(x, z) + .006, z)); }
      trails.push(P);
      const food = hot(new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 10), new THREE.MeshStandardMaterial({color: [0xc8321e, 0x8a2a6a, 0xd08a20][k], roughness:.4})), .3); food.position.copy(P[P.length - 1]).add(new V3(0, .42, 0)); food.castShadow = true; scene.add(food); FOODS.push(food); }   // solid: baked into the floor below   // fallen fruit ~3 cm
    const N = 110, part = (sx, sy, sz) => hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({color:0x2a140a, roughness:.35}), N), .5);
    const head = part(), thor = part(), gas = part(), load = hot(new THREE.InstancedMesh(leafGeo('round', .03, .035, 0, .1, 3, 4), new THREE.MeshStandardMaterial({color:0x6aa83a, side:THREE.DoubleSide}), N), TEMP.leaf);
    const legPos = new Float32Array(N*6*2*3), legG = new THREE.BufferGeometry(); legG.setAttribute('position', new THREE.BufferAttribute(legPos, 3));
    const legs = new THREE.LineSegments(legG, new THREE.LineBasicMaterial({color:0x1a0c06})); legs.frustumCulled = false;
    [head, thor, gas, load].forEach(m => { m.frustumCulled = false; scene.add(m); }); scene.add(legs);
    const owner = {temp:.52, motion:.35, self:false}; [head, thor, gas, load, legs].forEach(m => m.userData.owner = owner);
    const ants = []; for(let i = 0; i < N; i++){ const tr = trails[i % 3]; pathAt(tr, 0); ants.push({tr, s: rnd()*tr.len, dir: rnd() < .5 ? 1 : -1, speed: rr(.45, .75), off: rr(-.05, .05), ph: rnd()*6}); }
    ANTS.push({ants, head, thor, gas, load, legs, legPos, legG});
  }
  floorBake(FOODS);   // the fruit at the trails' ends is solid: she walks up over it, not through it
}
function updateAnts(dt, t){
  const up = UP, side = new V3();
  for(const C of ANTS){
    C.ants.forEach((a, i) => {
      a.s += a.dir*a.speed*dt; if(a.s > a.tr.len){ a.s = a.tr.len; a.dir = -1; } if(a.s < 0){ a.s = 0; a.dir = 1; }
      const [p, d0] = pathAt(a.tr, a.s), d = d0.clone().multiplyScalar(a.dir); side.crossVectors(d, up).normalize();
      p.addScaledVector(side, a.off + Math.sin(t*6 + a.ph)*.006);
      const yaw = Math.atan2(d.x, d.z); Q.setFromEuler(E.set(0, yaw, 0));
      const at = (o, sx, sy, sz, m, lift = .012) => { M4.compose(p.clone().addScaledVector(d, o).add(new V3(0, lift, 0)), Q, new V3(sx, sy, sz)); m.setMatrixAt(i, M4); };
      at(.035, .011, .01, .013, C.head); at(.012, .009, .008, .016, C.thor); at(-.022, .014, .012, .02, C.gas);
      if(a.dir < 0 && (i % 3)) at(.05, 1, 1, 1, C.load, .03); else { M4.makeScale(0, 0, 0); C.load.setMatrixAt(i, M4); }
      for(let k = 0; k < 6; k++){ const sx = k < 3 ? -1 : 1, kk = k % 3, sw = Math.sin(t*28 + a.ph + kk*2.1 + (sx > 0 ? Math.PI : 0))*.008;
        const b = p.clone().addScaledVector(d, .012 + (kk - 1)*.008).add(new V3(0, .012, 0)), f = b.clone().addScaledVector(side, sx*.022).addScaledVector(d, (kk - 1)*.012 + sw); f.y = p.y;
        const o = (i*6 + k)*6; C.legPos[o] = b.x; C.legPos[o + 1] = b.y; C.legPos[o + 2] = b.z; C.legPos[o + 3] = f.x; C.legPos[o + 4] = f.y; C.legPos[o + 5] = f.z; }
    });
    [C.head, C.thor, C.gas, C.load].forEach(m => m.instanceMatrix.needsUpdate = true); C.legG.attributes.position.needsUpdate = true;
  }
}
function updateLife(dt, t){ updateBirds(dt, t); updateSeedlings(dt, t); updateCats(dt, t); updateAnts(dt, t); }
