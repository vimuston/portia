'use strict';
// glyph atlas, render targets, resize

/* =====================================================================
   GLYPH ATLAS + RENDER TARGETS
   ===================================================================== */
// (the JetBrains Mono font load is awaited by the bootstrap in index.html, before any game script runs)
let atlasTex = null;
function buildAtlas(cw, ch, setKey){
  const SET = GLYPHSETS[setKey || BRAILLE_STYLES[LOOK.braille].set] || GLYPHSETS.braille;
  const fontPx = Math.round(ch*.8);
  const font = `${fontPx}px "JetBrains Mono", "Segoe UI Symbol", "Segoe UI Historic", "Noto Sans Runic", "Noto Sans Symbols 2", "Yu Gothic", "MS Gothic", "Noto Sans JP", "DejaVu Sans", ui-monospace, monospace`;
  const m = document.createElement('canvas'); m.width = cw; m.height = ch;
  const x = m.getContext('2d', {willReadFrequently:true});
  const BR = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];        // braille bit -> (column, row)
  const draw = (ctx, chr, ox) => {
    const cp = chr.codePointAt(0) - 0x2800;
    if(SET.dots && cp > 0 && cp < 256){                                              // round dots: anti-aliased circles, sized by the dot slider
      ctx.save(); ctx.fillStyle = '#fff'; const r = Math.max(.45, Math.min(cw*.5, ch*.25)*.5*LOOK.dot);
      BR.forEach(([cx, cy], b) => { if(cp & (1 << b)){ ctx.beginPath(); ctx.arc(ox + cw*(.27 + .46*cx), ch*(.14 + .24*cy), r, 0, 6.2832); ctx.fill(); } });
      ctx.restore(); return; }
    ctx.save(); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    const w = ctx.measureText(chr).width, sx = w > cw*.98 ? cw*.98/w : 1;
    ctx.translate(ox + cw/2, ch/2 + ch*.04); ctx.scale(sx, 1); ctx.fillText(chr, 0, 0); ctx.restore();
  };
  const sig = chr => { x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch); draw(x, chr, 0); const d = x.getImageData(0, 0, cw, ch).data; let s = '', cov = 0; for(let i = 0; i < d.length; i += 4){ s += d[i] > 127 ? 1 : 0; cov += d[i]; } return [s, cov/(255*cw*ch)]; };
  const tofu = new Set([sig('')[0], sig('￿')[0], sig('\u{10FFFD}')[0]]);
  const cov = [];
  for(const chr of [...SET.chars]){ if(chr === ' ') continue; const [s, c] = sig(chr); if(c > .004 && !tofu.has(s)) cov.push([chr, c]); }
  if(cov.length < 2 && SET !== GLYPHSETS.braille) return buildAtlas(cw, ch, 'braille');   // this font can't draw the set: fall back
  cov.sort((a, b) => a[1] - b[1]);
  const N = Math.min(18, cov.length), lo = cov[0][1], hi = cov[cov.length - 1][1], used = new Set(), ramp = [' '];
  for(let i = 0; i < N; i++){
    const target = lo + (hi - lo)*Math.pow(i/Math.max(1, N - 1), 1.15);
    let best = null, bd = 1e9;
    for(const e of cov){ if(used.has(e[0])) continue; const dd = Math.abs(e[1] - target); if(dd < bd){ bd = dd; best = e; } }
    used.add(best[0]); ramp.push(best[0]);
  }
  const all = ramp.concat(SET.edges); R.ramp = all.join('');
  const a = document.createElement('canvas'); a.width = cw*all.length; a.height = ch;
  const ax = a.getContext('2d'); ax.fillStyle = '#000'; ax.fillRect(0, 0, a.width, a.height);
  all.forEach((chr, i) => draw(ax, chr, i*cw));
  if(atlasTex) atlasTex.dispose();
  atlasTex = new THREE.CanvasTexture(a);
  atlasTex.flipY = false; atlasTex.generateMipmaps = false;
  atlasTex.minFilter = atlasTex.magFilter = THREE.NearestFilter;
  finalMat.uniforms.uAtlas.value = atlasTex;
  finalMat.uniforms.uAtlasN.value = all.length;
  finalMat.uniforms.uRampN.value = ramp.length;
  cellMat.uniforms.uN.value = ramp.length;
}

let sceneRT, auxRT, cellRT, maskRT, fullRT, imgRT, mrtRT, fullMRT, bloomRT = [], motRT = [], motI = 0;
function rt(w, h, type, linear, depth){
  return new THREE.WebGLRenderTarget(w, h, {type, minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter, depthBuffer: depth, generateMipmaps:false});
}
function resize(){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  R.W = Math.max(1, Math.round(innerWidth*dpr)); R.H = Math.max(1, Math.round(innerHeight*dpr));
  renderer.setSize(R.W, R.H, false);
  const [cw, ch] = GLYPH[R.glyph];
  R.cw = Math.max(2, Math.round(cw*dpr)); R.ch = Math.max(4, Math.round(ch*dpr));
  R.cols = Math.max(1, Math.floor(R.W/R.cw)); R.rows = Math.max(1, Math.floor(R.H/R.ch));
  R.offX = Math.floor((R.W - R.cols*R.cw)/2); R.offY = Math.floor((R.H - R.rows*R.ch)/2);
  camera.aspect = R.W/R.H; camera.updateProjectionMatrix();
  [sceneRT, auxRT, cellRT, maskRT, ...motRT].forEach(t => t && t.dispose());
  const det = Math.max(1, Math.min(LOOK.detail || 1, Math.floor(R.W/R.cols), Math.floor(R.H/R.rows)));   // scene detail: sub-cell resolution for the HD filters
  sceneRT = rt(R.cols*det, R.rows*det, THREE.HalfFloatType, true, true);
  if(mrtRT) mrtRT.dispose();
  if(AUX_MRT) mrtRT = auxTargets(R.cols*det, R.rows*det, false);   // the scene's colour (as sceneRT) plus the aux, in one pass
  auxRT = rt(R.cols, R.rows, THREE.FloatType, false, true);
  cellRT = rt(R.cols, R.rows, THREE.UnsignedByteType, false, false);
  maskRT = rt(R.cols, R.rows, THREE.UnsignedByteType, true, false);
  // look lab: the full-resolution scene (with depth) for the filters, the finished image, and the glow chain
  [fullRT, imgRT, ...bloomRT].forEach(t => t && t.dispose());
  const fs = Math.min(1, Math.sqrt(2.6e6/(R.W*R.H)));
  fullRT = rt(Math.round(R.W*fs), Math.round(R.H*fs), THREE.HalfFloatType, true, true);
  fullRT.depthTexture = new THREE.DepthTexture(fullRT.width, fullRT.height);
  if(fullMRT) fullMRT.dispose();
  fullMRT = AUX_MRT ? auxTargets(fullRT.width, fullRT.height, true) : null;   // the filters' full-size scene, carrying the aux too
  imgRT = rt(R.W, R.H, THREE.HalfFloatType, true, false);
  const q1 = [Math.max(1, R.W >> 2), Math.max(1, R.H >> 2)], q2 = [Math.max(1, R.W >> 3), Math.max(1, R.H >> 3)];
  bloomRT = [rt(...q1, THREE.HalfFloatType, true, false), rt(...q1, THREE.HalfFloatType, true, false), rt(...q2, THREE.HalfFloatType, true, false), rt(...q2, THREE.HalfFloatType, true, false)];
  filterMat.uniforms.uRes.value.set(R.W, R.H); compMat.uniforms.uRes.value.set(R.W, R.H);
  compMat.uniforms.uPx.value = dpr;
  motRT = [rt(R.cols, R.rows, THREE.HalfFloatType, false, false), rt(R.cols, R.rows, THREE.HalfFloatType, false, false)];
  SU.uGrid.value.set(R.cols, R.rows);
  finalMat.uniforms.uCell.value.set(R.cw, R.ch);
  finalMat.uniforms.uOff.value.set(R.offX, R.offY);
  finalMat.uniforms.uRes.value.set(R.W, R.H);
  buildAtlas(R.cw, R.ch);
}
resize();
addEventListener('resize', resize);
