'use strict';
// debug snapshots: press ` (backquote) to copy where Portia is (spot, surface, facing, camera) to the clipboard as a
// line of JS. Paste it into the console, or hand it to a new session, and __dbg.load(...) puts her straight back there.
// The world is seeded, so platform and climb ids ('L12', 'C7', 'WEB-B', 'ground') name the same surface every load.

const SNAP_V = 1;
const r4 = x => Math.round(x*1e4)/1e4;
const v3a = v => [r4(v.x), r4(v.y), r4(v.z)];
const surfById = id => id == null ? null : id === GROUND.id ? GROUND : PLAT.find(p => p.id === id) || CLIMBS.find(S => S.id === id) || null;

function snapTake(){
  const q = sp.m.quaternion;
  const s = {v: SNAP_V, mode: sp.mode, plat: sp.plat ? sp.plat.id : null, pos: v3a(sp.pos), vel: v3a(sp.vel), yaw: r4(sp.yaw),
    head: v3a(sp.climbHead), quat: [r4(q.x), r4(q.y), r4(q.z), r4(q.w)],
    cam: {yaw: r4(cam.yaw), pitch: r4(cam.pitch), dist: r4(cam.dist)}, t: r4(time)};
  if(sp.plat && sp.plat.side !== undefined) s.side = sp.plat.side;          // which face of the orb she is on
  if(sp.line || sp.mode === 'hang') Object.assign(s, {line: sp.line, anchor: v3a(sp.anchor), anchorPlat: sp.anchorPlat ? sp.anchorPlat.id : null, ropeL: r4(sp.ropeL)});
  if(sp.roll) s.rolling = true;                                              // mid-roll round a rim: restored settled, not mid-roll
  if(PREDS.length) s.preds = PREDS.map(pr => ({pos: v3a(pr.pos), state: pr.state}));   // for context; not restored
  return s;
}
function snapText(s){ return '__dbg.load(' + JSON.stringify(s) + ')'; }

function snapLoad(s, opt = {}){
  if(typeof s === 'string'){ const m = s.match(/\{[\s\S]*\}/); s = JSON.parse(m ? m[0] : s); }
  const plat = surfById(s.plat);
  if(s.plat && !plat) console.warn('snapshot: no surface with id', s.plat, '— putting her on the ground');
  let mode = s.mode;
  if(mode === 'feed') mode = plat && plat.kind === 'climb' ? 'climb' : 'ground';   // a meal isn't restorable; leave her where she ate
  if(intro && introOpen()) toggleGuide(false);
  DOOM.t = -1; DOOM.by = null; DOOM.reset = false;
  endBalloon();
  Object.assign(sp, {mode, plat: plat || GROUND, vigor: 1, stuck: 0, charging: false, braked: mode === 'hang', committed: false, plop: false, holdIn: false,
    roll: null, feed: null, aim: null, aimFixed: false, leapHit: null, line: !!s.line, anchorPlat: surfById(s.anchorPlat), ropeL: s.ropeL || 0});
  sp.pos.fromArray(s.pos); sp.vel.fromArray(s.vel || [0, 0, 0]); sp.yaw = s.yaw || 0;
  if(s.head) sp.climbHead.fromArray(s.head);
  if(s.anchor) sp.anchor.fromArray(s.anchor);
  if(plat && s.side !== undefined) plat.side = s.side;
  sp.m.visible = true; sp.m.scale.setScalar(1); sp.m.position.copy(sp.pos);
  if(s.quat) sp.m.quaternion.fromArray(s.quat); else sp.m.rotation.set(0, sp.yaw, 0);
  gaitRelease(sp.m);
  if(s.cam){ cam.yaw = s.cam.yaw; cam.pitch = cam.pitchEff = s.cam.pitch; cam.dist = cam.distEff = s.cam.dist; }
  cam.target.copy(sp.pos); cam.swingDir = null; cam.swing = null; cam.swingT = 0;
  if(opt.predsHome){ for(const pr of PREDS) predHome(pr); PRED.grace = 4; }
  SEEN.last.copy(sp.pos); SEEN.speed = 0;
  return sp;
}

async function snapCopy(){
  const txt = snapText(snapTake());
  console.log(txt);
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; }
  catch(e){                                                                  // no async clipboard (insecure origin, no focus): the old way
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta);
    ta.select(); try { ok = document.execCommand('copy'); } catch(e2){} ta.remove();
  }
  toast(ok ? 'Debug snapshot copied to the clipboard.' : 'Could not reach the clipboard — the snapshot is in the console.');
}

addEventListener('keydown', e => {
  if(e.code !== 'Backquote' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if(e.target.matches && e.target.matches('input, textarea')) return;
  e.preventDefault(); snapCopy();
});
// #snap=<json> in the URL restores on load, so a snapshot can also be shared as a link
if(location.hash.startsWith('#snap=')){ try { snapLoad(decodeURIComponent(location.hash.slice(6))); } catch(e){ console.warn('snapshot: bad #snap', e); } }

Object.assign(window.__dbg, {snap: snapTake, snapText, load: snapLoad, copySnap: snapCopy, surfById});
