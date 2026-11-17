'use strict';
// per-frame render

/* =====================================================================
   FRAME
   ===================================================================== */
// The scene is drawn several times a frame (shadow, scene, aux, maybe full): update its matrices once here instead of
// on every renderer.render() call. The sun's shadow map is redrawn every SHADOW_EVERY frames (it's the biggest pass,
// and almost all casters are static).
scene.matrixWorldAutoUpdate = false;
const SHADOW_EVERY = 3;
let shadowFrame = 0;
function render(dt){
  ATMO.visible = true;
  scene.updateMatrixWorld();
  if(shadowFrame++ % SHADOW_EVERY === 0) renderer.shadowMap.needsUpdate = true;
  if(R.view === '3d'){ renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
  const braille = FILTERS[LOOK.filter].id < 0, needFull = !braille || LOOK.herStyle === 'clean';
  // aux in the scene pass: with the filters, the full-size scene carries it; with braille, the cell-sized scene does
  const mrt = AUX_MRT && R.mrt !== false;   // (R.mrt = false: the old separate aux pass, for comparison)
  const FT = mrt && !braille ? fullMRT : fullRT, fullTex = FT.isWebGLMultipleRenderTargets ? FT.texture[0] : FT.texture;
  if(needFull){ if(FT === fullMRT) renderSceneAux(fullMRT); else { renderer.setRenderTarget(fullRT); renderer.render(scene, camera); } }
  if(mrt){ if(braille) renderSceneAux(mrtRT); }
  else {
    if(braille){ renderer.setRenderTarget(sceneRT); renderer.render(scene, camera); }
    ATMO.visible = false;
    for(const o of drawables){ o.userData.main = o.material; o.material = auxFor(o); }
    scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(auxRT); renderer.render(scene, camera);
    for(const o of drawables) o.material = o.userData.main;
    scene.background = BGC; scene.fog = FOG;
  }
  ATMO.visible = false;
  SU.uAux.value = auxRT.texture;
  pass(maskMat, maskRT);
  const cu = compMat.uniforms;
  if(braille){
    motionMat.uniforms.uPrev.value = motRT[motI].texture; motionMat.uniforms.uDecay.value = Math.pow(.86, dt*60);
    pass(motionMat, motRT[1 - motI]); motI = 1 - motI;
    cellMat.uniforms.uScene.value = mrt ? mrtRT.texture[0] : sceneRT.texture; cellMat.uniforms.uMot.value = motRT[motI].texture;
    pass(cellMat, cellRT);
    finalMat.uniforms.uCells.value = cellRT.texture;
    pass(finalMat, imgRT);
    cu.uMM.value.set(1/(R.cw*R.cols), 1/(R.ch*R.rows), -R.offX/(R.cw*R.cols), -R.offY/(R.ch*R.rows));
  } else {
    const fm = filterMat.uniforms; fm.uFull.value = fullTex; fm.uDepth.value = FT.depthTexture;
    fm.uNear.value = camera.near; fm.uFar.value = camera.far;
    pass(filterMat, imgRT);
    cu.uMM.value.set(1/R.W, 1/R.H, 0, 0);
  }
  // glow: bright pass at 1/4 size, blurred, then again at 1/8
  if(LOOK.glow > 0){
    const [a1, b1, a2, b2] = bloomRT, sz = LOOK.glowSize;
    brightMat.uniforms.uSrc.value = imgRT.texture; brightMat.uniforms.uTx.value.set(1/R.W, 1/R.H); pass(brightMat, a1);
    const blur = (src, dst, dx, dy) => { blurMat.uniforms.uSrc.value = src.texture; blurMat.uniforms.uDir.value.set(dx/src.width, dy/src.height); pass(blurMat, dst); };
    blur(a1, b1, sz, 0); blur(b1, a1, 0, sz); blur(a1, b2, sz*1.5, 0); blur(b2, a2, 0, sz*1.5); blur(a2, b2, sz*2.5, 0); blur(b2, a2, 0, sz*2.5);
    cu.uB1.value = a1.texture; cu.uB2.value = a2.texture;
  }
  _v.copy(sp.pos).project(camera);
  cu.uSpotP.value.set((_v.x*.5 + .5)*R.W, (_v.y*.5 + .5)*R.H, _v.z < 1 ? 1 : 0); filterMat.uniforms.uFocusY.value = Math.min(.95, Math.max(.05, _v.y*.5 + .5));
  cu.uFocus.value = camera.position.distanceTo(sp.pos);
  cu.uImg.value = imgRT.texture; cu.uMask.value = maskRT.texture; cu.uFull.value = fullTex; cu.uDepth.value = FT.depthTexture;
  cu.uNear.value = camera.near; cu.uFar.value = camera.far;
  cu.uFMode.value = braille ? 0 : 1; cu.uHasFull.value = needFull ? 1 : 0; cu.uHerClean.value = LOOK.herStyle === 'clean' ? 1 : 0;
  pass(compMat, null);
}
