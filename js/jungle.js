'use strict';
// decorative understory, atmosphere, updateJungle

/* =====================================================================
   JUNGLE DRESSING — dense understory, moss, flowers, roots, mossy branches, dew; light shafts, pollen, gnats, drips.
   Decoration only (nothing here is walkable except the extra leaves added through addLeaf).
   ===================================================================== */
const leafMat = (color, {amp = .035, ...o} = {}) => sway(glowLeaf(new THREE.MeshStandardMaterial(Object.assign({color, map: LEAF_TEX, bumpMap: LEAF_TEX, bumpScale: .8, roughness:.55, side:THREE.DoubleSide}, o))), amp);
const nearPlat = (x, z, m) => PLAT.some(p => !p.ground && p.kind !== 'flower' && Math.hypot(x - p.x, z - p.z) < Math.max(p.rx, p.rz) + m);
// a few more broad leaves, bridging gaps between the walkable ones: natural platforms and pathways
for(const [x, ht, z, type, w, l, rot] of [[1.5, 1.05, -.9, 'heart', .9, 1.3, 1.9], [-1.5, 1.4, .9, 'lance', .7, 1.3, -1.1], [4.4, 2.0, -.2, 'round', .8, .9, .7],
    [-.4, .7, 2.0, 'heart', .8, 1.1, 2.6], [2.6, 2.3, -2.8, 'lance', .65, 1.2, .4], [-2.4, 1.9, -1.4, 'heart', .85, 1.2, -2.2], [6.9, 2.6, -1.2, 'round', .7, .8, 1.2], [-4.2, 2.4, 1.0, 'lance', .7, 1.2, .9]])
  addLeaf(x, ht, z, type, w, l, rot);

// ---- moss: cushions on soil, stones, roots and the log, each furred with thousands of tiny upright strands
const MOSS_SPOTS = [];
{
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), k = 1 + (hash2(p.getX(i)*4.1, p.getZ(i)*3.7 + y) - .5)*.35; p.setXYZ(i, p.getX(i)*k, Math.max(-.15, y)*.42*k, p.getZ(i)*k); }
  g.computeVertexNormals();
  const N = 1500, im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: MOSS_TEX, bumpMap: MOSS_TEX, bumpScale: 3, roughness:1}), N), TEMP.moss), c = new THREE.Color();
  const add = (pos, s) => { if(MOSS_SPOTS.length >= N) return; const i = MOSS_SPOTS.length; M4.compose(pos, Q.setFromEuler(E.set(0, rnd()*6.3, 0)), new V3(s*rr(.8, 1.3), s*rr(.7, 1.1), s*rr(.8, 1.3))); im.setMatrixAt(i, M4);
    c.setHSL(rr(.22, .28), rr(.5, .75), rr(.2, .34)); im.setColorAt(i, c); MOSS_SPOTS.push([pos.clone(), s]); };
  for(let k = 0; k < 230; k++){ const [cx, cz] = scatter(21*AK, 1); for(let j = 0; j < 5; j++){ const x = cx + rr(-1.4, 1.4), z = cz + rr(-1.4, 1.4); add(new V3(x, hAt(x, z) - .02, z), rr(.25, .95)); } }   // cushions 1.5–6 cm
  for(const r of ROCKS) for(let j = 0; j < 14; j++){ const a = rnd()*6.28, rad = r.r*rr(0, .8); add(new V3(r.x + Math.cos(a)*rad, hAt(r.x, r.z) + r.h - .01, r.z + Math.sin(a)*rad), rr(.08, .2)); }
  { const ax = new V3(Math.sin(LOG.ang), 0, Math.cos(LOG.ang)), sd = new V3(Math.cos(LOG.ang), 0, -Math.sin(LOG.ang)), cy = hAt(LOG.x, LOG.z) + LOG.r*LOG.sink;
    for(let j = 0; j < 70; j++){ const al = rr(-LOG.len*.45, LOG.len*.45), a = rr(-1.4, 1.4);
      add(new V3(LOG.x, cy, LOG.z).addScaledVector(ax, al).addScaledVector(sd, Math.sin(a)*LOG.r).add(new V3(0, Math.cos(a)*LOG.r - .01, 0)), rr(.06, .16)); } }
  im.count = MOSS_SPOTS.length; im.receiveShadow = true; scene.add(im);
  // the strands
  // each strand a little leafy shoot: a stem with three pairs of tiny leaves splayed round it, dark at the base, pale
  // and fresh at the tip (vertex colours, multiplied by the strand's own green)
  const sg = (() => { const parts = [new THREE.ConeGeometry(.0055, .065, 3).translate(0, .0325, 0)];
    for(let q = 0; q < 6; q++){ const y = .012 + q*.009, a = q*2.4, L = .016 - q*.0015;
      parts.push(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, y, 0, Math.cos(a + .35)*L*.35, y + L*.5, Math.sin(a + .35)*L*.35, Math.cos(a)*L, y + L*.8, Math.sin(a)*L], 3))); }
    const m = mergeGeos(parts.map(g => { g.computeVertexNormals(); if(!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count*2).fill(0), 2)); return g; }));
    const P = m.attributes.position, col = []; for(let i = 0; i < P.count; i++){ const t = Math.min(1, P.getY(i)/.065); col.push(.35 + .9*t, .42 + .85*t, .3 + .55*t); }
    m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return m; })(), SN = 42000;
  const st = hot(new THREE.InstancedMesh(sg, sway(new THREE.MeshStandardMaterial({roughness:.9, vertexColors:true, side:THREE.DoubleSide}), .4, 2.2), SN), TEMP.moss); let k = 0;
  const up = new V3(0, 1, 0), dir = new V3();
  while(k < SN){
    const [pos, s] = MOSS_SPOTS[Math.floor(rnd()*MOSS_SPOTS.length)], a = rnd()*6.28, h = Math.acos(rr(.15, 1));
    dir.set(Math.sin(h)*Math.cos(a), Math.cos(h), Math.sin(h)*Math.sin(a));
    const at = pos.clone().add(new V3(dir.x*s, dir.y*s*.42, dir.z*s));
    M4.compose(at, Q.setFromUnitVectors(up, dir.clone().lerp(up, .5).normalize()), new V3(1, rr(.6, 1.6), 1)); st.setMatrixAt(k, M4);
    c.setHSL(rr(.2, .3), rr(.55, .85), rr(.28, .46)); st.setColorAt(k, c); k++;
  }
  scene.add(st);
  // sporophytes: hair-thin red-brown setae standing out of the cushions, each nodding a little capsule
  const spg = (() => { const seta = new THREE.CylinderGeometry(.0055, .0085, 1, 4).translate(0, .5, 0), caps = new THREE.SphereGeometry(1, 7, 5);   // unit tall, scaled uniformly
    caps.scale(.036, .09, .036).rotateZ(.9).translate(.042, .99, 0);
    const m = mergeGeos([seta, caps]), P = m.attributes.position, col = [];
    for(let i = 0; i < P.count; i++){ const cap = P.getY(i) > .93 || Math.abs(P.getX(i)) > .015; col.push(...(cap ? [.42, .3, .14] : [.55, .2, .1])); }
    m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return m; })();
  const SPN = 3000, sp = hot(new THREE.InstancedMesh(spg, sway(new THREE.MeshStandardMaterial({vertexColors:true, roughness:.6}), .6, 1.7), SPN), TEMP.moss);
  for(let i = 0; i < SPN; i++){ const [pos, s] = MOSS_SPOTS[Math.floor(rnd()*MOSS_SPOTS.length)], a = rnd()*6.28, d = Math.sqrt(rnd())*.8, H = rr(.18, .5)*Math.min(1.3, .5 + s);
    M4.compose(pos.clone().add(new V3(Math.cos(a)*s*d, s*.42*Math.sqrt(1 - d*d) - .005, Math.sin(a)*s*d)), Q.setFromEuler(E.set(rr(-.25, .25), rnd()*6.3, rr(-.25, .25))), new V3(H, H, H)); sp.setMatrixAt(i, M4);
    c.setHSL(rr(.02, .08), rr(.5, .8), rr(.35, .6)); sp.setColorAt(i, c); }
  scene.add(sp);
}

// ---- ferns: many more clumps, with young fronds still curled in fiddleheads
{
  const g = frondGeo(true), centers = []; for(let i = 0; i < 180 && centers.length < 95; i++){ const [x, z] = scatter(22*AK, 2.5), sz = rr(2.2, 5.5); if(!nearPlat(x, z, sz*.8)) centers.push([x, z, sz]); }   // young ferns, fronds 7–20 cm
  const im = hot(new THREE.InstancedMesh(g, sway(new THREE.MeshStandardMaterial({roughness:.7, side:THREE.DoubleSide, emissive:0x0e1c07, vertexColors:true}), .03), centers.length*9), TEMP.leaf), c = new THREE.Color(); let k = 0;
  for(const [x, z, sz] of centers){ const hue = rr(.24, .3);
    for(let j = 0; j < 9; j++){ const s = sz*rr(.7, 1.2);
      M4.compose(new V3(x, hAt(x, z), z), Q.setFromEuler(E.set(rr(-.45, .05), j/9*6.28 + rr(-.3, .3), 0, 'YXZ')), new V3(s, s*rr(.8, 1.2), s));
      im.setMatrixAt(k, M4); c.setHSL(hue + rr(-.02, .02), rr(.5, .7), rr(.24, .38)); im.setColorAt(k, c); k++; } }
  im.castShadow = im.receiveShadow = true; scene.add(im);
  const cr = hot(new THREE.InstancedMesh(fernCrownGeo(), new THREE.MeshStandardMaterial({color:0x5a3f26, map: FIDDLE_TEX, bumpMap: FIDDLE_TEX, bumpScale: 2, roughness:.9}), centers.length), TEMP.wood);
  centers.forEach(([x, z, sz], i) => { const s = sz*rr(.02, .03); cr.setMatrixAt(i, M4.compose(new V3(x, hAt(x, z) - .02, z), Q.setFromEuler(E.set(0, rnd()*6.3, 0)), new V3(s, s, s))); });
  cr.castShadow = cr.receiveShadow = true; scene.add(cr);
  // fiddleheads: a scurfy stalk rolling over into a tight, beaded crozier (one piece, so it reads as a young frond)
  const n = 75, cm = hot(new THREE.InstancedMesh(crozierGeo(1, .13, .02), sway(new THREE.MeshStandardMaterial({map: FIDDLE_TEX, bumpMap: FIDDLE_TEX, bumpScale: 1.5, roughness:.6}), .02, 1.4), n), TEMP.leaf), c2 = new THREE.Color();
  for(let i = 0; i < n; i++){ const [cx, cz] = centers[i % centers.length], x = cx + rr(-.8, .8), z = cz + rr(-.8, .8), h = rr(.8, 2.2), y = hAt(x, z);   // fiddleheads 2–6 cm
    M4.compose(new V3(x, y - .02, z), Q.setFromEuler(E.set(rr(-.15, .15), rnd()*6.3, rr(-.12, .12))), new V3(h, h, h)); cm.setMatrixAt(i, M4);
    c2.setHSL(rr(.2, .27), rr(.45, .65), rr(.4, .55)); cm.setColorAt(i, c2); }
  cm.castShadow = true; scene.add(cm);
}

// ---- more fungi on the floor: glossy waxcaps, tall scaly parasols ringed on the stem, puffballs, coral fungi,
// scarlet cups on little stalks, and veiled ladies hanging out their lacy white skirts. All cold.
{
  const c = new THREE.Color(), up = new V3(0, 1, 0), L = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
  const freeSpot = (rMax, rMin, m) => { for(let t = 0; ; t++){ const p = scatter(rMax, rMin); if(t > 30 || !nearPlat(p[0], p[1], m)) return p; } };
  const stemG = (r0, r1) => new THREE.CylinderGeometry(r0, r1, 1, 10, 4).translate(0, .5, 0);
  // stand a unit-tall stalk at x,z (height h, girth sw), leaning a little; returns [base, top, lean]
  const stalk = (im, i, x, z, h, sw, lean = .15) => { const b = new V3(x, hAt(x, z) - .02, z), q = new THREE.Quaternion().setFromEuler(E.set(rr(-lean, lean), rnd()*6.3, rr(-lean, lean)));
    im.setMatrixAt(i, M4.compose(b, q, new V3(sw, h, sw))); return [b, new V3(0, h, 0).applyQuaternion(q).add(b), q]; };
  // waxcaps: smooth, greasy-bright conical caps in scarlet, orange, yellow and parrot green, on hollow stems of the same colour
  const WAX_TEX = canvasTex(256, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c8beb4'); g.addColorStop(.35, '#f2ece6'); g.addColorStop(1, '#fffaf2'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 260; i++){ const px = trnd()*w; x.strokeStyle = `rgba(${trnd() < .5 ? '140,120,110' : '255,255,250'},${.12 + trnd()*.18})`; x.lineWidth = .6 + trnd()*1.2;
      for(const ox of [-w, 0, w]){ x.beginPath(); x.moveTo(px + ox, trnd()*h*.3); x.lineTo(px + ox + (trnd() - .5)*3, h); x.stroke(); } }
  }, [1, 1]);
  const WAX = [[0, .85, .42], [.02, .9, .47], [.06, .95, .5], [.12, .9, .52], [.15, .85, .6], [.3, .5, .38]];
  const wn = 110, wCap = hot(new THREE.InstancedMesh(L([[.9, -.02], [1, .03], [.86, .3], [.66, .6], [.43, .88], [.2, 1.08], [.001, 1.15]]), new THREE.MeshStandardMaterial({map: WAX_TEX, roughness:.2, side:THREE.DoubleSide}), wn), TEMP.fungus);
  const wGill = hot(new THREE.InstancedMesh(gillGeo(), new THREE.MeshStandardMaterial({map: GILL_TEX, roughness:.5, side:THREE.DoubleSide}), wn), TEMP.fungus);
  const wStem = hot(new THREE.InstancedMesh(stemG(.05, .06), new THREE.MeshStandardMaterial({map: WAX_TEX, roughness:.3}), wn), TEMP.fungus);
  for(let k = 0; k < wn;){ const [cx, cz] = freeSpot(24*AK, 2, 1), col = WAX[Math.floor(rnd()*WAX.length)], m = 2 + Math.floor(rnd()*4);
    for(let j = 0; j < m && k < wn; j++, k++){ const x = cx + rr(-.5, .5), z = cz + rr(-.5, .5), cs = rr(.2, .5), h = rr(.7, 1.6)*(.5 + cs*1.5);   // caps 1–3 cm across
      const [, tp] = stalk(wStem, k, x, z, h, .8 + cs*2, .2);
      M4.compose(tp, Q.setFromEuler(E.set(rr(-.15, .15), rnd()*6.3, rr(-.15, .15))), new V3(cs, cs*rr(.75, 1.15), cs)); wCap.setMatrixAt(k, M4); wGill.setMatrixAt(k, M4);
      c.setHSL(col[0] + rr(-.015, .015), col[1], col[2] + rr(-.05, .05)); wCap.setColorAt(k, c); c.offsetHSL(.03, -.2, .12); wStem.setColorAt(k, c); wGill.setColorAt(k, c); } }
  wCap.castShadow = true; scene.add(wCap, wGill, wStem);
  // parasols: a broad flat cap with a dark knob, its cream skin cracked into brown scales; a tall snakeskin stem with a
  // bulb at the foot and a loose double ring
  const PARASOL_TEX = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#efe6d4'; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 2600; i++){ const px = trnd()*w, py = trnd()*h; x.strokeStyle = `rgba(190,170,140,${.15 + trnd()*.2})`; x.lineWidth = .7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (trnd() - .5)*2, py + 6 + trnd()*10); x.stroke(); }
    const g = x.createLinearGradient(0, 0, 0, h*.22); g.addColorStop(0, 'rgba(92,62,38,1)'); g.addColorStop(.8, 'rgba(110,76,48,.95)'); g.addColorStop(1, 'rgba(110,76,48,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h*.22);
    for(let row = 0; row < 11; row++){ const py = h*(.2 + row*.065), n = 22 + row*6, sz = 9 - row*.45;   // scales in loose rings, smaller and sparser toward the margin
      for(let i = 0; i < n; i++){ if(trnd() < row*.05) continue; const px = (i + trnd()*.6)/n*w, ry = py + (trnd() - .5)*10;
        x.fillStyle = `rgba(${95 + trnd()*30},${62 + trnd()*20},${36 + trnd()*14},${.75 + trnd()*.25})`;
        for(const ox of [-w, 0, w]){ x.beginPath(); x.ellipse(px + ox, ry, sz*(1.2 + trnd()*.8), sz*(.6 + trnd()*.4), (trnd() - .5)*.5, 0, 6.283); x.fill(); } } }
  }, [1, 1]);
  const pn = 14;
  const pCap = hot(new THREE.InstancedMesh(L([[.96, -.07], [1, -.02], [.96, .06], [.82, .12], [.58, .16], [.34, .2], [.18, .27], [.08, .33], [.001, .35]], 32), new THREE.MeshStandardMaterial({map: PARASOL_TEX, bumpMap: PARASOL_TEX, bumpScale: 2.5, roughness:.85, side:THREE.DoubleSide}), pn), TEMP.fungus);
  const pGill = hot(new THREE.InstancedMesh(gillGeo(), new THREE.MeshStandardMaterial({color:0xf4eee2, map: GILL_TEX, roughness:.8, side:THREE.DoubleSide}), pn), TEMP.fungus);
  const pStem = hot(new THREE.InstancedMesh(L([[.001, 0], [.17, 0], [.21, .03], [.18, .07], [.1, .12], [.08, .5], [.07, .97], [.065, 1]], 12), new THREE.MeshStandardMaterial({color:0xd8c8b0, map: FIDDLE_TEX, bumpMap: FIDDLE_TEX, bumpScale: 1.5, roughness:.7}), pn), TEMP.fungus);
  const pRing = hot(new THREE.InstancedMesh(L([[.075, .02], [.12, 0], [.2, -.05], [.24, -.11], [.22, -.13], [.14, -.07], [.08, -.03]], 20), new THREE.MeshStandardMaterial({color:0xeee4d2, roughness:.8, side:THREE.DoubleSide}), pn), TEMP.fungus);
  for(let k = 0; k < pn; k++){ const [x, z] = freeSpot(24*AK, 4, 2), h = rr(3.5, 7), cs = rr(.8, 1.6);   // stems 10–20 cm, caps 5–10 cm across
    const [b, tp, q] = stalk(pStem, k, x, z, h, 1, .1);
    pRing.setMatrixAt(k, M4.compose(b.clone().lerp(tp, .74), q, new V3(1, 1, 1)));
    M4.compose(tp, Q.setFromEuler(E.set(rr(-.12, .12), rnd()*6.3, rr(-.12, .12))), new V3(cs, cs*rr(.8, 1.1), cs)); pCap.setMatrixAt(k, M4); pGill.setMatrixAt(k, M4);
    c.setHSL(rr(.07, .1), rr(.25, .45), rr(.82, .95)); pCap.setColorAt(k, c); }
  pCap.castShadow = pStem.castShadow = true; scene.add(pCap, pGill, pStem, pRing);
  // puffballs: pear-shaped, white to tan, crowded with tiny warts; the old ones open at a pore on top
  const PUFF_TEX = canvasTex(256, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a2a1a'); g.addColorStop(.06, '#8a7458'); g.addColorStop(.14, '#ece4d4'); g.addColorStop(1, '#d8ccb4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 2400; i++){ const px = trnd()*w, py = h*(.08 + trnd()*.9), r = .6 + trnd()*1.6, v = trnd() < .5 ? 120 + trnd()*50 : 240;
      x.fillStyle = `rgba(${v},${v*.92},${v*.8},${.35 + trnd()*.4})`; for(const ox of [-w, 0, w]){ x.beginPath(); x.arc(px + ox, py, r, 0, 6.283); x.fill(); } }
  }, [1, 1]);
  const puffG = new THREE.SphereGeometry(1, 20, 14); { const p = puffG.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i), k = y < 0 ? 1 - .5*Math.pow(-y, 1.4) : 1;
    p.setXYZ(i, p.getX(i)*k, y < 0 ? y*1.25 : y*.85, p.getZ(i)*k); } puffG.computeVertexNormals(); }
  const fn = 60, puff = hot(new THREE.InstancedMesh(puffG, new THREE.MeshStandardMaterial({map: PUFF_TEX, bumpMap: PUFF_TEX, bumpScale: 2, roughness:.85}), fn), TEMP.fungus);
  for(let k = 0; k < fn;){ const [cx, cz] = freeSpot(24*AK, 2, 1), m = 1 + Math.floor(rnd()*4);
    for(let j = 0; j < m && k < fn; j++, k++){ const x = cx + rr(-.6, .6), z = cz + rr(-.6, .6), s = rr(.2, .6);   // 1–3.5 cm
      puff.setMatrixAt(k, onGround(x, z, s*.95, rnd()*6.3, new V3(s, s, s), .15)); c.setHSL(rr(.08, .11), rr(.15, .4), rr(.6, .95)); puff.setColorAt(k, c); } }
  puff.castShadow = puff.receiveShadow = true; scene.add(puff); litterBake(puff);   // solid: walked over, not through
  // coral fungi: little clumps of blunt, forking branches in butter yellow, apricot, lilac and cream. Each branch is
  // a softly bent, lumpy tube that flares into its forks; the tips split into tiny blunt teeth. The flesh is finely
  // wrinkled lengthwise and flecked, deeper in tone at the fused base and paler toward the tips.
  const CORAL_TEX = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#d8d0c4'; x.fillRect(0, 0, w, h);
    for(let i = 0; i < 900; i++){ const px = trnd()*w, py = trnd()*h, l = 10 + trnd()*40, v = trnd() < .55 ? 150 + trnd()*40 : 245;   // lengthwise wrinkles
      x.strokeStyle = `rgba(${v},${v*.96},${v*.9},${.18 + trnd()*.3})`; x.lineWidth = .5 + trnd()*1.3;
      for(const ox of [-w, 0, w]) for(const oy of [-h, 0, h]){ x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + (trnd() - .5)*4, py + oy + l/2, px + ox + (trnd() - .5)*3, py + oy + l); x.stroke(); } }
    for(let i = 0; i < 1100; i++){ const px = trnd()*w, py = trnd()*h, r = .3 + trnd()*.8, d = trnd() < .45;                // pits and pale flecks
      x.fillStyle = d ? `rgba(150,130,110,${.12 + trnd()*.2})` : `rgba(255,252,245,${.3 + trnd()*.4})`; x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill(); }
    for(let i = 0; i < 8; i++){ const px = trnd()*w, py = trnd()*h, r = 6 + trnd()*14, g = x.createRadialGradient(px, py, 0, px, py, r);   // bruises
      g.addColorStop(0, 'rgba(150,115,80,.22)'); g.addColorStop(1, 'rgba(150,115,80,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, 2*r, 2*r); }
  }, [1, 1]);
  const coralG = (() => { const parts = [];
    const lump = () => { const f = [rr(5, 9), rr(11, 17)], ph = [rnd()*6.3, rnd()*6.3]; return t => 1 + .07*Math.sin(t*f[0] + ph[0]) + .04*Math.sin(t*f[1] + ph[1]); };
    const ball = (e, r) => parts.push(new THREE.SphereGeometry(r, 8, 5).translate(e.x, e.y, e.z));
    const br = (p, dir, len, r, d) => {
      const s0 = p.clone().addScaledVector(dir, -r*.4), e = p.clone().addScaledVector(dir, len);
      const bend = new V3(rr(-1, 1), rr(.2, 1), rr(-1, 1)).normalize().multiplyScalar(len*.12), mid = s0.clone().lerp(e, .5).add(bend);
      const crv = new THREE.QuadraticBezierCurve3(s0, mid, e), lu = lump();
      parts.push(taperedTube(crv, t => r*(1.12 - .38*t + .22*Math.max(0, 1 - t*6))*lu(t), {seg: 5, radial: 8, capEnd: false}));   // flared at the crotch
      const tip = crv.getTangent(1).normalize(), rt = r*.74;
      if(d === 0){ ball(e, rt*1.02);                                                                                // blunt tip with 2–3 little teeth
        const tn = 2 + (rnd() < .5 ? 1 : 0);
        for(let i = 0; i < tn; i++){ const a = i/tn*6.283 + rnd(), td = tip.clone().add(new V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(.6)).normalize(), tl = rt*rr(1.2, 2);
          parts.push(taperedTube(new THREE.LineCurve3(e.clone().addScaledVector(td, rt*.3), e.clone().addScaledVector(td, rt*.3 + tl)), t => rt*(.55 - .3*t), {seg: 1, radial: 6})); }
        return; }
      ball(e, rt*1.08);                                                                                               // fleshy fork
      const n = 2 + (rnd() < .45 ? 1 : 0);
      for(let i = 0; i < n; i++){ const a = i/n*6.283 + rr(-.5, .5), sp = rr(.3, .6);
        const nd = tip.clone().multiplyScalar(Math.cos(sp)).add(new V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(Math.sin(sp))); nd.y = Math.max(nd.y, .45); nd.normalize();
        br(e, nd, len*rr(.62, .82), rt, d - 1); } };
    parts.push(L([[.001, -.05], [.12, -.05], [.125, -.01], [.1, .05], [.075, .12], [.001, .17]], 12));          // fused fleshy base
    for(let i = 0; i < 5; i++){ const a = i/5*6.283 + rr(-.3, .3); br(new V3(Math.cos(a)*.06, .02, Math.sin(a)*.06), new V3(Math.cos(a)*.35, 1, Math.sin(a)*.35).normalize(), .3, .065, 3); }
    const g = mergeGeos(parts), P = g.attributes.position, col = new Float32Array(P.count*3);
    let top = 0; for(let i = 0; i < P.count; i++) top = Math.max(top, P.getY(i));
    for(let i = 0; i < P.count; i++){ const t = Math.min(1, Math.max(0, P.getY(i)/top)), k = .55 + .45*Math.pow(t, .8);   // deeper at the base, pale at the tips
      col[i*3] = k; col[i*3 + 1] = k*(.94 + .06*t); col[i*3 + 2] = k*(.86 + .14*t); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
  const CORAL = [[.13, .8, .62], [.07, .75, .62], [.78, .3, .72], [.11, .35, .85], [.05, .85, .5]];
  const cn = 22, coral = hot(new THREE.InstancedMesh(coralG, new THREE.MeshStandardMaterial({vertexColors: true, map: CORAL_TEX, bumpMap: CORAL_TEX, bumpScale: 1.1, roughness:.8}), cn), TEMP.fungus);
  for(let k = 0; k < cn; k++){ const [x, z] = freeSpot(23*AK, 2, 1), s = rr(1, 2.4), col = CORAL[Math.floor(rnd()*CORAL.length)];   // clumps 2.5–6 cm tall
    coral.setMatrixAt(k, onGround(x, z, -.02, rnd()*6.3, new V3(s, s*rr(.85, 1.15), s), .12)); c.setHSL(col[0] + rr(-.02, .02), col[1], col[2] + rr(-.06, .04) + .08); coral.setColorAt(k, c); }
  coral.castShadow = coral.receiveShadow = true; scene.add(coral);
  // scarlet cups: deep little goblets on short stalks, fringed at the rim, sprouting in groups from buried wood
  const cupG = L([[.001, 0], [.3, .04], [.6, .18], [.85, .42], [1, .7], [1.05, .78], [1, .8]], 20);
  { const p = cupG.attributes.position, col = []; for(let i = 0; i < p.count; i++){ const y = p.getY(i); col.push(1, 1 - .3*Math.max(0, .5 - y), 1 - .3*Math.max(0, .5 - y)); } cupG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const un = 90, cup = hot(new THREE.InstancedMesh(cupG, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.45, side:THREE.DoubleSide}), un), TEMP.fungus);
  const cupS = hot(new THREE.InstancedMesh(stemG(.05, .07), new THREE.MeshStandardMaterial({color:0xe8b8a0, roughness:.6}), un), TEMP.fungus);
  for(let k = 0; k < un;){ const [cx, cz] = freeSpot(24*AK, 2, 1), m = 2 + Math.floor(rnd()*5), pink = rnd() < .3;
    for(let j = 0; j < m && k < un; j++, k++){ const x = cx + rr(-.45, .45), z = cz + rr(-.45, .45), cs = rr(.14, .34), h = rr(.08, .35);   // cups 8–20 mm across
      const [, tp] = stalk(cupS, k, x, z, h, 1 + cs*2, .35);
      cup.setMatrixAt(k, M4.compose(tp, Q.setFromEuler(E.set(rr(-.5, .5), rnd()*6.3, rr(-.5, .5))), new V3(cs, cs*rr(.7, 1.1), cs)));
      pink ? c.setHSL(rr(.94, .98), .75, rr(.55, .65)) : c.setHSL(rr(.98, 1.01) % 1, .9, rr(.42, .5)); cup.setColorAt(k, c); } }
  cup.castShadow = true; scene.add(cup, cupS);
  // veiled ladies: a spongy white stem crowned by an olive, honeycombed head, with a lace skirt let down from under it
  const HONEY_TEX = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#e8e2cc'; x.fillRect(0, 0, w, h);
    for(let iy = 0; iy < 9; iy++) for(let ix = 0; ix < 18; ix++){ const px = (ix + (iy % 2)*.5 + (trnd() - .5)*.3)/18*w, py = (iy + .5 + (trnd() - .5)*.3)/9*h, r = w/18*.42;
      x.fillStyle = `rgba(${48 + trnd()*20},${52 + trnd()*20},${22 + trnd()*10},1)`; for(const ox of [-w, 0, w]){ x.beginPath(); x.ellipse(px + ox, py, r, r*1.15, 0, 0, 6.283); x.fill(); }
      x.fillStyle = 'rgba(200,210,150,.35)'; x.beginPath(); x.arc(px - r*.3, py - r*.3, r*.25, 0, 6.283); x.fill(); }   // a slimy gleam in each pit
  }, [1, 1]);
  const NET_TEX = canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); const n = 10, P = [];
    for(let j = 0; j <= n; j++) for(let i = 0; i <= n; i++) P.push([(i + (j % 2)*.5 + (i % n && j % n ? (trnd() - .5)*.35 : 0))/n*w, (j + (i % n && j % n ? (trnd() - .5)*.35 : 0))/n*h]);
    x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.lineJoin = 'round';
    const at = (i, j) => P[j*(n + 1) + i];
    for(let j = 0; j <= n; j++) for(let i = 0; i <= n; i++){ const a = at(i, j);
      for(const [di, dj] of [[1, 0], [0, 1]]){ const ii = i + di, jj = j + dj; if(ii < 0 || ii > n || jj > n) continue; const b = at(ii, jj);
        for(const ox of [-w, 0, w]){ x.beginPath(); x.moveTo(a[0] + ox, a[1]); x.lineTo(b[0] + ox, b[1]); x.stroke(); } } }
  }, [4, 3]);
  const vn = 6;
  const vStem = hot(new THREE.InstancedMesh(stemG(.24, .3), new THREE.MeshStandardMaterial({color:0xf2eee4, map: PUFF_TEX, bumpMap: PUFF_TEX, bumpScale: 2, roughness:.8}), vn), TEMP.fungus);
  const vHead = hot(new THREE.InstancedMesh(L([[.5, 0], [.56, .15], [.55, .45], [.46, .75], [.3, .95], [.14, 1.03], [.001, 1.05]], 20), new THREE.MeshStandardMaterial({map: HONEY_TEX, bumpMap: HONEY_TEX, bumpScale: 3, roughness:.3, side:THREE.DoubleSide}), vn), TEMP.fungus);
  // each skirt is its own lathe, bent out of true: the lace sags and billows unevenly, folds into soft pleats toward the hem,
  // and the hem itself hangs ragged — longer tongues here, torn-short bays there, the whole thing slumped a little to one side
  const skirtM = new THREE.MeshStandardMaterial({color:0xfbf8f0, map: NET_TEX, alphaTest: .45, roughness:.7, side:THREE.DoubleSide});
  const skirtProfile = [[1.35, -2.5], [1.22, -2.1], [1.02, -1.5], [.78, -.9], [.58, -.4], [.47, 0]];
  let sSeed = 4242; const srnd = () => (sSeed = (sSeed*16807) % 2147483647)/2147483647, srr = (a, b) => a + srnd()*(b - a);   // own stream: the rest of the jungle stays put
  const skirtG = () => {
    const pts = [];
    for(let i = 0; i < skirtProfile.length - 1; i++){ const [a0, b0] = skirtProfile[i], [a1, b1] = skirtProfile[i + 1];
      for(let j = 0; j < 3; j++){ const f = j/3; pts.push([a0 + (a1 - a0)*f, b0 + (b1 - b0)*f]); } }
    pts.push(skirtProfile[skirtProfile.length - 1]);
    const g = L(pts, 48), p = g.attributes.position;
    const wave = (n, amp) => { const w = []; for(let f = 1; f <= n; f++) w.push([f + (f > 2 ? Math.floor(srnd()*3) : 0), srnd()*6.283, amp*srr(.4, 1)/Math.sqrt(f)]); return w; };
    const sum = (w, th) => w.reduce((s, [f, ph, a]) => s + a*Math.sin(f*th + ph), 0);
    const bulge = wave(3, .12), pleat = [[srr(7, 11) | 0, srnd()*6.283, .07], [srr(13, 17) | 0, srnd()*6.283, .03]], hem = wave(6, .35), tear = [[srr(9, 14) | 0, srnd()*6.283, .18], [srr(17, 23) | 0, srnd()*6.283, .08]];
    const slump = srnd()*6.283, sx = Math.cos(slump), sz = Math.sin(slump), lean = srr(.08, .22);
    for(let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if(r < 1e-4) continue;
      const th = Math.atan2(z, x), t = Math.min(1, Math.max(0, -y/2.5)), t2 = t*t;
      const rad = 1 + t*sum(bulge, th) + t2*sum(pleat, th), drop = t2*t*(sum(hem, th) + Math.max(0, sum(tear, th)));   // + hangs lower, − hitched up
      const nx = x*rad + sx*lean*t2, nz = z*rad + sz*lean*t2;
      p.setXYZ(i, nx, y - drop + t2*.15*Math.cos(th - slump), nz); }
    g.computeVertexNormals(); return g;
  };
  for(let k = 0; k < vn; k++){ const [x, z] = freeSpot(22*AK, 4, 2), H = rr(4, 7), s = rr(.75, 1.15);   // 12–20 cm tall
    const [, tp, q] = stalk(vStem, k, x, z, H, s, .08), hb = tp.clone().addScaledVector(up.clone().applyQuaternion(q), -.85*s);
    vHead.setMatrixAt(k, M4.compose(hb, q, new V3(s, s, s)));
    const sk = hot(new THREE.Mesh(skirtG(), skirtM), TEMP.fungus); sk.position.copy(hb); sk.quaternion.copy(q); sk.scale.set(s*rr(.9, 1.1), s*rr(.8, 1.05), s*rr(.9, 1.1));   // same draws as the old instance scale
    sk.castShadow = true; scene.add(sk);
    c.setHSL(rr(.14, .2), rr(.2, .4), rr(.5, .7)); vHead.setColorAt(k, c); }
  vStem.castShadow = vHead.castShadow = true; scene.add(vStem, vHead);
}

// ---- broad-leaved understory plants (big heart and lance leaves on arching stalks)
{
  // every blade is walkable like the play-area leaves: held level on its stalk (no shader sway, so the feet match the
  // surface), top and underside both, and the stalk is a climbable tube, so she can walk up from the soil or leap across
  const shapes = ['heart', 'heart', 'lance', 'round'], before = PLAT.slice();
  const nearOld = (x, z, m) => before.some(p => !p.ground && Math.hypot(x - p.x, z - p.z) < Math.max(p.rx, p.rz) + m);   // spacing as before: plants don't dodge each other's blades
  for(let i = 0; i < 75; i++){                                                     // herbs 15–45 cm tall, leaves the size of her whole world
    const [x, z] = scatter(26*AK, 3), tall = rr(5, 15); if(nearOld(x, z, tall*.75)) continue;
    const gy = hAt(x, z), nLeaves = 3 + Math.floor(rnd()*3), hue = rr(.22, .32), varieg = rnd() < .2;
    const mat = glowLeaf(new THREE.MeshStandardMaterial({color: new THREE.Color().setHSL(hue, rr(.45, .7), rr(.22, .36)), map: LEAF_TEX, roughness:.55, side:THREE.DoubleSide}));
    if(varieg) mat.emissive.multiplyScalar(1.6);
    const vc = mat.color.clone().lerp(new THREE.Color(0xe8f0b0), .45), veinM = new THREE.LineBasicMaterial({color: vc});
    for(let j = 0; j < nLeaves; j++){
      const a = j/nLeaves*6.28 + rr(-.4, .4), reach = tall*rr(.4, .8), h = tall*rr(.6, 1);
      const tip = new V3(x + Math.cos(a)*reach, gy + h, z + Math.sin(a)*reach), sr = .04 + tall*.008;
      const curve = new THREE.CatmullRomCurve3([new V3(x, gy - .02, z), new V3(x + Math.cos(a)*reach*.2, gy + h*.75, z + Math.sin(a)*reach*.2), tip]);
      scene.add(hot(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, sr, 6), stemM), TEMP.stem));
      const stalk = tubeSurface(curve.getPoints(16), sr, 'stem');
      const type = shapes[Math.floor(rnd()*shapes.length)], w = rr(.25, .55)*tall, l = w*rr(1.4, 2.1), droop = rr(.25, .6), fold = rr(.08, .2);
      const rot = -a + Math.PI/2 + rr(-.3, .3); rr(-.35, .15);                     // (the old tilt's draw, kept so the rest of the jungle stays put)
      const leaf = hot(new THREE.Mesh(leafGeo(type, w, l, droop, fold), mat), TEMP.leaf); OCCLUDERS.push(leaf);   // the camera never pushes through
      // the stalk meets the blade's underside a little in from its base (as on a taro leaf), inside the part she can walk
      leaf.position.copy(tip); leaf.rotation.set(0, rot, 0); leaf.translateZ(-l*.74); leaf.position.y += sr + .012;
      leaf.castShadow = leaf.receiveShadow = true; scene.add(leaf);
      leaf.add(new THREE.LineSegments(veinGeo(type, w, l, droop, fold), veinM));
      const p = {id:'L' + PLAT.length, kind:'leaf', herb:true, x: leaf.position.x, y: leaf.position.y, z: leaf.position.z, rx:w*.82, rz:l*.78, rot, leaf:{type, w, l, droop, fold}};
      PLAT.push(p); p.under = leafUnder(p);
      // walking up the stalk carries her out from under the blade onto its top, right above the joint
      const sp0 = stalk._pts, T = sp0[sp0.length - 1], up = T.clone().sub(sp0[sp0.length - 4]).normalize();
      stalk.top = p;
      stalk.atRim = (v, t) => v.distanceTo(T) < sr*1.5 + .08 && t.dot(up) > .2;
      stalk.rimLand = () => { const q = new V3(T.x, 0, T.z); q.y = surfAt(p, q.x, q.z) + .003; return {pos: q, yaw: rot + Math.PI, swing: true}; };
    }
  }
}

// ---- tropical flowers: five-petalled blooms in pinks, oranges, yellows, violets and white; red-and-gold bract spikes
const FLOWER_SPOTS = [];
{
  const petal = leafGeo('round', .028, .045, 0, .25, 4, 8); petal.translate(0, 0, -.045);
  const COLS = [0xff4f9a, 0xff7a1a, 0xffd23a, 0xb35cff, 0xf6f2ff, 0xff3355, 0xff9ad0];
  const N = 300, P = 5, pm = hot(new THREE.InstancedMesh(petal, sway(new THREE.MeshStandardMaterial({roughness:.5, side:THREE.DoubleSide}), .2), N*P), .3);
  const ctr = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 6, 4), new THREE.MeshStandardMaterial({color:0xffe066, roughness:.6, emissive:0x332200}), N), .3);
  const stl = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(.004, .006, 1, 5).translate(0, .5, 0), new THREE.MeshStandardMaterial({color:0x4f7a2a}), N), TEMP.stem);
  const c = new THREE.Color(); let k = 0;
  for(let i = 0; i < N; i++){                                                     // blooms 4–10 cm across on stems 5–25 cm tall
    let x, z, h, t = 0;
    do { const [cx, cz] = i % 3 ? scatter(22*AK, 2) : FLOWER_SPOTS.length ? FLOWER_SPOTS[Math.floor(rnd()*FLOWER_SPOTS.length)].slice(0, 2) : scatter(22*AK, 2);
      x = cx + rr(-1.5, 1.5); z = cz + rr(-1.5, 1.5); h = rr(1.5, 8); } while(nearPlat(x, z, 1.2) && ++t < 30);
    const y = hAt(x, z), col = COLS[Math.floor(rnd()*COLS.length)], s = rr(.7, 1.6)*12, tilt = rr(.1, .6);
    FLOWER_SPOTS.push([x, z, y + h]);
    // every bloom is a landing pad: a shallow cup (the petals' tilt) with the round yellow centre domed in the middle
    const fr = .09*s*Math.cos(tilt)*.85;
    PLAT.push({id:'FL' + PLAT.length, kind:'flower', x, y: y + h, z, rx: fr, rz: fr, rot: 0, cup: Math.tan(tilt), ctr: .012*s});
    M4.compose(new V3(x, y, z), Q.identity(), new V3(6, h, 6)); stl.setMatrixAt(i, M4);
    M4.compose(new V3(x, y + h, z), Q.identity(), new V3(s, s, s)); ctr.setMatrixAt(i, M4);
    for(let j = 0; j < P; j++){ M4.compose(new V3(x, y + h, z), Q.setFromEuler(E.set(tilt, j/P*6.283 + i, 0, 'YXZ')), new V3(s, s, s)); pm.setMatrixAt(k, M4); c.set(col).offsetHSL(rr(-.02, .02), 0, rr(-.06, .06)); pm.setColorAt(k, c); k++; }
  }
  scene.add(pm, ctr, stl);
  // heliconia-like spikes: red boat-shaped bracts tipped gold, zig-zagging up a stalk
  const bract = new THREE.ConeGeometry(.035, .16, 6).rotateZ(Math.PI/2).translate(.07, 0, 0), HN = 18, BN = HN*7;
  const bm = hot(new THREE.InstancedMesh(bract, new THREE.MeshStandardMaterial({roughness:.45, vertexColors:false}), BN), .32);
  const sk = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(.01, .014, 1, 5).translate(0, .5, 0), new THREE.MeshStandardMaterial({color:0x3f6a2a}), HN), TEMP.stem);
  k = 0;
  for(let i = 0; i < HN; i++){ const [x, z] = scatter(26*AK, 5); if(nearPlat(x, z, 3)) { i--; continue; } const y = hAt(x, z), H = rr(12, 24);   // stalks 35–70 cm, bracts ~5 cm
    M4.compose(new V3(x, y, z), Q.identity(), new V3(10, H, 10)); sk.setMatrixAt(i, M4);
    for(let j = 0; j < 7; j++){ const bs = 10*(1 - j*.08); M4.compose(new V3(x, y + H*.45 + j*.7, z), Q.setFromEuler(E.set(0, (j % 2 ? Math.PI : 0) + rr(-.2, .2), .5)), new V3(bs, bs, bs)); bm.setMatrixAt(k, M4);
      c.setHSL(j > 4 ? .1 : rr(0, .02), .9, j > 4 ? .5 : .42); bm.setColorAt(k, c); k++; } }
  bm.castShadow = sk.castShadow = true; scene.add(bm, sk);
  // fallen petals in the litter
  const fp = hot(new THREE.InstancedMesh(petal, new THREE.MeshStandardMaterial({roughness:.7, side:THREE.DoubleSide}), 260), .3);
  for(let i = 0; i < fp.count; i++){ const [fx, fz, fy] = FLOWER_SPOTS[Math.floor(rnd()*FLOWER_SPOTS.length)], x = fx + rr(-3, 3), z = fz + rr(-3, 3), ps = rr(8, 16);
    fp.setMatrixAt(i, onGround(x, z, .01, rnd()*6.3, new V3(ps, ps, ps), .2)); c.set(COLS[Math.floor(rnd()*COLS.length)]).offsetHSL(0, -.2, -.12); fp.setColorAt(i, c); }
  scene.add(fp);
}

// ---- buttress roots flaring from every big trunk, snaking into the soil
{
  for(const [x, z, r] of TREE_LIST){
    const n = 5 + Math.floor(rnd()*3), big = r > 5;
    for(let j = 0; j < n; j++){
      const a = j/n*6.28 + rr(-.3, .3), pts = [], reach = big ? rr(1.3, 2.3) : rr(2.2, 3.2);
      for(let k = 0; k <= 8; k++){ const t = k/8, d = r*(.85 + t*reach), aa = a + Math.sin(t*3 + j)*.15, px = x + Math.cos(aa)*d, pz = z + Math.sin(aa)*d;
        if(k > 2 && (nearPlat(px, pz, 1.5) || ANT_HILLS.some(([hx, hz]) => Math.hypot(px - hx, pz - hz) < ANT_HILL_R + 1))) break;   // stop short of leaves, webs and mounds
        pts.push(new V3(px, hAt(px, pz) + r*.9*Math.pow(1 - t, 1.8) - .04*t, pz)); }
      if(pts.length < 4) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const R0 = r*.55, rAt = t => R0*Math.pow(1 - t, 1.25) + (big ? .1 : .025);        // thick at the trunk, a thin tip in the soil
      const m = hot(new THREE.Mesh(taperedTube(curve, rAt, {seg: 30, radial: 16, w: .5, h: 1.55}), BARK_ROOT_M), TEMP.wood); m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
      const sp = curve.getPoints(14); tubeSurface(sp, sp.map((_, k) => rAt(k/14)), 'bark', {w: .5, h: 1.55});
    }
  }
}

// ---- fallen branches furred with moss, fringed with bracket fungi, spotted with lichen; seed pods and little mushrooms
{
  const brM = antiTile(new THREE.MeshStandardMaterial({color:0x6a5440, map: BARK_TEX_S, bumpMap: BARK_TEX_S, bumpScale: 1.5, roughness:.95}));
  const lich = [], fung = [], pods = [], caps = [];
  for(let i = 0; i < 14; i++){
    let [x, z] = scatter(21*AK, 3); if(nearPlat(x, z, 2)) { i--; continue; }
    let a = rnd()*6.28; const pts = [], len = rr(7, 16), r = rr(.15, .4);              // branches 20–50 cm long, 1–2.5 cm thick
    for(let k = 0; k <= 10; k++){ pts.push(new V3(x, hAt(x, z) + r*.8, z)); a += rr(-.2, .2); x += Math.cos(a)*len/10; z += Math.sin(a)*len/10; }
    const curve = new THREE.CatmullRomCurve3(pts), bAt = t => r*(1 - .45*t), m = hot(new THREE.Mesh(taperedTube(curve, bAt, {seg: 40, radial: 12, capStart: true}), brM), TEMP.stick); m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
    { const bp = curve.getPoints(24); tubeSurface(bp, bp.map((_, k) => bAt(k/24))); }
    for(let k = 0; k < 14; k++){ const t = rnd(), p = curve.getPoint(t), side = rnd() < .5 ? 1 : -1, tg = curve.getTangent(t), nrm = new V3(-tg.z, 0, tg.x).normalize();
      if(k < 5) lich.push(p.clone().add(new V3(0, r*.95, 0)).addScaledVector(nrm, rr(-.5, .5)*r));
      else if(k < 9) fung.push([p.clone().addScaledVector(nrm, side*r*.9), Math.atan2(nrm.x*side, nrm.z*side), rr(.12, .3)]);
      else caps.push(p.clone().add(new V3(0, r*.9, 0)).addScaledVector(nrm, rr(-.4, .4)*r)); }
  }
  for(let i = 0; i < 120; i++){ const [x, z] = scatter(21*AK, 1); pods.push(new V3(x, hAt(x, z) + .09, z)); }
  for(let i = 0; i < 70; i++){ const [x, z] = scatter(21*AK, 2); for(let j = 0; j < 3; j++){ const px = x + rr(-.4, .4), pz = z + rr(-.4, .4); caps.push(new V3(px, hAt(px, pz), pz)); } }
  const lm = hot(new THREE.InstancedMesh(new THREE.CircleGeometry(1, 9).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({color:0xb9c8a0, roughness:.9, side:THREE.DoubleSide}), lich.length), TEMP.moss);
  lich.forEach((p, i) => { const s = rr(.06, .15); M4.compose(p, Q.identity(), new V3(s, 1, s*rr(.6, 1))); lm.setMatrixAt(i, M4); });
  const fm = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, .85, .25, 20, 2, false, 0, Math.PI), new THREE.MeshStandardMaterial({color:0xe0a25a, map: ZONE_TEX, bumpMap: ZONE_TEX, bumpScale: 2, roughness:.6}), fung.length), TEMP.fungus);
  fung.forEach(([p, yaw, s], i) => { M4.compose(p, Q.setFromEuler(E.set(0, yaw - Math.PI/2, 0)), new V3(s, s, s)); fm.setMatrixAt(i, M4); fm.setColorAt(i, new THREE.Color().setHSL(rr(.06, .11), .6, rr(.45, .7))); });
  const pm = hot(new THREE.InstancedMesh(new THREE.CapsuleGeometry(.018, .06, 4, 10).rotateZ(Math.PI/2), new THREE.MeshStandardMaterial({map: TWIG_TEX, bumpMap: TWIG_TEX, bumpScale: 3, roughness:.6}), pods.length), TEMP.dead);
  pods.forEach((p, i) => { const ps = rr(4, 7); M4.compose(p, Q.setFromEuler(E.set(0, rnd()*6.3, 0)), new V3(ps, ps*rr(.7, 1), ps*rr(.8, 1.3))); pm.setMatrixAt(i, M4); pm.setColorAt(i, new THREE.Color().setHSL(rr(.05, .1), .45, rr(.25, .42))); });
  const cm = hot(new THREE.InstancedMesh(capGeo('convex'), new THREE.MeshStandardMaterial({map: CAP_TEX, bumpMap: CAP_TEX, bumpScale: 1.5, roughness:.5, side:THREE.DoubleSide}), caps.length), TEMP.fungus);
  const gm = hot(new THREE.InstancedMesh(gillGeo(), new THREE.MeshStandardMaterial({color:0xd8c8a8, map: GILL_TEX, roughness:.8, side:THREE.DoubleSide}), caps.length), TEMP.fungus);
  const sm = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(.006, .009, 1, 7).translate(0, .5, 0), new THREE.MeshStandardMaterial({color:0xe8dcc4, map: FIDDLE_TEX, roughness:.7}), caps.length), TEMP.fungus);
  caps.forEach((p, i) => { const h = rr(.15, .5), s = rr(.08, .22); M4.compose(p, Q.identity(), new V3(4, h, 4)); sm.setMatrixAt(i, M4);   // caps 5–13 mm
    M4.compose(p.clone().add(new V3(0, h, 0)), Q.setFromEuler(E.set(rr(-.2, .2), rnd()*6.3, rr(-.2, .2))), new V3(s, s*rr(.6, .9), s)); cm.setMatrixAt(i, M4); gm.setMatrixAt(i, M4);
    cm.setColorAt(i, new THREE.Color().setHSL(rr(.04, .09), rr(.35, .6), rr(.42, .62))); });
  scene.add(lm, fm, pm, cm, gm, sm);
}

// ---- hanging vines with small heart leaves, dropping from the canopy into the play area
{
  const vm = new THREE.MeshStandardMaterial({color:0x4a5a2a, roughness:.8}), leaves = [];
  for(let i = 0; i < 40; i++){
    const [x, z] = scatter(22*AK, 2), top = rr(140, 240), bottom = hAt(x, z) + rr(2, 12), pts = [];       // threads 2–4 mm thick, from 5 m up
    for(let k = 0; k <= 14; k++){ const t = k/14; pts.push(new V3(x + Math.sin(t*5 + i)*2*t, top - t*(top - bottom), z + Math.cos(t*4 + i)*2*t)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    scene.add(hot(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, rr(.03, .07), 5), vm), TEMP.liana));
    for(let t = .8; t < 1; t += rr(.004, .009)) leaves.push([curve.getPoint(t), rnd()*6.3]);
  }
  const lg = leafGeo('heart', .05, .08, .3, .1, 4, 8), lm = hot(new THREE.InstancedMesh(lg, leafMat(0x5d8f34, {amp: .3}), leaves.length), TEMP.leaf), c = new THREE.Color();
  leaves.forEach(([p, yaw], i) => { const s = rr(.7, 1.6)*8; M4.compose(p, Q.setFromEuler(E.set(rr(.6, 1.3), yaw, 0, 'YXZ')), new V3(s, s, s)); lm.setMatrixAt(i, M4); c.setHSL(rr(.23, .3), .55, rr(.24, .36)); lm.setColorAt(i, c); });
  lm.castShadow = true; scene.add(lm);
}

// ---- more grass, greener, in the light gaps
{
  const g = new THREE.ConeGeometry(.008, 1, 3).translate(0, .5, 0), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) + y*y*.3); }
  g.computeVertexNormals();
  const n = 3000, im = hot(new THREE.InstancedMesh(g, sway(new THREE.MeshStandardMaterial({roughness:.7}), .09, 1.9), n), TEMP.grass), c = new THREE.Color(); let k = 0;
  while(k < n){ const [cx, cz] = scatter(26*AK, 2), m = 10 + Math.floor(rnd()*18); if(nearPlat(cx, cz, 1.2)) continue;
    for(let j = 0; j < m && k < n; j++, k++){ const x = cx + rr(-1, 1), z = cz + rr(-1, 1), h = rr(1, 7), w = 1.5 + h*.6;
      im.setMatrixAt(k, onGround(x, z, -.01, rnd()*6.3, new V3(w, h, w), .35)); c.setHSL(rr(.2, .29), rr(.5, .75), rr(.24, .4)); im.setColorAt(k, c); } }
  im.receiveShadow = true; scene.add(im);
}
plantGrassTufts();

// ---- dew: droplets beaded on the walkable leaves and the moss, catching the sun
{
  const spots = [];
  for(const p of PLAT) if(p.kind === 'leaf') for(let j = 0; j < 26; j++){ const q = randomIn(p, .05); q.y = surfAt(p, q.x, q.z) + .008; spots.push([q, rr(.015, .045)]); }   // beads 1–3 mm
  for(let j = 0; j < 260; j++){ const [pos, s] = MOSS_SPOTS[Math.floor(rnd()*MOSS_SPOTS.length)]; const a = rnd()*6.28; spots.push([pos.clone().add(new V3(Math.cos(a)*s*.5, s*.4, Math.sin(a)*s*.5)), rr(.015, .035)]); }
  // water, not pearls: clear in the middle (the leaf shows through, a touch darker and greener), a dark refracting rim,
  // one hard pinpoint highlight up toward the sun and the light it focuses glowing low on the far side
  const dropM = new THREE.MeshStandardMaterial({color:0x5f7f58, roughness:.03, metalness:0, transparent:true, depthWrite:false});
  dropM.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
    { vec3 nV = normalize(normal), vV = normalize(vViewPosition); float fr = pow(1. - clamp(abs(dot(nV, vV)), 0., 1.), 1.6);
      float hi = smoothstep(.955, .985, dot(nV, normalize(vec3(-.45, .65, .62)))), hi2 = smoothstep(.988, .996, dot(nV, normalize(vec3(.35, .5, .8))))*.35;
      float caus = smoothstep(.55, .95, dot(nV, normalize(vec3(.4, -.75, .55))));
      gl_FragColor.rgb = gl_FragColor.rgb*(.55 + .2*(1. - fr)) + vec3(.75, .95, .6)*caus*.35 - vec3(.12, .1, .08)*fr + vec3(1.)*(hi + hi2)*1.6;
      gl_FragColor.a = clamp(.12 + .6*fr + caus*.25 + hi + hi2, 0., 1.); }`); };
  dropM.customProgramCacheKey = () => 'dewdrop';
  const dm = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI*2, 0, Math.PI*.62), dropM, spots.length), TEMP.leaf);   // a bead sitting on the surface: the base cut flat
  spots.forEach(([p, s], i) => { M4.compose(p.clone().add(new V3(0, -s*.25, 0)), Q.identity(), new V3(s, s*.7, s)); dm.setMatrixAt(i, M4); });
  dm.renderOrder = 2;
  scene.add(dm);
}

// ---- atmosphere (not part of the senses buffer: hidden from the position/heat pass)
const ATMO = new THREE.Group(); scene.add(ATMO);
{
  // light shafts from the canopy gaps, along the sun's direction, landing on bright patches the sun map leaves there
  const sunDir = SUN.position.clone().sub(SUN.target.position).normalize();
  const shaftM = new THREE.ShaderMaterial({uniforms:{uT: WORLD_T}, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false,
    vertexShader:`varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position, 1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform float uT; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float e = pow(abs(dot(vN, vV)), 2.2), along = smoothstep(0., .08, vUv.y)*smoothstep(1., .45, vUv.y);
        float flick = .8 + .2*sin(uT*.7 + vUv.x*25.)*sin(uT*.4 + vUv.y*9.);
        gl_FragColor = vec4(vec3(1., .95, .78)*e*along*flick*.075, 1.); }`});
  for(const [x, z, r] of SHAFTS){
    const L = 190, g = new THREE.CylinderGeometry(r, r*1.6, L, 20, 1, true).translate(0, L/2, 0);   // from the canopy gap ~6 m up
    const m = new THREE.Mesh(g, shaftM); m.position.set(x, hAt(x, z) - .1, z); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), sunDir); ATMO.add(m);
  }
  // pollen and dust motes drifting in the air, glinting
  const PN = 3200, pp = new Float32Array(PN*3), ph = new Float32Array(PN);
  for(let i = 0; i < PN; i++){ const [x, z] = scatter(26*AK); pp[i*3] = x; pp[i*3 + 1] = hAt(x, z) + rr(.1, 30)*rr(.2, 1); pp[i*3 + 2] = z; ph[i] = rnd()*100; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const pollen = new THREE.Points(pg, new THREE.ShaderMaterial({uniforms:{uT: WORLD_T}, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aPh; uniform float uT; varying float vA;
      void main(){ vec3 p = position + vec3(sin(uT*.13 + aPh)*1.2, sin(uT*.09 + aPh*1.7)*.7 + fract(uT*.004 + aPh*.01)*.6, cos(uT*.11 + aPh*1.3)*1.2);
        vec4 mv = modelViewMatrix*vec4(p, 1.); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(5./-mv.z, 1., 4.);
        vA = (.35 + .65*pow(.5 + .5*sin(uT*2.3 + aPh*7.), 6.))*smoothstep(24., 3., -mv.z); }`,
    fragmentShader:`varying float vA; void main(){ vec2 q = gl_PointCoord*2. - 1.; float r = dot(q, q); if(r > 1.) discard; gl_FragColor = vec4(vec3(1., .96, .82)*vA*(1. - r)*.8, 1.); }`}));
  pollen.frustumCulled = false; ATMO.add(pollen);
  // gnat swarms dancing in the light
  const GN = 60, gp = new Float32Array(GN*3), gph = new Float32Array(GN);
  for(let i = 0; i < GN; i++){ const sw = Math.floor(i/15), [x, z] = [[1.5, 2.5], [-3, -1.5], [4, -3], [-1, 4.5]][sw]; gp[i*3] = x; gp[i*3 + 1] = hAt(x, z) + 4 + sw*1.2; gp[i*3 + 2] = z; gph[i] = rnd()*100; }   // swarms ~15 cm up, ~15 cm across
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('aPh', new THREE.BufferAttribute(gph, 1));
  const gnats = new THREE.Points(gg, new THREE.ShaderMaterial({uniforms:{uT: WORLD_T}, transparent:true, depthWrite:false,
    vertexShader:`attribute float aPh; uniform float uT;
      void main(){ vec3 p = position + vec3(sin(uT*3.1 + aPh)*1.4 + sin(uT*7.3 + aPh*2.)*.25, sin(uT*2.3 + aPh*1.4)*1., cos(uT*2.7 + aPh*.8)*1.4);
        vec4 mv = modelViewMatrix*vec4(p, 1.); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(9./-mv.z, 1.5, 4.); }`,
    fragmentShader:`void main(){ vec2 q = gl_PointCoord*2. - 1.; if(dot(q, q) > 1.) discard; gl_FragColor = vec4(.08, .07, .05, .9); }`}));
  gnats.frustumCulled = false; ATMO.add(gnats);
}
// water dripping from leaf tips, with a small splash ring
const DRIPS = [];
{
  const dropG = new THREE.SphereGeometry(.05, 10, 8), dropM = new THREE.MeshStandardMaterial({color:0xdff2ff, roughness:.05, transparent:true, opacity:.75, emissive:0x101a20});
  const ringM = new THREE.MeshBasicMaterial({color:0xcfe6f0, transparent:true, opacity:.6, side:THREE.DoubleSide, depthWrite:false});
  for(const p of PLAT.filter(q => q.kind === 'leaf').slice(0, 9)){
    const c = Math.cos(p.rot), s = Math.sin(p.rot), tip = new V3(p.x - p.rz*.95*s, 0, p.z - p.rz*.95*c); tip.y = surfAt(p, tip.x, tip.z) - .02;
    const drop = new THREE.Mesh(dropG, dropM), ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 24).rotateX(-Math.PI/2), ringM.clone());
    ATMO.add(drop, ring); DRIPS.push({tip, drop, ring, t: rr(0, 4), period: rr(2.5, 6), y: tip.y, v: 0, ground: hAt(tip.x, tip.z), splash: -1});
  }
}
function updateJungle(dt){
  WORLD_T.value += dt;
  for(const d of DRIPS){
    d.t += dt;
    if(d.t < d.period){ const g = Math.min(1, d.t/d.period); d.drop.position.copy(d.tip); d.drop.scale.setScalar(.4 + .8*g); d.drop.scale.y *= 1 + .5*g; d.y = d.tip.y; d.v = 0; }
    else { d.v += 120*dt; d.y -= d.v*dt;                                               // (true g is ~330 units/s²; a little slowed so the fall reads) d.drop.position.set(d.tip.x, d.y, d.tip.z);
      if(d.y <= d.ground){ d.t = 0; d.period = rr(2.5, 6); d.splash = 0; } }
    if(d.splash >= 0){ d.splash += dt; const k = d.splash/.6; d.ring.position.set(d.tip.x, d.ground + .008, d.tip.z); d.ring.scale.setScalar(.04 + k*.5); d.ring.material.opacity = .6*(1 - k); d.ring.visible = k < 1; if(k >= 1) d.splash = -1; }
    else d.ring.visible = false;
  }
}


// light gaps: where each shaft lands, the sun map gets a large bright opening (projected through the sun's own camera)
{
  SUN.updateMatrixWorld(); SUN.target.updateMatrixWorld(); SUN.shadow.updateMatrices(SUN);
  const cam = SUN.shadow.camera, x = DAPPLE.userData.canvas.getContext('2d'), W = 512;
  for(const [sx, sz, r] of SHAFTS){
    const p = new V3(sx, hAt(sx, sz), sz).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    const u = (p.x*.5 + .5)*W, v = (1 - (p.y*.5 + .5))*W, rp = r*W/(2*Math.tan(SUN.angle)*SUN.position.length())*1.7;
    const g = x.createRadialGradient(u, v, 0, u, v, rp); g.addColorStop(0, 'rgba(255,250,232,1)'); g.addColorStop(.6, 'rgba(255,246,222,.9)'); g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g; x.beginPath(); x.arc(u, v, rp, 0, 6.283); x.fill();
  }
  DAPPLE.needsUpdate = true;
}
