'use strict';
// spider model, legs/IK, gait, palps and fangs

/* ---------- creatures ---------- */
function superEllipsoid(a, b, c, e, rise = 0, flat = 1, res = 1){
  const g = new THREE.SphereGeometry(1, Math.round(28*res), Math.round(18*res)), p = g.attributes.position;
  const f = v => Math.sign(v)*Math.pow(Math.abs(v), e);
  for(let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let Y = f(y)*b; Y *= Y > 0 ? 1 + rise*z : flat;
    p.setXYZ(i, f(x)*a, Y, f(z)*c);
  }
  g.computeVertexNormals(); return g;
}
function surfaceHairs(geo, n, len, back, mat){
  const p = geo.attributes.position, nm = geo.attributes.normal, pts = [];
  for(let k = 0; k < n; k++){
    const i = Math.floor(rnd()*p.count), b = new V3(p.getX(i), p.getY(i), p.getZ(i)), d = new V3(nm.getX(i), nm.getY(i), nm.getZ(i));
    if(d.y < -.4) continue;
    d.z -= back; d.normalize(); pts.push(b, b.clone().addScaledVector(d, len*rr(.6, 1.4)));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
}
function segHairs(L, r, n, len, mat, opt = {}){
  const pts = [];
  for(let k = 0; k < n; k++){
    const z = L*rr(.08, .98), th = opt.fringe && rnd() < .7 ? rr(-2.6, -.5) : rnd()*6.28;
    const b = new V3(Math.cos(th)*r, Math.sin(th)*r, z), d = new V3(Math.cos(th), Math.sin(th), opt.fringe ? .4 : 1.15).normalize();
    pts.push(b, b.clone().addScaledVector(d, len*rr(.6, 1.3)*(opt.fringe ? 2.2 : 1)));
  }
  for(let k = 0; k < (opt.tricho || 0); k++){ const z = L*rr(.2, .7), b = new V3(rr(-.3, .3)*r, r, z); pts.push(b, b.clone().add(new V3(0, len*2.6, len*.4))); }
  if(opt.tuft) for(let k = 0; k < 7; k++){ const th = k/7*6.28, b = new V3(0, 0, L*.97); pts.push(b, b.clone().add(new V3(Math.cos(th)*len*.6, Math.sin(th)*len*.6 - len*.3, len*.5))); }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
}
// a feather: hairs splay out sideways from both flanks of a segment, angled forward (Portia's plumed palps and legs)
function featherHairs(L, r, n, len, mat, spread = 1, tp = null){   // tp: {r1, l1} tip radius and tip hair-length factor (taper)
  const pts = [];
  for(let k = 0; k < n; k++){
    const z = L*rr(.05, 1), sd = rnd() < .5 ? -1 : 1, th = (sd > 0 ? 0 : Math.PI) + rr(-.9, .9)*spread;
    const f = z/L, rz = tp ? r + (tp.r1 - r)*f : r, lf = tp ? 1 + (tp.l1 - 1)*f : .75 + .35*Math.sin(f*3.1);
    const b = new V3(Math.cos(th)*rz, Math.sin(th)*rz, z), d = new V3(Math.cos(th), Math.sin(th)*.6 - .15, rr(.25, .7)).normalize();
    pts.push(b, b.clone().addScaledVector(d, len*rr(.5, 1.25)*lf));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
}
// a pelt: hairs all round a segment, lying back along it, so the segment beneath is hidden
function pelt(L, r, n, len, mat, tp = null){
  const pts = [];
  for(let k = 0; k < n; k++){
    const z = L*rr(-.08, 1), f = Math.max(0, z/L), th = rnd()*6.283, rz = (tp ? r + (tp.r1 - r)*f : r)*.95, b = new V3(Math.cos(th)*rz, Math.sin(th)*rz, z);
    const d = new V3(Math.cos(th)*rr(.3, .7), Math.sin(th)*rr(.3, .7), 1).normalize();
    pts.push(b, b.clone().addScaledVector(d, len*rr(.6, 1.3)*(tp ? 1 + (tp.l1 - 1)*f : 1)));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
}
const LEGDEF = [ {len:.39, th:.026, yaw:.8, z:.085}, {len:.325, th:.019, yaw:1.3, z:.06}, {len:.34, th:.019, yaw:1.8, z:.035}, {len:.4, th:.0195, yaw:2.4, z:.005} ];   // the female's long, stout legs: ~25% longer and ~50% thicker than the male's;
// her hind legs splay wider so, trailing behind as she walks, they clear the abdomen and each other
const LEGDEF_M = [ {len:.31, th:.0175, yaw:.8, z:.085}, {len:.26, th:.0125, yaw:1.3, z:.06}, {len:.27, th:.0125, yaw:1.8, z:.035}, {len:.32, th:.013, yaw:2.7, z:.005} ];
const SEGF = [.30, .13, .24, .18, .15];               // femur, patella, tibia, metatarsus, tarsus
const REST = [-.8, 1.0, .35, .25, .25];
// Portia's coat: grey-scale mottling and banding (tinted by each part's own colour), and dense multi-tone fur
const SPIDER_TEX = (() => {
  const mott = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 9000; i++){ const v = 140 + trnd()*115; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(trnd()*w, trnd()*h, 1 + trnd()*2, 1 + trnd()*2); }
    for(let i = 0; i < 140; i++){ const dk = trnd() < .55, v = dk ? 40 + trnd()*50 : 220 + trnd()*35; x.fillStyle = `rgba(${v},${v*.96},${v*.9},${.25 + trnd()*.35})`;
      x.beginPath(); x.ellipse(trnd()*w, trnd()*h, 2 + trnd()*10, 1.5 + trnd()*6, trnd()*3, 0, 6.283); x.fill(); }
    x.strokeStyle = 'rgba(60,55,50,.25)'; for(let i = 0; i < 600; i++){ const px = trnd()*w, py = trnd()*h; x.lineWidth = .6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (trnd() - .5)*4, py + 3 + trnd()*4); x.stroke(); }
  }, [2, 2]);
  const band = canvasTex(32, 128, (x, w, h) => {
    x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, w, h);
    for(const [y0, y1, v] of [[0, 18, 70], [46, 60, 95], [88, 104, 60], [118, 128, 230]]){ x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, y0, w, y1 - y0); }
    for(let i = 0; i < 700; i++){ const v = 120 + trnd()*130; x.fillStyle = `rgba(${v},${v},${v},.4)`; x.fillRect(trnd()*w, trnd()*h, 1.5, 1.5); }
  }, [1, 1]);
  return {mott, band};
})();
// fur: each hair runs from a darker root to a tip that is pale, brown or near-black; a few long setae stand out
function furHairs(geo, n, len, back, mat, longFrac = .1){
  const p = geo.attributes.position, nm = geo.attributes.normal, pts = [], cols = [];
  for(let k = 0; k < n; k++){
    const i = Math.floor(rnd()*p.count), b = new V3(p.getX(i), p.getY(i), p.getZ(i)), d = new V3(nm.getX(i), nm.getY(i), nm.getZ(i));
    if(d.y < -.45) continue;
    d.z -= back*rr(.6, 1.4); d.x += rr(-.35, .35); d.normalize();
    const long = rnd() < longFrac, L = len*rr(.45, 1.5)*(long ? 2.6 : 1);
    const r = rnd(), tip = long ? 1.25 : r < .5 ? rr(1.0, 1.3) : r < .82 ? rr(.65, .85) : rr(.25, .4), root = rr(.35, .6);
    pts.push(b, b.clone().addScaledVector(d, L)); cols.push(root, root*.95, root*.9, tip, tip*.97, tip*.9);
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.LineSegments(g, mat);
}
// hair physics: every hair's tip is offset by a damped spring that reacts to the body's acceleration and airflow
// (lagging on a start or stop, streaming back in a leap, sagging, rippling in gusts), plus a fine individual flutter
function hairPhysics(root){
  const U = {value: new V3()};
  root.traverse(o => {
    if(!o.isLineSegments) return;
    const g = o.geometry, p = g.attributes.position, n = p.count, tip = new Float32Array(n), len = new Float32Array(n);
    for(let i = 0; i + 1 < n; i += 2){ const L = Math.hypot(p.getX(i + 1) - p.getX(i), p.getY(i + 1) - p.getY(i), p.getZ(i + 1) - p.getZ(i)); tip[i + 1] = 1; len[i] = len[i + 1] = L; }
    g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1)); g.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
    const m = o.material; if(m.userData.hairPhys) return; m.userData.hairPhys = true;
    m.onBeforeCompile = sh => {
      sh.uniforms.uHairW = U; sh.uniforms.uWT = WORLD_T;
      sh.vertexShader = 'attribute float aTip; attribute float aLen; uniform vec3 uHairW; uniform float uWT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float k = aTip*clamp(aLen*90., .3, 3.);
          vec3 fl = vec3(sin(uWT*9. + position.x*900.), sin(uWT*7.3 + position.z*800.), cos(uWT*8.1 + position.y*700.))*.0011;
          transformed += transpose(mat3(modelMatrix))*(uHairW + fl)*k; }`);
    };
    m.customProgramCacheKey = () => 'hairphys';
  });
  root.userData.hair = {U, off: new V3(), vel: new V3(), lastPos: null, lastVel: new V3()};
}
function updateHair(m, dt){
  const H = m.userData.hair; if(!H || dt <= 0) return;
  const pos = m.userData.parts.body.getWorldPosition(new V3());
  if(!H.lastPos){ H.lastPos = pos.clone(); return; }
  const vel = pos.clone().sub(H.lastPos).divideScalar(dt); H.lastPos.copy(pos);
  if(vel.length() > 40) vel.setLength(40);                                  // a teleport is not a gust
  const acc = vel.clone().sub(H.lastVel).divideScalar(dt); H.lastVel.lerp(vel, .5);
  const tgt = acc.multiplyScalar(-.0005).addScaledVector(vel, -.0022).add(new V3(0, -.0015, 0)).add(windVec().multiplyScalar(.0045*(.3 + wind.gust)));
  if(tgt.length() > .02) tgt.setLength(.02);
  H.vel.addScaledVector(tgt.sub(H.off), 260*dt); H.vel.multiplyScalar(Math.exp(-13*dt)); H.off.addScaledVector(H.vel, dt);
  if(H.off.length() > .025) H.off.setLength(.025);
  H.U.value.copy(H.off);
}
// Portia's colour pattern: one function per body part, read both by the skin texture and by each hair's root,
// so the fur carries the same mottling, bands and spots as the skin beneath it (sRGB triples)
const PCOL = {cream:[.95,.93,.88], tan:[.55,.48,.40], rust:[.45,.30,.20], brown:[.20,.16,.13], dark:[.05,.04,.04], grey:[.50,.50,.50]};
const mixC = (a, b, t) => [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t];
// the female's solid-colour parts, toned to match PCOL (Portia fimbriata: sooty, cream-flecked)
const PTONE = {cara:0x4e4136, abd:0x5b4e40, hair:0xbfb4a3, chel:0x201a16, em:0x030303, leg:0x40352b, leg1:0x4a433d, tip:0x837e79, palp:0x695a4a, ring:0x716251, rim:0x28201a, plume:0xf7f4ed};
const h3 = (x, y, z) => { const v = Math.sin(x*127.1 + y*311.7 + z*74.7)*43758.5453; return v - Math.floor(v); };
function noise3(x, y, z){
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z, s = t => t*t*(3 - 2*t), su = s(u), sv = s(v), sw = s(w);
  const l = (a, b, t) => a + (b - a)*t, c = (i, j, k) => h3(X + i, Y + j, Z + k);
  return l(l(l(c(0,0,0), c(1,0,0), su), l(c(0,1,0), c(1,1,0), su), sv), l(l(c(0,0,1), c(1,0,1), su), l(c(0,1,1), c(1,1,1), su), sv), sw);
}
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a)/(b - a))); return t*t*(3 - 2*t); };   // smoothstep; a > b runs it downhill
const PAT = {
  cara(x, y, z){                                  // rust and brown mottle, black flecks, dark eye field, pale margins
    const n1 = noise3(x*4 + 3, y*4, z*4), n2 = noise3(x*13, y*13 + 5, z*13);
    let c = mixC(PCOL.brown, PCOL.rust, Math.min(1, n1*1.3));
    if(n2 > .7) c = mixC(c, PCOL.dark, .75); else if(n2 < .2) c = mixC(c, PCOL.tan, .6);
    if(z > .45 && y > .1) c = mixC(c, PCOL.dark, .45);
    if(y < .22) c = mixC(c, n1 > .5 ? PCOL.cream : PCOL.tan, .55);
    if(Math.abs(x) < .14 && z < .35 && z > -.6 && y > .5) c = mixC(c, PCOL.tan, .5);
    return c;
  },
  abd(x, y, z){                                    // brown and tan, paired cream spots, a pale front band, dark chevrons behind, rust flecks
    const n1 = noise3(x*5, y*5 + 9, z*5), n2 = noise3(x*14 + 2, y*14, z*14), ax = Math.abs(x);
    let c = mixC(PCOL.brown, PCOL.tan, n1*.85);
    if(n2 > .72) c = mixC(c, PCOL.rust, .8); else if(n2 < .14) c = mixC(c, PCOL.dark, .7);
    const under = sstep(-.06, -.24, y);                                   // the belly darkens gradually, and carries no marks
    if(under >= 1) return mixC(c, PCOL.dark, .5);
    const c0 = c;
    // every mark fades in over a soft, noise-warped edge, so nothing reads as a pasted-on block
    const n3 = noise3(x*8 + 7, y*8, z*8 + 4), wob = (n3 - .5)*.12;
    // pale median stripe: a lancet, widest at the front and tapering back, its margins ragged
    const w = .17*(.45 + .55*sstep(-.6, .45, z))*(.8 + .4*n3);
    c = mixC(c, PCOL.cream, (.35 + n1*.3)*sstep(w*1.15, w*.5, ax + wob*.5)*sstep(-.65, -.3, z + wob)*sstep(.25, .6, y + wob));
    for(const [sx, sz, r] of [[.45, .35, .17], [.4, -.22, .16], [.3, -.58, .13]]){
      const d = Math.hypot(ax - sx, z - sz)/(r*(.8 + n2*.5)) + wob*1.5; c = mixC(c, PCOL.cream, .8*sstep(1.1, .7, d)); }
    { const t = -z*3.2 + ax*2.4 + wob*2, f = t - Math.floor(t);
      c = mixC(c, PCOL.dark, .6*sstep(0, .1, f)*sstep(.38, .18, f)*sstep(-.02, -.22, z)*sstep(.55, .85, n1 + n3*.4)); }   // broken chevrons, not drawn lines
    c = mixC(c, PCOL.dark, .45*sstep(.55, .66, ax + wob)*sstep(.9, .78, ax + wob)*sstep(.08, .25, y));
    return mixC(mixC(c, c0, under), PCOL.dark, .5*under);
  }
};
// skin texture for a sphere-mapped body part: each texel looks up the pattern at its direction on the unit sphere
function patternTex(fn){
  const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), im = x.createImageData(W, H);
  for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){
    const ph = (i + .5)/W*6.2832, th = (j + .5)/H*Math.PI, st = Math.sin(th);
    const c = fn(-Math.cos(ph)*st, Math.cos(th), Math.sin(ph)*st), k = (j*W + i)*4, g = .88 + h3(i, j, 3)*.24;
    im.data[k] = Math.min(255, c[0]*g*255); im.data[k + 1] = Math.min(255, c[1]*g*255); im.data[k + 2] = Math.min(255, c[2]*g*255); im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const PORTIA_TEX = {cara: patternTex(PAT.cara), abd: patternTex(PAT.abd)};
// recolour a hair bundle: fn(root) gives an sRGB colour; the root is shaded darker than the tip, each hair jittered
const VCM = {};
function hairCols(seg, fn, op = .9){
  const p = seg.geometry.attributes.position, c = new Float32Array(p.count*3), col = new THREE.Color(), r = new V3();
  for(let i = 0; i + 1 < p.count; i += 2){
    r.set(p.getX(i), p.getY(i), p.getZ(i)); const s = fn(r), j = rr(.82, 1.15);
    col.setRGB(Math.min(1, s[0]*j), Math.min(1, s[1]*j), Math.min(1, s[2]*j), THREE.SRGBColorSpace);
    c.set([col.r*.55, col.g*.55, col.b*.55, col.r, col.g, col.b], i*3);
  }
  seg.geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  seg.material = VCM[op] || (VCM[op] = new THREE.LineBasicMaterial({color:0xffffff, vertexColors:true, transparent:true, opacity:op}));
  return seg;
}
// weighted pick from the palette, by hair
const pickC = w => { let t = rnd()*w.reduce((a, b) => a + b[1], 0); for(const [k, v] of w){ if((t -= v) <= 0) return PCOL[k]; } return PCOL[w[0][0]]; };
function makeSpider(male){
  const s = male ? .92 : 1;
  const C = male ? {cara:0x15120f, abd:0x1a1613, leg:0x17130f, hair:0xe9e4d8, spot:0xf6f2e8, chel:0x2f9a82, palp:0xf2ede2, em:0x000000}
                 : {cara:PTONE.cara, abd:PTONE.abd, leg:0x5e4a36, hair:PTONE.hair, spot:0xd9c49a, chel:PTONE.chel, palp:0xd8c8a8, em:PTONE.em};   // Portia: sooty brown-black, cream-flecked
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.6, emissive:C.em}, o));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.rotation.order = 'YXZ';
  const hairM = new THREE.LineBasicMaterial({color:C.hair, transparent:true, opacity:.85}), palps = [];
  const furM = new THREE.LineBasicMaterial({color:C.hair, vertexColors:true, transparent:true, opacity:.9});
  const legFurM = new THREE.LineBasicMaterial({color: new THREE.Color(C.hair).multiplyScalar(.7), transparent:true, opacity:.8});
  const coat = (c, o = {}) => std(c, Object.assign({map: SPIDER_TEX.mott, bumpMap: SPIDER_TEX.mott, bumpScale: .6, roughness:.7}, o));
  // the inverse of superEllipsoid: a point on the shape back to its unit-sphere direction, for the pattern lookups
  const unSE = (a, b, c, e, rise, flat) => q => { const f = (v, k) => Math.sign(v)*Math.pow(Math.min(1, Math.abs(v/k)), 1/e), z = f(q.z, c*s);
    return [f(q.x, a*s), q.y > 0 ? f(q.y/(1 + rise*z), b*s) : f(q.y/flat, b*s), z]; };
  // the head: tall, box-fronted and high, the face a flat wall carrying the eyes
  // female head: a rounded dome that narrows towards its crown (taper) and whose upper face leans back (tilt), not a box
  const CG = male ? [.066, .057, .085, .62, .22, .6] : [.058, .064, .064, .7, .32, .45, .32, .3];
  function headPt(x, y, z){                                   // unit-sphere direction -> point on the head (unscaled, carapace-local)
    const [a, b, c, e, rise, flat, tp = 0, tl = 0] = CG, L = Math.hypot(x, y, z) || 1, f = v => Math.sign(v)*Math.pow(Math.abs(v/L), e);
    let X = f(x)*a, Y = f(y)*b*(y > 0 ? 1 + rise*z/L : flat), Z = f(z)*c;
    if(Y > 0){ const h = Y/(b*(1 + rise)); X *= 1 - tp*h; if(Z > 0) Z -= tl*c*h*(Z/c)*(Z/c); }
    return [X, Y, Z];
  }
  const cg = male ? superEllipsoid(...CG.map((v, i) => i < 3 ? v*s : v)) : (() => {
    const g = new THREE.SphereGeometry(1, 32, 22), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const q = headPt(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0]*s, q[1]*s, q[2]*s); }
    g.computeVertexNormals(); return g; })();
  // the whole head (carapace, eyes, horns, face, fangs, palps) rides in one group: on the female it stands tall and high,
  // its crown level with the abdomen, which sits lower behind it
  const head = new THREE.Group(); body.add(head);
  if(!male){ head.position.y = .012*s; head.scale.set(1, 1.1, 1); }
  const cara = new THREE.Mesh(cg, male ? coat(C.cara) : coat(0xffffff, {map: PORTIA_TEX.cara})); const HZ = male ? .05 : .066; cara.position.z = HZ*s; head.add(cara);   // the female's shorter head keeps its face where it was
  // a point on the head's surface in a given direction (body space, unscaled), pushed out by 'out' so an eye bulges from it
  function onCara(x, y, z, out = 0){
    const P = new V3(...headPt(x, y, z)), n = P.clone().normalize();
    return [P.x + n.x*out, P.y + n.y*out, P.z + HZ + n.z*out];
  }
  // the point on the front face at a given x, y (solved by iterating the direction)
  function faceAt(x, y, out = 0){
    const d = [x/CG[0], y/CG[1], 1];
    for(let i = 0; i < 30; i++){ const P = onCara(d[0], d[1], d[2]); d[0] *= Math.pow(Math.abs(x/(P[0] || 1e-6)), .7); d[1] *= Math.pow(Math.abs(y/(P[1] || 1e-6)), .7); }
    return onCara(d[0], d[1], d[2], out);
  }
  // the point on the head's side at a given height y and length z (solved like faceAt, with x free)
  function sideAt(y, z, out = 0){
    const d = [1, y/CG[1], (z - HZ)/CG[2]];
    for(let i = 0; i < 40; i++){ const P = onCara(d[0], d[1], d[2]); d[1] *= Math.pow(Math.abs(y/(P[1] || 1e-6)), .7); const dz = z - P[2]; d[2] += dz/CG[2]*.7; }
    return onCara(d[0], d[1], d[2], out);
  }
  const caraAt = unSE(...CG), caraCol = q => PAT.cara(...caraAt(q));
  const caraFurM = new THREE.LineBasicMaterial({color: new THREE.Color(C.cara).multiplyScalar(male ? 2.2 : 1.75), vertexColors:true, transparent:true, opacity:.9});
  const caraHairM = new THREE.LineBasicMaterial({color: new THREE.Color(C.cara).multiplyScalar(male ? 1.6 : 1.3), transparent:true, opacity:.85});
  const plumeM = new THREE.LineBasicMaterial({color: male ? 0xf6f3ea : PTONE.plume, transparent:true, opacity:.92});
  { const sh = surfaceHairs(cg, 160, .003*s, 1.3, caraHairM), fh = furHairs(cg, 6000, .0026*s, 1.2, caraFurM, .03);   // head: a short pile, the carapace's own colours
    if(!male){ hairCols(sh, caraCol, .85); hairCols(fh, q => mixC(caraCol(q), PCOL.cream, rnd() < .12 ? .6 : 0), .9); }
    cara.add(sh, fh); }
  // where the camera sits when it ducks into her eyes: just above the front of the crown, between the eye rows
  const eye = new THREE.Object3D(); eye.position.set(...onCara(0, .55, .85, .03)).multiplyScalar(male ? s : 1); head.add(eye);
  // eight eyes: AME (huge, forward, high on the face), ALE just outside and above them on the front corners, tiny PME, PLE on the rear corners
  const eyeM =new THREE.MeshStandardMaterial({color:0x050302, roughness:.05, metalness:.5});
  const glintM = new THREE.MeshBasicMaterial({color:0xffffff});
  const EYES = male ? [[.021, .014, .128, .023], [.05, .033, .118, .011], [.054, .047, .08, .0055], [.05, .048, .03, .012]]
                    : [faceAt(.0178, .036).concat(.0152), faceAt(.042, .038).concat(.009), sideAt(.04, HZ + .002).concat(.0052), sideAt(.042, HZ - .03).concat(.009)]   // all in one line running back along the head's side;   // AME, ALE, PME, PLE: on the surface
  const ringM = new THREE.MeshStandardMaterial({color:PTONE.ring, roughness:.9}), rimM = new THREE.MeshStandardMaterial({color:PTONE.rim, roughness:.95});
  for(const sx of [-1, 1]) for(const [x, y, z, r] of EYES){
    if(male){
      const e = new THREE.Mesh(new THREE.SphereGeometry(r*s, 12, 8), eyeM); e.position.set(sx*x*s, y*s, z*s); head.add(e);
      if(r > .01){ const gl = new THREE.Mesh(new THREE.SphereGeometry(r*.28*s, 6, 4), glintM); gl.position.set(sx*(x - r*.3)*s, (y + r*.45)*s, (z + r*.75)*s); head.add(gl); }
      continue;
    }
    // female: the eye sits sunk into the face (only a shallow lens shows), framed by a golden ring and a dark rim
    const P = new V3(sx*x, y, z), dir = P.clone().sub(new V3(0, 0, HZ - .025)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), dir);
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), eyeM); e.position.copy(P).addScaledVector(dir, -r*.45); head.add(e);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r*1.02, r*.045, 4, 28), ringM); ring.position.copy(P).addScaledVector(dir, r*.05); ring.quaternion.copy(q); head.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r*1.12, r*.035, 4, 28), rimM); rim.position.copy(P); rim.quaternion.copy(q); head.add(rim);
    if(r > .005){ const gl = new THREE.Mesh(new THREE.SphereGeometry(r*.17, 6, 4), glintM); gl.position.copy(P).addScaledVector(dir, r*.5).add(new V3(-sx*r*.25, r*.3, 0)); head.add(gl); }
    const pts = []; for(let k = 0; k < Math.round(r*1200); k++){ const a = rnd()*6.283, rad = r*rr(1.15, 1.4), lo = new V3(Math.cos(a)*rad, Math.sin(a)*rad, 0).applyQuaternion(q), b = P.clone().add(lo);
      pts.push(b, b.clone().addScaledVector(lo.normalize(), r*rr(.25, .5)).addScaledVector(dir, r*.2)); }   // short golden hairs radiating from the rim
    head.add(hairCols(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), hairM), () => pickC([['tan', 3], ['cream', 2], ['rust', 2]]), .9));
  }
  // the face below the eyes: a band of cream hair (the clypeus) over the fangs
  { const pts = []; const y0 = male ? -.012 : .01, n = male ? 14 : 420;
    for(let k = 0; k < n; k++){ const x = rr(-.04, .04)*s, b = male ? new V3(x, y0*s, .132*s) : new V3(...onCara(rr(-.42, .42), rr(-.4, -.04), .9, .001)); pts.push(b, b.clone().add(new V3(rr(-.003, .003)*s, (male ? -.014 : -.017)*s, (male ? .004 : .009)*s))); }
    const cl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), hairM);
    head.add(male ? cl : hairCols(cl, () => pickC([['cream', 6], ['tan', 2], ['brown', 1]]), .92)); }
  // horns: two tufts on the top front corners of the head, above the side eyes
  if(!male) for(const sx of [-1, 1]){
    const hg = new THREE.Group(); hg.position.set(...onCara(sx*.55, .75, .45, -.003).map(v => v*s)); hg.rotation.set(-.15, 0, -sx*.3); head.add(hg);
    hg.add(new THREE.Mesh(new THREE.ConeGeometry(.0085*s, .026*s, 7).translate(0, .013*s, 0), coat(0xffffff, {map: PORTIA_TEX.cara})));
    const pts = []; for(let k = 0; k < 160; k++){ const a = rnd()*6.283, h = rr(0, .02)*s, rad = .0086*s*(1 - h/(.026*s)), b = new V3(Math.cos(a)*rad, h, Math.sin(a)*rad);
      pts.push(b, b.clone().lerp(new V3(0, .03*s, .001*s), rr(.35, .6))); }
    hg.add(hairCols(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), hairM), q => q.y > .006*s ? pickC([['rust', 3], ['tan', 3], ['cream', 1]]) : pickC([['brown', 2], ['rust', 2], ['dark', 1]]), .95));
  }
  const fangs = [], fangM = new THREE.MeshStandardMaterial({color:0x1a0f08, roughness:.18, metalness:.55}), venomM = new THREE.MeshStandardMaterial({color:0xf4f0d0, emissive:0x6a6440, roughness:.1, transparent:true, opacity:.85});
  for(const sx of [-1, 1]){
    // each chelicera hinges at its top against the face; its fang folds along its lower edge (closed) or swings down
    // and forward, bared, when she sights prey or bites (fangTick drives both)
    const chY = (male ? .026 : .03)*s, piv = new THREE.Group(); piv.position.set(sx*.018*s, (male ? -.036 : -.026)*s + chY*.7, .122*s); head.add(piv);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({color:C.chel, roughness:.25, metalness:.7})); ch.scale.set((male ? .016 : .019)*s, chY, (male ? .015 : .018)*s); ch.position.y = -chY*.7; piv.add(ch);
    const fg = new THREE.Group(); fg.position.set(0, -chY*1.6, .004*s); piv.add(fg);
    fg.add(new THREE.Mesh(new THREE.ConeGeometry(.0045*s, .026*s, 6).rotateX(Math.PI/2).translate(0, 0, .013*s), fangM));
    const drop = new THREE.Mesh(new THREE.SphereGeometry(.003*s, 6, 4), venomM); drop.position.z = .027*s; drop.visible = false; fg.add(drop);   // a bead of venom at the tip
    fangs.push({piv, fg, sx, drop});
    const pa = new THREE.Group(); pa.position.set(sx*(male ? .032 : .034)*s, (male ? -.03 : -.008)*s, (male ? .12 : .128)*s); pa.rotation.set(male ? 1.05 : 1.2, sx*.2, 0); head.add(pa); palps.push({pa, sx});
    const pm = std(male ? C.palp : PTONE.palp, {emissive:0x000000});   // a tan-brown core beneath the cream hair
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry((male ? .005 : .0075)*s, (male ? .006 : .0095)*s, .03*s, 7).rotateX(Math.PI/2).translate(0, 0, .0175*s), pm); pa.add(p1);
    const j = new THREE.Group(); j.position.z = .035*s; j.rotation.x = .9; pa.add(j); palps[palps.length - 1].j = j;
    const p2 = new THREE.Mesh(male ? new THREE.SphereGeometry(.013*s, 8, 6).translate(0, 0, .014*s) : new THREE.CylinderGeometry(.0035*s, .0072*s, .03*s, 7).rotateX(Math.PI/2).translate(0, 0, .015*s), male ? std(0x0c0a08) : pm); j.add(p2);   // tapers to the tip
    j.add(segHairs(.03*s, .008*s, male ? 22 : 12, .01*s, hairM));
    const TP1 = {r1: (male ? .005 : .0075)*s, l1: .8}, TP2 = {r1: .0035*s, l1: .35};                         // longest hair at the base, short at the tip
    const pc = seg => male ? seg : hairCols(seg, q => pickC([['cream', 7], ['tan', 3], ['brown', 1.2], ['dark', .4]]), .92);   // cream plumes with tan and brown through them
    p1.add(pc(featherHairs(.035*s, (male ? .006 : .0095)*s, 140, .016*s, plumeM, .8, TP1)), pc(pelt(.035*s, (male ? .006 : .0095)*s, 420, .017*s, plumeM, TP1)));   // palps: plumes, fringed on both sides,
    j.add(pc(pelt(.03*s, .0072*s, 520, .018*s, plumeM, TP2)));                                                         // and a pelt all round hiding the segments
    if(!male) j.add(pc(featherHairs(.03*s, .0072*s, 260, .022*s, plumeM, .7, TP2)));
  }
  const ag = superEllipsoid(.072*s, .06*s, .105*s, .92, .1, .85);
  const abd = new THREE.Mesh(ag, male ? coat(C.abd) : coat(0xffffff, {map: PORTIA_TEX.abd})); abd.position.set(0, (male ? .012 : -.002)*s, (male ? -.115 : -.1)*s); abd.rotation.x = male ? -.12 : -.06; if(!male) abd.scale.z = 1.15; body.add(abd);   // the female's abdomen reaches further forward
  { const abdAt = unSE(.072, .06, .105, .92, .1, .85), abdCol = q => PAT.abd(...abdAt(q));
    const sh = surfaceHairs(ag, 320, .008*s, 1.4, hairM), fh = furHairs(ag, 8500, .0075*s, 1.35, furM, .1);
    if(!male){ hairCols(sh, q => mixC(abdCol(q), PCOL.cream, .25), .85); hairCols(fh, abdCol, .9); }   // the fur carries the abdomen's pattern
    abd.add(sh, fh); }
  const spotM = std(C.spot, {emissive: male ? 0x222222 : 0x3a2810});
  const SPOTS = male ? [[0, .07, 2.6, .9], [-.035, -.03, 1, 1], [.035, -.03, 1, 1], [-.028, -.07, .9, .9], [.028, -.07, .9, .9]]
                     : [[0, .02, 1.5, 1.4], [-.036, -.035, 1, 1], [.036, -.035, 1, 1], [-.028, -.075, .85, .85], [.028, -.075, .85, .85]];
  if(male) for(const [x, z, sw, sl] of SPOTS){
    const a = .072, b = .06, c = .105, yy = b*Math.sqrt(Math.max(0, 1 - (x/a)**2 - (z/c)**2));
    const sp = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), spotM); sp.scale.set(.011*sw*s, .004*s, .011*sl*s); sp.position.set(x*s, yy*s - .001*s, z*s); abd.add(sp);
  }
  // Portia's tufts: clumps of long setae that break her outline up like a scrap of debris
  { const pts = [];
    for(const [x, z, hg] of [[-.03, .01, 1], [.03, .01, 1], [-.026, -.06, .8], [.026, -.06, .8]]){
      const yy = .06*Math.sqrt(Math.max(0, 1 - (x/.072)**2 - (z/.105)**2));
      for(let k = 0; k < 14; k++){ const b = new V3(x + rr(-.006, .006), yy, z + rr(-.006, .006)).multiplyScalar(s); pts.push(b, b.clone().add(new V3(rr(-.008, .008), .03*hg, -.012).multiplyScalar(s))); }
    }
    const tf = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), hairM);
    abd.add(male ? tf : hairCols(tf, () => pickC([['tan', 3], ['rust', 2], ['cream', 2], ['dark', 1]]), .9));
    const cp = []; for(let k = 0; k < 16; k++){ const b = new V3(rr(-.012, .012), male ? .058 : .074, rr(-.01, .03)).multiplyScalar(s); cp.push(b, b.clone().add(new V3(rr(-.006, .006), .022, -.01).multiplyScalar(s))); }
    const ct = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cp), caraHairM);
    cara.add(male ? ct : hairCols(ct, () => pickC([['tan', 2], ['rust', 2], ['cream', 1]]), .9)); }
  const spinner = new THREE.Object3D(); spinner.position.set(0, -.008*s, -.105*s); abd.add(spinner);
  for(const sx of [-1, 1]){ const sn = new THREE.Mesh(new THREE.ConeGeometry(.007*s, .02*s, 6).rotateX(-Math.PI/2), std(C.abd)); sn.position.set(sx*.008*s, -.008*s, -.107*s); abd.add(sn); }
  const legTex = {map: SPIDER_TEX.band, bumpMap: SPIDER_TEX.mott, bumpScale: .4, roughness:.65};
  const legM = std(male ? C.leg : PTONE.leg, legTex), leg1M = male ? std(0x0b0907, legTex) : std(PTONE.leg1, Object.assign({emissive:C.em}, legTex));
  const tipM = male ? legM : std(PTONE.tip, Object.assign({emissive:C.em}, legTex));          // the leg tips: bare, slender, grey-brown with pale rings
  // leg hair colours: rust, brown and black mottle with a cream ring at the end of each segment; the plumes mostly cream and tan
  const legCol = L => q => q.z > L*.8 && rnd() < .7 ? pickC([['cream', 3], ['tan', 1]]) : pickC([['rust', 3], ['brown', 3], ['dark', 2], ['tan', 1.5], ['cream', .8]]);
  const plumeCol = () => pickC([['cream', 5], ['tan', 3], ['rust', 1.2], ['brown', 1], ['dark', .5]]);
  const legs = [];
  for(const side of [-1, 1]) for(let k = 0; k < 4; k++){
    const D = (male ? LEGDEF_M : LEGDEF)[k], yawG = new THREE.Group(); yawG.position.set(side*.045*s, -.018*s, D.z*s); yawG.rotation.y = side*D.yaw; body.add(yawG);
    const coxa = new THREE.Mesh(new THREE.SphereGeometry(D.th*1.1*s, 6, 5), k === 0 ? leg1M : legM); yawG.add(coxa);
    let parent = yawG, prevL = 0; const joints = [], segL = [];
    for(let j = 0; j < 5; j++){
      const jg = new THREE.Group(); jg.position.z = prevL; jg.rotation.x = REST[j]; parent.add(jg); joints.push(jg);
      const bare = !male && j >= 3, L = D.len*SEGF[j]*s, r0 = D.th*s*(bare ? (j === 3 ? .46 : .3) : 1 - j*.13), r1 = r0*(bare ? .7 : .82);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 6).rotateX(Math.PI/2).translate(0, 0, L/2), bare ? tipM : k === 0 ? leg1M : legM); jg.add(m);
      if(bare){                                                             // metatarsus and tarsus: thin and bare, a few fine setae on the metatarsus only
        if(j === 3) jg.add(hairCols(segHairs(L, r0, 7, D.th*.5*s, hairM), () => pickC([['grey', 2], ['tan', 1]]), .7));
      } else {
        const lc = legCol(L), tc = seg => male ? seg : hairCols(seg, lc, .88);
        jg.add(tc(segHairs(L, r0, j === 0 ? 9 : 13, D.th*.95*s, hairM, {tricho: (j === 2 || j === 3) ? 2 : 0, tuft: j === 4, fringe: k === 0 && (j === 1 || j === 2)})));
        jg.add(tc(segHairs(L, r0, Math.round((j === 0 ? 44 : 70)*(k === 0 ? 3.4 : 1)), D.th*(k === 0 ? .5 : .7)*s, legFurM)));
        if(k === 0 && j >= 1 && j <= (male ? 3 : 2)) jg.add(male ? segHairs(L, r0, 120, D.th*.6*s, hairM, {fringe: true}) : hairCols(segHairs(L, r0, 120, D.th*.6*s, hairM, {fringe: true}), plumeCol, .9));   // the first legs: dense, short fringe brushes
        if(j <= 3){ const fh = featherHairs(L, r0, Math.round((k === 0 ? 70 : 55)*(j === 1 ? .6 : 1)), D.th*(k === 0 ? 1.1 : 1.4)*s, plumeM, 1.1); jg.add(male ? fh : hairCols(fh, plumeCol, .92)); }   // feathery fringes on every leg
      }
      parent = jg; prevL = L; segL.push(L);
    }
    const tip = new THREE.Object3D(); tip.position.z = prevL; parent.add(tip);
    legs.push({side, k, yawG, joints, tip, segL, base: side*D.yaw, foot: new V3(), planted: false, step: null, free: false});
  }
  root.userData.parts = {body, legs, s, h0: 0, hairM, furM, legFurM, hairBase: new THREE.Color(C.hair), spinner, abd, palps, head, eye, fangs, fangF: 0};
  hairPhysics(root);
  root.traverse(o => { if(o.isMesh) o.castShadow = true; });
  poseSpider(root, {}); root.updateMatrixWorld(true);
  let minY = 1e9; const w = new V3(); for(const L of legs){ L.tip.getWorldPosition(w); minY = Math.min(minY, w.y); }
  root.userData.parts.h0 = -minY + .002;
  // rest footholds in body space: where each foot naturally wants to be
  poseSpider(root, {}); root.updateMatrixWorld(true);
  setRestStance(body, legs);
  scene.add(root);
  return root;
}

/* ---------- legged locomotion: planted feet, stepping gait, inverse kinematics ----------
   Each foot holds a world-space foothold. The body is carried by the planted feet (height and tilt come
   from where they stand) and can only move as far as they can stretch, so the stepping legs drive the motion. */
const PHI3 = 1.0, T4 = .25;                 // metatarsus angle below horizontal, tarsus flex
// knee chain A (femur) + B (patella/tibia), then a distal part held at a fixed downward angle (cz out, cd down)
function legGeo(L){
  if(!L.geo){
    const g = L.segL;
    L.geo = g.length === 5 ? [g[0], g[1] + g[2], g[3]*Math.cos(PHI3) + g[4]*Math.cos(PHI3 + T4), g[3]*Math.sin(PHI3) + g[4]*Math.sin(PHI3 + T4)]
                           : [g[0], g[1], g[2]*Math.cos(PHI3), g[2]*Math.sin(PHI3)];
  }
  return L.geo;
}
function legIK(L, fb){                       // fb: foot target in body space
  const d = fb.clone().sub(L.yawG.position);
  L.yawG.rotation.y = Math.atan2(d.x, d.z);
  const [A, B, cz, cd] = legGeo(L), r = Math.hypot(d.x, d.z);
  const px = r - cz, dn = -(d.y + cd);                                     // ankle point, downward positive
  const D = Math.min(A + B - 1e-4, Math.max(Math.abs(A - B) + 1e-4, Math.hypot(px, dn)));
  const cl = v => Math.max(-1, Math.min(1, v));
  const al = Math.atan2(dn, px), be = Math.acos(cl((A*A + D*D - B*B)/(2*A*D))), ga = Math.acos(cl((A*A + B*B - D*D)/(2*A*B)));
  const t0 = al - be, t1 = t0 + Math.PI - ga, J = L.joints;               // knee up: femur rises, patella bends down
  if(J.length === 5){ J[0].rotation.x = t0; J[1].rotation.x = t1 - t0; J[2].rotation.x = 0; J[3].rotation.x = PHI3 - t1; J[4].rotation.x = T4; }
  else { J[0].rotation.x = t0; J[1].rotation.x = t1 - t0; J[2].rotation.x = PHI3 - t1; }
}
// pull each rest foothold in toward the hip until the leg stands at ~72% stretch (high knees, reach in reserve)
function setRestStance(body, legs){
  for(const L of legs){
    const tip = body.worldToLocal(L.tip.getWorldPosition(new V3())), hp = L.yawG.position;
    let lo = .3, hi = 1;
    for(let i = 0; i < 14; i++){ const f = (lo + hi)/2, q = new V3(hp.x + (tip.x - hp.x)*f, tip.y, hp.z + (tip.z - hp.z)*f); if(reachRatio(L, q) > .72) hi = f; else lo = f; }
    L.restLocal = new V3(hp.x + (tip.x - hp.x)*lo, tip.y, hp.z + (tip.z - hp.z)*lo);
    L.restR = Math.hypot(L.restLocal.x - hp.x, L.restLocal.z - hp.z);
    Object.assign(L, {foot: new V3(), planted: false, step: null, free: false});
  }
}
// Portia's feet take whatever surface they actually reach near her: soil, bark, stone faces, stone tops.
// Returns the surface normal there. Around a corner the front feet land on the wall while the hind feet stay put.
function playerPlace(v){
  const pl = sp.plat;
  if(pl && pl.web){ pl.project(v); return pl.normal(v); }          // on the orb every foot takes the silk: no reaching for nearby leaves or stems, which tilts her and locks her legs
  if(pl && !pl.ground && pl.kind !== 'climb' && !pl.climb){ (sp.mode === 'ground' ? placeTop : placeOn)(pl, v); return UP.clone(); }
  let bd = 1e9; const best = new V3(), bn = new V3(0, 1, 0), q = new V3();
  const take = n => { const d2 = q.distanceToSquared(v); if(d2 < bd){ bd = d2; best.copy(q); bn.copy(n); } };
  const walls = [], tops = [];
  for(const S of climbsNear(v.x, v.z, .8)){
    if(!S.near(v)) continue;
    walls.push(S); if(S.top && !S.thin) tops.push(S.top);
  }
  if(!(pl && (pl.climb || pl.thin))){           // soil, unless standing on a top, under a leaf or on the orb (or it's inside a trunk)
    q.set(v.x, floorAt(v.x, v.z) + .002, v.z);
    if(!walls.some(S => S.inside(q, -.005))){
      const [gx, gz] = slopeAt(v.x, v.z);
      if(pl && pl.kind === 'climb'){ const d2 = q.distanceToSquared(v), pen = .07; if(d2 + pen*pen < bd){ bd = d2 + pen*pen; best.copy(q); bn.set(-gx, 1, -gz).normalize(); } }
      else take(new V3(-gx, 1, -gz).normalize());                 // climbing: the feet reach for bark over soil tucked under an overhang
    }
  }
  for(const S of walls){ q.copy(v); S.project(q); take(S.normal(q)); }
  // a stalk's blade is a curved leaf, not a flat disc at its centre height: put the foot on the real top, and only
  // from above it. Under the blade a foot can't reach the top through it, or half her feet stand "up" and half
  // "down" and the averaged normal tips her body on its side, through the leaf.
  for(const T of tops){ const [cx, cz] = clampTo(T, v.x, v.z), y = T.leaf ? surfAt(T, cx, cz) : T.y;
    if(T.leaf && (pl === T.under || v.y < y - .01)) continue;
    q.set(cx, y + .002, cz); take(UP); }
  v.copy(best); return bn.clone();
}
// carry the body on the feet: "up" from the standing feet's surface normals, height from where they stand,
// shifted so every standing foot stays within reach; both smoothed, so corners are rounded by the legs
function bodyOnFeet(m, dt, base, fwd, fallbackUp, snap = false, soft = false){
  const P = m.userData.parts, st = P.legs.filter(L => !L.free && L.planted && !L.step);
  const nUp = new V3(); for(const L of st) nUp.add(L.n || UP);
  if(nUp.lengthSq() < 1e-6) nUp.copy(fallbackUp); nUp.normalize();
  const kUp = 1 - Math.exp(-(snap ? 22 : 6)*dt);                            // snapping: the body hugs the surface through a dart
  if(!P.up || !P.inited) P.up = nUp.clone();
  else if(P.up.dot(nUp) < -.95) P.up.applyAxisAngle(new V3(1, 0, 0).applyQuaternion(m.quaternion), Math.PI*kUp).normalize();   // feet on the opposite face: a lerp toward the exact opposite never turns, so pitch over
  else P.up.lerp(nUp, kUp).normalize();
  // facing stays continuous: where the wanted heading is still edge-on to the tilting body (e.g. "up the wall" while
  // the body is still level), keep the current facing and hand over as the body rolls onto the new surface
  const up = P.up, zA = fwd.clone().addScaledVector(up, -fwd.dot(up)), cur = new V3(0, 0, 1).applyQuaternion(m.quaternion);
  const zB = cur.addScaledVector(up, -cur.dot(up)), la = zA.length(), w = P.inited ? Math.min(1, Math.max(0, (la - .35)/.4)) : 1;
  let z = new V3();
  if(la > 1e-4) z.addScaledVector(zA.normalize(), w);
  if(zB.lengthSq() > 1e-8) z.addScaledVector(zB.normalize(), 1 - w);
  if(z.lengthSq() < 1e-6) z.set(0, 0, 1).addScaledVector(up, -up.z);
  z.normalize();
  if(P.inited && zB.lengthSq() > 1e-8){                     // turn the facing at a bounded rate (≈3 rad/s)
    const c = Math.max(-1, Math.min(1, zB.dot(z))), ang = Math.acos(c), mx = (snap ? 10 + 30*w : 3 + 11*w)*dt;
    if(ang > mx){ const perp = z.clone().addScaledVector(zB, -c); if(perp.lengthSq() > 1e-8){ perp.normalize(); z = zB.clone().multiplyScalar(Math.cos(mx)).addScaledVector(perp, Math.sin(mx)); } }
  }
  M4.makeBasis(new V3().crossVectors(up, z), up, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(M4);
  if(P.inited) m.quaternion.slerp(q, 1 - Math.exp(-(snap ? 45 : 12)*dt)); else m.quaternion.copy(q);
  let off = 0; for(const L of st) off += L.foot.clone().sub(base).dot(up); off = st.length ? off/st.length : 0;
  const target = base.clone().addScaledVector(up, off);
  if(st.length && P.inited){
    m.updateMatrixWorld(true);
    const fbs = st.map(L => [L, P.body.worldToLocal(L.foot.clone())]);
    const worst = dl => { const sh = target.clone().addScaledVector(up, dl).sub(m.position).dot(up); return Math.max(...fbs.map(([L, fb]) => reachRatio(L, fb, -sh))); };
    if(worst(0) > .88){ let best = 0, bw = worst(0); for(let i = -12; i <= 12; i++){ const w = worst(i*.025); if(w < bw - 1e-4){ bw = w; best = i*.025; } } target.addScaledVector(up, best); }
  }
  if(P.inited) m.position.lerp(target, 1 - Math.exp(-(snap ? 40 : soft ? 5 : 14)*dt)); else m.position.copy(target);   // stalking: the body floats over each change of footing
}
const placeOn = (p, v) => { [v.x, v.z] = clampTo(p, v.x, v.z); v.y = surfAt(p, v.x, v.z) + .002; return v; };
const UP = new V3(0, 1, 0);
// how hard a leg must stretch to put its foot at fb (body space): 1 = fully straight knee chain
function reachRatio(L, fb, dy = 0){
  const [A, B, cz, cd] = legGeo(L);
  const dx = fb.x - L.yawG.position.x, dz = fb.z - L.yawG.position.z, d_y = fb.y + dy - L.yawG.position.y;
  return Math.hypot(Math.hypot(dx, dz) - cz, -(d_y + cd))/(A + B);
}
// neighbours never lift together: same-side adjacent legs and the opposite leg of the pair keep standing
function canStep(P, L, maxN = 4){
  let n = 0;
  for(const o of P.legs){
    if(!o.step) continue; n++;
    if((o.side === L.side && Math.abs(o.k - L.k) === 1) || (o.k === L.k && o.side !== L.side)) return false;
  }
  return n < maxN;
}
function gaitSupport(m){
  const P = m.userData.parts; let n = 0, t = 0;
  for(const L of P.legs){ if(L.free) continue; t++; if(L.planted && !L.step) n++; }
  return t ? n/t : 1;
}
function gaitRelease(m){ for(const L of m.userData.parts.legs){ L.planted = false; L.step = null; } m.userData.parts.inited = false; }
// how much of a proposed body move the planted legs allow before they would overstretch
function gaitLimit(m, delta, maxR = .93){
  const P = m.userData.parts; if(!P.inited) return 1;
  const legs = P.legs.filter(L => !L.free && L.planted && !L.step), body = P.body;
  const now = legs.map(L => reachRatio(L, body.worldToLocal(L.foot.clone())));
  const ok = f => legs.every((L, i) => { const r = reachRatio(L, body.worldToLocal(L.foot.clone().addScaledVector(delta, -f))); return r <= maxR || r <= now[i]; });
  if(ok(1)) return 1;
  let lo = 0, hi = 1; for(let i = 0; i < 6; i++){ const mid = (lo + hi)/2; if(ok(mid)) lo = mid; else hi = mid; }
  return lo;
}
// turning is limited the same way: the body can only twist as far as the standing legs allow
function gaitTurn(m, from, to){
  const P = m.userData.parts; if(!P.inited || from === to) return to;
  const legs = P.legs.filter(L => !L.free && L.planted && !L.step), body = P.body, keep = m.rotation.y;
  const test = y => { m.rotation.y = y; m.updateMatrixWorld(true); return legs.map(L => reachRatio(L, body.worldToLocal(L.foot.clone()))); };
  const now = test(from), ok = f => test(from + angDelta(from, to)*f).every((r, i) => r <= .96 || r <= now[i] + 1e-4);
  let res = to;
  if(!ok(1)){ let lo = 0, hi = 1; for(let i = 0; i < 6; i++){ const mid = (lo + hi)/2; if(ok(mid)) lo = mid; else hi = mid; } res = from + angDelta(from, to)*lo; }
  m.rotation.y = keep; m.updateMatrixWorld(true);
  return res;
}
// carry the body on its feet: height from the stance feet, pitch front-vs-back, roll left-vs-right
function gaitBody(m, dt, fallbackY){
  const P = m.userData.parts, yaw = m.rotation.y;
  const f = new V3(Math.sin(yaw), 0, Math.cos(yaw)), rt = new V3(Math.cos(yaw), 0, -Math.sin(yaw)), d = new V3();
  let y = 0, n = 0, fy = 0, fz = 0, fn = 0, by = 0, bz = 0, bn = 0, ry = 0, rx = 0, rn = 0, ly = 0, lx = 0, ln = 0;
  for(const L of P.legs){
    if(L.free || !L.planted || L.step) continue;
    d.subVectors(L.foot, m.position); y += L.foot.y; n++;
    if(L.k < 2){ fy += L.foot.y; fz += d.dot(f); fn++; } else { by += L.foot.y; bz += d.dot(f); bn++; }
    if(L.side > 0){ ry += L.foot.y; rx += d.dot(rt); rn++; } else { ly += L.foot.y; lx += d.dot(rt); ln++; }
  }
  let ty = n ? y/n : fallbackY;
  if(n && P.inited){
    m.updateMatrixWorld(true);
    const st = P.legs.filter(L => !L.free && L.planted && !L.step).map(L => [L, P.body.worldToLocal(L.foot.clone())]);
    const worst = Y => Math.max(...st.map(([L, fb]) => reachRatio(L, fb, m.position.y - Y)));
    if(worst(ty) > .88){                                    // shift up or down so every standing foot is within reach
      let best = ty, bw = worst(ty);
      for(let i = -12; i <= 12; i++){ const Y = ty + i*.025, w = worst(Y); if(w < bw - 1e-4 || (w <= .88 && Math.abs(Y - ty) < Math.abs(best - ty) && bw <= .88)){ bw = w; best = Y; } }
      ty = best;
    }
    const fys = st.map(([L]) => L.foot.y);
    ty = Math.max(Math.min(...fys) - .04, Math.min(Math.max(...fys) + .06, ty));
  }
  m.position.y = P.inited ? m.position.y + (ty - m.position.y)*(1 - Math.exp(-16*dt)) : ty;
  let px = 0, pz = 0;
  if(fn && bn){ const dz = fz/fn - bz/bn; if(dz > .02) px = -Math.atan2(fy/fn - by/bn, dz); }
  if(rn && ln){ const dx = rx/rn - lx/ln; if(dx > .02) pz = Math.atan2(ry/rn - ly/ln, dx); }
  px = Math.max(-.7, Math.min(.7, px)); pz = Math.max(-.7, Math.min(.7, pz));
  const k = P.inited ? 1 - Math.exp(-10*dt) : 1;
  m.rotation.x += (px - m.rotation.x)*k; m.rotation.z += (pz - m.rotation.z)*k;
}
// Portia's saccadic gait (from footage of P. labiata): she moves in snaps. A burst either swivels the body on the
// spot (a big heading change is one pivot, up to ~95°, never a smooth arc) or darts it along the surface she stands
// on, as far as that surface has room (up to ~half a metre), on fast-beating legs. Then she freezes dead still,
// every foot locked. A dart never crosses onto another surface: it stops short of a trunk, a rim or a leaf edge,
// and only a push from there walks her over.
const PACE = {maxD: 1.5, maxClimb: 2.5, vMax: 3.4, vClimb: 3.0, minD: .04, pivotB: .075, F0: .12, F1: .27, cad: .045, pivotCad: .04};
const paceShape = u => { const s = x => x*x*(3 - 2*x); return u < .2 ? s(u/.2) : u > .75 ? s((1 - u)/.25) : 1; };   // surge, run, brake (mean ≈ .775)
const paceEase = u => 1 - (1 - u)**3;                         // swivels: fast out, settled at the end
function paceTick(o, dt, active, mag, err, room){
  const pc = o.pc || (o.pc = {ph: 'idle', t: 0, dur: 0, turn: 0, done: 0, pivot: false, jolt: 0, cruise: 0, cad: PACE.cad});
  pc.jolt = Math.max(0, pc.jolt - dt*8);
  if(!active){ if(pc.ph === 'burst') pc.jolt = 1; pc.ph = 'idle'; pc.t = 0; pc.dYaw = pc.rate = pc.v = pc.lead = 0; return pc; }
  if(pc.ph === 'burst' && pc.t >= pc.dur){ pc.ph = 'freeze'; pc.t = 0; pc.dur = rr(PACE.F0, PACE.F1) + (1 - mag)*.35; pc.jolt = 1; }
  if(pc.ph === 'idle' || (pc.ph === 'freeze' && pc.t >= pc.dur)){
    const a = Math.abs(err);
    pc.ph = 'burst'; pc.t = 0; pc.done = 0; pc.pivot = a > .45 || room - .03 < PACE.minD;
    pc.turn = Math.max(-1.65, Math.min(1.65, err));
    if(pc.pivot){ pc.D = 0; pc.dur = PACE.pivotB + .035*Math.min(1, a/1.6); pc.cruise = 0; pc.cad = PACE.pivotCad; }
    else { pc.D = Math.min((o.mode === 'climb' ? PACE.maxClimb : PACE.maxD)*(.3 + .7*mag), room - .03); pc.dur = Math.max(.07 + pc.D*.32, pc.D/(.775*(o.mode === 'climb' ? PACE.vClimb : PACE.vMax))); pc.cruise = pc.D/(pc.dur*.775); pc.cad = PACE.cad; }
  }
  pc.t += dt;
  const u = Math.min(1, pc.t/pc.dur);
  if(pc.ph === 'burst'){ const e = paceEase(u); pc.dYaw = pc.turn*(e - pc.done); pc.done = e; pc.rate = pc.turn*3*(1 - u)**2/pc.dur; pc.v = pc.cruise*paceShape(u);
    // lead: each foot lands where the body will be when it touches down (a beat and a half on), so the last
    // beats of a dart bring the feet back under her instead of leaving them all reaching forward
    let ahead = 0; const u2 = Math.min(1, u + pc.cad*1.5/pc.dur); for(let i = 0; i < 6; i++) ahead += paceShape(u + (u2 - u)*(i + .5)/6);
    pc.lead = pc.cruise*ahead/6*(u2 - u)*pc.dur/.102; }
  else { pc.dYaw = 0; pc.rate = 0; pc.v = 0; pc.lead = 0; }
  return pc;
}
// a burst only starts once her body sits square on the surface (after climbing over a rim it is still rolling round)
function settled(){
  const P = sp.m.userData.parts, nUp = new V3(); let k = 0; if(!P.up || !P.inited) return false;
  for(const L of P.legs) if(!L.free && L.planted && !L.step){ nUp.add(L.n || UP); k++; }
  return k >= 4 && nUp.lengthSq() > 1e-6 && P.up.dot(nUp.normalize()) > .94 && (sp.mode !== 'climb' || P.up.dot(sp.plat.normal(sp.pos)) > .5);   // and on the surface she is on, not a neighbour at a fork
}
// how far a dart can run from p along dir and stay on the surface she stands on
function dartRoomGround(p, dir, maxD){
  const pl = sp.plat, st = .03; let d = 0;
  for(; d + st <= maxD; d += st){
    const x = p.x + dir.x*(d + st), z = p.z + dir.z*(d + st);
    if(pl.ground ? Math.hypot(x, z) > AREA || climbHit(x, floorAt(x, z) + .05, z, dir) : !inPlat(pl, x, z) || climbHit(x, surfAt(pl, x, z) + .05, z, dir)) break;
  }
  return d;
}
// would a step to q along t carry her off climbing surface S (over its rim, down onto soil, onto another solid)?
function climbLeaves(S, q, t){
  if(S.top && S.atRim(q, t)) return true;
  if(t.y < 0 && S.atBottom && S.atBottom(q)) return true;
  for(const S2 of climbsNear(q.x, q.z, .4)){
    if(S2 === S || S2.thin || S2.web || !S2.inside(q, .015)) continue;
    if(t.dot(S2.normal(q)) > -.05) continue;
    return true;
  }
  return false;
}
function dartRoomClimb(S, p, dir, maxD){
  const q = p.clone(), st = .03; let d = 0;
  for(; d + st <= maxD; d += st){
    const n = S.normal(q), t = dir.clone().addScaledVector(n, -dir.dot(n)); if(t.lengthSq() < 1e-6) break; t.normalize();
    const q2 = q.clone().addScaledVector(t, st); S.project(q2);
    if(q2.distanceTo(q) > st*3 || climbLeaves(S, q2, t)) break;      // (the surface jumps there: a seam in the bark)
    q.copy(q2);
  }
  return d;
}
// while darting the feet hold only the surface she is on, so the body keeps its alignment to it
function dartPlace(v){
  const pl = sp.plat;
  if(sp.mode === 'climb'){                                   // a foot reaching past a leaf's rim gets the edge's sideways normal:
    pl.project(v); const n = pl.normal(v), nb = pl.normal(sp.pos);   // keep the body's own surface normal instead
    return n.dot(nb) > .6 ? n : nb;
  }
  if(pl.ground){
    const q = new V3(v.x, floorAt(v.x, v.z) + .002, v.z);
    const [gx, gz] = slopeAt(v.x, v.z), sn = new V3(-gx, 1, -gz).normalize();
    for(const S of climbsNear(v.x, v.z, .5)) if(S.inside(q, -.005)){ playerPlace(v); return sn; }   // a foot against a trunk grips the bark, but she stays level
    v.copy(q); return sn;
  }
  (sp.mode === 'ground' && !pl.climb ? placeTop : placeOn)(pl, v); return UP.clone();
}
// game logic (silk noise, scaring flies, the male's "is she still?") reads her average pace, not the burst peaks
// (quick to rise on a dart, slow to fall through a freeze, capped at her steady walking pace)
function paceSpeed(spd, on, dt, cap){
  if(!on) return sp.paceAvg = spd;
  const a = sp.paceAvg || 0, v = Math.min(spd, cap);
  return sp.paceAvg = a + (v - a)*(1 - Math.exp(-dt/(v > a ? .04 : .45)));
}
// place and step the feet, then bend every standing leg onto its foothold. o.snap: quick whip-like steps;
// o.hold: a freeze, so no foot lifts and lifted feet land where they were headed; o.cad {t, per}: a burst, the legs
// beat in two alternating sets of four (L1 R2 L3 R4 / R1 L2 R3 L4), each set flung forward once per beat
function gaitUpdate(m, dt, o){
  const P = m.userData.parts, body = P.body, s = P.s, up = o.up || UP, tmp = new V3();
  m.updateMatrixWorld(true);
  const turning = Math.abs(o.turn || 0) > .5;
  // sneaking is a slow rolling wave: up to three non-neighbouring legs in the air at once, each taking a long, slow
  // reach (it lifts once its foot lags ~7 cm and is set down ~4 cm ahead of its rest spot), so the body glides
  const spd = o.vel.length(), stepDur = o.sneak ? (turning ? .5 : .6) : o.snap ? .06 : Math.max(.07, (o.stepDur || .16) - spd*.05), stride = .07*s;
  for(const L of P.legs){
    if(o.free(L)){ L.free = true; L.step = null; continue; }
    // the foothold this leg wants: its rest spot, led ahead along the motion, set onto the real surface
    const base = body.localToWorld(L.restLocal.clone()), lead = o.vel.clone().multiplyScalar(stepDur*1.2 + .03), des = new V3(); let dn = up;
    if(o.sneak && spd > 1e-4) lead.copy(o.vel).multiplyScalar(stride*.55/spd + stepDur*.5);   // a long reach ahead, not a shuffle
    if(o.turn){ const ang = Math.max(-.6, Math.min(.6, o.turn*(stepDur*1.3 + .04))); base.sub(m.position).applyAxisAngle(up, ang).add(m.position); }
    for(let i = 0; i < 6; i++){                      // never aim for a foothold the leg can't comfortably reach
      des.copy(base).add(lead); const pn = o.place(des); dn = pn && pn !== des ? pn : up;
      if(reachRatio(L, body.worldToLocal(des.clone())) <= .8) break;
      lead.multiplyScalar(.55);
    }
    // on a slim trunk the rest foothold, set onto the curving bark, can lie out of reach: draw it in toward the hip
    if(reachRatio(L, body.worldToLocal(des.clone())) > .9){
      const hip = L.yawG.getWorldPosition(new V3());
      for(let i = 0; i < 5; i++){ des.lerp(hip, .25); const pn = o.place(des); dn = pn && pn !== des ? pn : up; if(reachRatio(L, body.worldToLocal(des.clone())) <= .9) break; }
    }
    if(L.free || !L.planted){                       // (re)plant from wherever the foot is now
      const tip = L.tip.getWorldPosition(new V3());
      L.free = false; L.planted = true; L.foot.copy(tip); L.n = dn.clone(); L.step = {from: tip, to: des.clone(), t: 0, dur: o.snap ? .07 : .12, n: dn.clone()};
    }
    if(L.step){
      L.step.t += dt/L.step.dur; if(!o.hold){ L.step.to.copy(des); L.step.n = dn.clone(); }
      const k = Math.min(1, L.step.t);
      const e = o.sneak ? k*k*k*(k*(6*k - 15) + 10) : o.snap ? 1 - (1 - k)**3 : k*k*(3 - 2*k);   // sneaking: eased into the touchdown; snapping: flung out, planted hard
      L.foot.lerpVectors(L.step.from, L.step.to, e);
      L.foot.addScaledVector(up, (o.snap ? Math.pow(Math.sin(Math.PI*k), .6)*.035 : Math.sin(Math.PI*k)*(o.sneak ? .018 : .03 + spd*.025))*s);
      if(k >= 1){ L.foot.copy(L.step.to); L.n = L.step.n; L.step = null; }
    } else {
      tmp.subVectors(L.foot, des); const vert = tmp.dot(up); tmp.addScaledVector(up, -vert);
      const err = tmp.length(), reach = reachRatio(L, body.worldToLocal(L.foot.clone()));
      if(err > stride*8){ L.foot.copy(des); L.n = dn.clone(); }                                  // teleported: just plant
      else if(o.cad){
        const beat = Math.floor(o.cad.t/o.cad.per), grp = (L.k + (L.side > 0 ? 0 : 1)) % 2;
        if(beat % 2 === grp && o.cad.t - beat*o.cad.per < o.cad.per*.4 && (err > stride*(o.cad.min || .15) || Math.abs(vert) > .02*s))
          L.step = {from: L.foot.clone(), to: des.clone(), t: 0, dur: Math.max(.02, (beat + 1)*o.cad.per - o.cad.t), n: dn.clone()};   // lands on the beat
      }
      else if(!o.hold && (err > stride*(o.snap ? .6 : 1) || (reach > .86 && err > stride*.3) || Math.abs(vert) > .05*s) && canStep(P, L, o.sneak ? 3 : 4))
        L.step = {from: L.foot.clone(), to: des.clone(), t: 0, dur: stepDur, n: dn.clone()};
    }
  }
  P.inited = true;
  for(const L of P.legs) if(!L.free){ legIK(L, body.worldToLocal(L.foot.clone())); const a = L.ikA || (L.ikA = []); for(let j = 0; j < L.joints.length; j++) a[j] = L.joints[j].rotation.x; L.ikY = L.yawG.rotation.y; }
}
// true walking surface: leaf blade (fold, droop), log curvature, terrain
// the palps live their own life. Walking: they tap the ground ahead, tasting it. Idle: bouts of waving (sampling the
// air; faster when a scent plume is near), grooming (rubbed against the fangs and face) or stillness. Plucking: they
// drum on the silk in time with the legs. Each palp eases toward its target pose, so changes are never snaps.
function palpTargets(sx, st, t, k){
  const alt = sx > 0 ? 0 : Math.PI;
  switch(st){
    case 'tap':   { const d = Math.max(0, Math.sin(t*9 + alt)); return [1.05 + .38*d, sx*.18, .9 - .3*d]; }
    case 'taste': { const w = .5 + .5*Math.sin(t*(6 + 6*k) + alt); return [.45 + .45*w, sx*(.22 + .12*Math.sin(t*2.3 + alt)), .55 + .45*w]; }
    case 'groom': { const r = t*15 + (sx > 0 ? 0 : 1.6); return [.5 + .14*Math.sin(r), -sx*.5 + .08*Math.cos(r), 1.75 + .3*Math.sin(r + .8)]; }
    case 'air':   return [.6, sx*.35, .5];
    case 'hang':  return [.75, sx*.25, .7];
    case 'grip':  return [.55 + .06*Math.sin(t*5 + alt), -sx*.32, 1.35];   // curled in round the held prey, pressing it to the fangs
    default:      return [1.0, sx*.2, .85];
  }
}
function animatePalps(P, st, t, dt, k = 0, drum = null, lift = 0){   // lift: fold them up (radians) clear of the surface, as in a landing dip
  if(!P.palps) return;
  const e = 1 - Math.exp(-(lift ? 40 : 18)*dt);
  for(const q of P.palps){
    const [x, y, jx] = palpTargets(q.sx, st, t, k);
    let X = x - lift, JX = jx;
    if(drum){ const d = drum(q.sx); X = 1.05 + .7*d; JX = .9 - .55*d; }      // a downward stroke onto the thread
    q.pa.rotation.x += (X - q.pa.rotation.x)*e; q.pa.rotation.y += (y - q.pa.rotation.y)*e; q.j.rotation.x += (JX - q.j.rotation.x)*e;
  }
}
// fangs: f = 0 folded away under the chelicerae, 1 bared (chelicerae swung forward and spread, fangs down and out,
// a bead of venom at each tip). Eased unless snap (the rapid strokes of the venom bite are set frame by frame)
function fangTick(P, f, dt, snap = false){
  if(!P.fangs) return;
  P.fangF = snap ? f : P.fangF + (f - P.fangF)*(1 - Math.exp(-14*dt)); const k = P.fangF;
  for(const q of P.fangs){
    q.piv.rotation.set(-.4*k, 0, q.sx*.2*k);
    q.fg.rotation.set(-.15 + 1.05*k, -q.sx*(1.45 - 1.2*k), 0);
    q.drop.visible = k > .45; q.drop.scale.setScalar(Math.min(1, (k - .45)*2.5));
  }
}
// the prey she is about to leap at burns brighter and flickers in her sight; the venom bite flares it too
// in her sights it glows faintly; a sure hit makes it pulse bright
function hlTick(dt, target, sure = false){
  const e = 1 - Math.exp(-14*dt), on = sure ? .65 + .35*Math.sin(time*7) : .35;
  for(const q of PREY) if(!(sp.feed && sp.feed.p === q)) q.hl = (q.hl || 0) + ((q === target ? on : 0) - (q.hl || 0))*e;
  for(const f of flies) if(!(sp.feed && sp.feed.p === f)) f.hl = (f.hl || 0) + ((f === target ? on : 0) - (f.hl || 0))*e;
}
function scentNear(pos){ let c = 0; for(const v of SU.uChem.value){ if(v.w < .002) continue; c += v.w*Math.exp(-pos.distanceTo(new V3(v.x, v.y, v.z))*.3); } return Math.min(1, c); }
// leg poses through a leap (joint angles femur..tarsus, + bends down; yaw 0 = straight ahead, PI = straight back).
// launch: the hind pair (IV) has just kicked out straight behind, III with it, I-II thrust forward and held high;
// cruise: I-II stay raised ahead, IV trails behind; land: the hind legs swing out sideways first, ready to grab, and
// only at the very end do the raised front legs come down and reach for the surface.
// from/span: where in the flight (0 take-off .. 1 touchdown) each pair turns to its landing pose
const AIR_POSE = [
  {launch: [-1.05, .4, .15, .1, .1],  ly: .4,  cruise: [-1.0, .45, .15, .1, .1],  cy: .4,  land: [-.45, .7, .3, .2, .15],  dy: .55, from: .8,  span: .17},
  {launch: [-.7, .5, .2, .1, .1],     ly: .8,  cruise: [-.65, .55, .2, .1, .1],   cy: .9,  land: [-.25, .75, .3, .2, .15],  dy: 1.15, from: .7, span: .22},
  {launch: [.12, .15, .05, .05, .05], ly: 2.4, cruise: [-.15, .45, .2, .1, .1],   cy: 2.0, land: [-.2, .65, .3, .2, .15],   dy: 1.5, from: .45, span: .35},
  {launch: [.22, .06, .03, .02, .02], ly: 2.95, cruise: [.06, .22, .1, .05, .05], cy: 2.75, land: [-.25, .55, .25, .15, .15], dy: 1.85, from: .4, span: .35}];
const ss01 = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3 - 2*x); };
function poseSpider(m, o){
  const {body, legs, s, h0, abd} = m.userData.parts;
  body.position.y = h0 - (o.crouch || 0)*.035*s + (o.bob || 0);
  for(const L of legs){
    const ph = (o.phase || 0) + ((L.k + (L.side > 0 ? 0 : 1)) % 2)*Math.PI + L.k*.35;
    const lift = Math.max(0, Math.sin(ph))*(o.walk || 0);
    let a = [-.8 - lift*.45, 1.0 + lift*.25, .35, .25, .25], y = L.base + Math.cos(ph)*.2*(o.walk || 0)*L.side;
    if(o.air){                                      // the leap, as slow-motion footage of a Portia shows it (see AIR_POSE)
      const P = AIR_POSE[L.k], lk = o.launch || 0, ld = o.flight != null ? ss01((o.flight - P.from)/P.span) : o.land || 0;
      a = P.cruise.slice(); let yf = P.cy;
      if(lk > 0){ for(let j = 0; j < 5; j++) a[j] += (P.launch[j] - a[j])*lk; yf += (P.ly - yf)*lk; }
      if(ld > 0){ for(let j = 0; j < 5; j++) a[j] += (P.land[j] - a[j])*ld; yf += (P.dy - yf)*ld; }
      y = L.side*Math.min(3.05, yf*(L.base*L.side/LEGDEF[L.k].yaw)); }   // scaled by this rig's own splay (the male's hind legs sit wider)
    if(o.hang){ a = [-1.15, 1.5, .55, .4, .3]; }
    if(L.k === 0 && o.raise){ const r = Math.max(0, Math.min(1.2, o.raise + (o.pump || 0)*L.side));   // pump: one front leg higher than the other
a = [-.8 - r*.95, 1.0 - r*.75, .35 - r*.25, .25 - r*.1, .25]; y = L.base*(1 - r*.4) + r*.28*L.side*Math.sin(o.wave || 0); }
    if(L.k === 1 && o.raise2){ const r = Math.min(1.2, o.raise2);    // gauging a leap: the second legs come up too, a little lower and wider than the first
a = [-.8 - r*.75, 1.0 - r*.6, .35 - r*.2, .25 - r*.08, .25]; y = L.base*(1 - r*.25); }
    if(L.k === 1 && o.gest2){ const r = Math.min(1.2, o.gest2);      // gesturing: the second legs held up to play the air (the taps are in updateSpider)
a = [-.8 - r*.75, 1.0 - r*.6, .35 - r*.2, .25 - r*.08, .25]; y = L.base*(1 - r*.25); }
    if(o.grab && L.k < 2){                       // first and second legs reach forward and close round the prey in her fangs
      const g = o.grab, G = L.k === 0 ? [-1.3, 1.15, 1.05, .8, .6] : [-1.0, 1.25, .8, .55, .4], gy = L.base*(L.k === 0 ? .3 : .62);
      for(let j = 0; j < 5; j++) a[j] += (G[j] - a[j])*g; y += (gy - y)*g; }
    if(o.curl){ const c = o.curl, C = [.35, 2.0, 1.5, 1.1, 1.1];   // death curl: every leg folding tight under the body
      for(let j = 0; j < 5; j++) a[j] += (C[j] - a[j])*c; y += (L.base*.55 - y)*c; }
    if(L.k === 3 && o.crouch){ a[0] -= o.crouch*.25; a[1] += o.crouch*.3; }
    for(let j = 0; j < 5; j++) L.joints[j].rotation.x = a[j];
    L.yawG.rotation.y = y;
  }
  abd.rotation.x = -.12 + (o.twitch || 0) - (o.abdDown || 0)*.3;
}
