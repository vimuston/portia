'use strict';
// fly model; the player (sp), the male, flies, cricket

// a house fly, close up: sphere-mapped skins (striped grey thorax, tessellated abdomen with buff flanks and segment
// bands, faceted red eyes), veined smoky wings cut from an alpha texture, jointed bristly legs with pale foot pads,
// macrochaetae on thorax and abdomen, antennae with aristae, a sponging proboscis, halteres and ocelli
const FLY_PAT = {
  thorax(x, y, z){                                  // ash grey, four black stripes down the back, golden dust at the shoulders
    const n1 = noise3(x*6 + 1, y*6, z*6), n2 = noise3(x*22, y*22 + 4, z*22), ax = Math.abs(x);
    let c = mixC([.36, .35, .33], [.52, .5, .46], n1);
    if(y > -.1 && ((ax > .1 && ax < .22) || (ax > .38 && ax < .5)) && z > -.75) c = mixC(c, [.06, .055, .05], .85);
    if(z > .45 && ax > .35) c = mixC(c, [.62, .52, .3], .45*n1 + .2);
    if(y < -.25) c = mixC(c, [.14, .13, .12], .7);
    if(n2 > .78) c = mixC(c, [.04, .04, .035], .8);    // bristle sockets
    return c;
  },
  abd(x, y, z){                                     // segments front to back, each a chequer of grey and black dust, darker hind rims
    const n1 = noise3(x*5 + 7, y*5, z*5), n2 = noise3(x*18, y*18, z*18 + 3), ax = Math.abs(x);
    const seg = (1 - z)*2.1, f = seg - Math.floor(seg), si = Math.floor(seg);
    let c = mixC([.38, .37, .34], [.55, .54, .5], n1);
    const wx = x*4 + si + (n1 - .5)*.9, wz = z*5 + (n2 - .5)*.7, cq = Math.abs(Math.sin(wx*Math.PI)*Math.sin(wz*Math.PI));   // shifting chequer, as dust catches the light
    if(y > -.2) c = mixC(c, [.1, .095, .085], Math.max(0, (Math.sin(wx*Math.PI)*Math.sin(wz*Math.PI) > 0 ? cq : 0) - .05)*.85);
    if(f > .78) c = mixC(c, [.07, .065, .06], .75);
    if(ax < .09 && y > 0) c = mixC(c, [.05, .05, .045], .85);
    if(z > .1 && ax > .45 && y < .55) c = mixC(c, [.78, .6, .3], .65*(1 - Math.abs(y - .1)));   // translucent buff flanks
    if(y < -.45) c = mixC(c, [.62, .58, .48], .5);
    if(n2 > .82) c = mixC(c, [.03, .03, .03], .8);
    return c;
  },
  head(x, y, z){                                    // silver-gold face, black frontal stripe between the eyes
    const n = noise3(x*9, y*9 + 2, z*9);
    let c = mixC([.62, .58, .48], [.82, .78, .64], n);
    if(Math.abs(x) < .16 && y > -.1) c = mixC(c, [.08, .06, .05], .8);
    if(z < -.2) c = mixC(c, [.18, .17, .16], .7);
    return c;
  }
};
let FLY_TEX = null;
function flyTex(){
  if(FLY_TEX) return FLY_TEX;
  const eye = canvasTex(256, 128, (x, w, h) => {                  // compound eye: rows of hexagonal facets, each with a glint
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a120c'); gr.addColorStop(.5, '#9a2a18'); gr.addColorStop(1, '#4a0e0a');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const r = 3.2;
    for(let row = 0, y = 0; y < h + r; row++, y += r*1.5) for(let px = (row & 1)*r*.87; px < w + r; px += r*1.74){
      const t = trnd();
      x.fillStyle = `rgba(${150 + t*60|0},${40 + t*30|0},${24 + t*14|0},.9)`;
      x.beginPath(); for(let k = 0; k < 6; k++){ const a = k*Math.PI/3 + Math.PI/6; x.lineTo(px + Math.cos(a)*r*.86, y + Math.sin(a)*r*.86); } x.fill();
      x.fillStyle = 'rgba(255,220,190,.35)'; x.fillRect(px - .8, y - 1.4, 1.1, 1.1);
    }
  });
  eye.wrapT = THREE.ClampToEdgeWrapping;
  const wing = canvasTex(256, 96, (x, w, h) => {                  // membrane, smoky root, faint interference colours, veins
    x.translate(0, h); x.scale(1, -1);                            // leading edge at the outer side once the wing is laid back
    const shape = () => { x.beginPath(); x.moveTo(4, h*.3); x.bezierCurveTo(w*.35, h*.14, w*.7, h*.06, w*.9, h*.14);
      x.bezierCurveTo(w*1.01, h*.24, w*1.0, h*.58, w*.88, h*.74); x.bezierCurveTo(w*.7, h*.98, w*.35, h*.98, w*.17, h*.82);
      x.bezierCurveTo(w*.1, h*.76, w*.07, h*.6, 4, h*.48); x.closePath(); };
    shape(); x.save(); x.clip();
    const g1 = x.createLinearGradient(0, 0, w, 0); g1.addColorStop(0, 'rgba(120,105,85,.6)'); g1.addColorStop(.25, 'rgba(200,205,210,.28)'); g1.addColorStop(1, 'rgba(225,232,238,.2)');
    x.fillStyle = g1; x.fillRect(0, 0, w, h);
    const g2 = x.createLinearGradient(0, 0, w*.6, h); g2.addColorStop(0, 'rgba(255,120,200,0)'); g2.addColorStop(.45, 'rgba(255,140,220,.08)'); g2.addColorStop(.7, 'rgba(120,255,190,.08)'); g2.addColorStop(1, 'rgba(120,180,255,0)');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 900; i++){ x.fillStyle = `rgba(40,35,30,${.08 + trnd()*.12})`; x.fillRect(trnd()*w, trnd()*h, 1, 1); }   // microtrichia
    x.strokeStyle = 'rgba(55,42,30,.95)'; x.lineCap = 'round';
    const vein = (lw, ...p) => { x.lineWidth = lw; x.beginPath(); x.moveTo(p[0], p[1]); for(let i = 2; i < p.length; i += 6) x.bezierCurveTo(p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5]); x.stroke(); };
    vein(2.4, 4, h*.3, w*.35, h*.15, w*.7, h*.07, w*.9, h*.14);                       // costa
    vein(1.6, 6, h*.34, w*.15, h*.26, w*.3, h*.2, w*.42, h*.17);                      // R1
    vein(1.4, 8, h*.36, w*.3, h*.3, w*.6, h*.2, w*.86, h*.17);                        // R2+3
    vein(1.4, 8, h*.4, w*.35, h*.4, w*.7, h*.36, w*.97, h*.36);                       // R4+5
    vein(1.3, 10, h*.46, w*.35, h*.52, w*.62, h*.56, w*.72, h*.54, w*.8, h*.5, w*.86, h*.4, w*.93, h*.38);   // M1, bent up to the tip
    vein(1.2, 12, h*.52, w*.25, h*.66, w*.42, h*.74, w*.6, h*.86);                    // CuA1
    vein(1.1, 10, h*.55, w*.14, h*.64, w*.2, h*.72, w*.26, h*.8);                     // A1+CuA2
    vein(1.1, w*.47, h*.37, w*.47, h*.42, w*.48, h*.46, w*.48, h*.53);                // r-m crossvein
    vein(1.1, w*.62, h*.36, w*.63, h*.43, w*.64, h*.5, w*.64, h*.56);                 // dm-cu crossvein
    x.restore(); shape(); x.lineWidth = 1.2; x.strokeStyle = 'rgba(60,48,36,.7)'; x.stroke();
  });
  wing.wrapS = wing.wrapT = THREE.ClampToEdgeWrapping;
  FLY_TEX = {thorax: patternTex(FLY_PAT.thorax), abd: patternTex(FLY_PAT.abd), head: patternTex(FLY_PAT.head), eye, wing};
  return FLY_TEX;
}
function makeFly(){
  const segsFrom = pts => new THREE.BufferGeometry().setFromPoints(pts);
  const T = flyTex(), g = new THREE.Group(); g.rotation.order = 'YXZ';
  const tm = new THREE.MeshStandardMaterial({map: T.thorax, roughness:.55});
  const am = new THREE.MeshStandardMaterial({map: T.abd, roughness:.32, metalness:.25});
  const hm = new THREE.MeshStandardMaterial({map: T.head, roughness:.4, metalness:.2});
  const em = new THREE.MeshStandardMaterial({map: T.eye, roughness:.22, metalness:.1});
  const lm = new THREE.MeshStandardMaterial({color:0x1c1916, roughness:.45});
  const pm = new THREE.MeshStandardMaterial({color:0xb8a888, roughness:.6});
  const brM = new THREE.LineBasicMaterial({color:0x0c0b0a});
  const SPH = new THREE.SphereGeometry(1, 20, 14);
  const part = (geo, mat, p, s, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if(s) m.scale.set(...s); parent.add(m); return m; };
  // bristles on a unit-sphere part, in its own (scaled) space: out of the surface, swept back
  const bristles = (parent, n, len, keep) => {
    const pts = []; let tries = 0;
    while(pts.length < n*2 && tries++ < n*20){
      const u = trnd()*2 - 1, a = trnd()*6.2832, s = Math.sqrt(1 - u*u), d = new V3(s*Math.cos(a), u, s*Math.sin(a));
      if(!keep(d)) continue;
      const tip = d.clone().multiplyScalar(1 + len*(.6 + trnd()*.6)).add(new V3(0, 0, -len*.9));
      pts.push(d.clone().multiplyScalar(.98), tip);
    }
    parent.add(new THREE.LineSegments(segsFrom(pts), brM));
  };

  // thorax, scutellum, abdomen
  const th = part(SPH, tm, [0, .058, .02], [.042, .04, .052]);
  bristles(th, 26, .45, d => d.y > .1);
  part(SPH, tm, [0, .084, -.024], [.022, .011, .016]);
  const ab = part(SPH, am, [0, .05, -.055], [.039, .031, .062]);
  bristles(ab, 22, .3, d => d.y > -.2 && d.z < .3);
  bristles(ab, 8, .5, d => d.z < -.7);

  // head: wide and flat front to back, the eyes wrapping its sides
  const head = new THREE.Group(); head.position.set(0, .064, .082); g.add(head);
  part(SPH, hm, [0, 0, 0], [.034, .03, .02], head);
  for(const sx of [-1, 1]){
    const e = part(SPH, em, [sx*.019, .004, .004], [.017, .024, .019], head); e.rotation.set(0, sx*.5, 0);
    // antenna in its groove on the face: scape, a fat third segment, a feathery arista
    const ap = [new V3(sx*.004, .006, .019), new V3(sx*.006, -.004, .024), new V3(sx*.007, -.004, .024), new V3(sx*.008, -.016, .026),
      new V3(sx*.008, -.01, .026), new V3(sx*.018, .0, .034)];
    for(let k = 0; k < 4; k++){ const q = ap[4].clone().lerp(ap[5], .2 + k*.2); ap.push(q, q.clone().add(new V3(sx*.002, .003, .002))); }
    head.add(new THREE.LineSegments(segsFrom(ap), brM));
    part(SPH, lm, [sx*.0065, -.01, .024], [.003, .007, .003], head);
  }
  for(const [ox, oz] of [[0, .006], [-.004, -.002], [.004, -.002]]) part(SPH, new THREE.MeshStandardMaterial({color:0xd8c070, roughness:.2, emissive:0x302010}), [ox, .029, oz], [.0022, .0015, .0022], head);   // ocelli
  const vb = []; for(const sx of [-1, 1]) for(let k = 0; k < 3; k++){ const b = new V3(sx*(.006 + k*.006), .026 - k*.002, -.004 - k*.002); vb.push(b, b.clone().add(new V3(sx*.004, .01, -.008))); }
  head.add(new THREE.LineSegments(segsFrom(vb), brM));                 // vertical bristles over the eyes
  // proboscis: a stalk folded down and a sponging pad
  part(new THREE.CylinderGeometry(.004, .006, .022, 6), lm, [0, -.03, .014], null, head).rotation.x = .35;
  part(SPH, new THREE.MeshStandardMaterial({color:0x6a5a44, roughness:.5}), [0, -.041, .019], [.007, .003, .006], head);

  // legs: coxa, femur, tibia, two tarsal pieces, pale pads; six of them, each bristled. Each is jointed: a hip
  // group at the coxa (yaw swings it fore and aft, z lifts it) and a knee group carrying the tibia and foot (z folds
  // it, y swings it in toward the midline); flyLegTick poses them for walking, grooming, flight
  const Y = new V3(0, 1, 0);
  const limb = (a, b, r0, r1, mat, parent = g) => {
    const d = b.clone().sub(a), L = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 5), mat);
    m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(Y, d.normalize()); parent.add(m); return m;
  };
  const legs = [];
  for(const sx of [-1, 1]) for(let k = 0; k < 3; k++){
    const fz = [.03, .004, -.024][k], dz = [.024, .002, -.03][k];
    const base = new V3(sx*.02, .04, .046 - k*.026), knee = base.clone().add(new V3(sx*.042, .016, fz)),
      ankle = knee.clone().add(new V3(sx*.024, -.046, dz*.8)), mid = new V3(ankle.x + sx*.01, .012, ankle.z + dz*.5), foot = new V3(mid.x + sx*.006, .002, mid.z + dz*.4);
    const coxa = base.clone().lerp(knee, .22);
    const hip = new THREE.Group(); hip.position.copy(base); hip.rotation.order = 'YXZ'; g.add(hip);
    const kn = new THREE.Group(); kn.position.copy(knee).sub(base); hip.add(kn);
    const H = v => v.clone().sub(base), K = v => v.clone().sub(knee);
    limb(H(base), H(coxa), .007, .006, lm, hip); limb(H(coxa), H(knee), .0055, .0042, lm, hip);
    limb(K(knee), K(ankle), .0038, .0028, lm, kn); limb(K(ankle), K(mid), .0024, .002, lm, kn); limb(K(mid), K(foot), .0019, .0016, lm, kn);
    for(const sz of [-1, 1]) part(SPH, pm, K(new V3(foot.x + sz*.0015*sx, .0015, foot.z + sz*.0015)).toArray(), [.0022, .0012, .0022], kn);
    const hBr = [], kBr = [];
    for(const [a, b, n, arr, to] of [[coxa, knee, 4, hBr, H], [knee, ankle, 5, kBr, K], [ankle, mid, 3, kBr, K]]) for(let i = 0; i < n; i++){
      const p = to(a.clone().lerp(b, (i + .5)/n)), out = new V3(sx*.006, .004, -.002 - trnd()*.003);
      arr.push(p, p.clone().add(out));
    }
    hip.add(new THREE.LineSegments(segsFrom(hBr), brM)); kn.add(new THREE.LineSegments(segsFrom(kBr), brM));
    legs.push({hip, kn, sx, k, s: 0, l: 0, f: 0, y: 0});
  }
  g.userData.legs = legs;

  // halteres, behind the wing roots
  for(const sx of [-1, 1]){
    const a = new V3(sx*.03, .07, -.015), b = new V3(sx*.042, .064, -.026);
    limb(a, b, .001, .001, lm); part(SPH, hm, [b.x, b.y, b.z], [.0026, .0022, .0026]);
  }
  // wings: laid back over the abdomen in a shallow V; the pivot's z rotation flaps them (see the fly update)
  const wm = new THREE.MeshStandardMaterial({map: T.wing, transparent:true, alphaTest:.02, side:THREE.DoubleSide, roughness:.15, metalness:.1, depthWrite:false});
  const wgeo = new THREE.PlaneGeometry(.15, .056); wgeo.translate(.075, 0, 0); wgeo.rotateX(-Math.PI/2);
  const wings = [-1, 1].map(sx => {
    const piv = new THREE.Group(); piv.position.set(sx*.02, .088, .03); g.add(piv);
    const w = new THREE.Mesh(wgeo, wm); w.scale.x = sx; w.rotation.y = sx*.95; w.position.y = .002; piv.add(w);
    w.renderOrder = 2;
    return piv;
  });
  g.userData.wings = wings; g.userData.th = th; g.userData.ab = ab;
  g.userData.th0 = th.scale.clone(); g.userData.ab0 = ab.scale.clone();
  g.traverse(o => { if(o.isMesh) o.castShadow = true; });
  scene.add(g); return g;
}

const sp = {
  m: makeSpider(false), pos: new V3(START.x, START.y, START.z), vel: new V3(), yaw: 0, mode:'ground', plat: START,
  anchor: new V3(), anchorPlat: null, ropeL: 0, braked: false, committed: false,
  charging: false, charge: 0, phase: 0, speed: 0, hunger: .55, caught: 0, motion: 0, self: true, felt: 0, temp: .6, heat: 0,
  moveVel: new V3(), vigor: 1, stuck: 0, climbHead: new V3(0, 1, 0), climbGrace: 0, stuckKind: '', stuckPos: new V3(), lunge: 0, tap: 0, pluckT: 0, noise: 0, plucking: false,
  raiseW: 0, raiseLvl: 0, line: false, plop: false, holdIn: false
};
sp.m.userData.owner = sp;
// the male displays out in the jungle, on a big herb leaf (L74) high on its stalk; home is the spot he dances around
const MALE_HOME = new V3(-35.38, 0, 2.14);
let MALE_LEAF = PLAT.filter(p => p.herb && inPlat(p, MALE_HOME.x, MALE_HOME.z, 0)).sort((a, b) => Math.abs(a.y - 9.6) - Math.abs(b.y - 9.6))[0];
// if the jungle grows differently and no blade covers that spot, the nearest high herb blade, danced on at its middle
if(!MALE_LEAF){ MALE_LEAF = PLAT.filter(p => p.herb && p.y - hAt(p.x, p.z) > 5).sort((a, b) => Math.hypot(a.x - MALE_HOME.x, a.z - MALE_HOME.z) - Math.hypot(b.x - MALE_HOME.x, b.z - MALE_HOME.z))[0];
  MALE_HOME.set(MALE_LEAF.x, 0, MALE_LEAF.z); }
MALE_HOME.y = MALE_LEAF.y;
const male = {m: makeSpider(true), plat: MALE_LEAF, home: MALE_HOME, pos: MALE_HOME.clone(), t: 0, motion: 0, vib: 0, temp: .64};
male.m.userData.owner = male;
const flies = [];
const FLY_HOMES = [PLAT[1], PLAT[3], PLAT.find(p => p.kind === 'log')];
for(let i = 0; i < 3; i++){
  const plat = FLY_HOMES[i];
  const f = {m: makeFly(), plat, pos: randomIn(plat), state:'walk', t: rnd()*3, dir: rnd()*6.28, motion: 0, vib: 0, hear: 0, gone: false, respawn: 0, temp: .7};
  f.m.userData.owner = f; flies.push(f);
}
const cricket = {pos: new V3(-6.5, hAt(-6.5, 6.5) + .05, 6.5)};
const HUNT = PLAT.filter(p => (p.kind === 'leaf' && !p.herb) || p.kind === 'log' || p.kind === 'fungus');   // flies stay in the play area
