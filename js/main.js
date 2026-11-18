'use strict';
// debug hooks, clock and main loop

window.__dbg = {tick: dt => tick(dt), jumpTo: (T, plat) => { const sol = bestLeap(T, plat); sp.aim = {target: T.clone(), vel: sol.v, ok: sol.ok, yaw: sol.yaw, plat}; sp.aimFixed = true; jump(); }, camera, pickTarget, solveLeap, updateAim, aimPt, aimRing, aimOuter, predictLeap, leapVel, leapSpread, WEB, wrapUnder, climbOver, cutLine, startAir, enterClimb, land, gaitUpdate, bodyOnFeet, reachRatio, playerPlace, CLIMBS, sp, cam, flies, male, husks, SU, R, pulses, catchFly, PREY, ARG, ORBS, BAD, wind, strike, dropLine, PLAT, hAt, surfAt, GROUND, START, renderer, scene, makeSpider, ENC};   // console inspection while tuning
const clock = new THREE.Clock();
let time = 0;
toast('You are Portia labiata — a jumping spider that hunts other spiders.');
function tick(dt){
  time += dt; SU.uTime.value = time; updateJungle(dt); updateLife(dt, time);
  pollPad(); padActions(dt);
  updateFlies(dt, time); updateMale(dt); if(!(DOOM.t >= 0 && !DOOM.reset)) updateSpider(dt); updatePredators(dt); updatePrey(dt, time);
  updateSenses(dt, time); updateCamera(dt); updateHud(dt); AUDIO.update(dt);
  render(dt);
}
window.__dbg.audio = AUDIO; window.__dbg.preds = PREDS; window.__dbg.doom = DOOM; window.__dbg.render = render; window.__dbg.aux = {AUX_MRT, AUX_STAT, get auxRT(){ return auxRT; }, get mrtRT(){ return mrtRT; }, get imgRT(){ return imgRT; }};
window.__dbg.step =(secs, dt = 1/30) => { for(let t = 0; t < secs; t += dt) tick(dt); };   // drive the sim when frames are paused (testing)
renderer.setAnimationLoop(() => { const d = Math.min(clock.getDelta(), 1/30); tick(d*slowmoScale(d)); updateSlowTip(); });   // slowmoScale: the debug slow-motion leap (input.js)
window.__dbg.slowmo = SLOWMO;
