'use strict';
// scene, lighting, procedural textures, terrain, walkable surfaces and platforms

/* =====================================================================
   WORLD — a rainforest floor at spider scale (1 unit ≈ 3 body lengths)
   ===================================================================== */
const scene = new THREE.Scene();
const BGC = new THREE.Color(0xb7cbb2);                     // misty, backlit canopy haze
scene.background = BGC;
const FOG_STRETCH = 4.4;                                       // fog reach vs the old 1:1 floor (27 → ~120 units, ~3.5 m)
const FOG = new THREE.Fog(0x8ea78c, 4, 120); scene.fog = FOG;   // humid green haze: giant trunks tens of units off fade to silhouettes
const camera = new THREE.PerspectiveCamera(55, 1, 0.03, 1500);

// rainforest light: a green skylight fill that leaves the interior dim, and a warm high sun that only gets through
// the canopy in flecks and patches (a spotlight projecting a canopy-gap map), plus filmic tone mapping
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
scene.add(new THREE.HemisphereLight(0xcfe3c0, 0x2a2416, 1.05));
const WORLD_T = {value: 0};
const WIND_U = {value: new THREE.Vector3(1, 0, .5)};   // (dir.x, dir.z, strength): shared by the air sense and the swaying plants
let texSeed = 7; const trnd = () => (texSeed = (texSeed*16807) % 2147483647)/2147483647;
function canvasTex(w, h, draw, rep){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if(rep) t.repeat.set(rep[0], rep[1]); t.userData.canvas = c; return t;
}
const ANTI_GLSL = `
float athash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float atnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(athash(i), athash(i + vec2(1, 0)), f.x), mix(athash(i + vec2(0, 1)), athash(i + vec2(1, 1)), f.x), f.y); }`;
function antiTile(mat){
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + ANTI_GLSL).replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 uA = vMapUv, uB = vMapUv*.47 + vec2(.37, .19), uC = vMapUv*1.63 + vec2(.71, .53);
  float nA = atnoise(vMapUv*.31), nB = atnoise(vMapUv*.83 + 7.3);
  vec4 tA = texture2D(map, uA), tB = texture2D(map, uB), tC = texture2D(map, uC);
  vec4 sampledDiffuseColor = mix(mix(tA, tB, smoothstep(.3, .7, nA)), tC, smoothstep(.5, .85, nB)*.55);
  sampledDiffuseColor.rgb *= .88 + .24*atnoise(vMapUv*.13 + 3.1);
  diffuseColor *= sampledDiffuseColor;
#endif`);
  };
  mat.customProgramCacheKey = () => 'antitile'; return mat;
}
// sun flecks: mostly canopy shade with some leak, bright flecks, and big gaps where the light shafts land (drawn later)
const DAPPLE = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#2e3024'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 110; i++){ const px = trnd()*w, py = trnd()*h, r = 4 + trnd()*30, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,248,226,1)'); g.addColorStop(.55, 'rgba(255,240,205,.7)'); g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r, r*(.5 + trnd()*.5), trnd()*3, 0, 6.283); x.fill(); }
});
DAPPLE.wrapS = DAPPLE.wrapT = THREE.ClampToEdgeWrapping;
const SUN = new THREE.SpotLight(0xfff0d4, 6, 0, .27, .3, 0);
SUN.position.set(42, 138, 27); SUN.target.position.set(0, 0, 0); scene.add(SUN, SUN.target);   // high above the floor, so birds and crowns cast shadows too
SUN.castShadow = true; SUN.shadow.mapSize.set(3072, 3072); SUN.shadow.camera.near = 70; SUN.shadow.camera.far = 220;
SUN.shadow.bias = -0.0004; SUN.shadow.radius = 4; SUN.map = DAPPLE;
const sun = SUN;
const SHAFTS = [[.6, 1.6, 2.2], [-3.4, -2.1, 3], [4.2, -3.4, 2.4], [-1.6, 5.2, 2.2], [7.2, 1.1, 2.8], [-6.2, 2.6, 2.4], [2.4, 7.4, 2], [-14, -9, 3.5], [15, 12, 3], [-25, 17, 3.5], [27, -15, 3.2], [9, -30, 3], [-10, 31, 3.2], [33, 21, 2.8]];
// swaying vegetation: displaces vertices by height in the material's vertex stage. Everything leans downwind with the
// shared wind; gust fronts roll across the floor along the wind (warped crosswise, so neighbours move nearly but not
// exactly together), plus a small per-plant flutter.
function sway(mat, amp, freq = 1.6){
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWT = WORLD_T; sh.uniforms.uWD = WIND_U;
    sh.vertexShader = 'uniform float uWT; uniform vec3 uWD;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { mat3 bm = mat3(modelMatrix); vec3 wo = modelMatrix[3].xyz;
      #ifdef USE_INSTANCING
        wo += (modelMatrix*vec4(instanceMatrix[3].xyz, 0.)).xyz; bm = bm*mat3(instanceMatrix);
      #endif
        vec2 wd = normalize(uWD.xy + 1e-5), wc = vec2(-wd.y, wd.x);
        float along = dot(wo.xz, wd), across = dot(wo.xz, wc), ph = wo.x*1.3 + wo.z*.9;
        float front = .5 + .5*sin(along*.45 - uWT*1.3 + sin(across*.3 + uWT*.2)*1.6);      // gusts travelling downwind
        float eddy = .5 + .5*sin(along*1.7 + across*1.1 - uWT*2.4);                           // finer air-current ripples
        float bend = uWD.z*(.25 + .5*front + .25*eddy)*(.85 + .3*sin(ph));
        float fl = sin(uWT*${freq.toFixed(2)} + ph)*(.06 + .1*uWD.z);                         // each plant's own flutter
        vec2 d = (wd*(bend + fl) + wc*sin(uWT*${(freq*1.3).toFixed(2)} + ph*1.7)*.05*uWD.z)*${(amp*.55).toFixed(4)}*dot(position, position);
        vec3 ld = inverse(bm)*vec3(d.x, 0., d.y);                                            // world wind -> this plant's local frame
        transformed += ld*(length(d)/max(length(ld), 1e-5)); }`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp + '_' + freq;
  return mat;
}
const glowLeaf = (m, k = .26) => { m.emissive = (m.color ? m.color.clone() : new THREE.Color(0x4a7a2a)).multiplyScalar(k); m.emissiveMap = m.map || null; return m; };
// bark: fissured, lichen-spotted, mossy
// draw a shape at all its wrap-around copies, so a texture tiles without seams
const wrap9 = (w, h, fn) => { for(const ox of [-w, 0, w]) for(const oy of [-h, 0, h]) fn(ox, oy); };
const barkDraw = (x, w, h) => {
  x.fillStyle = '#c9b8a0'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 16000; i++){ const v = 150 + trnd()*80; x.fillStyle = `rgba(${v},${v*.9},${v*.78},.25)`; x.fillRect(trnd()*w, trnd()*h, 2, 2); }
  for(let i = 0; i < 900; i++){                                                     // fissures: long, wandering, of every width
    const pts = []; let px = trnd()*w, py = trnd()*h; const L = 20 + trnd()*200, wd = .5 + trnd()*3.6, n = 8 + Math.floor(trnd()*6);
    for(let k = 0; k <= n; k++){ pts.push([px, py]); px += (trnd() - .5)*6; py += L/n; }
    x.strokeStyle = `rgba(${45 + trnd()*30},${34 + trnd()*20},${26 + trnd()*14},${.35 + trnd()*.5})`; x.lineWidth = wd;
    wrap9(w, h, (ox, oy) => { x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a + ox, b + oy) : x.moveTo(a + ox, b + oy)); x.stroke(); }); }
  for(let i = 0; i < 260; i++){ const c = trnd() < .6 ? `rgba(214,226,190,${.3 + trnd()*.4})` : `rgba(96,140,58,${.3 + trnd()*.35})`,
    ex = trnd()*w, ey = trnd()*h, rx = 2 + trnd()*12, ry = 2 + trnd()*8, rot = trnd()*3;
    x.fillStyle = c; wrap9(w, h, (ox, oy) => { x.beginPath(); x.ellipse(ex + ox, ey + oy, rx, ry, rot, 0, 6.283); x.fill(); }); }
};
const BARK_TEX = canvasTex(512, 512, barkDraw, [3, 13]);
const BARK_TEX_S = canvasTex(512, 512, barkDraw, [2, 1.2]);
const BARK_ROOT_M = antiTile(new THREE.MeshStandardMaterial({color:0x8a7258, map: BARK_TEX_S, bumpMap: BARK_TEX_S, bumpScale: 1.5, roughness:.95}));
// leaves: pale midrib and lateral veins, darker margins, a few blemishes (multiplied by each leaf's own green)
// stone: granular grey with darker flecks, fine cracks and pale lichen rosettes
const STONE_TEX = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#d4d0c8'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 14000; i++){ const v = 120 + trnd()*135; x.fillStyle = `rgba(${v},${v*.98},${v*.94},.35)`; x.fillRect(trnd()*w, trnd()*h, 1 + trnd()*1.5, 1 + trnd()*1.5); }
  x.strokeStyle = 'rgba(60,56,50,.55)';
  for(let i = 0; i < 26; i++){ const pts = []; let px = trnd()*w, py = trnd()*h; for(let k = 0; k <= 7; k++){ pts.push([px, py]); px += (trnd() - .5)*22; py += (trnd() - .3)*18; }
    x.lineWidth = .5 + trnd(); wrap9(w, h, (ox, oy) => { x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a + ox, b + oy) : x.moveTo(a + ox, b + oy)); x.stroke(); }); }
  for(let i = 0; i < 40; i++){ const px = trnd()*w, py = trnd()*h, r = 3 + trnd()*11; x.fillStyle = trnd() < .7 ? `rgba(220,226,200,${.35 + trnd()*.3})` : `rgba(200,180,90,${.3 + trnd()*.3})`;
    wrap9(w, h, (ox, oy) => { x.beginPath(); x.arc(px + ox, py + oy, r, 0, 6.283); x.fill(); }); }
}, [3, 2]);
// soil: crumbly humus, pale grains, dark wet crumbs, fine root threads and tiny pebbles (seamless)
const SOIL_TEX = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#bdb3a2'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 26000; i++){ const v = 90 + trnd()*165, r = 1 + trnd()*2.5; x.fillStyle = `rgba(${v},${v*.93},${v*.84},${.25 + trnd()*.35})`;
    x.fillRect(trnd()*w, trnd()*h, r, r); }
  for(let i = 0; i < 600; i++){ const px = trnd()*w, py = trnd()*h, r = 1.5 + trnd()*5, v = trnd() < .5 ? 60 + trnd()*40 : 200 + trnd()*50;
    x.fillStyle = `rgba(${v},${v*.92},${v*.82},${.35 + trnd()*.4})`; wrap9(w, h, (ox, oy) => { x.beginPath(); x.ellipse(px + ox, py + oy, r, r*(.5 + trnd()*.5), trnd()*3, 0, 6.283); x.fill(); }); }
  for(let i = 0; i < 90; i++){ const pts = []; let px = trnd()*w, py = trnd()*h, a = trnd()*6.28; for(let k = 0; k <= 10; k++){ pts.push([px, py]); a += (trnd() - .5)*.8; px += Math.cos(a)*6; py += Math.sin(a)*6; }
    x.strokeStyle = `rgba(${120 + trnd()*60},${90 + trnd()*40},${60 + trnd()*30},.5)`; x.lineWidth = .6 + trnd()*.8;
    wrap9(w, h, (ox, oy) => { x.beginPath(); pts.forEach(([a2, b2], k) => k ? x.lineTo(a2 + ox, b2 + oy) : x.moveTo(a2 + ox, b2 + oy)); x.stroke(); }); }
}, [36, 36]);
// leaves: mottled blade, a net of fine veins between the laterals, pale midrib, darker margins, fungal spots with
// yellow halos and the odd leaf-miner trail (all near-white: multiplied by each leaf's own green)
const LEAF_TEX = canvasTex(256, 512, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#9a9a90'); g.addColorStop(.14, '#d2d4c8'); g.addColorStop(.5, '#eef0e6'); g.addColorStop(.86, '#d2d4c8'); g.addColorStop(1, '#9a9a90');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 260; i++){ const px = trnd()*w, py = trnd()*h, r = 8 + trnd()*40, v = trnd() < .5 ? 255 : 120, gr = x.createRadialGradient(px, py, 0, px, py, r);   // soft mottling
    gr.addColorStop(0, `rgba(${v},${v},${v*.92},.09)`); gr.addColorStop(1, `rgba(${v},${v},${v*.92},0)`); x.fillStyle = gr; x.fillRect(px - r, py - r, 2*r, 2*r); }
  for(let i = 0; i < 9000; i++){ const v = 170 + trnd()*85; x.fillStyle = `rgba(${v},${v},${v*.95},.16)`; x.fillRect(trnd()*w, trnd()*h, 1 + trnd()*1.5, 1 + trnd()*1.5); }
  // areoles: a jittered grid of points joined into a fine, slightly sunken vein net
  const GX = 22, GY = 44, P = [];
  for(let j = 0; j <= GY; j++) for(let i = 0; i <= GX; i++) P.push([i/GX*w + (trnd() - .5)*w/GX*.8, j/GY*h + (trnd() - .5)*h/GY*.8]);
  x.lineWidth = .8; x.strokeStyle = 'rgba(255,255,240,.32)';
  for(let j = 0; j <= GY; j++) for(let i = 0; i <= GX; i++){ const a = P[j*(GX + 1) + i];
    if(i < GX && trnd() < .8){ const b = P[j*(GX + 1) + i + 1]; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    if(j < GY && trnd() < .8){ const b = P[(j + 1)*(GX + 1) + i]; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); } }
  for(let k = 0; k < P.length; k += 2){ const [a, b] = P[k], gr = x.createRadialGradient(a + 5, b + 5, 0, a + 5, b + 5, 6);   // the shaded floor of each little cell
    gr.addColorStop(0, 'rgba(70,74,50,.14)'); gr.addColorStop(1, 'rgba(70,74,50,0)'); x.fillStyle = gr; x.fillRect(a - 1, b - 1, 12, 12); }
  // midrib and arching laterals, each throwing off a few secondary veins
  x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.beginPath(); x.moveTo(w/2, 0); x.lineTo(w/2, h); x.stroke();
  x.strokeStyle = 'rgba(90,90,60,.35)'; x.lineWidth = 1.2; for(const s of [-1, 1]){ x.beginPath(); x.moveTo(w/2 + s*3.2, 0); x.lineTo(w/2 + s*3.2, h); x.stroke(); }
  for(let k = 1; k < 13; k++){ const y = h - k*h/13.5 + (trnd() - .5)*8;
    for(const sd of [-1, 1]){ const ex = w/2 + sd*w*.48, ey = y - 70 - trnd()*10;
      x.lineWidth = 2.6; x.strokeStyle = 'rgba(255,255,250,.9)'; x.beginPath(); x.moveTo(w/2, y); x.quadraticCurveTo(w/2 + sd*w*.24, y - 18, ex, ey); x.stroke();
      x.lineWidth = 1; x.strokeStyle = 'rgba(80,84,56,.3)'; x.beginPath(); x.moveTo(w/2, y + 3); x.quadraticCurveTo(w/2 + sd*w*.24, y - 15, ex, ey + 3); x.stroke();
      for(let q = 0; q < 3; q++){ const t = .3 + q*.22, px = w/2 + sd*w*.24*2*t*(1 - t) + (ex - w/2)*t*t, py = y*(1 - t)*(1 - t) + (y - 18)*2*t*(1 - t) + ey*t*t;
        x.lineWidth = 1.1; x.strokeStyle = 'rgba(255,255,240,.55)'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + sd*8, py + 14, px + sd*4, py + 30 + trnd()*14); x.stroke(); } } }
  // blemishes: brown fungal spots with a yellow halo, small dark specks, a pale leaf-miner trail or two
  for(let i = 0; i < 14; i++){ const px = trnd()*w, py = trnd()*h, r = 2 + trnd()*7, gr = x.createRadialGradient(px, py, 0, px, py, r*2.4);
    gr.addColorStop(0, 'rgba(110,80,40,.75)'); gr.addColorStop(.4, 'rgba(140,110,50,.55)'); gr.addColorStop(.55, 'rgba(255,245,140,.35)'); gr.addColorStop(1, 'rgba(255,245,140,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, r*2.4, 0, 6.283); x.fill(); }
  for(let i = 0; i < 60; i++){ x.fillStyle = `rgba(60,55,35,${.2 + trnd()*.3})`; x.beginPath(); x.arc(trnd()*w, trnd()*h, .6 + trnd()*1.4, 0, 6.283); x.fill(); }
  for(let i = 0; i < 2; i++){ let px = w*(.2 + trnd()*.6), py = h*(.2 + trnd()*.6), a = trnd()*6.28; x.beginPath(); x.moveTo(px, py);
    for(let k = 0; k < 40; k++){ a += (trnd() - .5)*1.4; px += Math.cos(a)*4; py += Math.sin(a)*4; x.lineTo(px, py); x.lineWidth = .8 + k*.06; }
    x.strokeStyle = 'rgba(255,255,230,.6)'; x.stroke(); }
}, [1, 1]);
// mushroom caps (lathe UVs: u round the cap, v from the centre out to the rim): radial fibrils, a dark umbo,
// striations near a paler margin and a few scurfy scales
const CAP_TEX = canvasTex(512, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6a5a48'); g.addColorStop(.18, '#a89478'); g.addColorStop(.6, '#d8c8ae'); g.addColorStop(.9, '#efe4cc'); g.addColorStop(1, '#c8b89c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 1400; i++){ const px = trnd()*w, y0 = trnd()*h*.7, L = 20 + trnd()*h*.6, v = trnd() < .5 ? 70 + trnd()*50 : 220 + trnd()*35;   // fibrils
    x.strokeStyle = `rgba(${v},${v*.9},${v*.78},${.12 + trnd()*.18})`; x.lineWidth = .6 + trnd()*1.4;
    for(const ox of [-w, 0, w]){ x.beginPath(); x.moveTo(px + ox, y0); x.lineTo(px + ox + (trnd() - .5)*4, y0 + L); x.stroke(); } }
  for(let i = 0; i < 64; i++){ const px = (i + trnd()*.4)/64*w; x.strokeStyle = `rgba(70,55,40,${.25 + trnd()*.25})`; x.lineWidth = 1.5 + trnd()*1.5;   // striate margin
    x.beginPath(); x.moveTo(px, h*(.62 + trnd()*.1)); x.lineTo(px, h); x.stroke(); }
  for(let i = 0; i < 160; i++){ const px = trnd()*w, py = trnd()*trnd()*h*.6, r = .8 + trnd()*2.6;   // scales, crowded at the centre
    x.fillStyle = `rgba(${trnd() < .5 ? '60,45,30' : '235,225,200'},${.3 + trnd()*.4})`; x.beginPath(); x.ellipse(px, py, r*1.6, r, 0, 0, 6.283); x.fill(); }
  for(let i = 0; i < 30; i++){ x.fillStyle = 'rgba(255,250,235,.25)'; x.beginPath(); x.arc(trnd()*w, h*(.3 + trnd()*.5), 3 + trnd()*8, 0, 6.283); x.fill(); }   // damp sheen
}, [1, 1]);
// gills under the cap: crowded blades, long and short alternating, shading into the stem
const GILL_TEX = canvasTex(512, 64, (x, w, h) => {
  x.fillStyle = '#d6c9b0'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 128; i++){ const px = i/128*w, long = i % 2 === 0; x.fillStyle = 'rgba(70,55,40,.55)'; x.fillRect(px, 0, 1.6, long ? h : h*.55);
    x.fillStyle = 'rgba(255,248,232,.5)'; x.fillRect(px + 1.6, 0, 1, long ? h : h*.55); }
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,.5)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
}, [1, 1]);
// bracket fungi: concentric growth zones round the point of attachment, a pale growing margin, fine radial hairs
const ZONE_TEX = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#efe6d6'; x.fillRect(0, 0, w, h);
  for(let r = 128; r > 2; r -= 3 + trnd()*7){ const v = 120 + trnd()*120; x.strokeStyle = `rgba(${v},${v*.82},${v*.62},.75)`; x.lineWidth = 2 + trnd()*4;
    x.beginPath(); for(let k = 0; k <= 64; k++){ const a = k/64*6.283, rr2 = r*(1 + .04*Math.sin(a*5 + r)); k ? x.lineTo(128 + Math.cos(a)*rr2, 128 + Math.sin(a)*rr2) : x.moveTo(128 + Math.cos(a)*rr2, 128 + Math.sin(a)*rr2); } x.stroke(); }
  for(let i = 0; i < 900; i++){ const a = trnd()*6.283, r0 = trnd()*120; x.strokeStyle = `rgba(80,60,40,${.08 + trnd()*.1})`; x.lineWidth = .7;
    x.beginPath(); x.moveTo(128 + Math.cos(a)*r0, 128 + Math.sin(a)*r0); x.lineTo(128 + Math.cos(a)*(r0 + 8), 128 + Math.sin(a)*(r0 + 8)); x.stroke(); }
}, [1, 1]);
// twigs and roots: lengthwise grain, pale lenticels, bud scars and leaf nodes, peeling flakes and lichen.
// along = which texture axis runs down the length (v for a cylinder, u for a tube)
const twigDraw = along => (x, W, H) => {
  if(along === 'u'){ x.setTransform(0, 1, -1, 0, W, 0); [W, H] = [H, W]; }       // draw as if v ran along, then turn it
  const w = W, h = H;
  x.fillStyle = '#c4b49c'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 700; i++){ const px = trnd()*w, y0 = trnd()*h, L = 20 + trnd()*120, v = trnd() < .55 ? 80 + trnd()*60 : 200 + trnd()*50;   // grain
    x.strokeStyle = `rgba(${v},${v*.88},${v*.74},${.2 + trnd()*.3})`; x.lineWidth = .5 + trnd()*1.6;
    for(const ox of [-w, 0, w]) for(const oy of [-h, 0, h]){ x.beginPath(); x.moveTo(px + ox, y0 + oy); x.lineTo(px + ox + (trnd() - .5)*3, y0 + L + oy); x.stroke(); } }
  for(let i = 0; i < 90; i++){ const px = trnd()*w, py = trnd()*h; x.fillStyle = `rgba(235,225,195,${.5 + trnd()*.3})`;   // lenticels
    for(const ox of [-w, 0, w]) x.fillRect(px + ox, py, 3 + trnd()*5, 1.2); }
  for(let i = 0; i < 4; i++){ const py = trnd()*h, gr = x.createLinearGradient(0, py - 6, 0, py + 6);                       // nodes
    gr.addColorStop(0, 'rgba(50,38,26,0)'); gr.addColorStop(.5, 'rgba(50,38,26,.6)'); gr.addColorStop(1, 'rgba(50,38,26,0)'); x.fillStyle = gr; x.fillRect(0, py - 6, w, 12);
    const bx = trnd()*w; x.fillStyle = 'rgba(40,28,18,.8)'; x.beginPath(); x.ellipse(bx, py, 5, 3.5, 0, 0, 6.283); x.fill(); }
  for(let i = 0; i < 20; i++){ const px = trnd()*w, py = trnd()*h, rw = 4 + trnd()*14, rh = 6 + trnd()*24;                       // peeling flakes
    x.fillStyle = `rgba(${trnd() < .5 ? '228,214,186' : '72,56,40'},${.35 + trnd()*.3})`; x.beginPath(); x.ellipse(px, py, rw, rh, (trnd() - .5)*.3, 0, 6.283); x.fill(); }
  for(let i = 0; i < 16; i++){ const px = trnd()*w, py = trnd()*h, r = 3 + trnd()*9; x.fillStyle = trnd() < .6 ? `rgba(200,214,170,${.45 + trnd()*.3})` : `rgba(110,150,60,${.4 + trnd()*.3})`;   // lichen and moss
    for(let k = 0; k < 7; k++){ x.beginPath(); x.arc(px + (trnd() - .5)*r, py + (trnd() - .5)*r, r*(.3 + trnd()*.4), 0, 6.283); x.fill(); } }
  x.setTransform(1, 0, 0, 1, 0, 0);
};
const TWIG_TEX = canvasTex(128, 512, twigDraw('v'), [1, 1]);
const ROOT_TEX = canvasTex(512, 128, twigDraw('u'), [6, 1]);
// moss cushions: a fine felt of tiny star-shaped leaflets, lighter at the tips, darker in the hollows
const MOSS_TEX = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#7a8a6a'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 2600; i++){ const px = trnd()*w, py = trnd()*h, r = 2 + trnd()*4, v = 150 + trnd()*105, a0 = trnd()*6.28;
    x.strokeStyle = `rgba(${v},${v},${v*.82},${.4 + trnd()*.4})`; x.lineWidth = .8;
    wrap9(w, h, (ox, oy) => { if(px + ox < -8 || px + ox > w + 8 || py + oy < -8 || py + oy > h + 8) return;
      x.beginPath(); for(let k = 0; k < 5; k++){ const a = a0 + k*1.2566; x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a)*r, py + oy + Math.sin(a)*r); } x.stroke(); }); }
  for(let i = 0; i < 400; i++){ x.fillStyle = `rgba(30,40,20,${.2 + trnd()*.3})`; x.beginPath(); x.arc(trnd()*w, trnd()*h, .8 + trnd()*1.8, 0, 6.283); x.fill(); }
}, [3, 3]);
// fern stalks and fiddleheads: green, scurfy with brown hair-scales that thicken on the coil
const FIDDLE_TEX = canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#e4ecd0'; x.fillRect(0, 0, w, h);
  for(let i = 0; i < 120; i++){ const px = trnd()*w; x.strokeStyle = `rgba(255,255,240,${.15 + trnd()*.2})`; x.lineWidth = .8; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
  for(let i = 0; i < 700; i++){ const py = Math.pow(trnd(), .6)*h, px = trnd()*w, a = trnd()*6.28, L = 2 + trnd()*4;   // more scales up the coil (v grows along it)
    x.strokeStyle = `rgba(${110 + trnd()*40},${70 + trnd()*30},${30 + trnd()*20},${.4 + trnd()*.4})`; x.lineWidth = 1 + trnd();
    for(const ox of [-w, 0, w]){ x.beginPath(); x.moveTo(px + ox, py); x.lineTo(px + ox + Math.cos(a)*L, py + Math.sin(a)*L); x.stroke(); } }
}, [1, 1]);
// mushroom caps as lathes (unit radius), listed rim → centre so the texture's dark umbo sits on top; the margin
// rolls under a little. Gills: a shallow cone from the stem out to just inside the margin.
const CAP_PROFILES = {convex: [[.94, -.09], [1, -.02], [.97, .08], [.88, .23], [.72, .39], [.5, .52], [.25, .6], [.001, .62]],
  bell: [[.95, -.05], [1, 0], [.9, .15], [.76, .34], [.58, .56], [.38, .76], [.18, .9], [.001, .95]]};
const capGeo = k => new THREE.LatheGeometry(CAP_PROFILES[k].map(([a, b]) => new THREE.Vector2(a, b)), 28);
const gillGeo = () => new THREE.LatheGeometry([[.1, .16], [.4, .1], [.7, .02], [.95, -.07]].map(([a, b]) => new THREE.Vector2(a, b)), 28);
// a fern crozier: a stalk rising stalkH, then rolling forward into a tightening logarithmic coil of radius R, its
// tube beaded where the furled leaflets press out (unit height; scale per instance)
function crozierGeo(stalkH, R, r0, {seg = 90, radial = 7} = {}){
  const pts = [];
  for(let k = 0; k < 5 && stalkH > 0; k++){ const t = k/5; pts.push(new V3(Math.sin(t*1.6)*.03*stalkH, t*stalkH, 0)); }
  const C = new V3(R, stalkH, 0), turns = 3.1*Math.PI;
  for(let k = 0; k <= 46; k++){ const th = k/46*turns, r = R*Math.exp(-.2*th); pts.push(new V3(C.x - Math.cos(th)*r, C.y + Math.sin(th)*r, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts), split = stalkH > 0 ? .35 : 0;
  return taperedTube(curve, t => t < split ? r0*(1 - .2*t/split) : r0*(1.25 - .75*(t - split)/(1 - split))*(1 + .22*Math.max(0, Math.sin((t - split)*90))), {seg, radial, capStart: true});
}


let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
const rr = (a, b) => a + rnd()*(b - a);
const OCCLUDERS = [];
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
const hot = (o, t) => { o.userData.temp = t; return o; };

/* ---------- terrain: rolling humus with flattened beds under the log and stones ---------- */
const hash2 = (x, z) => { const s = Math.sin(x*127.1 + z*311.7)*43758.5453; return s - Math.floor(s); };
function vnoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf*xf*(3 - 2*xf), v = zf*zf*(3 - 2*zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a)*u + (c - a)*v + (a - b - c + d)*u*v;
}
const ridge = (x, z) => 1 - Math.abs(vnoise(x, z)*2 - 1);
// AK: how much wider the play area is than it first was (the floor everyone walks is AREA units in radius); the near
// ring of giants is pushed out with it, the far ring a little less
const AK = 1.5, AREA = 30*AK;
const MOUNDS = Array.from({length:70}, (_, i) => [(hash2(i, 1.7) - .5)*40, (hash2(i, 9.3) - .5)*40, .35 + hash2(i, 4.4)*1.1, (hash2(i, 7.7) - .45)*.6]);
// the same hummocks out over the widened floor (only beyond the old one, so nothing near the middle moves)
for(let i = 0; i < 130; i++){ const x = (hash2(i, 31.7) - .5)*2*(AREA + 4), z = (hash2(i, 47.3) - .5)*2*(AREA + 4); if(Math.max(Math.abs(x), Math.abs(z)) > 21) MOUNDS.push([x, z, .35 + hash2(i, 14.4)*1.1, (hash2(i, 17.7) - .45)*.6]); }
// rugged forest floor: broad swells, ridged spurs, hummocks and pits, gravelly micro-relief
function rawH(x, z){
  let h = (vnoise(x*.1, z*.1) - .5)*1.7 + (ridge(x*.28 + 3, z*.28) - .6)*.6 + (vnoise(x*.7 + 7, z*.7) - .5)*.42
        + (vnoise(x*1.7, z*1.7 + 3) - .5)*.2 + (ridge(x*3.3, z*3.3 + 11) - .5)*.07 + (vnoise(x*7, z*7) - .5)*.035;
  for(const [mx, mz, r, a] of MOUNDS){ const d2 = ((x - mx)**2 + (z - mz)**2)/(r*r); if(d2 < 6) h += a*Math.exp(-d2); }
  h += broadH(x, z);
  for(const [mx, mz] of ANT_HILLS){ const d2 = ((x - mx)**2 + (z - mz)**2)/(ANT_HILL_R*ANT_HILL_R); if(d2 < 1) h += ANT_HILL_H*Math.pow(1 - d2, 1.6); }   // ant mounds (walkable soil)
  return h;
}
function broadH(x, z){ return (vnoise(x*.022 + 50, z*.022 - 20) - .5)*5; }            // the forest's broad rolls, metres across
const ANT_HILLS = [[-5.2, 4.6], [6.8, 4.4]], ANT_HILL_R = 2.2, ANT_HILL_H = .9;     // ~13 cm across, ~3 cm high
// trees at spider scale (1 unit ≈ 3 cm): rainforest giants 0.5–1.5 m thick looming at the edge of the floor and fading
// into the haze, plus two young trees (15–20 cm thick) close by to climb. [x, z, radius]
const TREE_LIST = [
  ...[[-24, -21, 11], [33, -4, 13], [5, -40, 16], [-9, 41, 12.5], [-47, 11, 18], [48, -24, 15], [35, 45, 12], [-42, -49, 20]].map(([x, z, r]) => [x*AK, z*AK, r]),
  ...[[86, 18, 22], [-22, -88, 25], [-88, -14, 21], [42, 92, 19], [96, -64, 26], [-70, 70, 24], [12, 110, 20]].map(([x, z, r]) => [x*1.3, z*1.3, r]),
  [-4.8, 13.2, 2.6], [14, 3, 3.2]];
const inTrunk = (x, z, m = 0) => TREE_LIST.some(([tx, tz, r]) => Math.hypot(x - tx, z - tz) < r*1.15 + m);
const LOG = {x:-1.2, z:6.2, ang:1.35, r:.62, len:9, sink:.45};   // sink: axis height above the soil in radii (half-buried in litter, so the overhang underneath is shallow)
const ROCKS = [{x:-6.2, z:-4.0, r:1.3, h:1.1}, {x:1.6, z:-1.6, r:.7, h:.45}];
const STUMPS = [{x:3.6, z:6.8, r:.7, h:1.2}, {x:7.6, z:-6.2, r:.9, h:1.6}, {x:-2.6, z:-6.6, r:.6, h:.9}];
const FLAT = [];
{ const ax = Math.sin(LOG.ang), az = Math.cos(LOG.ang), h = LOG.len/2;
  FLAT.push({seg:[LOG.x - ax*h, LOG.z - az*h, LOG.x + ax*h, LOG.z + az*h], r:LOG.r*1.1, level: rawH(LOG.x, LOG.z)});
  for(const k of [...ROCKS, ...STUMPS]) FLAT.push({seg:[k.x, k.z, k.x, k.z], r:k.r, level: rawH(k.x, k.z)}); }
function hAt(x, z){
  let h = rawH(x, z);
  for(const f of FLAT){
    const [ax, az, bx, bz] = f.seg, dx = bx - ax, dz = bz - az, L2 = dx*dx + dz*dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax)*dx + (z - az)*dz)/L2)) : 0;
    const d = Math.hypot(x - ax - dx*t, z - az - dz*t);
    const k = Math.max(0, Math.min(1, (f.r + 1.2 - d)/1.2)); h += (f.level - h)*k*k*(3 - 2*k)*.9;
  }
  return h;
}
// the floor as her legs feel it: the top of every dead leaf, fragment, curl and twig lying on the soil, baked into a
// height field (metres of litter over the soil) with gentle ramps up onto each piece, so she walks over the litter
// and never under it. hAt stays the bare soil (the scenery is built on it); floorAt is whichever is higher, soil or litter.
const LIT = {C: .05, R: AREA + 2, h: null}; LIT.N = Math.ceil(2*LIT.R/LIT.C) + 1; LIT.top = new Float32Array(LIT.N*LIT.N).fill(-1e9);
function litterBake(im){
  // (not added to OCCLUDERS: raycasting an InstancedMesh tests every instance, and the camera's march already stops
  // short of the litter through floorAt, which reads this baked height field)
  const {C, R, N, top} = LIT, g = im.geometry, P = g.attributes.position, nv = P.count, I = g.index ? g.index.array : null, nt = I ? I.length : nv;
  const w = new Float32Array(nv*3), M = new THREE.Matrix4(), v = new V3();
  for(let n = 0; n < im.count; n++){
    im.getMatrixAt(n, M); const e = M.elements; if(Math.abs(e[12]) > R + 3 || Math.abs(e[14]) > R + 3) continue;
    for(let i = 0; i < nv; i++){ v.fromBufferAttribute(P, i).applyMatrix4(M); const gx = (v.x + R)/C, gz = (v.z + R)/C; w[i*3] = gx; w[i*3 + 1] = v.y; w[i*3 + 2] = gz;
      const ix = Math.round(gx), iz = Math.round(gz); if(ix >= 0 && iz >= 0 && ix < N && iz < N && v.y > top[iz*N + ix]) top[iz*N + ix] = v.y; }
    for(let t = 0; t < nt; t += 3){
      const a = (I ? I[t] : t)*3, b = (I ? I[t + 1] : t + 1)*3, c = (I ? I[t + 2] : t + 2)*3;
      const ax = w[a], az = w[a + 2], bx = w[b], bz = w[b + 2], cx = w[c], cz = w[c + 2], d = (bz - cz)*(ax - cx) + (cx - bx)*(az - cz);
      if(Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.floor(Math.max(ax, bx, cx)));
      const z0 = Math.max(0, Math.ceil(Math.min(az, bz, cz))), z1 = Math.min(N - 1, Math.floor(Math.max(az, bz, cz)));
      for(let iz = z0; iz <= z1; iz++) for(let ix = x0; ix <= x1; ix++){
        const l1 = ((bz - cz)*(ix - cx) + (cx - bx)*(iz - cz))/d, l2 = ((cz - az)*(ix - cx) + (ax - cx)*(iz - cz))/d, l3 = 1 - l1 - l2;
        if(l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const y = l1*w[a + 1] + l2*w[b + 1] + l3*w[c + 1], k = iz*N + ix; if(y > top[k]) top[k] = y;
      }
    }
  }
}
function litterFinish(){
  const {C, R, N, top} = LIT, S = .25, M = Math.ceil(2*R/S) + 1, soil = new Float32Array(M*M), h = top;
  for(let j = 0; j < M; j++) for(let i = 0; i < M; i++) soil[j*M + i] = hAt(-R + i*S, -R + j*S);   // a coarse soil, for the ramps only
  Object.assign(LIT, {S, M, soil});
  for(let iz = 0; iz < N; iz++) for(let ix = 0; ix < N; ix++){ const k = iz*N + ix; if(h[k] > -1e8) h[k] -= litSoil(-R + ix*C, -R + iz*C); }
  litterRamps(h);
  for(let k = 0; k < h.length; k++) if(h[k] < -.5) h[k] = -.5;
  LIT.h = h; LIT.top = null;
}
// ramps: no cell lower than a neighbour minus a gentle slope, so a curl or a twig is walked up onto, not hit like a wall.
// A tall piece (a curl standing a leg-span high) loses a share of its height per cell instead, so its ramp hugs it: a
// fixed gentle slope would spread a skirt of floor metres out into thin air around it, and she'd walk on nothing
function litterRamps(h){
  const N = LIT.N, a = .6*LIT.C, b = a*Math.SQRT2, F = .35, m = (k, j, d) => { const q = h[j] - Math.max(d, h[j]*F*d/a); if(q > h[k]) h[k] = q; };
  for(let iz = 1; iz < N - 1; iz++) for(let ix = 1; ix < N - 1; ix++){ const k = iz*N + ix; m(k, k - 1, a); m(k, k - N, a); m(k, k - N - 1, b); m(k, k - N + 1, b); }
  for(let iz = N - 2; iz > 0; iz--) for(let ix = N - 2; ix > 0; ix--){ const k = iz*N + ix; m(k, k + 1, a); m(k, k + N, a); m(k, k + N + 1, b); m(k, k + N - 1, b); }
}
// bake solid scenery placed after litterFinish (plain meshes too) into the finished floor, so she walks up over it
// instead of through it: rasterise into a scratch top, raise the floor to it, and re-run the ramps
function floorBake(meshes){
  const {C, R, N} = LIT, top = new Float32Array(N*N).fill(-1e9), h = LIT.h; LIT.top = top;
  for(const o of meshes){ o.updateMatrixWorld(true);
    litterBake(o.isInstancedMesh ? o : {geometry: o.geometry, count: 1, getMatrixAt: (n, M) => M.copy(o.matrixWorld)}); }
  LIT.top = null;
  for(let iz = 0; iz < N; iz++) for(let ix = 0; ix < N; ix++){ const k = iz*N + ix; if(top[k] > -1e8){ const y = top[k] - litSoil(-R + ix*C, -R + iz*C); if(y > h[k]) h[k] = y; } }
  litterRamps(h);
}
const bilin = (A, W, gx, gz) => { const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz, k = iz*W + ix;
  return (A[k]*(1 - fx) + A[k + 1]*fx)*(1 - fz) + (A[k + W]*(1 - fx) + A[k + W + 1]*fx)*fz; };
const litSoil = (x, z) => bilin(LIT.soil, LIT.M, Math.min(LIT.M - 1.001, Math.max(0, (x + LIT.R)/LIT.S)), Math.min(LIT.M - 1.001, Math.max(0, (z + LIT.R)/LIT.S)));
// the top of the litter here (-Infinity off the baked area): the piece itself where one lies, a gentle ramp beside it
function litTop(x, z){
  if(!LIT.h) return -Infinity;
  const N = LIT.N, gx = (x + LIT.R)/LIT.C, gz = (z + LIT.R)/LIT.C; if(!(gx >= 0 && gz >= 0 && gx < N - 1 && gz < N - 1)) return -Infinity;
  return litSoil(x, z) + bilin(LIT.h, N, gx, gz);
}
const floorAt = (x, z) => Math.max(hAt(x, z), litTop(x, z));
// the highest the drawn ground can be here, for keeping the camera out of it: litter, and beyond the fine soil patch
// the coarse skirt mesh (2-unit grid) whose flat triangles can stand well above the true soil between its vertices
function soilTop(x, z){
  let h = floorAt(x, z);
  if(Math.max(Math.abs(x), Math.abs(z)) > AREA + 3.5){ const x0 = Math.floor(x/2)*2, z0 = Math.floor(z/2)*2;
    for(const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) h = Math.max(h, hAt(x0 + a, z0 + b)); }
  return h;
}
// anything the legs can grip: a vertical surface given by radius(dirX, dirZ, heightAboveBase)
const CLIMBS = [];
function makeClimb(o){
  const S = Object.assign({kind:'climb', ground:false, id:'C' + CLIMBS.length, top:null}, o);
  S.dir = v => { const dx = v.x - S.cx, dz = v.z - S.cz, L = Math.hypot(dx, dz) || 1e-6; return [dx/L, dz/L, L]; };
  S.project = v => {
    const [ux, uz] = S.dir(v); v.y = Math.min(S.y1, Math.max(S.y0, v.y));
    const R = S.radius(ux, uz, v.y - S.y0) + .002; v.x = S.cx + ux*R; v.z = S.cz + uz*R;
    const g = hAt(v.x, v.z) + .004; if(v.y < g) v.y = g;
    return v;
  };
  S.normal = v => { const [ux, uz] = S.dir(v); return new V3(ux, 0, uz); };
  S.inside = (v, m = 0) => { if(v.y < S.y0 || v.y > S.y1) return false; const [ux, uz, L] = S.dir(v); return L < S.radius(ux, uz, v.y - S.y0) + m; };
  S.near = v => Math.hypot(v.x - S.cx, v.z - S.cz) <= S.radius(1, 0, 0)*1.3 + .8 && v.y <= S.y1 + 1;
  S.hit = (x, y, z, dir) => { if(y < S.y0 - .2 || y > S.y1) return false; const dx = x - S.cx, dz = z - S.cz, L = Math.hypot(dx, dz) || 1e-6;
    return L < S.radius(dx/L, dz/L, y - S.y0) + .1 && -(dir.x*dx + dir.z*dz)/L > .2; };
  S.pushOut = (v, vel, m = .05) => { const [ux, uz] = S.dir(v), Rr = S.radius(ux, uz, v.y - S.y0) + m; v.x = S.cx + ux*Rr; v.z = S.cz + uz*Rr;
    const vn = vel.x*ux + vel.z*uz; if(vn < 0){ vel.x -= ux*vn; vel.z -= uz*vn; } };
  S.topAt = (v, vel) => !!S.top && vel.y <= 0 && v.y > S.y1 - .12 && inPlat(S.top, v.x, v.z);       // dropping onto the top, not its rim
  S.atRim = (v, t) => t.y >= 0 && v.y >= S.y1 - .01;
  S.rimLand = v => { const inw = new V3(S.top.x - v.x, 0, S.top.z - v.z).normalize(); return {pos: new V3(v.x + inw.x*.14, S.top.y, v.z + inw.z*.14), yaw: Math.atan2(inw.x, inw.z)}; };
  S.atBottom = v => v.y <= floorAt(v.x, v.z) + .04;
  S.soilExit = (v, n) => { const q = new V3(v.x + n.x*.18, 0, v.z + n.z*.18); q.y = floorAt(q.x, q.z); return q; };
  S.canEnter = () => true;
  CLIMBS.push(S); return S;
}
// a leaf blade as a thin two-faced surface. She walks the top as ground; the underside and the rim are climbed
// (upside-down underneath). Normals turn outward toward the rim so her body rolls round the edge on its legs.
const LEAF_TH = .006;
const leafLocal = (p, v) => { const dx = v.x - p.x, dz = v.z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot); return [dx*c - dz*s, dx*s + dz*c, c, s]; };
function leafUnder(p){
  const S = {kind:'climb', ground:false, id:'C' + CLIMBS.length, label:'leaf', top:p, thin:true, cx:p.x, cz:p.z, y0:p.y - 1 - p.leaf.droop*p.leaf.l*.35, y1:p.y + .5 + p.leaf.fold*p.leaf.w, intoDir: new V3(0, -1, 0), ext: Math.max(p.rx, p.rz)*1.3 + .3};
  const E = (lx, lz) => Math.hypot(lx/p.rx, lz/p.rz);
  const out = (lx, lz, c, s) => { const gx = lx/(p.rx*p.rx), gz = lz/(p.rz*p.rz); return new V3(gx*c + gz*s, 0, -gx*s + gz*c).normalize(); };
  S.project = v => { let [lx, lz, c, s] = leafLocal(p, v); const e = E(lx, lz); if(e > .985){ lx *= .985/e; lz *= .985/e; }
    const x = p.x + lx*c + lz*s, z = p.z - lx*s + lz*c; return v.set(x, surfAt(p, x, z) - LEAF_TH, z); };
  S.normal = v => { const [lx, lz, c, s] = leafLocal(p, v), e = E(lx, lz), h = .03, x = v.x, z = v.z;
    const n = new V3((surfAt(p, x + h, z) - surfAt(p, x - h, z))/(2*h), -1, (surfAt(p, x, z + h) - surfAt(p, x, z - h))/(2*h)).normalize();
    const w = Math.max(0, Math.min(1, (e - .92)/.065)); if(w > 0 && Math.hypot(lx, lz) > 1e-4) n.lerp(out(lx, lz, c, s), w*w*(3 - 2*w)).normalize();
    return n; };
  S.inside = (v, m = 0) => { const [lx, lz] = leafLocal(p, v); if(E(lx, lz) > 1) return false; const sf = surfAt(p, v.x, v.z); return v.y > sf - LEAF_TH - m && v.y < sf + m; };
  S.crossDown = (a, b) => { const [lx, lz] = leafLocal(p, b); return E(lx, lz) <= 1.02 && a.y >= surfAt(p, a.x, a.z) - .01 && b.y <= surfAt(p, b.x, b.z) + .005; };   // down through the curved top
  S.crossUp = (a, b) => { const [lx, lz] = leafLocal(p, b); return E(lx, lz) <= 1 && a.y < surfAt(p, a.x, a.z) - LEAF_TH && b.y >= surfAt(p, b.x, b.z) - LEAF_TH - .03; };
  S.near = v => { const [lx, lz] = leafLocal(p, v); return E(lx, lz) < 1.5 && Math.abs(v.y - surfAt(p, v.x, v.z)) < .6; };
  S.hit = () => false; S.pushOut = () => {}; S.atBottom = () => false; S.soilExit = v => v; S.canEnter = () => true;
  S.topAt = (v, vel) => vel.y <= 0 && v.y >= surfAt(p, v.x, v.z) - .015;
  S.atRim = (v, t) => { const [lx, lz, c, s] = leafLocal(p, v); return E(lx, lz) > .95 && t.dot(out(lx, lz, c, s)) > .3; };
  S.rimLand = v => { const [lx, lz, c, s] = leafLocal(p, v), o = out(lx, lz, c, s), q = v.clone().addScaledVector(o, -.12); q.y = p.y;
    return {pos: q, yaw: Math.atan2(-o.x, -o.z), swing: true}; };
  S.rimPoint = (x, z) => { const [lx, lz, c, s] = leafLocal(p, new V3(x, 0, z)), e = E(lx, lz) || 1, k = .985/e, q = new V3(p.x + (lx*c + lz*s)*k, 0, p.z + (-lx*s + lz*c)*k);
    q.y = surfAt(p, q.x, q.z) - LEAF_TH*.5; return [q, out(lx, lz, c, s)]; };
  CLIMBS.push(S); return S;
}
// the orb, as a walkable sheet of radii: either face, out to the frame
function webSurface(){
  const {C, n, u, R} = ARG, v = new V3(0, 1, 0);
  const S = {kind:'climb', ground:false, id:'C' + CLIMBS.length, label:'web', top:null, thin:true, web:true, side:1, cx:C.x, cz:C.z, y0:C.y - R*1.2, y1:C.y + R*1.2, ext: R*1.5};
  const Cw = () => C.clone().add(ARG_WEB.position);
  const loc = q => { const d = q.clone().sub(Cw()), a = d.dot(n); d.addScaledVector(n, -a); return [a, d, Math.atan2(d.dot(v), d.dot(u))]; };
  S.setSide = q => { const a = loc(q)[0]; if(Math.abs(a) > .02) S.side = Math.sign(a); };
  // the face she comes at it from: where she was a frame ago, or (already at the plane) against the way she is moving
  S.sideFrom = (prev, vel) => { const a = loc(prev)[0]; return Math.abs(a) > .004 ? Math.sign(a) : (vel && Math.abs(vel.dot(n)) > 1e-4 ? -Math.sign(vel.dot(n)) : S.side); };
  S.project = q => { const [, d, ang] = loc(q), L = d.length(), lim = ARG.edge(ang)*.96; if(L > lim) d.multiplyScalar(lim/L); return q.copy(Cw()).add(d).addScaledVector(n, S.side*.006); };
  S.normal = () => n.clone().multiplyScalar(S.side);
  S.inside = (q, m = 0) => { const [a, d, ang] = loc(q); return Math.abs(a) < m + .006 && d.length() < ARG.edge(ang); };
  S.near = q => { const [a, d] = loc(q); return Math.abs(a) < .6 && d.length() < R*1.4; };
  S.hit = () => false; S.pushOut = () => {}; S.atBottom = () => false; S.soilExit = q => q; S.canEnter = () => true;
  S.topAt = () => false; S.atRim = () => false;
  S.atEdge = (q, t) => { const [, d, ang] = loc(q), L = d.length(); return L >= ARG.edge(ang)*.95 && L > 1e-6 && t.dot(d)/L > .2; };   // at the frame, walking outward
  CLIMBS.push(S); return S;
}
// any round woody thing lying, arching or hanging (branches, roots, buttresses, lianas): a tube around a polyline,
// radius tapering along it. Feet and body take it in any orientation, like bark: land on it, walk along and around it,
// over its ends, and down onto the soil.
function tubeSurface(pts, rad, label = 'bark', ell = null){
  // ell = {w, h}: an elliptical cross-section (w across, h upright), as for the fin-like buttress roots
  const n = pts.length, R = Array.isArray(rad) ? rad : pts.map(() => rad), c = new V3(), ew = ell ? ell.w : 1, eh = ell ? ell.h : 1, em = Math.max(ew, eh);
  for(const q of pts) c.add(q); c.divideScalar(n);
  let br = 0, y0 = 1e9, y1 = -1e9; pts.forEach((q, i) => { br = Math.max(br, q.distanceTo(c) + R[i]*em); y0 = Math.min(y0, q.y - R[i]*em); y1 = Math.max(y1, q.y + R[i]*em); });
  const S = {kind:'climb', ground:false, id:'C' + CLIMBS.length, label, top:null, tube:true, cx: c.x, cz: c.z, y0, y1, ext: br, _pts: pts, _R: R, _ell: ell};
  S._bb = [1e9, -1e9, 1e9, -1e9]; pts.forEach((q, i) => { const r = R[i]*em; S._bb[0] = Math.min(S._bb[0], q.x - r); S._bb[1] = Math.max(S._bb[1], q.x + r); S._bb[2] = Math.min(S._bb[2], q.z - r); S._bb[3] = Math.max(S._bb[3], q.z + r); });
  const ab = new V3(), av = new V3(), dv = new V3(), sd = new V3(), uv = new V3(), UPV = new V3(0, 1, 0), K = {q: new V3(), d: 0, r: 0, side: new V3(), up: new V3(), ds: 0, du: 0};
  // one segment's answer for v: foot point q on the axis, radius r there, (scaled) distance d, cross-section frame
  const segAt = (i, v, k) => { const a = pts[i]; ab.subVectors(pts[i + 1], a); av.subVectors(v, a);
    const t = Math.max(0, Math.min(1, av.dot(ab)/(ab.lengthSq() || 1e-9))), qx = a.x + ab.x*t, qy = a.y + ab.y*t, qz = a.z + ab.z*t;
    k.r = R[i] + (R[i + 1] - R[i])*t; k.q.set(qx, qy, qz); dv.set(v.x - qx, v.y - qy, v.z - qz);
    if(ell){ sd.crossVectors(ab, UPV); if(sd.lengthSq() < 1e-9) sd.set(1, 0, 0); sd.normalize(); uv.crossVectors(sd, ab).normalize();
      const ds = dv.dot(sd), du = dv.dot(uv), da = dv.length()**2 - ds*ds - du*du; k.d = Math.sqrt((ds/ew)**2 + (du/eh)**2 + Math.max(0, da));
      k.side.copy(sd); k.up.copy(uv); k.ds = ds; k.du = du; (k.ax || (k.ax = new V3())).copy(dv).addScaledVector(sd, -ds).addScaledVector(uv, -du); }   // ax: past a segment's end
    else k.d = dv.length();
    return k; };
  const KS = Array.from({length: Math.max(1, n - 1)}, () => ({q: new V3(), d: 0, r: 0, side: new V3(), up: new V3(), ds: 0, du: 0, p: new V3(), e: 0}));
  const KT = {q: new V3(), d: 0, r: 0, side: new V3(), up: new V3(), ds: 0, du: 0};
  const insideAny = (v, m) => { for(let i = 0; i + 1 < n; i++){ segAt(i, v, KT); if(KT.d < KT.r + m) return true; } return false; };
  // the nearest point on the tube's outer surface. Every segment offers its own surface point; take the nearest one
  // that isn't buried inside a neighbouring segment (a tapering, bending tube's segments overlap). Taking the segment
  // v is deepest inside instead threw a walker metres along big roots and limbs with every small step.
  const order = KS.map((_, i) => i);
  const closest = v => {
    for(let i = 0; i + 1 < n; i++){ const k = segAt(i, v, KS[i]); onSurface(k.p.copy(v), k, 0); k.e = k.p.distanceToSquared(v); }
    order.sort((a, b) => KS[a].e - KS[b].e);
    let pick = order[0];
    for(const i of order){ if(!insideAny(KS[i].p, -.003)){ pick = i; break; } }
    const k = KS[pick]; K.q.copy(k.q); K.d = k.d; K.r = k.r; K.side.copy(k.side); K.up.copy(k.up); K.ds = k.ds; K.du = k.du; if(k.ax) (K.ax || (K.ax = new V3())).copy(k.ax);
    // in the crease on the inside of a bend every nearby segment's point is buried in its neighbour: push the nearest
    // one out of whatever segment it is buried in, a few times over; it settles in the crease right beside v
    if(pick !== order[0]){
      const P0 = KS[order[0]].p, cur = CP.copy(P0); let ok = false, kk = KS[order[0]];
      for(let it = 0; it < 4; it++){ let deep = -1, dd = -.003;
        for(let j = 0; j + 1 < n; j++){ segAt(j, cur, KT); const pen = KT.d - KT.r; if(pen < dd){ dd = pen; deep = j; } }
        if(deep < 0){ ok = true; break; }
        kk = segAt(deep, cur, KC); onSurface(cur, kk, 0); }
      if(ok && cur.distanceToSquared(v) < KS[pick].e){ K.q.copy(kk.q); K.d = kk.d; K.r = kk.r; K.side.copy(kk.side); K.up.copy(kk.up); K.ds = kk.ds; K.du = kk.du; if(kk.ax) (K.ax || (K.ax = new V3())).copy(kk.ax); K.crease = cur.clone(); }
      else K.crease = null;
    } else K.crease = null;
    return K; };
  const CP = new V3(), KC = {q: new V3(), d: 0, r: 0, side: new V3(), up: new V3(), ds: 0, du: 0};
  const ellNormal = k => { const g = k.side.clone().multiplyScalar(k.ds/(ew*ew)).addScaledVector(k.up, k.du/(eh*eh)); return k.ax ? g.add(k.ax) : g; };
  S.normal = v => { const k = closest(v); const d = ell ? ellNormal(k) : v.clone().sub(k.q); return d.lengthSq() > 1e-12 ? d.normalize() : UP.clone(); };
  const onSurface = (v, k, off) => {
    if(ell){ const axL = k.ax ? k.ax.lengthSq() : 0; let rho = Math.sqrt((k.ds/ew)**2 + (k.du/eh)**2 + axL); if(rho < 1e-6){ k.du = 1e-3; rho = 1e-3/eh; }
      const s = k.r/rho; v.copy(k.q).addScaledVector(k.side, k.ds*s).addScaledVector(k.up, k.du*s); if(k.ax) v.addScaledVector(k.ax, s); const nn = ellNormal(k).normalize(); return v.addScaledVector(nn, off); }
    const d = v.clone().sub(k.q); if(d.lengthSq() < 1e-10) d.set(0, 1, 0); d.normalize(); return v.copy(k.q).addScaledVector(d, k.r + off); };
  S.project = v => { const k = closest(v); if(k.crease){ const cp = k.crease, nn = S.normal(cp); v.copy(cp).addScaledVector(nn, .002); } else onSurface(v, k, .002); const g = hAt(v.x, v.z) + .004; if(v.y < g) v.y = g; return v; };
  S.inside = (v, m = 0) => v.distanceTo(c) <= br + m && insideAny(v, m);
  S.near = v => v.distanceTo(c) < br + .6;
  S.hit = (x, y, z, dir) => { const v = new V3(x, y, z); if(!S.inside(v, .1)) return false; const nn = S.normal(v); return -(dir.x*nn.x + dir.z*nn.z) > .12; };
  S.pushOut = (v, vel, m = .05) => { const k = closest(v); onSurface(v, k, m); const nn = S.normal(v); const vn = vel.dot(nn); if(vn < 0) vel.addScaledVector(nn, -vn); };
  S.topAt = () => false; S.atRim = () => false;
  S.atBottom = v => v.y <= floorAt(v.x, v.z) + .04;
  S.soilExit = (v, nn) => { const q = new V3(v.x + nn.x*.18, 0, v.z + nn.z*.18); q.y = floorAt(q.x, q.z); return q; };
  S.canEnter = () => true;
  CLIMBS.push(S); return S;
}
// a tapering limb, root or branch: one continuous tube whose radius follows rAt(t), with an optional flattened
// cross-section (w across, h upright: buttress roots are tall fins) and rounded-off caps, so nothing shows a cut end
function taperedTube(curve, rAt, {seg = 24, radial = 12, w = 1, h = 1, capStart = false, capEnd = true} = {}){
  const pos = [], uv = [], idx = [], T = new V3(), side = new V3(), upv = new V3(), p = new V3(), prev = curve.getPoint(0);
  let vAcc = 0; const ring = radial + 1, r0 = Math.max(.02, rAt(0));
  const UPV = new V3(0, 1, 0), frame = t => { curve.getTangent(t, T); side.crossVectors(T, UPV); if(side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); upv.crossVectors(side, T).normalize(); };
  for(let i = 0; i <= seg; i++){
    const t = i/seg; curve.getPoint(t, p); frame(t); const r = Math.max(.002, rAt(t)); vAcc += p.distanceTo(prev); prev.copy(p);
    for(let j = 0; j <= radial; j++){ const a = j/radial*6.2832, cx = Math.cos(a)*r*w, cy = Math.sin(a)*r*h;
      pos.push(p.x + side.x*cx + upv.x*cy, p.y + side.y*cx + upv.y*cy, p.z + side.z*cx + upv.z*cy); uv.push(j/radial, vAcc/(6.2832*r0)); }
  }
  for(let i = 0; i < seg; i++) for(let j = 0; j < radial; j++){ const a = i*ring + j, b = a + ring; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const cap = (t, ringStart, out) => { curve.getPoint(t, p); frame(t); const r = Math.max(.002, rAt(t)), c = pos.length/3;
    pos.push(p.x + T.x*out*r*.6, p.y + T.y*out*r*.6, p.z + T.z*out*r*.6); uv.push(.5, out > 0 ? vAcc/(6.2832*r0) : 0);
    for(let j = 0; j < radial; j++) out > 0 ? idx.push(ringStart + j, c, ringStart + j + 1) : idx.push(ringStart + j + 1, c, ringStart + j); };
  if(capEnd) cap(1, seg*ring, 1);
  if(capStart) cap(0, 0, -1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  // make sure faces point outward (the winding depends on the frame's handedness)
  { const A = new V3(pos[0], pos[1], pos[2]), B = new V3(pos[ring*3], pos[ring*3 + 1], pos[ring*3 + 2]), Cc = new V3(pos[3], pos[4], pos[5]);
    const n = new V3().subVectors(B, A).cross(new V3().subVectors(Cc, A)), c0 = curve.getPoint(0);
    if(n.dot(A.clone().sub(c0)) < 0){ for(let k = 0; k < idx.length; k += 3){ const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; } g.setIndex(idx); } }
  g.computeVertexNormals(); return g;
}
// a boulder: an ellipsoid (turned about the vertical), walkable all over its exposed part
function blobSurface(cx, cy, cz, rx, ry, rz, yaw, label = 'stone'){
  const C = new V3(cx, cy, cz), cs = Math.cos(yaw), sn = Math.sin(yaw), br = Math.max(rx, ry, rz);
  const toL = v => { const d = v.clone().sub(C); return new V3(d.x*cs - d.z*sn, d.y, d.x*sn + d.z*cs); };
  const toW = l => new V3(l.x*cs + l.z*sn, l.y, -l.x*sn + l.z*cs);
  const S = {kind:'climb', ground:false, id:'C' + CLIMBS.length, label, top:null, cx, cz, y0: cy - ry, y1: cy + ry, ext: br};
  S.normal = v => { const l = toL(v); return toW(new V3(l.x/(rx*rx), l.y/(ry*ry), l.z/(rz*rz))).normalize(); };
  S.project = v => { const l = toL(v), k = Math.hypot(l.x/rx, l.y/ry, l.z/rz) || 1e-6; l.divideScalar(k).multiplyScalar(1 + .002/br);
    v.copy(C).add(toW(l)); const g = hAt(v.x, v.z) + .004; if(v.y < g) v.y = g; return v; };
  S.inside = (v, m = 0) => { if(v.distanceTo(C) > br + m) return false; const l = toL(v); return Math.hypot(l.x/(rx + m), l.y/(ry + m), l.z/(rz + m)) < 1; };
  S.near = v => v.distanceTo(C) < br + .6;
  S.hit = (x, y, z, dir) => { const v = new V3(x, y, z); if(!S.inside(v, .1)) return false; const nn = S.normal(v); return -(dir.x*nn.x + dir.z*nn.z) > .12; };
  S.pushOut = (v, vel, m = .05) => { const nn = S.normal(v); const l = toL(v), k = Math.hypot(l.x/(rx + m), l.y/(ry + m), l.z/(rz + m)) || 1e-6;
    v.copy(C).add(toW(l.divideScalar(k))); const vn = vel.dot(nn); if(vn < 0) vel.addScaledVector(nn, -vn); };
  S.topAt = () => false; S.atRim = () => false;
  S.atBottom = v => v.y <= floorAt(v.x, v.z) + .04;
  S.soilExit = (v, nn) => { const q = new V3(v.x + nn.x*.18, 0, v.z + nn.z*.18); q.y = floorAt(q.x, q.z); return q; };
  S.canEnter = () => true;
  CLIMBS.push(S); return S;
}
// cheap reject before S.inside(v, m): outside the surface's height span (the log's flanks reach below its grip span),
// or outside a tube's footprint box, it can't contain v
const climbMay = (S, v, m) => (S.log || (v.y >= S.y0 - m - .05 && v.y <= S.y1 + m + .05))
  && (!S._bb || (v.x >= S._bb[0] - m - .05 && v.x <= S._bb[1] + m + .05 && v.z >= S._bb[2] - m - .05 && v.z <= S._bb[3] + m + .05));
// a coarse grid over the climbable surfaces, so contact tests only look at the ones nearby
const CGRID = {cell: 1.5, map: new Map(), n: -1, stamp: 0};
function climbsNear(x, z, m = .7){
  const c = CGRID.cell;
  if(CGRID.n !== CLIMBS.length){ CGRID.map.clear();
    for(const S of CLIMBS){ const e = S.ext ?? (S.radius ? S.radius(1, 0, 0)*1.4 + .3 : 2.5); S._st = 0;
      for(let ix = Math.floor((S.cx - e)/c); ix <= Math.floor((S.cx + e)/c); ix++) for(let iz = Math.floor((S.cz - e)/c); iz <= Math.floor((S.cz + e)/c); iz++){
        const k = ix*1000 + iz; let L = CGRID.map.get(k); if(!L) CGRID.map.set(k, L = []); L.push(S); } }
    CGRID.n = CLIMBS.length; }
  const out = [], st = ++CGRID.stamp;
  for(let ix = Math.floor((x - m)/c); ix <= Math.floor((x + m)/c); ix++) for(let iz = Math.floor((z - m)/c); iz <= Math.floor((z + m)/c); iz++){
    const L = CGRID.map.get(ix*1000 + iz); if(L) for(const S of L) if(S._st !== st){ S._st = st; out.push(S); } }
  return out;
}
// the fallen log: a horizontal bark cylinder. Its crown is the walkable top (the 'log' platform); the legs grip
// the flanks all the way round to the overhang above the soil.
const logR = (p, s, h, al) => p.r*(1.05 - .05*(al/p.len + .5))*barkK(Math.atan2(-h, s), al, .05);
function logClimb(p, ax, sd){
  const C = new V3(p.x, p.cy, p.z), hl = p.len/2, hMin = -.6*p.r;
  const loc = v => { const d = v.clone().sub(C); return [d.dot(ax), d.dot(sd), d.y]; };          // along, side, height
  const at = (al, th) => { const R = logR(p, Math.sin(th), Math.cos(th), al) + .002;
    return C.clone().addScaledVector(ax, al).addScaledVector(sd, Math.sin(th)*R).add(new V3(0, Math.cos(th)*R, 0)); };
  const S = {kind:'climb', ground:false, id:'C' + CLIMBS.length, label:'bark', top:p, log:true, y0: C.y + hMin, y1: C.y + p.r, cx: p.x, cz: p.z, ext: hl + p.r + .4};
  S.project = v => {
    let [al, sd_, h] = loc(v); al = Math.max(-hl*.97, Math.min(hl*.97, al));
    let th = Math.atan2(sd_ || 1e-5, h); const sg = Math.sign(th) || 1;
    if(Math.cos(th) < hMin/p.r) th = sg*Math.acos(hMin/p.r);                               // not below the lowest grip
    let q = at(al, th); const g = hAt(q.x, q.z) + .004;
    if(q.y < g){ th = sg*Math.acos(Math.max(-1, Math.min(1, (g - C.y)/p.r))); q = at(al, th); }   // nor into the soil
    return v.copy(q);
  };
  S.normal = v => { const [, sd_, h] = loc(v), L = Math.hypot(sd_, h) || 1e-6; return sd.clone().multiplyScalar(sd_/L).add(new V3(0, h/L, 0)); };
  S.inside = (v, m = 0) => { const [al, sd_, h] = loc(v); return Math.abs(al) <= hl && Math.hypot(sd_, h) < logR(p, sd_, h, al) + m; };
  S.near = v => { const [al, sd_, h] = loc(v); return Math.abs(al) < hl + .6 && Math.hypot(sd_, h) < p.r + .9; };
  S.hit = (x, y, z, dir) => { const v = new V3(x, y, z); if(!S.inside(v, .1)) return false; const n = S.normal(v); return -(dir.x*n.x + dir.z*n.z) > .15; };
  S.pushOut = (v, vel, m = .05) => { const [al, sd_, h] = loc(v), L = Math.hypot(sd_, h) || 1e-6, Rr = logR(p, sd_, h, al) + m;
    const n = sd.clone().multiplyScalar(sd_/L).add(new V3(0, h/L, 0));
    v.copy(C).addScaledVector(ax, al).addScaledVector(n, Rr); const vn = vel.dot(n); if(vn < 0) vel.addScaledVector(n, -vn); };
  S.topAt = v => { const [, , h] = loc(v); return h > 0 && inPlat(p, v.x, v.z); };
  S.atRim = (v, t) => { const [, sd_, h] = loc(v); return t.y >= 0 && h > 0 && Math.abs(sd_) < p.rx*.9 && inPlat(p, v.x, v.z); };
  S.rimLand = (v, t) => { const [, sd_] = loc(v), pos = v.clone().addScaledVector(sd, -sd_*.3); pos.y = p.y;
    const f = new V3(t.x, 0, t.z); if(f.lengthSq() < .01) f.copy(sd).multiplyScalar(-Math.sign(sd_) || 1);
    return {pos, yaw: Math.atan2(f.x, f.z)}; };
  S.atBottom = v => { const [, , h] = loc(v); return h <= hMin + .01 || v.y <= floorAt(v.x, v.z) + .04; };
  S.soilExit = v => { const [al, sd_] = loc(v), q = C.clone().addScaledVector(ax, al).addScaledVector(sd, (Math.sign(sd_) || 1)*(p.r + .12)); q.y = floorAt(q.x, q.z); return q; };
  S.canEnter = v => Math.abs(loc(v)[0]) < hl*.95;
  CLIMBS.push(S); return S;
}
const slopeAt = (x, z) => [(floorAt(x + .05, z) - floorAt(x - .05, z))/.1, (floorAt(x, z + .05) - floorAt(x, z - .05))/.1];   // as the feet feel it: soil or litter

// leaf surface: tessellated grid bent into a lance / heart / round blade with fold and droop.
// local: x = width, -z = toward tip, +z = base (stem side), y = up
function leafPoint(type, w, l, u, t, droop, fold){
  let wd, yy = t*2 - 1;
  if(type === 'heart'){ wd = Math.pow(Math.sin(Math.PI*(.12 + .88*Math.pow(t, .8))), .7)*1.05; yy += .32*(1 - Math.abs(u))*Math.pow(Math.max(0, 1 - t/.28), 2); }
  else if(type === 'round'){ wd = Math.sqrt(Math.max(0, 1 - yy*yy)); }
  else wd = Math.pow(Math.sin(Math.PI*Math.pow(t, .85)), .8);
  const h = Math.abs(u)*wd*fold*w - droop*Math.pow(Math.max(0, t - .65)/.35, 2)*l*.35 - .07*u*u*w;
  return new V3(u*wd*w, h, -yy*l);
}
function leafGeo(type, w, l, droop = .25, fold = .1, sx = 10, sy = 22){   // sx, sy: tessellation (small or distant leaves need far less)
  const g = new THREE.PlaneGeometry(2, 2, sx, sy), p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const v = leafPoint(type, w, l, p.getX(i), (p.getY(i) + 1)/2, droop, fold); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function veinGeo(type, w, l, droop, fold){
  const pts = [];
  for(let i = 0; i < 20; i++){ pts.push(leafPoint(type, w, l, 0, i/20, droop, fold), leafPoint(type, w, l, 0, (i + 1)/20, droop, fold)); }
  for(let k = 1; k < 8; k++){ const t = k/8.5;
    for(const sd of [-1, 1]){ const a = leafPoint(type, w, l, 0, t, droop, fold), b = leafPoint(type, w, l, sd*.82, Math.min(1, t + .12), droop, fold); a.y += .004; b.y += .004; pts.push(a, b); } }
  return new THREE.BufferGeometry().setFromPoints(pts);
}
// a fern frond (unit length along +z): a bare stipe rising from the crown, running on as a real round rachis that
// arches over and tapers to the tip, set with leaflets (pinnae) that droop a little, each cut into rounded lobes
// (pinnules) either side of a pale midvein, with rows of brown spore dots (sori) on the underside. Vertex colours give
// a brown, scaly stipe base greening up the rachis, pale veins and darker lobe edges (multiplied by the frond's green).
function frondGeo(lo = false){   // lo: fewer, simpler leaflets, for the small young ferns and dead fronds
  const pos = [], col = [], N = lo ? 14 : 22, K = lo ? 6 : 10, S0 = .2, rach = s => new V3(0, Math.sin(s*2.4)*.45, s), Z = new V3(0, 0, 1);
  const push = (v, c, r = 1, g = 1.02, b = .9) => { pos.push(v.x, v.y, v.z); col.push(c*r, c*g, c*b); };
  for(let i = 0; i < N; i++){
    const u = (i + .5)/N, s = S0 + u*(1 - S0), B = rach(s);
    const w = .23*(1 - u*.8)*(.55 + .45*Math.sin(Math.PI*Math.min(1, u*1.8))), Lp = w*1.15, wb = .55*(1 - S0)/N;
    for(const sd of [-1, 1]){
      const D = new V3(sd, -.3, .45).normalize(), Eb = Z.clone().addScaledVector(D, -Z.dot(D)).normalize();
      const A = t => B.clone().addScaledVector(D, Lp*t).add(new V3(0, -Lp*.28*t*t, 0));                       // the leaflet droops toward its tip
      const lobe = k => Math.pow(Math.abs(Math.sin(k*Math.PI/3)), .7), hw = (t, k) => wb*Math.pow(1 - t, .55)*(.45 + .65*lobe(k)) + .0015;   // rounded lobes, a notch between each
      const P = [];
      for(let k = 0; k <= K; k++){ const t = k/K, a = A(t), h = hw(t, k); P.push([a.clone().add(new V3(0, h*.3, 0)), a.clone().addScaledVector(Eb, -h), a.clone().addScaledVector(Eb, h), t]); }
      for(let k = 0; k < K; k++){ const [a0, l0, r0, t0] = P[k], [a1, l1, r1, t1] = P[k + 1], vC0 = .8 + .5*t0, vC1 = .8 + .5*t1, vE = .6 + .12*lobe(k);
        push(a0, k ? vC0 : .5); push(l0, vE); push(a1, vC1); push(l0, vE); push(l1, vE*.92); push(a1, vC1);
        push(a0, k ? vC0 : .5); push(a1, vC1); push(r0, vE); push(r0, vE); push(a1, vC1); push(r1, vE*.92); }
      // sori: a little brown dot under each lobe, on the fronds' middle and upper leaflets, set just below the blade
      if(u > .3) for(let k = 1; k < K - 1; k += 3) for(const e of [-1, 1]){ const t = (k + .5)/K, a = A(t), h = hw(t, k)*.55, ctr = a.clone().addScaledVector(Eb, e*h).add(new V3(0, -.003, 0)), r = wb*.32;
        const p0 = ctr.clone().addScaledVector(D, r), p1 = ctr.clone().addScaledVector(D, -r*.5).addScaledVector(Eb, r*.87), p2 = ctr.clone().addScaledVector(D, -r*.5).addScaledVector(Eb, -r*.87);
        push(p0, .55, 1.3, .8, .35); push(p2, .55, 1.3, .8, .35); push(p1, .55, 1.3, .8, .35); }
    }
  }
  // the stipe and rachis: a tube from the crown to the tip, brown and thick at the base, green and fine at the tip
  const pts = []; for(let k = 0; k <= 30; k++) pts.push(rach(-.02 + k/30*1.02));
  const tube = taperedTube(new THREE.CatmullRomCurve3(pts), t => .011*(1 - .82*t) + .0012, {seg: lo ? 14 : 30, radial: lo ? 5 : 6, capStart: true}).toNonIndexed(), tp = tube.attributes.position;
  for(let i = 0; i < tp.count; i++){ const z = Math.max(0, tp.getZ(i)), b = Math.max(0, 1 - z/(S0*1.2)), v = .62 + .25*z;   // brown up the stipe, then green
    push(new V3(tp.getX(i), tp.getY(i), tp.getZ(i)), v, 1 + .55*b, 1 - .1*b, .85 - .25*b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); return g;
}
// a fern's crown: the knobbly, scaly rhizome the fronds rise from, brown with old stipe bases (unit radius; scale per clump)
function fernCrownGeo(){
  const parts = [new THREE.IcosahedronGeometry(1, 2)];
  { const p = parts[0].attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i), k = 1 + (hash2(p.getX(i)*5.1, p.getZ(i)*4.3 + y) - .5)*.4; p.setXYZ(i, p.getX(i)*k, Math.max(-.2, y)*.55*k, p.getZ(i)*k); } }
  for(let i = 0; i < 9; i++){ const a = i/9*6.283 + Math.sin(i*7.3)*.3, cg = new THREE.ConeGeometry(.16, .9, 5).translate(0, .45, 0);   // the stubs of old stipes, splayed
    cg.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.7 + .25*Math.sin(i*3.1), -a + Math.PI/2, 0, 'YXZ'))).translate(Math.cos(a)*.45, .15, Math.sin(a)*.45); parts.push(cg); }
  const g = mergeGeos(parts.map(q => { q.computeVertexNormals(); return q; })); g.computeVertexNormals(); return g;
}
const barkK = (a, y, amt) => 1 + amt*(.7*Math.sin(a*11 + y*.9) + .3*Math.sin(a*5 - y*.5));
function barkify(g, r, amt = .06){
  const p = g.attributes.position, col = [], c = new THREE.Color();
  for(let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), rad = Math.hypot(x, z);
    if(rad > r*.3){ const k = barkK(a, y, amt); p.setX(i, x*k); p.setZ(i, z*k); }
    const moss = Math.max(0, (vnoise(Math.cos(a)*2.3 + 11, y*.45 + Math.sin(a)*2.3) - .48)*2.4 + (vnoise(a*3.1, y*1.7 + 5) - .5)*.6);   // irregular patches
    c.setRGB(.34 + .06*Math.sin(a*11 + y), .25 + .04*Math.sin(y*3), .16).lerp(new THREE.Color(.22, .38, .1), Math.min(1, moss)*.85); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// place an instance on the terrain
function onGround(x, z, lift, rotY, s, tilt = .25){
  M4.compose(new V3(x, hAt(x, z) + lift, z), Q.setFromEuler(E.set(rr(-tilt, tilt), rotY, rr(-tilt, tilt), 'YXZ')), s); return M4;
}
// a random spot on the floor (never inside a tree trunk)
const scatter = (rMax, rMin = 0) => { for(let t = 0; ; t++){ const r = rMin + Math.sqrt(rnd())*(rMax - rMin), a = rnd()*6.283, x = Math.cos(a)*r, z = Math.sin(a)*r; if(t > 20 || !inTrunk(x, z, .3)) return [x, z]; } };

// soil mesh with humus / clay / moss variation: a fine patch under the play area, and a coarse skirt out to the far
// giants (sunk under the fine patch so the two never fight)
for(const [SZ, SEG, rep] of [[2*AREA + 8, (2*AREA + 8)*5, (2*AREA + 8)*.6], [480, 240, 288]]){
  const g = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); g.rotateX(-Math.PI/2);
  const col = [], c = new THREE.Color(), pos = g.attributes.position, outer = SZ > 2*AREA + 8;
  for(let i = 0; i < pos.count; i++){
    const x = pos.getX(i), z = pos.getZ(i), h = hAt(x, z) - broadH(x, z); pos.setY(i, hAt(x, z) - (outer && Math.max(Math.abs(x), Math.abs(z)) < AREA + 3 ? .6 : 0));
    const n1 = vnoise(x*.7, z*.7), n2 = vnoise(x*2.3 + 5, z*2.3), n3 = vnoise(x*.25 + 9, z*.25), n4 = vnoise(x*1.3 + 21, z*1.3 - 4), n5 = vnoise(x*5.1 - 7, z*5.1 + 2);
    c.setRGB(.16 + .1*n2, .11 + .06*n2, .065 + .035*n2);                                   // humus, a range of browns
    c.lerp(new THREE.Color(.27, .18, .1), Math.max(0, n4 - .5)*1.4);                       // drier, paler soil
    if(n1 > .6) c.lerp(new THREE.Color(.36, .2, .09), Math.min(1, (n1 - .6)*2.4));          // reddish clay
    if(n4 < .3) c.lerp(new THREE.Color(.38, .3, .2), (.3 - n4)*2);                          // sandy, gritty patches
    if(n5 > .7) c.lerp(new THREE.Color(.3, .16, .06), (n5 - .7)*2.2);                       // litter-stained, rust-orange
    if(n3 > .62) c.lerp(new THREE.Color(.17, .29, .08), Math.min(.85, (n3 - .62)*3));       // moss, only in patches
    c.multiplyScalar(.85 + .3*n5);                                                       // fine mottling
    if(h < -.25) c.multiplyScalar(.7).lerp(new THREE.Color(.06, .05, .04), .25);           // damp, dark hollows
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const tex = outer ? SOIL_TEX.clone() : SOIL_TEX; if(outer){ tex.repeat.set(rep, rep); tex.needsUpdate = true; }
  const m = hot(new THREE.Mesh(g, antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: tex, bumpMap: tex, bumpScale: 3, roughness:1}))), TEMP.soil); m.receiveShadow = true; scene.add(m);
}
// leaf litter lies in drifts: thick where this says, thinning to bare soil between, so the ground shows in patches
const litterCover = (x, z) => { const n = vnoise(x*.16 + 40, z*.16 - 13)*.7 + vnoise(x*.55 - 9, z*.55 + 4)*.3; return Math.max(0, Math.min(1, (n - .41)/.27)); };
// a random spot for a piece of litter: anywhere scatter would go, but taken more often where the drifts are (k > 1: only deep in them)
const litterSpot = (rMax, rMin = 0, k = 1) => { for(let t = 0; ; t++){ const p = scatter(rMax, rMin); if(t > 40 || rnd() < Math.pow(litterCover(p[0], p[1]), k)) return p; } };
// leaf litter: whole dead leaves, 5–15 cm long, of several kinds — long lance leaves, broad heart leaves, small round
// ones — in browns, tans, russets and the odd yellow or blackened one (a fine layer over the play area, a sparser one
// of lance leaves out among the giants)
for(const [shape, w, l, droop, fold, nNear, nFar, hue0, hue1] of [['lance', .8, 1.5, .3, .5, 900, 450, .04, .12], ['heart', 1, 1.2, .25, .35, 520, 0, .02, .1], ['round', .75, .85, .15, .3, 420, 0, .06, .14]]){
  const g = leafGeo(shape, w, l, droop, fold, 6, 12);
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: LEAF_TEX, roughness:.9, side:THREE.DoubleSide}), nNear + nFar), TEMP.litter);
  const c = new THREE.Color();
  for(let i = 0; i < im.count; i++){
    const far = i >= nNear, [x, z] = far ? scatter(120, AREA - 4) : litterSpot(25*AK), s = rr(.45, 1.3)*(far ? 2.2 : 1);
    im.setMatrixAt(i, onGround(x, z, .006 + rnd()*.012, rnd()*6.3, new V3(s, s*.5, s), .12));
    c.setHSL(rr(hue0, hue1), rr(.35, .6), rr(.1, .28));
    const v = rnd(); if(v < .1) c.setHSL(rr(.18, .26), .4, .18); else if(v < .16) c.setHSL(rr(.11, .14), .65, rr(.3, .4)); else if(v < .22) c.setHSL(.07, .2, rr(.05, .09));   // greenish, yellow, blackened
    im.setColorAt(i, c);
  }
  im.receiveShadow = true; scene.add(im); litterBake(im);   // walkable: she steps over it, never under it
}
// leaf fragments: torn, jagged pieces
{
  const sh = new THREE.Shape(); const N = 9;
  for(let k = 0; k < N; k++){ const a = k/N*6.283, r = rr(.5, 1); k ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r*.7) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r*.7); }
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI/2);
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({roughness:.9, side:THREE.DoubleSide}), 1900), TEMP.litter);
  const c = new THREE.Color();
  for(let i = 0; i < im.count; i++){
    const [x, z] = litterSpot(22*AK), s = rr(.12, .45);
    im.setMatrixAt(i, onGround(x, z, .008 + rnd()*.01, rnd()*6.3, new V3(s, s, s), .15));
    c.setHSL(rr(.03, .14), rr(.3, .6), rr(.12, .32)); im.setColorAt(i, c);
  }
  im.receiveShadow = true; scene.add(im); litterBake(im);   // walkable: she steps over it, never under it
}
// leaf skeletons: old leaves rotted down to their lace of veins, pale and see-through
{
  const SKEL_TEX = canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.lineCap = 'round';
    const vein = (x0, y0, a, L, wd, depth) => { let px = x0, py = y0; x.lineWidth = wd; x.beginPath(); x.moveTo(px, py);
      const pts = []; for(let k = 0; k < 8; k++){ a += (trnd() - .5)*.25; px += Math.cos(a)*L/8; py += Math.sin(a)*L/8; x.lineTo(px, py); pts.push([px, py, a]); }
      x.stroke(); if(depth > 0) for(const [qx, qy, qa] of pts) if(trnd() < .55) vein(qx, qy, qa + (trnd() < .5 ? 1 : -1)*(.7 + trnd()*.6), L*.45, wd*.55, depth - 1); };
    x.strokeStyle = 'rgba(236,222,190,1)'; vein(w/2, h, -Math.PI/2, h*.98, 5, 0);
    for(let k = 1; k < 9; k++) for(const sd of [-1, 1]) vein(w/2, h*(1 - k/9.5), -Math.PI/2 + sd*(.9 + trnd()*.2), w*.36*(1 - k*.05), 2.6, 2);
    for(let i = 0; i < 2200; i++){ const px = trnd()*w, py = trnd()*h, a = trnd()*6.28; x.lineWidth = .7; x.strokeStyle = `rgba(230,214,180,${.5 + trnd()*.4})`;   // the fine net between
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a)*(3 + trnd()*5), py + Math.sin(a)*(3 + trnd()*5)); x.stroke(); }
  }, [1, 1]);
  const g = leafGeo('lance', .7, 1.2, .2, .3, 6, 12);
  { const p = g.attributes.position, uv = g.attributes.uv; for(let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i)/1.4 + .5, -p.getZ(i)/2.4 + .5); }   // the texture laid flat across the blade
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: SKEL_TEX, alphaTest: .4, roughness:.8, side:THREE.DoubleSide}), 160), TEMP.litter), c = new THREE.Color();
  for(let i = 0; i < im.count; i++){ const [x, z] = litterSpot(22*AK, 0, 2), s = rr(.4, 1);
    im.setMatrixAt(i, onGround(x, z, .02 + rnd()*.01, rnd()*6.3, new V3(s, s*.5, s), .15)); c.setHSL(rr(.08, .12), rr(.15, .35), rr(.55, .75)); im.setColorAt(i, c); }
  im.receiveShadow = true; scene.add(im);
}
// dead fern fronds: last season's, brown and brittle, lying flat in the litter
{
  const im = hot(new THREE.InstancedMesh(frondGeo(true), new THREE.MeshStandardMaterial({roughness:.9, side:THREE.DoubleSide, vertexColors:true}), 70), TEMP.litter), c = new THREE.Color();
  for(let i = 0; i < im.count; i++){ const [x, z] = litterSpot(22*AK), s = rr(3, 9);
    M4.compose(new V3(x, hAt(x, z) + .015, z), Q.setFromEuler(E.set(0, rnd()*6.3, rr(-.12, .12), 'YXZ')), new V3(s, s*.08, s)); im.setMatrixAt(i, M4);
    c.setHSL(rr(.05, .1), rr(.4, .6), rr(.18, .3)); im.setColorAt(i, c); }
  im.receiveShadow = true; scene.add(im);
}
// curls of bark shed from the trees overhead: half-rolled strips, pale and grey outside, rusty inside
{
  const g = new THREE.CylinderGeometry(1, 1, 1, 14, 6, true, 0, Math.PI*1.35); g.rotateZ(Math.PI/2);
  { const p = g.attributes.position; for(let i = 0; i < p.count; i++){ const x = p.getX(i), k = 1 - .25*x - .15*x*x; p.setY(i, p.getY(i)*k); p.setZ(i, p.getZ(i)*k + Math.sin(x*3)*.08); } g.computeVertexNormals(); }
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: BARK_TEX_S, bumpMap: BARK_TEX_S, bumpScale: 2, roughness:.95, side:THREE.DoubleSide}), 150), TEMP.stick), c = new THREE.Color();
  for(let i = 0; i < im.count; i++){ const [x, z] = litterSpot(22*AK), len = rr(.4, 1.8), r = rr(.06, .16);   // strips 1–5 cm long, curled 4–10 mm across
    M4.compose(new V3(x, hAt(x, z) + r*.7, z), Q.setFromEuler(E.set(rr(-.15, .15), rnd()*6.3, rnd()*6.3, 'YZX')), new V3(len, r, r)); im.setMatrixAt(i, M4);
    rnd() < .5 ? c.setHSL(rr(.06, .1), rr(.1, .25), rr(.45, .65)) : c.setHSL(rr(.03, .07), rr(.4, .6), rr(.3, .45)); im.setColorAt(i, c); }
  im.castShadow = im.receiveShadow = true; scene.add(im); litterBake(im);
}
// seeds and fruit fallen from the canopy: round nuts and drupes (some split, showing a pale inside), winged seeds that
// spun down, and the odd soft fallen fruit going dark in the litter
{
  const c = new THREE.Color();
  const nut = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({roughness:.45}), 140), TEMP.dead);
  for(let i = 0; i < nut.count; i++){ const [x, z] = litterSpot(22*AK, 0, .6), s = rr(.06, .2);   // 4–12 mm across
    nut.setMatrixAt(i, onGround(x, z, s*.65, rnd()*6.3, new V3(s, s*rr(.75, 1), s*rr(1, 1.35)), .5));
    const v = rnd(); v < .45 ? c.setHSL(rr(.04, .08), rr(.4, .6), rr(.12, .24)) : v < .75 ? c.setHSL(rr(.08, .12), rr(.25, .45), rr(.28, .4)) : c.setHSL(rr(.0, .03), rr(.5, .7), rr(.18, .3)); nut.setColorAt(i, c); }
  // split husks: a hollow half-shell lying open, pale inside
  const husk = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI*2, 0, Math.PI*.55), new THREE.MeshStandardMaterial({color:0x8a6a48, roughness:.7, side:THREE.DoubleSide}), 60), TEMP.dead);
  for(let i = 0; i < husk.count; i++){ const [x, z] = litterSpot(22*AK, 0, .6), s = rr(.1, .22);
    M4.compose(new V3(x, hAt(x, z) + s*.25, z), Q.setFromEuler(E.set(Math.PI + rr(-.6, .6), rnd()*6.3, rr(-.4, .4))), new V3(s, s*.8, s)); husk.setMatrixAt(i, M4); }
  // winged seeds: a hard seed with a veined papery wing
  const wingG = leafGeo('lance', .32, .9, 0, .05, 4, 8); wingG.translate(0, 0, -.9);
  const wing = hot(new THREE.InstancedMesh(wingG, new THREE.MeshStandardMaterial({map: LEAF_TEX, roughness:.7, side:THREE.DoubleSide, transparent:true, opacity:.88}), 160), TEMP.dead);
  const seed = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({color:0x4a2e18, roughness:.5}), 160), TEMP.dead);
  for(let i = 0; i < wing.count; i++){ const [x, z] = litterSpot(22*AK), s = rr(.12, .3), yaw = rnd()*6.3, y = hAt(x, z) + .01;
    M4.compose(new V3(x, y, z), Q.setFromEuler(E.set(rr(-.15, .15), yaw, rr(-.25, .25), 'YXZ')), new V3(s, s, s)); wing.setMatrixAt(i, M4);
    M4.compose(new V3(x, y + .1*s, z), Q.setFromEuler(E.set(0, yaw, 0)), new V3(.2*s, .13*s, .3*s)); seed.setMatrixAt(i, M4);
    c.setHSL(rr(.06, .11), rr(.3, .55), rr(.35, .55)); wing.setColorAt(i, c); }
  // fallen fruit: soft, bruised, half sunk, a little fuzzy with mould
  const fruit = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({roughness:.6, map: CAP_TEX}), 24), .3);
  for(let i = 0; i < fruit.count; i++){ const [x, z] = scatter(22*AK, 3), s = rr(.35, .8);   // figs and drupes 2–5 cm
    fruit.setMatrixAt(i, onGround(x, z, s*.35, rnd()*6.3, new V3(s, s*rr(.6, .85), s*rr(.9, 1.15)), .3));
    const v = rnd(); v < .4 ? c.setHSL(rr(.0, .03), rr(.5, .7), rr(.2, .32)) : v < .7 ? c.setHSL(rr(.06, .1), rr(.6, .8), rr(.3, .42)) : c.setHSL(rr(.8, .9), rr(.3, .5), rr(.14, .22)); fruit.setColorAt(i, c); }
  nut.castShadow = husk.castShadow = fruit.castShadow = true; nut.receiveShadow = husk.receiveShadow = wing.receiveShadow = fruit.receiveShadow = true;
  scene.add(nut, husk, wing, seed, fruit); litterBake(nut); litterBake(fruit);
}
// empty snail shells, bleached and chalky, some with a broken lip
{
  const pts = []; for(let k = 0; k <= 60; k++){ const th = k/60*4.2*Math.PI, r = .55*Math.exp(-.2*th); pts.push(new V3(Math.cos(th)*r, .6 - .6*Math.exp(-.2*th), Math.sin(th)*r)); }
  const crv = new THREE.CatmullRomCurve3(pts.reverse());
  const g = taperedTube(crv, t => .025 + .32*Math.pow(t, 1.6), {seg: 70, radial: 12, capStart: true, capEnd: false});
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: TWIG_TEX, roughness:.55, side:THREE.DoubleSide}), 40), TEMP.dead), c = new THREE.Color();
  for(let i = 0; i < im.count; i++){ const [x, z] = litterSpot(20*AK, 1), s = rr(.12, .35);   // shells 6–20 mm
    M4.compose(new V3(x, hAt(x, z) + s*.3, z), Q.setFromEuler(E.set(rr(-1.4, 1.4), rnd()*6.3, rr(-1, 1))), new V3(s, s, s)); im.setMatrixAt(i, M4);
    c.setHSL(rr(.07, .12), rr(.15, .4), rr(.55, .78)); im.setColorAt(i, c); }
  im.castShadow = im.receiveShadow = true; scene.add(im);
}
// a few feathers drifted down from the birds overhead: a pale quill with soft barbs either side
{
  const g = leafGeo('lance', .16, 1, .05, -.15, 4, 10), p = g.attributes.position, col = [];
  for(let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i), q = Math.abs(x) < .012 ? 1.6 : 1, band = .85 + .15*Math.sin(z*28); col.push(q*band, q*band, q*band*.95); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.85, side:THREE.DoubleSide}), 18), TEMP.dead), c = new THREE.Color();
  for(let i = 0; i < im.count; i++){ const [x, z] = scatter(22*AK, 2), s = rr(.8, 2.4);   // 3–7 cm
    im.setMatrixAt(i, onGround(x, z, .02, rnd()*6.3, new V3(s, s, s), .15));
    const v = rnd(); v < .5 ? c.setHSL(rr(.06, .1), rr(.1, .3), rr(.35, .6)) : v < .8 ? c.setHSL(0, 0, rr(.08, .2)) : c.setHSL(rr(.55, .62), rr(.3, .6), rr(.3, .45)); im.setColorAt(i, c); }
  im.receiveShadow = true; scene.add(im);
}
// sticks and twigs, some forked
{
  const g = new THREE.CylinderGeometry(1, 1, 1, 8, 8);                 // knobbly: swellings at the nodes, a slight wander
  { const p = g.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + .14*Math.exp(-((y - .18)**2)/.004) + .1*Math.exp(-((y + .27)**2)/.003) + .06*Math.sin(a*3 + y*9) - .12*Math.max(0, y - .3)*2;
      p.setX(i, p.getX(i)*k + Math.sin(y*4)*.25); p.setZ(i, p.getZ(i)*k); }
    g.computeVertexNormals(); g.rotateZ(Math.PI/2); }
  const n = 440, im = hot(new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({map: TWIG_TEX, bumpMap: TWIG_TEX, bumpScale: 2.5, roughness:.9}), n), TEMP.stick);
  const c = new THREE.Color();
  for(let i = 0; i < n; i += 2){
    const [x, z] = litterSpot(22*AK, 0, .7), len = rr(.8, 6), r = rr(.03, .07)*(.6 + len*.12), yaw = rnd()*6.3;      // twigs 2–18 cm long, 2–6 mm thick
    im.setMatrixAt(i, onGround(x, z, r*.8, yaw, new V3(len, r, r), .08));
    const fy = yaw + rr(-.8, .8), fl = len*rr(.25, .5), o = rr(-.3, .3)*len;
    const fx = x + Math.cos(yaw)*o + Math.cos(fy)*fl*.5, fz = z - Math.sin(yaw)*o - Math.sin(fy)*fl*.5;
    im.setMatrixAt(i + 1, onGround(fx, fz, r*.6, fy, new V3(fl, r*.6, r*.6), .1));
    c.setHSL(rr(.06, .1), rr(.15, .4), rr(.22, .42)); im.setColorAt(i, c); im.setColorAt(i + 1, c);
  }
  im.castShadow = im.receiveShadow = true; scene.add(im); litterBake(im);   // walkable: she steps over it, never under it
}
// dead insects: beetle shells, ants, moth wings — all long cold
{
  const deadN = 70, shell = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({color:0x1d1510, roughness:.25, metalness:.4, side:THREE.DoubleSide}), deadN), TEMP.dead);
  for(let i = 0; i < deadN; i++){ const [x, z] = scatter(18*AK), s = rr(1.5, 4); shell.setMatrixAt(i, onGround(x, z, 0, rnd()*6.3, new V3(.045*s, .03*s, .075*s), .4)); }   // beetles 5–18 mm
  const antN = 60, partM = new THREE.MeshStandardMaterial({color:0x2a1408, roughness:.4});
  const parts = [[.02, .018, .03, .045], [.016, .015, .03, 0], [.026, .022, .034, -.05]].map(([sx, sy, sz, oz]) => ({sx, sy, sz, oz, im: hot(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), partM, antN), TEMP.dead)}));
  for(let i = 0; i < antN; i++){
    const [x, z] = scatter(18*AK), s = rr(1, 1.8), yaw = rnd()*6.3, roll = rnd() < .5 ? 1.4 : 0;
    for(const p of parts){ const px = x + Math.sin(yaw)*p.oz*s, pz = z + Math.cos(yaw)*p.oz*s;
      M4.compose(new V3(px, hAt(px, pz) + p.sy*s*.8, pz), Q.setFromEuler(E.set(0, yaw, roll, 'YXZ')), new V3(p.sx*s, p.sy*s, p.sz*s)); p.im.setMatrixAt(i, M4); }
  }
  const wingN = 45, wing = hot(new THREE.InstancedMesh(leafGeo('round', .05, .08, 0, 0, 4, 6), new THREE.MeshStandardMaterial({color:0xb8a68a, roughness:.8, transparent:true, opacity:.8, side:THREE.DoubleSide}), wingN), TEMP.dead);
  for(let i = 0; i < wingN; i++){ const [x, z] = scatter(18*AK), s = rr(2.5, 5); wing.setMatrixAt(i, onGround(x, z, .012, rnd()*6.3, new V3(s, s, s), .3)); }
  scene.add(shell, wing, ...parts.map(p => p.im));
}
// grass tufts in the light gaps: blades 5–30 cm tall, towering over her (planted once the platforms exist, to keep clear of them)
const plantGrassTufts = () => {
  const g = new THREE.ConeGeometry(.01, 1, 3).translate(0, .5, 0); const p = g.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i); p.setX(i, p.getX(i) + y*y*.28); }
  g.computeVertexNormals();
  const n = 1700, im = hot(new THREE.InstancedMesh(g, sway(new THREE.MeshStandardMaterial({roughness:.8}), .09, 1.9), n), TEMP.grass);
  const c = new THREE.Color(); let k = 0;
  while(k < n){
    const [cx, cz] = scatter(24*AK, 3), m = 8 + Math.floor(rnd()*14); if(nearPlat(cx, cz, 1.2)) continue;
    for(let j = 0; j < m && k < n; j++, k++){
      const x = cx + rr(-.9, .9), z = cz + rr(-.9, .9), h = rr(1.5, 9), w = 1.5 + h*.6;
      im.setMatrixAt(k, onGround(x, z, -.01, rnd()*6.3, new V3(w, h, w), .3));
      c.setHSL(rr(.17, .27), rr(.35, .6), rr(.18, .34)); if(rnd() < .25) c.setHSL(rr(.08, .12), .4, .3); im.setColorAt(k, c);
    }
  }
  im.receiveShadow = true; scene.add(im);
};
// dirt clods, pebbles, seeds
{
  const n = 950, im = hot(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), new THREE.MeshStandardMaterial({roughness:.95, flatShading:true}), n), TEMP.pebble);
  const c = new THREE.Color();
  for(let i = 0; i < n; i++){
    const [x, z] = litterSpot(22*AK, 0, .4), s = rr(.03, .2)*(rnd() < .1 ? 2.5 : 1);
    im.setMatrixAt(i, onGround(x, z, s*.2, rnd()*6.3, new V3(s, s*rr(.5, .9), s*rr(.8, 1.2)), 1));
    rnd() < .6 ? c.setHSL(rr(.05, .1), rr(.3, .5), rr(.08, .2)) : c.setHSL(rr(.08, .12), rr(.05, .15), rr(.25, .45)); im.setColorAt(i, c);
  }
  im.receiveShadow = true; scene.add(im); litterBake(im);   // walkable: she steps over it, never under it
}
// surface roots
{
  const m = new THREE.MeshStandardMaterial({color:0x6a5038, map: ROOT_TEX, bumpMap: ROOT_TEX, bumpScale: 2.5, roughness:.9});
  for(let i = 0; i < 30; i++){
    let [x, z] = scatter(19*AK, 2), a = rnd()*6.3; const pts = [];
    for(let k = 0; k < 12; k++){ pts.push(new V3(x, hAt(x, z) + .015, z)); a += rr(-.5, .5); x += Math.cos(a)*1.1; z += Math.sin(a)*1.1; }
    const crv = new THREE.CatmullRomCurve3(pts), tr = rr(.12, .3);                                    // roots 7–18 mm thick, snaking 40 cm
    const t = hot(new THREE.Mesh(new THREE.TubeGeometry(crv, 40, tr, 6), m), TEMP.wood); t.receiveShadow = t.castShadow = true; scene.add(t); OCCLUDERS.push(t);
    tubeSurface(crv.getPoints(24), tr);
  }
}
// half-buried boulders
{
  // a finely subdivided stone: lumpy at several scales, cut by a few flat fracture faces, crevices darker, moss and
  // lichen on the faces that look up; shared by every boulder (each scaled and turned differently)
  const g = new THREE.IcosahedronGeometry(1, 5), q = g.attributes.position, col = [], cc = new THREE.Color(), d = new V3();
  const cuts = [new V3(.7, .2, .5), new V3(-.4, .3, -.8), new V3(.1, .9, -.3), new V3(-.8, -.1, .4)].map(v => v.normalize());
  const fbm = v => { let a = 0, amp = .5, f = 1.3; for(let o = 0; o < 5; o++){ a += amp*(vnoise(v.x*f + v.z*f*.6 + o*3.7, v.y*f + v.x*f*.4 - o*1.3) - .5); amp *= .5; f *= 2.1; } return a; };
  for(let i = 0; i < q.count; i++){
    d.set(q.getX(i), q.getY(i), q.getZ(i)).normalize();
    let k = 1 + fbm(d)*.42 + Math.abs(fbm(d.clone().multiplyScalar(3.1)))*.05;
    for(const cn of cuts){ const dt = d.dot(cn); if(dt > .55) k = Math.min(k, .62/dt); }                    // flat fracture faces
    q.setXYZ(i, d.x*k, d.y*k, d.z*k);
    const crev = Math.max(0, 1 - k)*1.6, n2 = vnoise(d.x*6 + 3, d.z*6 + d.y*4);
    cc.setRGB(.58 + .1*n2, .56 + .09*n2, .52 + .08*n2).multiplyScalar(1 - crev*.5);
    if(d.y > .35 && n2 > .55) cc.lerp(new THREE.Color(.24, .36, .12), Math.min(.8, (n2 - .55)*3));        // moss on the tops
    else if(n2 > .78) cc.lerp(new THREE.Color(.82, .84, .7), .45);                                           // pale lichen
    col.push(cc.r, cc.g, cc.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const n = 110, im = hot(new THREE.InstancedMesh(g, antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: STONE_TEX, bumpMap: STONE_TEX, bumpScale: 3, roughness:.9})), n), TEMP.rock);
  const c = new THREE.Color();
  for(let i = 0; i < n; i++){
    const [x, z] = scatter(21*AK, 1.5), s = rr(.2, .95);                                                          // stones 1–6 cm
    const yaw = rnd()*6.3, sc = new V3(s*rr(.8, 1.3), s*rr(.5, .9), s*rr(.8, 1.3));
    im.setMatrixAt(i, onGround(x, z, -s*.35, yaw, sc, .3));
    blobSurface(x, hAt(x, z) - s*.35, z, sc.x*.9, sc.y*.9, sc.z*.9, yaw);
    c.setHSL(rr(.06, .14), rr(.04, .18), rr(.55, .8)); im.setColorAt(i, c);                                     // a per-stone tint
  }
  im.castShadow = im.receiveShadow = true; scene.add(im);
}
// fern clumps: grown ferns with fronds 25–60 cm long, arching high over the floor around the play area
{
  const g = frondGeo();
  const centers = []; for(let i = 0; i < 30; i++) centers.push(scatter(70, 47));
  { const cr = hot(new THREE.InstancedMesh(fernCrownGeo(), new THREE.MeshStandardMaterial({color:0x5a3f26, map: FIDDLE_TEX, bumpMap: FIDDLE_TEX, bumpScale: 2, roughness:.9}), centers.length), TEMP.wood);
    centers.forEach(([x, z], i) => { const s = rr(.35, .6); cr.setMatrixAt(i, M4.compose(new V3(x, hAt(x, z) - .05, z), Q.setFromEuler(E.set(0, rnd()*6.3, 0)), new V3(s, s, s))); });
    cr.castShadow = cr.receiveShadow = true; scene.add(cr); }
  const im = hot(new THREE.InstancedMesh(g, sway(new THREE.MeshStandardMaterial({color:0x4f7f34, roughness:.75, side:THREE.DoubleSide, vertexColors:true}), .012), centers.length*9), TEMP.leaf);
  const c = new THREE.Color(); let k = 0;
  for(const [x, z] of centers) for(let j = 0; j < 9; j++){
    const s = rr(8, 20);
    M4.compose(new V3(x, hAt(x, z), z), Q.setFromEuler(E.set(rr(-.25, .15), j/9*6.28 + rr(-.3, .3), 0, 'YXZ')), new V3(s, s*rr(.8, 1.2), s));
    im.setMatrixAt(k, M4); c.setHSL(rr(.24, .3), rr(.4, .6), rr(.2, .3)); im.setColorAt(k, c); k++;
  }
  im.castShadow = im.receiveShadow = true; scene.add(im);
}
// small pale mushrooms (Mycena-like), cold; no glow
const MUSH_SPOTS = [], MUSH_GLOW_M = new THREE.MeshStandardMaterial({color:0xd8eccc, roughness:.45});
{
  MUSH_GLOW_M.map = MUSH_GLOW_M.bumpMap = CAP_TEX; MUSH_GLOW_M.bumpScale = 1.2; MUSH_GLOW_M.side = THREE.DoubleSide;
  const n = 120, cap = hot(new THREE.InstancedMesh(capGeo('bell'), MUSH_GLOW_M, n), TEMP.fungus);
  const gill = hot(new THREE.InstancedMesh(gillGeo(), new THREE.MeshStandardMaterial({color:0xe0e6d4, map: GILL_TEX, roughness:.8, side:THREE.DoubleSide}), n), TEMP.fungus);
  const stem = hot(new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .018, 1, 8).translate(0, .5, 0), new THREE.MeshStandardMaterial({color:0xcfd8c0, map: FIDDLE_TEX, roughness:.6}), n), TEMP.fungus);
  for(let i = 0; i < n; i++){                                                     // caps 1–2.5 cm across on stems 2–6 cm tall
    const cl = i % 12, r = 4 + cl*2.9, a = cl*2.3 + rr(-.35, .35), rad = r + rr(-.8, .8), h = rr(.6, 1.9), cs = rr(.17, .42);
    const x = Math.cos(a)*rad, z = Math.sin(a)*rad, y = hAt(x, z), sw = 4 + cs*6;
    M4.compose(new V3(x, y, z), Q.setFromEuler(E.set(rr(-.2, .2), 0, rr(-.2, .2))), new V3(sw, h, sw)); stem.setMatrixAt(i, M4);
    const tp = new V3(0, h, 0).applyQuaternion(Q).add(new V3(x, y, z));             // the top of the leaning stem
    M4.compose(tp, Q.setFromEuler(E.set(rr(-.15, .15), rnd()*6.3, rr(-.15, .15))), new V3(cs, cs*.8, cs)); cap.setMatrixAt(i, M4); gill.setMatrixAt(i, M4); MUSH_SPOTS.push([tp.x, tp.y + cs*.3, tp.z, cs]);
  }
  scene.add(cap, gill, stem);
}
// tree trunks (climbable), lianas, canopy
const barkM = antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: BARK_TEX, bumpMap: BARK_TEX, bumpScale: 2, roughness:.95}));
const barkStumpM = antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: BARK_TEX_S, bumpMap: BARK_TEX_S, bumpScale: 2, roughness:.95}));
{
  // TREE_LIST (declared with the terrain): giants rise ~20 m (they vanish into the haze long before), the young trees ~8 m
  for(const [x, z, r] of TREE_LIST){
    const big = r > 5, rb = r*1.1, rt = r*(big ? .82 : .75), H = big ? 700 : 260, amt = .05, T = big ? 6 : 3;
    let y0 = 1e9; for(let k = 0; k < 16; k++){ const a = k/16*6.283; y0 = Math.min(y0, hAt(x + Math.cos(a)*rb*1.15, z + Math.sin(a)*rb*1.15)); }
    y0 -= .3 + (big ? 1 : 0);                                 // rooted below the lowest ground around it: never floating
    const g = barkify(new THREE.CylinderGeometry(rt, rb, H, 88, big ? 180 : 140).translate(0, H/2, 0), r, amt);
    const uv = g.attributes.uv; for(let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*2*Math.PI*rb/(3*T), uv.getY(i)*H/(13*T));   // bark plates sized to the trunk
    const t = hot(new THREE.Mesh(g, barkM), TEMP.trunk); t.position.set(x, y0, z); t.castShadow = t.receiveShadow = true; scene.add(t); OCCLUDERS.push(t);
    makeClimb({label:'bark', tree:true, cx:x, cz:z, y0, y1: y0 + H, radius: (ux, uz, ly) => (rb + (rt - rb)*ly/H)*barkK(Math.atan2(uz, ux), ly, amt)});
  }
  // lianas: woody ropes 1–4 cm thick, hanging out of the canopy far overhead
  const lianaM = new THREE.MeshStandardMaterial({color:0x3a3a22, roughness:.9});
  for(let i = 0; i < 18; i++){
    const [x, z] = scatter(28*AK, 6), pts = [], top = rr(260, 340);
    for(let k = 0; k <= 12; k++){ const t = k/12; pts.push(new V3(x + Math.sin(t*9 + i)*3*t, top - t*(top - hAt(x, z)), z + Math.cos(t*7 + i)*3*t)); }
    const crv = new THREE.CatmullRomCurve3(pts), lr = rr(.2, .65);
    const m = hot(new THREE.Mesh(new THREE.TubeGeometry(crv, 140, lr, 8), lianaM), TEMP.liana); m.castShadow = true; scene.add(m);
    tubeSurface(crv.getPoints(60), lr, 'vine');
  }
  // the canopy: leaf masses 5–10 m overhead, dark against the bright haze
  const can = hot(new THREE.InstancedMesh(leafGeo('lance', 1.5, 2.8, .5, .15, 6, 10), new THREE.MeshStandardMaterial({color:0x2a4a1f, emissive:0x1a3510, roughness:.8, side:THREE.DoubleSide, fog:false}), 1600), TEMP.canopy);
  for(let i = 0; i < can.count; i++){
    const [x, z] = scatter(240), s = rr(3, 9);
    M4.compose(new V3(x, rr(170, 330), z), Q.setFromEuler(E.set(rr(-.5, .5), rnd()*6.3, rr(-.5, .5))), new V3(s, s, s)); can.setMatrixAt(i, M4);
  }
  scene.add(can);
}

// walkable platforms
const PLAT = [];
const GROUND = {id:'ground', ground:true, y:0};
const surfY = (p, x, z) => p.ground ? floorAt(x, z) : p.y;
function inPlat(p, x, z, margin = 0){
  if(p.ground) return Math.hypot(x, z) < AREA;
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
  const lx = dx*c - dz*s, lz = dx*s + dz*c;
  const a = Math.max(.05, p.rx - margin), b = Math.max(.05, p.rz - margin);
  return (lx*lx)/(a*a) + (lz*lz)/(b*b) <= 1;
}
function randomIn(p, margin = .2){
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  for(let i = 0; i < 40; i++){
    const lx = (rnd()*2 - 1)*p.rx, lz = (rnd()*2 - 1)*p.rz, x = p.x + lx*c + lz*s, z = p.z - lx*s + lz*c;
    if(inPlat(p, x, z, margin)) return new V3(x, p.y, z);
  }
  return new V3(p.x, p.y, p.z);
}
// surface height of a platform at (x, z), and clamping a point onto it
function leafH(q, lx, lz){
  const yy = Math.max(-1, Math.min(1, -lz/q.l)), t = (yy + 1)/2;
  let wd;
  if(q.type === 'heart') wd = Math.pow(Math.sin(Math.PI*(.12 + .88*Math.pow(t, .8))), .7)*1.05;
  else if(q.type === 'round') wd = Math.sqrt(Math.max(0, 1 - yy*yy));
  else wd = Math.pow(Math.sin(Math.PI*Math.pow(t, .85)), .8);
  const u = Math.max(-1, Math.min(1, lx/Math.max(1e-3, wd*q.w)));
  return Math.abs(u)*wd*q.fold*q.w - q.droop*Math.pow(Math.max(0, t - .65)/.35, 2)*q.l*.35 - .07*u*u*q.w;
}
function surfAt(p, x, z){
  if(p.ground) return floorAt(x, z);
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot), lx = dx*c - dz*s, lz = dx*s + dz*c;
  if(p.leaf) return p.y + leafH(p.leaf, lx, lz);
  if(p.cup !== undefined){ const r = Math.hypot(lx, lz); return p.y + Math.max(r*p.cup, Math.sqrt(Math.max(0, p.ctr*p.ctr - r*r))); }
  if(p.kind === 'log'){ const R = logR(p, lx, Math.sqrt(Math.max(0, p.r*p.r - lx*lx)), lz); return p.cy + Math.sqrt(Math.max(0, R*R - lx*lx)); }
  return p.y;
}
function clampTo(p, x, z){
  if(p.ground) return [x, z];
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
  let lx = dx*c - dz*s, lz = dx*s + dz*c;
  const e = Math.sqrt((lx/p.rx)**2 + (lz/p.rz)**2), lim = p.kind === 'log' ? 1.6 : 1.04;   // feet may grip the log's flanks
  if(e > lim){ lx *= lim/e; lz *= lim/e; }
  return [p.x + lx*c + lz*s, p.z - lx*s + lz*c];
}
const LEAF_GREENS = [0x5f8f3e, 0x6fa04a, 0x4b7a34, 0x7da84f, 0x587f2f, 0x8aa84a, 0x4f8a48];
const stemM = new THREE.MeshStandardMaterial({color:0x4d5a2a, roughness:.8});
// ht is height above the local ground
function addLeaf(x, ht, z, type, w, l, rot){
  const y = hAt(x, z) + ht, droop = .3, fold = .1;
  const mat = glowLeaf(new THREE.MeshStandardMaterial({color: LEAF_GREENS[Math.floor(rnd()*LEAF_GREENS.length)], map: LEAF_TEX, bumpMap: LEAF_TEX, bumpScale: .8, roughness:.55, side:THREE.DoubleSide}), .2);
  const leaf = hot(new THREE.Mesh(leafGeo(type, w, l, droop, fold), mat), TEMP.leaf); leaf.position.set(x, y, z); leaf.rotation.y = rot;
  leaf.castShadow = leaf.receiveShadow = true; scene.add(leaf); OCCLUDERS.push(leaf);
  const vc = mat.color.clone().lerp(new THREE.Color(0xe8f0b0), .45);
  leaf.add(new THREE.LineSegments(veinGeo(type, w, l, droop, fold), new THREE.LineBasicMaterial({color: vc})));
  const base = leaf.localToWorld(new V3(0, -.02, l*1.02));
  const bx = base.x + rr(-.8, .8), bz = base.z + rr(-.8, .8), gy = hAt(bx, bz);
  const curve = new THREE.CatmullRomCurve3([new V3(bx, gy - .05, bz), new V3((bx + base.x)/2 + rr(-.4, .4), gy + (base.y - gy)*.55, (bz + base.z)/2 + rr(-.4, .4)), new V3(base.x, base.y - .05, base.z), base]);
  const stem = hot(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .03, 6), stemM), TEMP.stem); stem.castShadow = true; scene.add(stem);
  for(let k = 0; k < 3; k++){
    const t = rr(.2, .7), at = curve.getPoint(t), sw = rr(.2, .38), sl = rr(.45, .75);
    const dm = sway(glowLeaf(new THREE.MeshStandardMaterial({color: LEAF_GREENS[Math.floor(rnd()*LEAF_GREENS.length)], map: LEAF_TEX, roughness:.6, side:THREE.DoubleSide})), .04);
    const d = hot(new THREE.Mesh(leafGeo('lance', sw, sl, .6, .15), dm), TEMP.leaf); d.position.copy(at); d.rotation.set(0, rnd()*6.3, 0, 'YXZ');
    d.rotateX(rr(.25, .6)); d.translateZ(-sl*.95); d.castShadow = true; scene.add(d);
  }
  const p = {id:'L' + PLAT.length, kind:'leaf', x, y, z, rx:w*.82, rz:l*.78, rot, leaf:{type, w, l, droop, fold}}; PLAT.push(p);
  p.under = leafUnder(p); return p;
}
function addLog({x:cx, z:cz, ang, r, len}){
  const gy = hAt(cx, cz);
  const g = barkify(new THREE.CylinderGeometry(r, r*1.05, len, 22, 30), r, .05); g.rotateX(Math.PI/2);
  const logTex = BARK_TEX_S.clone(); logTex.repeat.set(3, 7); logTex.needsUpdate = true;
  const m = hot(new THREE.Mesh(g, antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: logTex, bumpMap: logTex, bumpScale: 2, roughness:.95}))), TEMP.wood); m.position.set(cx, gy + r*LOG.sink, cz); m.rotation.y = ang;
  m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
  const ax = new V3(Math.sin(ang), 0, Math.cos(ang)), sd = new V3(Math.cos(ang), 0, -Math.sin(ang));
  const moss = hot(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color:0x4d7a2a, roughness:1}), 90), TEMP.moss);
  for(let i = 0; i < moss.count; i++){
    const along = rr(-len*.45, len*.45), a = rr(-1.1, 1.1), s = rr(.05, .14);
    const p = new V3(cx, gy + r*LOG.sink, cz).addScaledVector(ax, along).addScaledVector(sd, Math.sin(a)*r).add(new V3(0, Math.cos(a)*r, 0));
    M4.compose(p, Q.identity(), new V3(s, s*.5, s)); moss.setMatrixAt(i, M4);
  }
  moss.receiveShadow = true; scene.add(moss);
  const top = {id:'LOG', kind:'log', x:cx, y:gy + r*(1 + LOG.sink), z:cz, rx:r*.42, rz:len*.46, rot:ang, r, len, cy: gy + r*LOG.sink}; PLAT.push(top);
  top.climb = logClimb(top, ax, sd);
  const fm = new THREE.MeshStandardMaterial({color:0xd9a35c, roughness:.7});
  for(const [along, side, h, fr] of [[-2.6, 1, .45, .42], [.4, -1, .55, .38], [2.8, 1, .6, .34], [1.6, 1, .3, .3]]){
    const out = sd.clone().multiplyScalar(side);
    const f = hot(new THREE.Mesh(new THREE.CylinderGeometry(fr, fr*.85, .05, 18, 1, false, 0, Math.PI), fm), TEMP.fungus);
    const at = new V3(cx, gy + h, cz).addScaledVector(ax, along).addScaledVector(out, Math.sqrt(Math.max(0, r*r - (h - r*LOG.sink)**2))*.97);   // set into the bark at that height
    f.position.copy(at); f.rotation.y = Math.atan2(-out.z, out.x); f.castShadow = f.receiveShadow = true; scene.add(f);
    const c = at.clone().addScaledVector(out, fr*.45);
    PLAT.push({id:'F' + PLAT.length, kind:'fungus', x:c.x, y:gy + h + .025, z:c.z, rx:fr*.42, rz:fr*.42, rot:0});
  }
}
function addRock({x, z, r, h}){
  const gy = hAt(x, z);
  const g = new THREE.CylinderGeometry(r*.85, r, h + .3, 9, 10); const p = g.attributes.position, col = [], c = new THREE.Color();
  for(let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), H = h + .3, ly = (y + H/2)/H, rad = Math.hypot(x, z);
    if(rad > .01){ const k = 1 + (hash2(Math.atan2(z, x)*3.1, y*4.3) - .5)*.035; p.setX(i, x*k); p.setZ(i, z*k); }       // slight unevenness (feet stay within ~2 cm)
    const n = hash2(x*5.3 + y*2.1, z*4.7), top = ly > .97;
    c.setRGB(.52 + .1*n, .5 + .09*n, .46 + .08*n).multiplyScalar(.6 + .4*ly);                                            // grey stone, darker toward the soil
    if(top && n > .45) c.lerp(new THREE.Color(.2, .32, .1), .7); else if(ly > .75 && n > .8) c.lerp(new THREE.Color(.22, .3, .12), .5);   // moss only in patches
    if(ly < .25) c.lerp(new THREE.Color(.16, .12, .08), (.25 - ly)*2);                                                     // soil-stained base
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = hot(new THREE.Mesh(g, antiTile(new THREE.MeshStandardMaterial({vertexColors:true, map: STONE_TEX, bumpMap: STONE_TEX, bumpScale: 2.5, roughness:.9}))), TEMP.rock);
  const rot = rnd()*3;
  m.position.set(x, gy + (h - .3)/2, z); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
  const top = {id:'R' + PLAT.length, kind:'rock', x, y:gy + h, z, rx:r*.78, rz:r*.78, rot:0}; PLAT.push(top);
  const H = h + .3, n = 9, seg = 2*Math.PI/n;
  top.climb = makeClimb({label:'stone', cx:x, cz:z, y0: gy - .3, y1: gy + h, top, radius: (ux, uz, ly) => {
    const lx = ux*Math.cos(rot) - uz*Math.sin(rot), lz = ux*Math.sin(rot) + uz*Math.cos(rot), th = ((Math.atan2(lx, lz) % seg) + seg) % seg;
    return (r + (r*.85 - r)*ly/H)*Math.cos(Math.PI/n)/Math.cos(th - Math.PI/n);
  }});
}
// tree stumps: bark sides to climb, a cut top with growth rings to stand on
function addStump({x, z, r, h}){
  const gy = hAt(x, z), y0 = gy - .4, H = h + .4, amt = .04, rb = r*1.1, rt = r*.95;
  const m = hot(new THREE.Mesh(barkify(new THREE.CylinderGeometry(rt, rb, H, 64, Math.ceil(H*4)).translate(0, H/2, 0), r, amt), barkStumpM), TEMP.wood);
  m.position.set(x, y0, z); m.castShadow = m.receiveShadow = true; scene.add(m); OCCLUDERS.push(m);
  const cap = hot(new THREE.Mesh(new THREE.CircleGeometry(rt*(1 - amt), 48).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({color:0x8a6a48, roughness:.9})), TEMP.wood);
  cap.position.set(x, y0 + H + .002, z); cap.receiveShadow = true; scene.add(cap);
  const rings = []; for(let k = 1; k < 7; k++){ const rr2 = rt*.9*k/7; for(let j = 0; j < 32; j++){ const a0 = j/32*6.283, a1 = (j + 1)/32*6.283; rings.push(new V3(Math.cos(a0)*rr2, .004, Math.sin(a0)*rr2), new V3(Math.cos(a1)*rr2, .004, Math.sin(a1)*rr2)); } }
  cap.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rings), new THREE.LineBasicMaterial({color:0x5a4028})));   // rings lie flat on the cut face
  const top = {id:'S' + PLAT.length, kind:'stump', x, y: y0 + H, z, rx: rt*.85, rz: rt*.85, rot: 0}; PLAT.push(top);
  top.climb = makeClimb({label:'bark', cx:x, cz:z, y0, y1: y0 + H, top, radius: (ux, uz, ly) => (rb + (rt - rb)*ly/H)*barkK(Math.atan2(uz, ux), ly, amt)});
}
const START = addLeaf(0, 2.0, 0, 'heart', 1.0, 1.4, .3);
addLeaf(3.2, 2.5, -1.0, 'lance', .8, 1.4, 1.1);
addLeaf(5.8, 3.2, .6, 'heart', 1.0, 1.4, -.4);
addLeaf(2.2, 1.3, 3.0, 'round', .9, 1.0, .9);
addLeaf(-2.8, 2.8, 1.8, 'lance', .8, 1.5, -.8);
addLeaf(-1.4, 2.2, -3.2, 'heart', .9, 1.3, .5);
addLeaf(3.6, 1.6, -4.2, 'lance', .7, 1.3, -1.2);
const MALE_LEAF = addLeaf(8.8, 3.6, -1.8, 'heart', 1.1, 1.6, .6);
addLeaf(-5.2, 1.7, -.6, 'round', .9, 1.1, 1.4);
addLeaf(6.3, 4.4, -3.6, 'lance', .8, 1.3, .2);
addLeaf(-4.6, 3.8, 3.6, 'heart', 1.0, 1.5, 2.0);
addLeaf(.8, 4.0, -2.2, 'lance', .7, 1.2, -.3);
addLeaf(-3.4, 1.0, -3.6, 'round', .8, .9, .2);
addLeaf(5.0, 1.0, 3.4, 'lance', .7, 1.2, 2.4);
addLog(LOG);
ROCKS.forEach(addRock);
STUMPS.forEach(addStump);
// a leaf above the armed spitting spider's leaf, to drop from
addLeaf(5.45, (PLAT[2].y + 1.45) - hAt(5.45, 1.05), 1.05, 'round', .5, .6, .4);
// Argiope's orb: vertical, with a frame-anchored leaf beside it and a leaf above it
const ARG = (() => {
  const x = -7.4, z = 1.2, gy = hAt(x, z), R = 4.2;                 // an orb ~25 cm across, as real Argiope webs are
  const C = new V3(x, gy + R + .5, z), n = new V3(1, 0, 0), u = new V3(0, 0, 1);
  const side = addLeaf(x - .05, (C.y - .08) - hAt(x - .05, z + R + .65), z + R + .65, 'lance', .55, 1.0, Math.PI/2);
  const above = addLeaf(x + .32, (C.y + R + .3) - hAt(x + .32, z), z, 'round', .55, .7, 0);
  return {C, n, u, R, side, above};
})();
// Badumna's lacy sheet beside the log, its retreat tube running into the wood
const BAD = (() => {
  const ax = new V3(Math.sin(LOG.ang), 0, Math.cos(LOG.ang)), sd = new V3(Math.cos(LOG.ang), 0, -Math.sin(LOG.ang));
  const cy = hAt(LOG.x, LOG.z) + LOG.r*LOG.sink;
  const mouth = new V3(LOG.x, cy + .12, LOG.z).addScaledVector(ax, -1.6).addScaledVector(sd, -LOG.r*.98);
  const RX = 1.65, RZ = 1.5, center = mouth.clone().addScaledVector(sd, -(RX + .02)); center.y = mouth.y - .04;
  const plat = {id:'WEB-B', kind:'web', x:center.x, y:center.y, z:center.z, rx:RX, rz:RZ, rot: LOG.ang};
  PLAT.push(plat);
  return {ax, sd, mouth, plat};
})();
// is (x, z) under Badumna's sheet (plus a margin)? the floor dressing keeps clear of it, so nothing pokes up through the silk
const underSheet = (x, z, m = 0) => { const p = BAD.plat, c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
  return Math.hypot((dx*c - dz*s)/(p.rx*1.3 + m), (dx*s + dz*c)/(p.rz*1.3 + m)) < 1; };
