'use strict';
// shared helpers, persistent store, locked look/style config, renderer

const $ = s => document.querySelector(s);
const V3 = THREE.Vector3;
// 'salticid.' is the old prefix, still read so settings saved before the rename carry over.
const store = {get(k, d){ try { let v = localStorage.getItem('portia.' + k); if(v == null) v = localStorage.getItem('salticid.' + k); return v == null ? d : v; } catch(e){ return d; } },
               set(k, v){ try { localStorage.setItem('portia.' + k, v); } catch(e){} }};

/* =====================================================================
   LOCKED STYLE — Braille glyph ramp, Thermal palette (colour = temperature)
   ===================================================================== */
const GLYPHSET = {chars: (() => { let s = ''; for(let k = 1; k < 256; k++) s += String.fromCharCode(0x2800 + k); return s; })(), edges:['⠒','⡜','⡇','⢣']};
const PAL = {bg:[.01,.008,.03], lo:[.1,.04,.38], mid:[.85,.15,.3], hi:[1,.95,.55], mot:[1,1,1], air:[[.2,.9,1],[.4,1,.5],[1,.5,1]], scent:[.6,1,.4]};
const GLYPH = {XXXS:[3, 5], XXS:[4, 6], XS:[4, 8], S:[5, 9], M:[6, 11], L:[8, 14]};   // cell sizes (px); XXXS is the locked look

/* ---------- LOOK LAB: filters, colour grades, glow and highlight effects to explore (V opens the panel) ---------- */
const GLYPHSETS = {
  braille:{chars: GLYPHSET.chars, edges: GLYPHSET.edges},
  brailleRound:{chars: GLYPHSET.chars, edges: GLYPHSET.edges, dots: true}          // braille drawn as round, anti-aliased dots
};
// braille is the glyph renderer; every other filter paints the full-resolution scene (id = branch in filterMat)
const FILTERS = {
  braille:{name:'braille', id:-1}, clean:{name:'clean 3D', id:0},
  watercolor:{name:'watercolour', id:1}, oil:{name:'oil paint', id:2}, crt:{name:'CRT screen', id:3}, vhs:{name:'VHS tape', id:4},
  pencil:{name:'coloured pencil', id:5}, ink:{name:'ink & tone', id:6}, cel:{name:'cel shaded', id:7}, pixel:{name:'pixel art', id:8},
  glass:{name:'stained glass', id:9}, mosaic:{name:'mosaic tiles', id:10}, points:{name:'pointillism', id:11}, charcoal:{name:'charcoal', id:12},
  cmyk:{name:'CMYK print', id:13}, gouache:{name:'gouache', id:14}, etching:{name:'etching', id:15}, glitch:{name:'glitch', id:16},
  tilt:{name:'tilt-shift', id:17}, dreamy:{name:'dreamy', id:18}, neon:{name:'neon edges', id:19}, crayon:{name:'wax crayon', id:20}
};
const BRAILLE_STYLES = {classic:{set:'braille', mode:0}, round:{set:'brailleRound', mode:0}, hd:{set:'braille', mode:1}};
// colour grades: always the world's own colours, varied like a film stock or a time of day.
// temp: warm+ / cool-; tint: magenta+ / green-; expo, con, sat, vib (lifts dull colours), fade (milky blacks), sh / hi: shadow / highlight tints
const GRADES = {
  natural:{}, 'golden hour':{temp:.6, sat:1.1, con:1.05, hi:'#ffd9a0', sh:'#3a2850'}, 'morning mist':{temp:-.3, con:.82, fade:.08, sat:.85, expo:1.05},
  'lush tropic':{sat:1.3, vib:.4, tint:-.25, con:1.1}, overcast:{sat:.72, con:.9, temp:-.15}, vivid:{sat:1.4, con:1.2, vib:.3},
  pastel:{sat:.7, fade:.15, con:.8, expo:1.1}, 'portra film':{temp:.2, sh:'#2a4048', hi:'#ffe6c8', fade:.04, sat:.95, con:.95},
  kodachrome:{sat:1.25, con:1.15, hi:'#ffd0b0', sh:'#18204a'}, 'bleach bypass':{sat:.45, con:1.35}, 'teal & orange':{sh:'#1e5060', hi:'#ffc890', sat:1.1, con:1.05},
  autumn:{temp:.45, tint:.2, sat:1.1, hi:'#ffcc80'}, moonlight:{temp:-.7, expo:.7, sat:.6, con:1.1, sh:'#102040'}, 'deep shade':{expo:.75, con:1.2, sh:'#0c2a18', sat:1.05},
  'high key':{expo:1.3, con:.85, fade:.05}, chiaroscuro:{expo:.85, con:1.5, sat:1.05}, 'faded vintage':{fade:.12, sat:.75, temp:.25, hi:'#ffe8b0', sh:'#203048'},
  technicolor:{sat:1.5, con:1.12, vib:.2}, 'cold steel':{temp:-.4, sat:.8, con:1.15}, 'sun-drenched':{expo:1.15, temp:.35, sat:1.15, fade:.03},
  dusk:{temp:.1, tint:.25, expo:.85, sh:'#30184a', hi:'#ffb8a0'}
};
const HER_STYLES = {same:0, clean:1};
const LOOK_BASE = {filter:'braille', braille:'classic', grade:'natural', size:'XXXS', detail:1, herStyle:'same',
  fAmt:1, fScale:1, dens:1, cap:1, dot:1, stag:0, edges:1, bloom:.5,
  glow:0, glowThr:.55, glowSize:1, glowWarm:0,
  gradeAmt:1, sat:1, bright:1, gamma:1,
  pColor:'#ffd84a', outCol:'white', pTint:0, pBoost:0, pOut:0, pGlow:0, pGlowR:3, pPulse:0, wDim:0, wDesat:0, spot:0, spotR:.35, dFade:0, dof:0,
  vig:.5, scan:.05, grain:0, chroma:0};
// the default look: oil paint, dusk grade
const LOOK_DEF = Object.assign({}, LOOK_BASE, {"filter":"oil","braille":"classic","grade":"dusk","size":"XXXS","detail":1,"herStyle":"same","fAmt":0.7,"fScale":2.05,"dens":1,"cap":1,"dot":1,"stag":0,"edges":1,"bloom":0.5,"glow":0,"glowThr":0.55,"glowSize":1,"glowWarm":0,"gradeAmt":0.9,"sat":0.7,"bright":1.15,"gamma":1,"pColor":"#ff3b6b","outCol":"accent","pTint":0,"pBoost":0,"pOut":0,"pGlow":0.15,"pGlowR":6,"pPulse":0,"wDim":0.2,"wDesat":0,"spot":0,"spotR":0.35,"dFade":0,"dof":0.15,"vig":0,"scan":0,"grain":0.16,"chroma":2.75});
const LOOK = Object.assign({}, LOOK_DEF);
try { const s = JSON.parse(store.get('look.v3', '{}')); for(const k in s) if(k in LOOK_DEF) LOOK[k] = s[k]; } catch(e){}
if(!GLYPH[LOOK.size]) LOOK.size = 'XXXS'; if(!FILTERS[LOOK.filter]) LOOK.filter = 'braille'; if(!GRADES[LOOK.grade]) LOOK.grade = 'natural'; if(!BRAILLE_STYLES[LOOK.braille]) LOOK.braille = 'classic';
const hexRGB = h => { h = String(h).replace('#', ''); if(h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16 & 255)/255, (n >> 8 & 255)/255, (n & 255)/255]; };
const R = {view:'ascii', glyph: LOOK.size, style:'braille'};


// Temperature scale, 0..1 (≈ 10 °C .. 40 °C). Everything in the world carries one of these.
const TEMP = {
  soil:.4, leaf:.22, stem:.25, litter:.26, stick:.33, dead:.08, rock:.5, wood:.33, moss:.16, fungus:.13,
  trunk:.3, canopy:.46, liana:.27, grass:.26, pebble:.44, silk:.4, preview:.6
};

/* =====================================================================
   RENDERER
   ===================================================================== */
const canvas = $('#view');
let renderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'}); }
catch(e){ const b = $('#err'); b.hidden = false; b.textContent = 'This needs WebGL2.'; throw e; }
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCF honours shadow.radius -> soft, low-contrast shade
renderer.shadowMap.autoUpdate = false;

// concatenate (non-indexed) geometries into one, so a whole tree crown is a single draw call
function mergeGeos(geos){
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g); let n = 0; for(const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3), uv = new Float32Array(n*2); let o = 0;
  for(const g of parts){ pos.set(g.attributes.position.array, o*3); nor.set(g.attributes.normal.array, o*3); if(g.attributes.uv) uv.set(g.attributes.uv.array, o*2); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return m;
}
