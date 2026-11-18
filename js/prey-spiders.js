'use strict';
// prey spider models and their webs

/* =====================================================================
   PREY SPIDERS AND THEIR WEBS — Portia labiata hunts other spiders
   ===================================================================== */
const angDelta = (a, b) => ((b - a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI;
const angDiff = (a, b) => Math.abs(angDelta(a, b));
const silkM = (op = .55, c = 0xf4f0e6) => new THREE.LineBasicMaterial({color:c, transparent:true, opacity:op});
const segsFrom = pts => new THREE.BufferGeometry().setFromPoints(pts);

// generic araneomorph body: carapace with sternum, chelicerae and fangs, two-part palps, abdomen with
// spinnerets, eight legs of three jointed parts with knuckles, spines, colour bands and claws
function makeArach(o){
  const s = o.s, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const std = (c, r = .55) => new THREE.MeshStandardMaterial({color:c, roughness:r});
  const [cw, chh, cl] = o.cara.map(v => v*s), [aw, ah, al] = o.abd.map(v => v*s);
  const paint = (g, fn, sx, sy, sz) => { const q = g.attributes.position, col = []; for(let i = 0; i < q.count; i++){ const c = fn(q.getX(i)/sx, q.getY(i)/sy, q.getZ(i)/sz); col.push(c[0], c[1], c[2]); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); };
  const cg = superEllipsoid(cw, chh, cl, .8, o.dome || 0, .7, o.res || 1);
  const cara = new THREE.Mesh(cg, std(o.caraColor ? 0xffffff : o.col.cara, .45)); cara.position.z = cl*.55; body.add(cara);
  if(o.caraColor){ paint(cg, o.caraColor, cw, chh, cl); cara.material.vertexColors = true; }
  const ag = superEllipsoid(aw, ah, al, o.abdE || .95, .05, .9, o.res || 1);
  if(o.abdShape){ const q = ag.attributes.position; for(let i = 0; i < q.count; i++){ const [x, y, z] = o.abdShape(q.getX(i)/aw, q.getY(i)/ah, q.getZ(i)/al); q.setXYZ(i, x*aw, y*ah, z*al); } ag.computeVertexNormals(); }
  const abd = new THREE.Mesh(ag, std(o.abdColor ? 0xffffff : o.col.abd, .42)); abd.position.set(0, ah*.35, -al*.95); body.add(abd);
  if(o.abdColor){ paint(ag, o.abdColor, aw, ah, al); abd.material.vertexColors = true; }
  const dark = std(o.col.dark || 0x140e0a, .3), und = std(o.col.under || o.col.cara, .6), legM = std(o.col.leg);
  const sternum = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), und); sternum.scale.set(cw*.6, chh*.12, cl*.72); sternum.position.set(0, -chh*.62, cl*.5); body.add(sternum);
  for(const sx of [-1, 1]){
    // chelicerae hang down in front of the carapace, fangs folded inward
    const ch = new THREE.Group(); ch.position.set(sx*cw*.24, -chh*.12, cl*1.4); ch.rotation.set(1.25, 0, sx*.08); body.add(ch);
    const cL = chh*(o.chel || .95);
    ch.add(new THREE.Mesh(new THREE.CylinderGeometry(cw*.19, cw*.24, cL, 7).rotateX(Math.PI/2).translate(0, 0, cL/2), std(o.col.chel || o.col.cara, .35)));
    const fang = new THREE.Mesh(new THREE.ConeGeometry(cw*.07, cL*.5, 5).rotateX(Math.PI/2).translate(0, 0, cL*.25), dark); fang.position.z = cL*.92; fang.rotation.y = -sx*1.1; ch.add(fang);
    // pedipalps: two short leg-like parts held forward
    const pa = new THREE.Group(); pa.position.set(sx*cw*.55, -chh*.3, cl*1.32); pa.rotation.set(.75, sx*.3, 0); body.add(pa);
    const pl = o.legLen[0]*s*.16, pr = o.legTh*s*.8, pm = o.legMat ? o.legMat(0, 0) : legM;
    pa.add(new THREE.Mesh(new THREE.CylinderGeometry(pr*.85, pr, pl, 6).rotateX(Math.PI/2).translate(0, 0, pl/2), pm));
    const pj = new THREE.Group(); pj.position.z = pl; pj.rotation.x = .8; pa.add(pj);
    pj.add(new THREE.Mesh(new THREE.SphereGeometry(pr*1.05, 6, 5), pm), new THREE.Mesh(new THREE.CylinderGeometry(pr*.75, pr*.9, pl*.9, 6).rotateX(Math.PI/2).translate(0, 0, pl*.45), pm));
  }
  // spinnerets at the tail of the abdomen
  for(const [x, y, r] of [[-.22, -.15, .11], [.22, -.15, .11], [-.12, -.32, .08], [.12, -.32, .08]]){
    const sn = new THREE.Mesh(new THREE.ConeGeometry(aw*r, al*.16, 6).rotateX(-Math.PI/2), std(o.col.spin || o.col.abd, .5)); sn.position.set(x*aw, y*ah, -al*.98); abd.add(sn);
  }
  if(o.deco) o.deco(abd, cara, s, std);
  const hairM = new THREE.LineBasicMaterial({color:o.col.hair, transparent:true, opacity:.8});
  const hn = o.hairs || (o.hairy ? [120, 220] : [0, 0]);
  if(hn[0]) cara.add(surfaceHairs(cg, hn[0], .01*s, 1, hairM));
  if(hn[1]) abd.add(surfaceHairs(ag, hn[1], .012*s, 1, hairM));
  const eyeM = new THREE.MeshStandardMaterial({color:0x080606, roughness:.08, metalness:.4}), glintM = new THREE.MeshBasicMaterial({color:0xffffff});
  for(const [x, y, z, er] of o.eyes) for(const sx of [-1, 1]){
    const r = (er || .008)*s, e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), eyeM); e.position.set(sx*x*s, y*s, z*s); body.add(e);
    const g = new THREE.Mesh(new THREE.SphereGeometry(r*.32, 5, 4), glintM); g.position.set(sx*x*s - sx*r*.2, y*s + r*.5, z*s + r*.6); body.add(g);
  }
  const spineM = new THREE.LineBasicMaterial({color:o.col.spine || 0x120c08, transparent:true, opacity:.9}), bandM = o.col.band != null ? std(o.col.band, .5) : null;
  const legs = [], YAW = o.legYaw || [.5, 1.1, 1.95, 2.55];
  for(const side of [-1, 1]) for(let k = 0; k < 4; k++){
    const len = o.legLen[k]*s, th = o.legTh*s;
    const yawG = new THREE.Group(); yawG.position.set(side*o.cara[0]*s*.7, -o.cara[1]*s*.3, (o.cara[2]*.55 + o.cara[2]*(.5 - k*.33))*s); yawG.rotation.y = side*YAW[k]; body.add(yawG);
    yawG.add(new THREE.Mesh(new THREE.SphereGeometry(th*1.25, 7, 5), o.legMat ? o.legMat(k, 0) : legM));          // coxa
    let parent = yawG, prev = 0; const joints = [], segL = [];
    for(let j = 0; j < 3; j++){
      const jg = new THREE.Group(); jg.position.z = prev; parent.add(jg); joints.push(jg);
      const L = len*[.42, .36, .22][j], r0 = th*(1 - j*.25), m = o.legMat ? o.legMat(k, j) : legM;
      jg.add(new THREE.Mesh(new THREE.CylinderGeometry(r0*.78, r0, L, o.legRad || 7).rotateX(Math.PI/2).translate(0, 0, L/2), m));
      if(j > 0) jg.add(new THREE.Mesh(new THREE.SphereGeometry(r0*1.12, 7, 5), m));                                // knuckle
      if(bandM && o.bands) for(const f of o.bands(k, j)){ const rb = r0*(1 - .22*f)*1.06;
        jg.add(new THREE.Mesh(new THREE.CylinderGeometry(rb, rb, L*.1, 7).rotateX(Math.PI/2).translate(0, 0, L*f), bandM)); }
      const sp = [];                                                                                             // stiff spines (macrosetae)
      for(let q = 0; q < (j === 2 ? 2 : o.spines || 4); q++){
        const z = L*rr(.2, .85), a = rr(-.3, Math.PI + .3), b = new V3(Math.cos(a)*r0, Math.sin(a)*r0, z);
        const sl = o.spineLen || 1; sp.push(b, b.clone().add(new V3(Math.cos(a)*th*1.1*sl, Math.sin(a)*th*1.1*sl, th*2.2*sl)));
      }
      jg.add(new THREE.LineSegments(segsFrom(sp), spineM));
      if(o.hairy) jg.add(segHairs(L, r0, 6, th*1.2, hairM));
      parent = jg; prev = L; segL.push(L);
    }
    const tip = new THREE.Object3D(); tip.position.z = prev; parent.add(tip);
    tip.add(new THREE.Mesh(new THREE.ConeGeometry(th*.4, th*1.6, 5).rotateX(Math.PI/2).translate(0, 0, -th*.8), dark));    // claws
    legs.push({side, k, yawG, joints, tip, segL, base: side*YAW[k]});
  }
  root.userData.parts = {body, legs, s, h0: 0, abd, cara};
  root.traverse(q => { if(q.isMesh) q.castShadow = true; });
  poseArach(root, {}); root.updateMatrixWorld(true);
  let minY = 1e9; const w = new V3(); for(const L of legs){ L.tip.getWorldPosition(w); minY = Math.min(minY, w.y); }
  root.userData.parts.h0 = -minY + .002;
  poseArach(root, {}); root.updateMatrixWorld(true);
  setRestStance(body, legs);
  scene.add(root); return root;
}
const blob = (parent, m, x, y, z, sx, sy, sz, rx = 0, ry = 0) => { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.rotation.set(rx, ry, 0); parent.add(b); return b; };
const onEll = (a, b, c, x, z) => b*Math.sqrt(Math.max(0, 1 - (x/a)**2 - (z/c)**2));   // height of an ellipsoid's top at (x, z)
function poseArach(m, o){
  const {body, legs, h0} = m.userData.parts;
  body.position.y = h0 + (o.bob || 0);
  for(const L of legs){
    const ph = (o.phase || 0) + ((L.k + (L.side > 0 ? 0 : 1)) % 2)*Math.PI;
    const lift = Math.max(0, Math.sin(ph))*(o.walk || 0);
    let a = [-.75 - lift*.4, 1.35, .55], y = L.base + Math.cos(ph)*.18*(o.walk || 0)*L.side;
    if(o.cross){ a = [-.25, .45, .25]; y = L.side*(L.k < 2 ? .3 + L.k*.16 : 2.6 + (L.k - 2)*.16); }   // St Andrew's cross: legs held in pairs
    if(o.tuck){ a = [-.35, .95, .5]; y = L.side*(L.k < 2 ? .22 + L.k*.22 : 2.65 + (L.k - 2)*.22); }  // drawn in, inside the retreat
    if(o.curl){ a = [.35, 2.0, 1.5]; y = L.base*.55; }                                                    // death curl: every leg folded tight under the body
    if(o.limp != null && !o.curl){ const c = o.limp; a = a.map((v, i) => v + ([.35, 2.0, 1.5][i] - v)*c); y += (L.base*.55 - y)*c; }   // dying in her fangs: legs drawing in as it is drained
    if(o.pump) a[0] -= Math.sin(o.pump)*.3;
    for(let j = 0; j < 3; j++) L.joints[j].rotation.x = a[j];
    if(o.curl) for(let j = 3; j < L.joints.length; j++) L.joints[j].rotation.x = 1.1;
    else for(let j = 3; j < L.joints.length; j++) if(L.joints[j].userData.r0 != null){ const r0 = L.joints[j].userData.r0; L.joints[j].rotation.x = r0 + (1.1 - r0)*(o.limp || 0); }
    L.yawG.rotation.y = y;
  }
}
// Scytodes pallida: pale straw body, the high domed carapace marked with a dark lyre pattern, six eyes in
// three pairs, long thin legs ringed with dark bands
function makeScytodes(){
  const m = makeArach({s:1, cara:[.068, .07, .08], dome:.6, abd:[.05, .045, .065], legLen:[.4, .34, .3, .37], legTh:.0065, hairs:[50, 70], spines:2,
    col:{cara:0xd6bf88, abd:0xc9ae78, leg:0xc4ab7c, hair:0xe8dcc0, band:0x3a2816, chel:0xb89a62, under:0xb8a070}, eyes:[[.012, .04, .12, .009], [.026, .036, .112, .008], [.02, .046, .105, .008]],
    bands:(k, j) => j === 0 ? [.3, .7] : j === 1 ? [.15, .5, .85] : [.45],
    deco:(abd, cara, s, std) => { const dm = std(0x3a2a18, .5);
      for(const sx of [-1, 1]) for(let i = 0; i < 6; i++){                                // the lyre: two bowed dark streaks
        const z = .055 - i*.022, x = sx*(.012 + .02*Math.sin(i/5*Math.PI)*1.1);
        blob(cara, dm, x*s, (onEll(.068, .07, .08, x, z) - .002)*s, z*s, .006*s, .0025*s, .012*s, 0, sx*(.5 - i*.18)); }
      for(let i = 0; i < 4; i++) blob(cara, dm, 0, (onEll(.068, .07, .08, 0, .05 - i*.03) - .002)*s, (.05 - i*.03)*s, .004*s, .0025*s, .01*s);
      for(const [x, z, r] of [[0, .035, .01], [-.025, .015, .008], [.025, .015, .008], [-.03, -.015, .008], [.03, -.015, .008], [-.015, -.04, .007], [.015, -.04, .007], [0, -.055, .006]])
        blob(abd, dm, x*s, (onEll(.05, .045, .065, x, z) - .001)*s, z*s, r*s, .003*s, r*1.2*s); }});
  const egg = new THREE.Mesh(new THREE.SphereGeometry(.034, 12, 9), new THREE.MeshStandardMaterial({color:0xf2eee0, roughness:.9, emissive:0x202018}));
  egg.position.set(0, .015, .145); m.userData.parts.body.add(egg); m.userData.egg = egg;
  egg.add(new THREE.LineSegments(segsFrom(Array.from({length: 40}, (_, i) => { const a = i*2.4, b = i*1.3; return new V3(Math.cos(a)*Math.sin(b), Math.cos(b), Math.sin(a)*Math.sin(b)).multiplyScalar(.035); })), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:.6})));
  return m;
}
// Badumna longinqua: velvety grey, dark carapace with pale radiating striae, a dark heart-mark and chevrons
// down the abdomen, dark legs with pale rings
function makeBadumna(){
  return makeArach({s:1.15, cara:[.058, .045, .075], abd:[.07, .058, .095], legLen:[.32, .28, .26, .31], legTh:.011, hairy:true, hairs:[160, 320],
    col:{cara:0x342c26, abd:0x4e4640, leg:0x2e2824, hair:0xa8a098, band:0x7a7068, chel:0x241c16, under:0x2a221c}, eyes:[[.012, .03, .108], [.028, .028, .1], [.014, .04, .095], [.03, .038, .09]],
    bands:(k, j) => j === 0 ? [.55] : j === 1 ? [.2, .7] : [.4],
    deco:(abd, cara, s, std) => { const pale = std(0x8a8078, .7), dk = std(0x1e1814, .6);
      for(const sx of [-1, 1]) for(let i = 0; i < 4; i++){ const a = -.6 + i*.45, x = sx*Math.cos(a)*.034, z = .005 + Math.sin(a)*.04;   // pale striae from the fovea
        blob(cara, pale, x*s, (onEll(.058, .045, .075, x, z) - .001)*s, z*s, .003*s, .002*s, .016*s, 0, sx*(Math.PI/2 - a)); }
      blob(abd, dk, 0, (onEll(.07, .058, .095, 0, .045) - .001)*s, .045*s, .012*s, .003*s, .03*s);                        // heart mark
      for(let k = 0; k < 4; k++){ const z = -.005 - k*.024, w = .042*(1 - k*.18);                                         // chevrons
        for(const sx of [-1, 1]){ const x = sx*w*.45;
          blob(abd, dk, x*s, (onEll(.07, .058, .095, x, z) - .001)*s, z*s, w*.5*s, .003*s, .006*s, 0, -sx*.55);
          blob(abd, pale, x*s, (onEll(.07, .058, .095, x, z - .009) - .001)*s, (z - .009)*s, w*.42*s, .0028*s, .004*s, 0, -sx*.55); } } }});
}
// Argiope: silver-haired carapace, a broad keystone abdomen with scalloped edges and bands of yellow,
// white and black, legs black with yellow rings
// Argiope: a keystone-shaped abdomen painted with wavy silver, yellow and black bands (black bands studded with pale
// dots), a black underside with two yellow stripes, scalloped lobed edges; a silver-haired carapace with a dark eye
// region; black legs ringed yellow at the joints, with long black spines and fine hair
function makeArgiope(){
  const yel = new THREE.MeshStandardMaterial({color:0xe8b818, roughness:.45}), blk = new THREE.MeshStandardMaterial({color:0x100c08, roughness:.4});
  const nz = (x, y, z) => Math.sin(x*37.1 + y*11.3 + z*23.7)*Math.sin(x*13.7 - z*41.3 + y*7.1);
  const YEL = [.95, .72, .06], BLK = [.035, .03, .02], WHT = [.93, .92, .86], SIL = [.82, .82, .76];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t];
  return makeArach({s:1.7, res:2.6, cara:[.045, .025, .055], abd:[.07, .034, .112], abdE:.8, legLen:[.46, .43, .28, .4], legTh:.0085, spines:9, spineLen:1.9, legRad:10, hairy:true, hairs:[0, 0],
    col:{cara:0xd8d8cc, abd:0xe8d24a, leg:0x14100c, hair:0x2a2420, band:0xe8b818, chel:0x6a5a40, under:0x1a1612, spin:0x1a1612, spine:0x050403}, eyes:[[.01, .02, .09], [.022, .018, .085], [.012, .026, .08], [.024, .024, .075]],
    legMat:(k, j) => blk, bands:(k, j) => j === 0 ? [.08, .55, .93] : j === 1 ? [.25, .9] : [.1, .85],
    // keystone: broad at the shoulders, tapering to the rear, the edge scalloped into lobes
    abdShape:(x, y, z) => { const t = (1 - z)/2, w = 1.05 - .25*Math.max(0, t - .3) + .07*Math.max(0, Math.cos(t*Math.PI*7))*(t > .2 ? 1 : 0);
      return [x*w, y*(1 - .2*t), z]; },
    abdColor:(x, y, z) => {
      if(y < -.25){ const st = Math.abs(Math.abs(x) - .32) < .09 ? 1 : 0; return st ? YEL : BLK; }      // underside: black with two yellow stripes
      const t = (1 - z)/2 + .025*Math.sin(x*16 + y*4) + .012*nz(x, y, z);                              // banding runs nose to tail, wavy
      let c;
      if(t < .1) c = mix(WHT, SIL, .4); else if(t < .19) c = YEL; else if(t < .24) c = BLK; else if(t < .36) c = YEL; else if(t < .44) c = BLK;
      else if(t < .51) c = WHT; else if(t < .6) c = BLK; else if(t < .74) c = YEL; else if(t < .81) c = BLK; else if(t < .88) c = YEL; else c = BLK;
      if(c === BLK && (Math.sin(x*28)*Math.sin(t*90)) > .75) c = mix(BLK, WHT, .8);                     // pale dots along the black bands
      if(Math.abs(x) > .82) c = mix(c, BLK, .55);                                                         // the dark flanks
      return mix(c, [c[0]*.8, c[1]*.8, c[2]*.8], .5 + .5*nz(x*2, y, z*2)); },
    caraColor:(x, y, z) => { const eye = z > .55 ? .7 : 0, mid = Math.abs(x) < .18 ? .25 : 0; return mix(SIL, [.15, .14, .12], Math.min(1, eye + mid + Math.max(0, -y)*.6)); },
    deco:(abd, cara, s) => {
      cara.add(surfaceHairs(cara.geometry, 900, .007*s, .5, new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:.85})));   // dense silver pile
      abd.add(surfaceHairs(abd.geometry, 260, .004*s, 1, new THREE.LineBasicMaterial({color:0xf8f0d0, transparent:true, opacity:.5})));      // sparse fine down
      for(const sx of [-1, 1]) for(let i = 0; i < 4; i++) blob(abd, blk, sx*.022*s, .033*s, (.055 - i*.035)*s, .0035*s, .0015*s, .0035*s); } });   // sigilla
}

// --- Argiope's orb: irregular doubled frame, ~36 radii, a dense hub and open free zone, a sticky spiral that
// widens outward with switchbacks filling the lower half, the zig-zag stabilimentum, Y-forked anchor lines, a wrapped prey parcel
const SILK_T = 99/255;                                  // web threads carry this exact temperature: a tag filters can read
const tagSilk = g => g.traverse(o => { if(o.isLine) o.userData.temp = SILK_T; });
// built as a function so a second web (in a tree's fork, hung from bark rather than leaves) can be made from it.
// frame0: the frame polygon, [x, y] around C in the web's plane; none: an irregular ring. RR/RN: its random source
function buildOrbWeb(O, G, frame0 = null, RR = rr, RN = rnd){

  const {C, u, R} = O, v = new V3(0, 1, 0), rr = RR, rnd = RN;
  const P2 = (x, y) => C.clone().addScaledVector(u, x).addScaledVector(v, y), P = (r, a) => P2(Math.cos(a)*r, Math.sin(a)*r);
  const F2 = frame0 || [], NF0 = 9;
  if(!frame0) for(let k = 0; k < NF0; k++){ const a = k/NF0*6.283 + rr(-.14, .14), rf = R*rr(1.02, 1.12)*(Math.sin(a) < -.3 ? 1.08 : 1); F2.push([Math.cos(a)*rf, Math.sin(a)*rf]); }
  const NF = F2.length;
  const rayHit = a => { const dx = Math.cos(a), dy = Math.sin(a); let best = R;
    for(let k = 0; k < NF; k++){ const [x1, y1] = F2[k], [x2, y2] = F2[(k + 1) % NF], ex = x2 - x1, ey = y2 - y1, den = ex*dy - dx*ey;
      if(Math.abs(den) < 1e-9) continue; const t = (ex*y1 - x1*ey)/den, q = (dx*y1 - dy*x1)/den; if(t > 0 && q >= 0 && q <= 1) best = t; }
    return best; };
  O.edge = rayHit;
  const frame = [], radii = [], hub = [], sticky = [], stab = [], anchor = [];
  for(let k = 0; k < NF; k++){ const [x1, y1] = F2[k], [x2, y2] = F2[(k + 1) % NF];
    frame.push(P2(x1, y1), P2(x2, y2), P2(x1*1.012, y1*1.012), P2(x2*1.012, y2*1.012)); }
  const NR = 36, RA = Array.from({length: NR}, (_, k) => k/NR*6.283 + rr(-.035, .035)), RE = RA.map(rayHit);
  for(let k = 0; k < NR; k++) radii.push(P(.02, RA[k]), P(RE[k], RA[k]));
  for(let ring = 0; ring < 10; ring++){ const r0 = .03 + ring*.012;
    for(let k = 0; k < NR; k++){ if(rnd() < .18) continue; hub.push(P(r0 + rr(-.004, .004), RA[k]), P(r0 + .007 + rr(-.004, .004), RA[(k + 1) % NR])); } }
  const r0 = .24, turns = 44, N = turns*NR;
  for(let i = 0; i < N; i++){
    if(rnd() < .015) continue;                                                       // the odd broken thread
    const k = i % NR, k2 = (k + 1) % NR, f1 = i/N, f2 = (i + 1)/N;
    sticky.push(P(r0 + (RE[k]*.92 - r0)*f1 + rr(-.003, .003), RA[k]), P(r0 + (RE[k2]*.92 - r0)*f2 + rr(-.003, .003), RA[k2]));
  }
  const low = []; for(let k = 0; k < NR; k++) if(Math.sin(RA[k]) < -.3) low.push(k);
  for(let b = 0; b < 4; b++) for(let i = 0; i + 1 < low.length; i++){ const k = low[i], k2 = low[i + 1], g = .935 + b*.012;
    sticky.push(P(RE[k]*g, RA[k]), P(RE[k2]*g, RA[k2])); }
  for(const [a0, len] of [[Math.PI/4, 1.1], [3*Math.PI/4, .92], [5*Math.PI/4, 1.25], [7*Math.PI/4, 1.05]]){
    const d = u.clone().multiplyScalar(Math.cos(a0)).addScaledVector(v, Math.sin(a0)), pp = u.clone().multiplyScalar(-Math.sin(a0)).addScaledVector(v, Math.cos(a0));
    const n = Math.round(len/.018);
    for(const off of [-.004, .004]){ let last = null;
      for(let k = 0; k <= n; k++){ if(.1 + k*.018 > rayHit(a0)*.8) break;   // a corner web's arms stop short of its frame
        const q = C.clone().addScaledVector(d, .1 + k*.018).addScaledVector(pp, (k % 2 ? 1 : -1)*(.014 + k*.0009) + off); if(last) stab.push(last, q); last = q; } }
  }
  if(O.above){                                             // slung from leaves and the ground: Y-forked anchor lines
  const pick = f => F2.reduce((b, q) => f(q) > f(b) ? q : b), top = P2(...pick(q => q[1])), bot = P2(...pick(q => -q[1])), sideF = P2(...pick(q => q[0])), back = P2(...pick(q => -q[0]));
  const fork = (a, b, spread) => { const m = a.clone().lerp(b, .55); anchor.push(a, m, m, b.clone().add(spread), m, b.clone().sub(spread)); };
  fork(top, new V3(O.above.x - .2, O.above.y - .02, O.above.z), new V3(0, 0, .12));
  fork(sideF, new V3(C.x, O.side.y - .01, O.side.z - .35), new V3(.08, 0, 0));
  fork(bot, new V3(bot.x, hAt(bot.x, bot.z - .25), bot.z - .25), new V3(.15, 0, 0));
  fork(back, new V3(back.x, hAt(back.x, back.z - .7), back.z - .7), new V3(.12, 0, 0));
  for(let k = 0; k < NF; k++){ const q = P2(...F2[k]); if(q.y < C.y - .3 && rnd() < .6){ const g = q.clone().add(new V3(rr(-.3, .3), 0, rr(-.4, .4))); g.y = hAt(g.x, g.z); anchor.push(q, g); } }
  }
  G.add(new THREE.LineSegments(segsFrom(frame), silkM(.62)), new THREE.LineSegments(segsFrom(radii), silkM(.5)), new THREE.LineSegments(segsFrom(hub), silkM(.55)),
    new THREE.LineSegments(segsFrom(sticky), silkM(.42, 0xe8f0ff)), new THREE.LineSegments(segsFrom(stab), silkM(.95, 0xffffff)), new THREE.LineSegments(segsFrom(anchor), silkM(.5)));
  if(!O.above) return;
  // a prey parcel wrapped in swathing silk, hung on the spiral
  const at = P(R*.62, -2.1), parcel = hot(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({color:0xece8dc, roughness:.9})), TEMP.dead);
  parcel.scale.set(.028, .045, .028); parcel.position.copy(at); G.add(parcel);
  const wrap = []; for(let i = 0; i < 60; i++){ const a = i*.9, y = (i/60 - .5)*.085; wrap.push(at.clone().add(new V3(Math.cos(a)*.03, y, Math.sin(a)*.03)), at.clone().add(new V3(Math.cos(a + .9)*.03, y + .0015, Math.sin(a + .9)*.03))); }
  G.add(hot(new THREE.LineSegments(segsFrom(wrap), silkM(.8, 0xffffff)), TEMP.dead));
}
const ARG_WEB = hot(new THREE.Group(), .3); scene.add(ARG_WEB);
ARG.g = ARG_WEB; buildOrbWeb(ARG, ARG_WEB);

// --- Badumna's sheet: an irregular lacy sheet spreading from the funnel retreat in the log. Signal threads fan out
// from the mouth; between them, woolly cribellate bands loop across (densest near the retreat, torn here and there);
// crossing structural threads, caught debris, a wispy sheet of fine silk; scaffolding up to the bark; a funnel retreat
const BAD_WEB = hot(new THREE.Group(), .3); scene.add(BAD_WEB);
{
  const p = BAD.plat, c = Math.cos(p.rot), s = Math.sin(p.rot), LGC = PLAT.find(q => q.kind === 'log').climb;
  const edgeR = a => 1 + .14*Math.sin(a*3 + 1.3) + .08*Math.sin(a*7 + .4) + .05*Math.sin(a*13 + 2);
  const E = (lx, lz) => Math.hypot(lx/p.rx, lz/p.rz)/edgeR(Math.atan2(lz/p.rz, lx/p.rx));
  const W = (lx, lz, dy = 0) => { const e = Math.min(1, E(lx, lz)); return new V3(p.x + lx*c + lz*s, p.y - .015*(1 - e*e) + dy, p.z - lx*s + lz*c); };
  const md = BAD.mouth.clone().sub(new V3(p.x, 0, p.z)), ml = [md.x*c - md.z*s, md.x*s + md.z*c];
  const edgeAt = a => { let lo = 0, hi = 3; for(let k = 0; k < 18; k++){ const m = (lo + hi)/2; (E(ml[0] + Math.cos(a)*m*p.rx, ml[1] + Math.sin(a)*m*p.rz) < 1 ? lo = m : hi = m); } return lo; };
  const sig = [], wool = [], cross = [], scaf = [];
  // signal threads: from the mouth across the sheet, gently curving
  const NS = 56, spokes = [];
  for(let k = 0; k < NS; k++){
    const a0 = Math.atan2(-ml[1], -ml[0]) + (k/(NS - 1) - .5)*2.9 + rr(-.03, .03), L = edgeAt(a0)*rr(.92, 1), pts = [];
    for(let i = 0; i <= 12; i++){ const f = i/12, a = a0 + Math.sin(f*3 + k)*.05*f; pts.push([ml[0] + Math.cos(a)*L*f*p.rx, ml[1] + Math.sin(a)*L*f*p.rz]); }
    spokes.push(pts); for(let i = 0; i < 12; i++) sig.push(W(...pts[i], .002), W(...pts[i + 1], .002));
  }
  // woolly cribellate bands looping between neighbouring spokes: two or three fuzzy strands each, densest near the mouth
  for(let k = 0; k + 1 < NS; k++){
    for(let f = .06; f < 1; f += .028*(1 + f*1.6) + rr(0, .01)){
      if(rnd() < .07) continue;                                                     // a torn gap
      const i = Math.min(11, Math.floor(f*12)), A = spokes[k][i], B = spokes[k + 1][Math.min(12, i + (rnd() < .3 ? 1 : 0))];
      const mid = [(A[0] + B[0])/2*(1 + rr(-.02, .04)), (A[1] + B[1])/2*(1 + rr(-.02, .04))];
      for(let st = 0; st < (f < .5 ? 3 : 2); st++){
        const off = (st - 1)*.004; let prev = null;
        for(let q = 0; q <= 8; q++){ const t = q/8, u = 1 - t;
          const x = u*u*A[0] + 2*u*t*mid[0] + t*t*B[0] + (rnd() - .5)*.008, z = u*u*A[1] + 2*u*t*mid[1] + t*t*B[1] + (rnd() - .5)*.008;
          const pt = W(x, z, .003 + off + (rnd() - .5)*.004); if(prev) wool.push(prev, pt); prev = pt; }
      }
    }
  }
  // crossing structural threads, slightly curved
  for(let k = 0; k < 220; k++){
    let a, b; do { a = [rr(-1, 1)*p.rx, rr(-1, 1)*p.rz]; } while(E(...a) > .95); do { b = [a[0] + rr(-.5, .5), a[1] + rr(-.5, .5)]; } while(E(...b) > .98);
    const m2 = [(a[0] + b[0])/2 + rr(-.05, .05), (a[1] + b[1])/2 + rr(-.05, .05)]; cross.push(W(...a, .001), W(...m2, -.003), W(...m2, -.003), W(...b, .001));
  }
  // scaffolding: knots above the sheet tied up to the bark; the rim tied down to the soil and plants
  for(let k = 0; k < 60; k++){ let a; do { a = [rr(-1, 1)*p.rx, rr(-1, 1)*p.rz]; } while(E(...a) > .85);
    const knot = W(a[0]*.75, a[1]*.75, rr(.15, .5)), bark = LGC.project(BAD.mouth.clone().addScaledVector(BAD.ax, rr(-1.4, 1.4)).add(new V3(0, rr(.05, .55), 0)));
    scaf.push(W(...a), knot, knot, bark); if(rnd() < .5){ let b2; do { b2 = [rr(-1, 1)*p.rx, rr(-1, 1)*p.rz]; } while(E(...b2) > 1); scaf.push(knot, W(...b2)); } }
  for(let k = 0; k < 22; k++){ const a = k/22*6.28, L = edgeAt(a), e = W(ml[0] + Math.cos(a)*L*p.rx*.98, ml[1] + Math.sin(a)*L*p.rz*.98);
    const g = new V3(e.x + rr(-.35, .35), 0, e.z + rr(-.35, .35)); g.y = hAt(g.x, g.z); scaf.push(e, g); }
  BAD_WEB.add(new THREE.LineSegments(segsFrom(cross), silkM(.32, 0xd8d6e4)), new THREE.LineSegments(segsFrom(wool), silkM(.5, 0xe8eaf8)),
    new THREE.LineSegments(segsFrom(sig), silkM(.7, 0xf6f6ff)), new THREE.LineSegments(segsFrom(scaf), silkM(.42, 0xdcd8e8)));
  // the fine sheet: an irregular outline with a lacy, wispy alpha (silk thickest near the retreat)
  const lace = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const cx = w*(.5 + ml[0]/(2*p.rx*1.2)), cy = h*(.5 + ml[1]/(2*p.rz*1.2));
    for(let i = 0; i < 1400; i++){ const a = trnd()*6.28, r0 = trnd()*w*.6, r1 = r0 + 6 + trnd()*30, v = 90 + trnd()*120;
      x.strokeStyle = `rgba(${v},${v},${v},${.25 + .5*Math.max(0, 1 - r0/(w*.6))})`; x.lineWidth = .5 + trnd(); x.beginPath();
      x.moveTo(cx + Math.cos(a)*r0, cy + Math.sin(a)*r0); x.quadraticCurveTo(cx + Math.cos(a + .2)*(r0 + r1)/2, cy + Math.sin(a + .2)*(r0 + r1)/2, cx + Math.cos(a + trnd()*.3)*r1, cy + Math.sin(a + trnd()*.3)*r1); x.stroke(); }
  });
  lace.colorSpace = THREE.NoColorSpace; lace.wrapS = lace.wrapT = THREE.ClampToEdgeWrapping;
  const sh = new THREE.Shape(); for(let k = 0; k <= 64; k++){ const a = k/64*6.283, r = edgeR(a); const X = Math.cos(a)*r*p.rx, Z = Math.sin(a)*r*p.rz; k ? sh.lineTo(X, Z) : sh.moveTo(X, Z); }
  const sg = new THREE.ShapeGeometry(sh, 6), sq = sg.attributes.position, suv = sg.attributes.uv;
  for(let k = 0; k < sq.count; k++){ const lx = sq.getX(k), lz = sq.getY(k), w3 = W(lx, lz, -.004); sq.setXYZ(k, w3.x, w3.y, w3.z); suv.setXY(k, .5 + lx/(2*p.rx*1.2), .5 + lz/(2*p.rz*1.2)); }
  sg.computeVertexNormals();
  const sheet = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({color:0xe2e2ee, alphaMap: lace, transparent:true, opacity:.75, side:THREE.DoubleSide, depthWrite:false, roughness:.6}));
  BAD_WEB.add(sheet);
  // what the sheet has caught: husks and bits of leaf
  const husk = new THREE.MeshStandardMaterial({color:0x2a1e14, roughness:.4}), bit = new THREE.MeshStandardMaterial({color:0x6a5030, side:THREE.DoubleSide});
  for(let k = 0; k < 9; k++){ let a; do { a = [rr(-1, 1)*p.rx, rr(-1, 1)*p.rz]; } while(E(...a) > .8);
    const m = new THREE.Mesh(k % 3 ? new THREE.SphereGeometry(.018, 6, 5) : new THREE.CircleGeometry(.03, 6).rotateX(-Math.PI/2), k % 3 ? husk : bit);
    m.position.copy(W(...a, .008)); m.scale.set(1, .6, 1.5); m.rotation.y = rnd()*6; BAD_WEB.add(m); }
  // retreat: a funnel flared at the mouth, wide enough for the spider, running into a crack in the log
  const prof = [[.26, -.1], [.22, -.05], [.18, .02], [.155, .12], [.14, .3], [.13, .6]].map(([r, y]) => new THREE.Vector2(r, y));
  const tubeM = new THREE.MeshStandardMaterial({color:0xe6e2ee, transparent:true, opacity:.5, side:THREE.DoubleSide, depthWrite:false});
  const tube = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), tubeM);
  tube.position.copy(BAD.mouth); tube.quaternion.setFromUnitVectors(new V3(0, 1, 0), BAD.sd); BAD_WEB.add(tube);
  const tl = [], e1 = BAD.ax, e2 = new V3().crossVectors(BAD.sd, e1).normalize();
  const tp = (r, y, a) => BAD.mouth.clone().addScaledVector(BAD.sd, y).addScaledVector(e1, Math.cos(a)*r).addScaledVector(e2, Math.sin(a)*r);
  for(let k = 0; k < 18; k++){ const a = k/18*6.283 + rr(-.1, .1); for(let i = 0; i + 1 < prof.length; i++) tl.push(tp(prof[i].x, prof[i].y, a), tp(prof[i + 1].x, prof[i + 1].y, a + rr(-.06, .06))); }
  for(let i = 0; i < prof.length; i++) for(let k = 0; k < 24; k++) tl.push(tp(prof[i].x, prof[i].y, k/24*6.283), tp(prof[i].x, prof[i].y, (k + 1)/24*6.283));
  for(let k = 0; k < 40; k++){ const a = rnd()*6.283, rim = tp(.26, -.1, a);                // the lacy collar spread onto the bark
    tl.push(rim, LGC.project(rim.clone().addScaledVector(e1, Math.cos(a)*rr(.15, .45)).addScaledVector(e2, Math.sin(a)*rr(.15, .45)))); }
  BAD_WEB.add(new THREE.LineSegments(segsFrom(tl), silkM(.6, 0xf2f0fa)));
}
tagSilk(ARG_WEB); tagSilk(BAD_WEB);
// --- Scytodes: a sparse, irregular tangle over its leaf: knots in the air, guy lines down to the blade, threads laid on it
function scytodesWeb(p){
  const c = Math.cos(p.rot), s = Math.sin(p.rot), g = [];
  const W = (lx, lz, dy) => { const x = p.x + lx*c + lz*s, z = p.z - lx*s + lz*c; return new V3(x, surfAt(p, x, z) + dy, z); };
  const knots = Array.from({length: 16}, () => W(rr(-1, 1)*p.rx*.7, rr(-1, 1)*p.rz*.7, rr(.08, .34)));
  for(const k of knots) for(let i = 0; i < 3; i++) g.push(k, W(rr(-1, 1)*p.rx*.95, rr(-1, 1)*p.rz*.95, .004));
  for(let i = 0; i < 34; i++){ const a = knots[Math.floor(rnd()*knots.length)], b = knots[Math.floor(rnd()*knots.length)]; if(a !== b) g.push(a, b); }
  for(let i = 0; i < 26; i++) g.push(W(rr(-1, 1)*p.rx*.8, rr(-1, 1)*p.rz*.8, .004), W(rr(-1, 1)*p.rx*.8, rr(-1, 1)*p.rz*.8, .004));
  scene.add(hot(new THREE.LineSegments(segsFrom(g), silkM(.38)), SILK_T));
}
