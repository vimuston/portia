'use strict';
// prey AI, pounce/feeding, silk lines, plucking, aim markers

const PREY = [];
function addPrey(p){ p.m.userData.owner = p; PREY.push(Object.assign(p, {alert:0, motion:0, vib:0, temp:.56, temp0:.56, dead:false, deadT:0, phase:0, t:rr(2, 6), close:0, idleT:0})); return p; }
const SCY = [PLAT[2], PLAT[6]].map((pl, i) => {
  scytodesWeb(pl);
  const home = randomIn(pl, .4);
  const p = addPrey({kind:'scytodes', name:'Scytodes pallida · spitting spider', m: makeScytodes(), plat: pl, home, pos: home.clone(), yaw: rnd()*6.28, egg: i === 1, cool: 0, state:'idle'});
  p.want = p.yaw; pl.silk = p; return p;
});
const BADU = addPrey({kind:'badumna', name:'Badumna longinqua · grey house spider', m: makeBadumna(), plat: BAD.plat, pos: BAD.mouth.clone(), yaw: 0,
  state:'retreat', pref: 'fly', interest: 0, rush: 0, sulk: 0, known: false, peekT: 0});
BAD.plat.silk = BADU;
const ARGI = addPrey({kind:'argiope', name:'Argiope · St Andrew’s Cross spider', m: makeArgiope(), plat: ARG.side, pos: ARG.C.clone(), state:'hub', wary: 0, fwd: new V3(0, -1, 0)});
ARG.side.silk = ARGI; ARG.above.silk = ARGI;
const WEB = webSurface(); WEB.silk = ARGI;

// mimicry signals Portia can pluck into silk
const PLUCKS = [
  {id:'midge', name:'tiny midge', glyph:'⠁   ⠂   ⠁'},
  {id:'fly',   name:'struggling fly', glyph:'⣿⡇⣷⣿'},
  {id:'calm',  name:'calming taps', glyph:'⠂  ⠂'}
];
let pluckIdx = 0;
const wind = {gust: 0, next: 5, end: 0};
function updateWind(dt, t){
  if(t > wind.next){ wind.end = t + rr(2.2, 4); wind.next = wind.end + rr(5, 12); }
  const target = t < wind.end ? 1 : 0;
  wind.gust += (target - wind.gust)*(1 - Math.exp(-(target ? 2.5 : 1.2)*dt));
}
const onSilkOf = p => ((sp.mode === 'ground' || sp.mode === 'climb') && sp.plat && sp.plat.silk === p) || (sp.mode === 'hang' && sp.anchorPlat && sp.anchorPlat.silk === p);
const preyNoise = p => onSilkOf(p) ? sp.noise : 0;
const preyPluck = p => sp.plucking && sp.plat && sp.plat.silk === p ? PLUCKS[pluckIdx].id : null;

// slab: also count a point just off the sheet (moving along it). Not when she started in the sheet's own plane (the leaf at
// its frame): then only a true pass through it counts, or every leap along the web would snag at its near edge
const inOrbPlane = q => { const d = q.clone().sub(ARG.C).sub(ARG_WEB.position); return Math.abs(d.dot(ARG.n)) < .12 && d.addScaledVector(ARG.n, -d.dot(ARG.n)).length() < ARG.R*1.4; };
// a leap from inside the orb's plane runs along the sheet: it takes hold only where she aimed on it (goal), never on the way
function orbHit(a, b, inPlane, goal){
  if(!inPlane) return orbContact(a, b, true);
  if(!goal || b.distanceTo(goal) > .35) return null;
  const C = ARG.C.clone().add(ARG_WEB.position), r = b.clone().sub(C), h = r.dot(ARG.n); if(Math.abs(h) > .14) return null;
  r.addScaledVector(ARG.n, -h); return r.length() < ARG.edge(Math.atan2(r.y, r.dot(ARG.u))) ? C.add(r) : null;
}
function orbContact(a, b, slab = true){
  const {n, u} = ARG, C = ARG.C.clone().add(ARG_WEB.position), da = a.clone().sub(C).dot(n), db = b.clone().sub(C).dot(n);
  let hit = null;
  if((da > 0) !== (db > 0)) hit = a.clone().lerp(b, da/(da - db));
  else if(slab && Math.abs(db) < .05) hit = b.clone();
  if(!hit) return null;
  const r = hit.clone().sub(C); r.addScaledVector(n, -r.dot(n));
  return r.length() < ARG.edge(Math.atan2(r.y, r.dot(u))) ? hit : null;     // out to the real frame, not a circle inside it
}
function webPoint(q, maxR){
  const {C, u, n} = ARG, r = q.clone().sub(C); let a = r.dot(u), b = r.y; const L = Math.hypot(a, b);
  if(L > maxR){ a *= maxR/L; b *= maxR/L; }
  return C.clone().addScaledVector(u, a).add(new V3(0, b, 0)).addScaledVector(n, .01);
}
function stepToward(p, target, speed, dt, plat){
  const dx = target.x - p.pos.x, dz = target.z - p.pos.z, L = Math.hypot(dx, dz);
  if(L < 1e-3) return 0;
  let st = Math.min(L, speed*dt);
  if(p.m.userData.parts.inited){ st *= .3 + .7*gaitSupport(p.m); st *= gaitLimit(p.m, new V3(dx/L*st, 0, dz/L*st)); }
  const nx = p.pos.x + dx/L*st, nz = p.pos.z + dz/L*st;
  if(!plat || inPlat(plat, nx, nz, .08)){ p.pos.x = nx; p.pos.z = nz; }
  p.yaw = gaitTurn(p.m, p.yaw, lerpAngle(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8*dt))); p.phase += st*40;
  return L;
}
function argMove(p, target, speed, dt, dash){   // dash: a strike, not a walk; the legs trail rather than set the pace
  const d = target.clone().sub(p.pos), L = d.length();
  if(L < .01) return L;
  let st = Math.min(L, speed*dt);
  if(p.m.userData.parts.inited && !dash){ st *= .3 + .7*gaitSupport(p.m); st *= gaitLimit(p.m, d.clone().multiplyScalar(st/L)); }
  p.pos.addScaledVector(d, st/L);
  p.fwd.lerp(d.normalize(), 1 - Math.exp(-6*dt)); p.phase += st*35;
  return L;
}
const gums = [];
function spit(p){
  p.cool = 7; p.state = 'hunt';
  const a = p.pos.clone().add(new V3(Math.sin(p.yaw)*.13, .05, Math.cos(p.yaw)*.13)), b = sp.pos.clone().add(new V3(0, .08, 0));
  const perp = new V3(-(b.z - a.z), 0, b.x - a.x).normalize(), pts = [];
  for(let k = 0; k <= 26; k++){ const t = k/26, w = Math.sin(t*Math.PI)*(k % 2 ? 1 : -1); pts.push(a.clone().lerp(b, t).addScaledVector(perp, w*.06).add(new V3(0, w*.03, 0))); }
  const ln = hot(new THREE.Line(segsFrom(pts), new THREE.LineBasicMaterial({color:0xf0f0d0})), .2); scene.add(ln); drawables.push(ln); gums.push({ln, t: 2.8});
  sp.stuck = 3.5; sp.stuckKind = 'gum'; sp.stuckPos = sp.pos.clone(); sp.charging = false;
  pulses.push({pos: a, amp: .8, decay: 4}); gusts.push({pos: a, amp: .6});
  toast('Spat on — sticky, venomous gum. Tap WASD to struggle free!');
}
function stickInWeb(pt){
  sp.stuck = 4.5; sp.stuckKind = 'web'; sp.stuckPos = pt.clone(); sp.pos.copy(pt); sp.vel.set(0, 0, 0); sp.charging = false;
  pulses.push({pos: pt.clone(), amp: 1.3, decay: 2});
  if(!ARGI.dead){ ARGI.state = 'wrap'; ARGI.wrapDelay = .9; }   // a moment to feel where the struggle is
  toast('Caught in the sticky spiral! Tap WASD to struggle free before it reaches you.');
}
function knockOff(){
  if(DOOM.t >= 0) return;                        // she is already dead where she fell
  if(sp.mode === 'ground' && !sp.plat.ground){ startAir(); const a = rnd()*6.28; sp.vel.set(Math.cos(a)*1.4, 1.4, Math.sin(a)*1.4); }
  else if(sp.mode === 'climb'){ const n = sp.plat.normal(sp.pos); startAir(); sp.vel.copy(n).multiplyScalar(1.6); sp.vel.y += .4; sp.climbGrace = .5; }
}
function hurt(amount, msg){
  if(DOOM.t >= 0) return;
  sp.vigor -= amount; toast(msg); pulses.push({pos: sp.pos.clone(), amp: 1.2, decay: 2});
  if(sp.vigor <= 0) die();
}
// a fatal bite: the same fade as the mantis kill (predators.js), with Portia dying where she was bitten. The
// spider whose update dealt the bite (KILLER_NOW) stays to feed on her
let KILLER_NOW = null;
function die(by = KILLER_NOW){ doomStart(null); if(by && !by.dead){ DOOM.killer = by; DOOM.lag = 1.6; DOOM.eatT = 0; } }
// the killer walks up to the corpse, fangs to it, and feeds, head dipping as it chews
const EAT_D = .13;
function eatCorpse(p, dt){
  const at = DOOM.at;
  let d;
  if(p.kind === 'argiope'){                         // along its own silk, to the point nearest her, a jaw's length short
    const aim = webPoint(at.clone().add(p.pos.clone().sub(at).setLength(EAT_D)), ARG.R);
    p.motion = argMove(p, aim, .5, dt) > .02 ? .4 : 0; d = p.pos.distanceTo(at);
  } else { d = Math.hypot(at.x - p.pos.x, at.z - p.pos.z);
    if(d > EAT_D){                                  // straight to her: the legs catch up (no gait limit, so it can't stall)
      const st = Math.min(d - EAT_D, .3*dt); p.pos.x += (at.x - p.pos.x)/d*st; p.pos.z += (at.z - p.pos.z)/d*st;
      p.yaw = lerpAngle(p.yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z), 1 - Math.exp(-8*dt)); p.phase += st*40; p.motion = .4; }
    else { p.motion = 0; p.yaw = lerpAngle(p.yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z), 1 - Math.exp(-6*dt)); } }
  if(DOOM.eatT > 0 || d <= EAT_D + .04) DOOM.eatT += dt;   // out of reach (she fell off its silk), it just waits
  p.vib = 0;
}
function eatPose(p, t){
  if(!(DOOM.eatT > 0)) return;
  const P = p.m.userData.parts, k = Math.min(1, DOOM.eatT*2);
  P.body.rotation.x = k*(.22 + .1*Math.max(0, Math.sin(t*5.5)));
}
function killPrey(p){
  p.dead = true; p.deadT = 0; p.state = 'dead'; p.drain = 0; p.flip = 0; sp.caught++;
  pulses.push({pos: p.pos.clone(), amp: 1.4, decay: .7});
  toast({scytodes: p.egg ? 'You land on it past the egg sac — fangs in, venom pumping.' : 'You drop onto it from behind — it never turned. Fangs in, venom pumping.',
         badumna: 'You leap onto the house spider on its own sheet — fangs in, venom pumping.',
         argiope: 'You land on it in the orb — fangs in, venom pumping.'}[p.kind]);
}
// ---- the kill is a leap: land on a spider and bite. A burst of rapid fang strokes pumps the venom in; then she
// seizes it in her front legs and palps, lifts it off its feet in her fangs, and drains it over 5 s, the body
// shrivelling as she sucks; then she lets the husk drop. The hunger it fills comes with the draining, not the bite.
const BITE_T = .55, GRAB_T = .45, DRAIN_T = 5, FEED_T = BITE_T + GRAB_T + DRAIN_T;
const HOLD_D = .19;                                // her stance sits this far behind where the prey stood
function preyAt(pos, r){ let best = null, bd = r; for(const p of [...PREY, male]){ if(p.dead || (p === male && !maleIsPrey())) continue; const d = p.m.userData.parts.body.getWorldPosition(new V3()).distanceTo(pos); if(d < bd){ bd = d; best = p; } } return best; }
function pounce(p){
  if(sp.stuck > 0) return false;
  if(p.kind === 'scytodes' && !p.egg && angDiff(p.yaw, Math.atan2(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z)) < .6){ spit(p); return false; }
  if(p.kind === 'badumna' && (p.state === 'retreat' || p.state === 'peek')) return false;
  if(p.kind === 'argiope' && p.state === 'pump'){ toast('The web is bucking — you cannot get a grip.'); return false; }
  if(p.kind === 'argiope' && p.state === 'lunge'){ toast('It meets you fangs-first.'); die(); return false; }
  if(p === male){                                  // the spent suitor: no defence but flight
    p.dead = true; p.deadT = 0; p.drain = 0; p.flip = 0; sp.caught++; endBalloon();
    pulses.push({pos: p.pos.clone(), amp: 1.4, decay: .7}); AUDIO.sfx.bite(); toast('You turn on your mate. Fangs in, venom pumping.');
    startFeed(p, null, p.plat, HOLD_D, .8); return true;
  }
  killPrey(p); endBalloon();
  // the face she bites from: the one she is on, or leapt from; a leap along the web can drift through its plane
  // before it reaches her, and that mustn't flip her onto the far face
  const fromWeb = sp.plat === WEB || (sp.mode === 'air' && sp.leftFrom === WEB);
  const up = p.kind === 'argiope' ? ARG.n.clone().multiplyScalar(fromWeb ? WEB.side : Math.sign(sp.pos.clone().sub(p.m.getWorldPosition(new V3())).dot(ARG.n)) || 1) : null;
  const F = startFeed(p, up, p.kind === 'argiope' ? null : p.plat, HOLD_D, .55);
  if(p.kind === 'badumna') F.base.y = Math.max(F.base.y, F.p0.y);
  return true;
}
// the bite, for spider or fly alike. Her stance: on the prey's own surface, just behind it, facing it along the
// line she came in on. gain: the hunger the drain fills
function startFeed(p, up, plat, holdD, gain){
  const q0 = p.m.getWorldQuaternion(new THREE.Quaternion()), p0 = p.m.getWorldPosition(new V3());
  if(!up) up = UP.clone().applyQuaternion(q0);
  const flat = v => v.addScaledVector(up, -v.dot(up));
  let fw = flat(p0.clone().sub(sp.pos));
  if(fw.lengthSq() < 1e-6) fw = flat(new V3(0, 0, 1).applyQuaternion(q0));
  fw.normalize();
  const base = p0.clone().addScaledVector(fw, -holdD);
  if(plat){ const [x, z] = clampTo(plat, base.x, base.z); base.set(x, surfY(plat, x, z), z); }
  sp.feed = {p, t: 0, base, up, fw, q0, p0, venT: 0, gain}; p.held = true; p.limp = 0; p.hl = 1; p.drain = 0;
  sp.mode = 'feed'; sp.vel.set(0, 0, 0); sp.charging = false; sp.braked = false; sp.committed = false; sp.plop = false; sp.aimPrey = null;
  return sp.feed;
}
const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3 - 2*x); };
function feedTick(dt){
  const F = sp.feed, p = F.p, P = p.m.userData.parts, S = sp.m.userData.parts; F.t += dt;
  if(F.fall){                                                            // caught mid-leap: she falls with her prey until she lands
    const prev = F.base.clone(); F.fall.y -= G*dt; const d = F.fall.clone().multiplyScalar(dt); F.base.add(d); F.p0.add(d);
    const L = findLanding(prev, F.base);
    if(L){ const [x, z] = clampTo(L, F.base.x, F.base.z), y = surfY(L, x, z); F.p0.y += y - F.base.y; F.base.set(x, y, z);
      F.fall = null; p.airborne = false; p.plat = L; pulses.push({pos: F.base.clone(), amp: .9, decay: 3}); }
  }
  const biting = F.t < BITE_T, lift = smooth01((F.t - BITE_T)/GRAB_T), k = Math.max(0, Math.min(1, (F.t - BITE_T - GRAB_T)/DRAIN_T));
  // her body: braced on the surface, lunging forward and down onto the prey for the bite, rearing back a little as she lifts it
  M4.makeBasis(new V3().crossVectors(F.up, F.fw), F.up, F.fw); sp.m.quaternion.setFromRotationMatrix(M4);
  const lunge = biting ? smooth01(F.t/.12) : 1 - lift;
  sp.pos.copy(F.base).addScaledVector(F.fw, .05*lunge); sp.m.position.copy(sp.pos); sp.speed = 0;
  sp.m.rotateX(.32*lunge - .12*lift);
  gaitRelease(sp.m);
  const sip = Math.sin(time*5.5);                                        // the slow pump of sucking
  poseSpider(sp.m, {crouch: biting ? .9 : .55 - .25*lift, grab: biting ? smooth01(F.t/.25) : 1, bob: biting ? Math.sin(F.t*90)*.004 : sip*.0012, twitch: .04*sip*(1 - lunge)});
  animatePalps(S, 'grip', time, dt);
  // fangs: rapid strokes while the venom goes in, then sunk and held
  fangTick(S, biting ? .55 + .45*Math.abs(Math.sin(F.t*42)) : .85, dt, true);
  updateHair(sp.m, dt);
  // venom: each stroke a small shudder through the surface; the prey flares hot in her sight, then fades as it dies
  if(biting && (F.venT -= dt) <= 0){ F.venT = .075; pulses.push({pos: F.p0.clone(), amp: .35, decay: 9}); }
  p.hl = biting ? .7 + .3*Math.abs(Math.sin(F.t*42)) : Math.max(0, (p.hl || 0) - dt*1.2);
  hlTick(dt, null);
  // the prey: spasms under the bite, goes limp, then hangs from her fangs held in legs and palps
  p.deadT = 0; p.drain = Math.max(p.drain || 0, k); p.limp = biting ? 0 : Math.max(p.limp || 0, Math.min(1, .35 + k*1.4));
  sp.m.updateMatrixWorld(true);
  const tip = new V3(), w = new V3(); for(const f of S.fangs){ tip.add(f.drop.getWorldPosition(w)); } tip.multiplyScalar(1/S.fangs.length);
  const hfw = F.fw.clone(), U = hfw.clone().multiplyScalar(-.8).addScaledVector(F.up, .6).normalize();   // its back turned to her face
  const Z = F.up.clone().addScaledVector(U, -F.up.dot(U)).normalize();                                     // its head up, legs hanging away from her
  const sway = .06*Math.sin(time*1.3), Zs = Z.clone().applyAxisAngle(U, sway);
  M4.makeBasis(new V3().crossVectors(U, Zs), U, Zs); const qH = new THREE.Quaternion().setFromRotationMatrix(M4);
  const sc = 1 - .15*k, hb = (P ? P.body.position.y : .055)*sc, posH = tip.clone().addScaledVector(U, -((P ? .03*(P.s || 1) : .035)*sc + hb));
  p.m.position.copy(F.p0).lerp(posH, lift); p.m.quaternion.copy(F.q0).slerp(qH, lift);
  sp.hunger = Math.min(1, sp.hunger + (k > 0 && k < 1 ? dt*F.gain/DRAIN_T : 0)); sp.vigor = Math.min(1, sp.vigor + (k > 0 ? dt*.06 : 0));
  if(k >= 1) endFeed(true);                                             // no letting go early: she feeds to the end
}
// she opens her fangs and the husk drops: from her jaws to the surface beneath (to the forest floor, for Argiope)
function endFeed(drained){
  const F = sp.feed, p = F.p; sp.feed = null;
  p.held = false; p.limp = 1; p.drain = Math.max(p.drain || 0, .5);
  const at = p.m.position.clone();
  if(p.fly){                                     // the fly's husk drops to the leaf or log; a new fly comes in later
    const surf = p.airborne || !p.plat ? GROUND : p.plat, [x, z] = clampTo(surf, at.x, at.z), y = surfY(surf, x, z);
    leaveHusk(new V3(x, y, z), surf.ground ? TEMP.soil : TEMP.leaf, {fallH: Math.max(0, at.y - y - .09), drain: p.drain, yaw: Math.atan2(F.fw.x, F.fw.z) + rr(-.8, .8)});
    p.gone = true; p.m.visible = false; p.respawn = 7; p.state = 'walk'; p.drain = 0; flyLook(p, 0); p.m.rotation.set(0, 0, 0);
    if(p.airborne){ sp.mode = 'air'; sp.pos.copy(F.base); sp.vel.set(0, 0, 0); sp.m.rotation.set(0, Math.atan2(F.fw.x, F.fw.z), 0); }
    else { sp.mode = 'ground'; sp.plat = surf; sp.pos.copy(F.base); }
    sp.yaw = Math.atan2(F.fw.x, F.fw.z); p.airborne = false;
    toast(drained ? 'Drained. You let the shrivelled fly drop.' : 'You let the fly drop, half-drained.'); return;
  }
  if(p.kind === 'argiope'){ p.dropped = true; p.pos.set(at.x, floorAt(at.x, at.z), at.z); }
  else { const [x, z] = clampTo(p.plat, at.x, at.z); p.pos.set(x, surfY(p.plat, x, z), z); if(p.kind === 'badumna') p.pos.y = Math.max(p.pos.y, F.p0.y); }
  p.fallH = Math.max(0, at.y - p.pos.y); p.fallV = 0; p.yaw = Math.atan2(F.fw.x, F.fw.z) + rr(-.8, .8); p.flip = 0;
  // back onto the face she fed from. F.base is already in world space (it rides the sway): taking the sway off again
  // set her a few cm off the plane, and enterClimb's setSide then flipped her to whichever way the orb was swinging
  if(p.kind === 'argiope'){ const face = Math.sign(F.up.dot(ARG.n)) || 1; WEB.side = face; enterClimb(WEB, F.base.clone(), F.fw.clone()); WEB.side = face; }
  else { sp.mode = 'ground'; sp.plat = p.plat; sp.pos.copy(F.base); sp.yaw = Math.atan2(F.fw.x, F.fw.z); }
  toast(drained ? 'Drained. You let the shrivelled husk drop.' : 'You let it drop, half-drained.');
}
// landing near a spider counts as landing on it
function strike(){ const p = preyAt(sp.pos, .42); return !!p && pounce(p); }
function enterClimb(S, at, hint){
  sp.leapHit = null;
  const was = sp.mode;
  if(S.setSide) S.setSide(at);
  if(S.web) S.lastOff = ARG_WEB.position.clone();
  endBalloon();
  S.project(at); sp.pos.copy(at); sp.mode = 'climb'; sp.plat = S; sp.vel.set(0, 0, 0); sp.braked = false; sp.committed = false; sp.plop = false;
  const n = S.normal(at), h = hint ? hint.clone() : new V3(0, 1, 0), into = -h.dot(n);
  h.addScaledVector(n, -h.dot(n)).addScaledVector(S.intoDir || UP, into);   // pressing into the surface means "up" (round a leaf rim: under)
  if(h.lengthSq() < 1e-4) h.set(0, 1, 0);
  sp.climbHead = h.addScaledVector(n, -h.dot(n)).normalize();
  if(was !== 'climb' && !sp.roll){ cam.swingDir = sp.climbHead.clone(); cam.swingT = 0; cam.swing = null; }   // a new surface: look the way she climbs
}
// Portia walks the orb freely; at its frame she steps across onto whatever is within a short reach beyond it:
// the soil, a leaf or other top, or bark, stone and stems. Nothing in reach: the frame holds her
function webExit(q, t){
  for(const r of [.08, .16, .24]){
    const a = q.clone().addScaledVector(t, r);
    if(a.y <= floorAt(a.x, a.z) + .06){ sp.mode = 'ground'; sp.plat = GROUND; sp.pos.set(a.x, floorAt(a.x, a.z), a.z); sp.yaw = Math.atan2(t.x, t.z); sp.climbGrace = .5; sp.handFrom = WEB; sp.handT = .6; return true; }
    for(const P of PLAT){ if(P.ground || !inPlat(P, a.x, a.z)) continue; const y = surfAt(P, a.x, a.z);
      if(Math.abs(a.y - y) < .1){ sp.mode = 'ground'; sp.plat = P; sp.pos.set(a.x, surfY(P, a.x, a.z), a.z); sp.yaw = Math.atan2(t.x, t.z); sp.handFrom = WEB; sp.handT = .6; return true; } }
    for(const S2 of climbsNear(a.x, a.z, .4)){
      if(S2.web || !S2.near(a)) continue;
      const h = a.clone(); S2.project(h); if(h.distanceTo(a) > .07) continue;
      sp.handFrom = WEB; sp.handT = .6; enterClimb(S2, h, t.clone()); return true;
    }
  }
  return false;
}
function climbHit(x, y, z, dir){
  for(const S of climbsNear(x, z, .5)) if(S.hit(x, y, z, dir)) return S;
  return null;
}
// X: no line → tie one here. Line just tied and she hasn't left the knot → let go and hang. Any other time there is a
// line (hanging, in the air, walked away, climbed back up to the knot) → cut it; the next X ties a fresh one.
function dropLine(){
  if(sp.stuck > 0) return;
  const onSurface = sp.mode === 'ground' || sp.mode === 'climb';
  if(sp.line){
    if(sp.lineFresh && onSurface && sp.pos.distanceTo(sp.anchor) < .3){ sp.lineFresh = false; dropOnLine(); }
    else cutLine();
    return;
  }
  if(!onSurface) return;
  if(sp.mode === 'ground' && sp.plat.ground){ toast('Nothing up here to tie silk to — fix a line on a leaf, log, stone or bark.'); return; }
  sp.line = true; sp.lineFresh = true; sp.anchor.copy(sp.pos); sp.anchorPlat = sp.plat; sp.ropeL = 0;
  pulses.push({pos: sp.pos.clone(), amp: .35, decay: 5});
  toast('Dragline tied — X again to let go and hang; after that X cuts it.');
}
// let go onto the tied line. On a leaf or other top she pays the line out to the nearest rim and slips over it
// (the knot moves to the rim, so the silk never runs through the leaf); on bark she pushes off it; under a leaf
// or on the orb she simply drops
function dropOnLine(){
  const P = sp.plat, out = new V3();
  if(sp.mode === 'ground'){
    out.copy(platOut(P, sp.pos.x, sp.pos.z));
    if(out.lengthSq() < 1e-8) out.set(Math.sin(sp.yaw), 0, Math.cos(sp.yaw));   // dead centre: over the edge she faces
    out.normalize();
    let lo = 0, hi = 2*platR(P);
    for(let i = 0; i < 24; i++){ const m = (lo + hi)/2; if(inPlat(P, sp.pos.x + out.x*m, sp.pos.z + out.z*m)) lo = m; else hi = m; }
    const rx = sp.pos.x + out.x*lo, rz = sp.pos.z + out.z*lo;
    sp.anchor.set(rx, surfAt(P, rx, rz), rz);
    startAir();
    sp.pos.copy(sp.anchor).addScaledVector(out, .08); sp.pos.y -= .06;
    sp.yaw = Math.atan2(-out.x, -out.z);                                    // facing back in, toward the leaf she left
  } else {
    const n = P.normal(sp.pos), thin = P.thin || P.web;
    out.set(n.x, 0, n.z); if(out.lengthSq() > 1e-6) out.normalize();
    startAir();
    if(thin) sp.pos.y -= .06; else sp.pos.addScaledVector(n, .25);
  }
  sp.mode = 'hang'; sp.braked = true; sp.committed = false; sp.charging = false;
  sp.ropeL = Math.max(.45, sp.pos.distanceTo(sp.anchor) + .2);
  sp.vel.set(out.x*.4, 0, out.z*.4);
  pulses.push({pos: sp.anchor.clone(), amp: .4, decay: 5});
  toast('You let go onto your dragline. W/S reel, A/D swing, SPACE leap.');
}
// the shape of one pluck stroke for a given side: the striking side pulls hard, the other follows lightly
function pluckStroke(side){ if(!(sp.tap > 0)) return 0; const k = Math.sin(Math.PI*(1 - sp.tap/.12)); return k*(side === sp.pluckSide ? 1 : .3); }
function doPluck(dt){
  sp.plucking = true; sp.pluckT -= dt;
  if(sp.pluckT > 0) return;
  const id = PLUCKS[pluckIdx].id; let amp = 0, next = .2;
  if(id === 'midge'){ amp = .25; next = rr(.45, .85); }                 // a tiny midge: faint, lone ticks far apart
  else if(id === 'fly'){ const burst = (time % 1) < .55; amp = burst ? rr(.7, 1) : 0; next = burst ? rr(.04, .1) : .06; }
  else if(id === 'male'){ const ph = time % .9; amp = ph < .4 ? .5 : 0; next = ph < .4 ? .16 : .9 - ph; }
  else { amp = .2; next = .9; }
  sp.pluckT = next;
  if(amp > 0){ pulses.push({pos: sp.pos.clone(), amp, decay: 7}); sp.tap = .12; sp.pluckSide = -(sp.pluckSide || 1); }
  return amp;   // > 0 when a stroke landed this frame (the sound hooks on this)
}
function deadTick(p, dt){
  if(!p.dead) return false;
  p.deadT += dt; p.temp = .3 + (p.temp0 - .3)*Math.exp(-p.deadT/12); p.motion = 0; p.vib = 0;
  if(p.deadT > 45) respawnPrey(p);
  return true;
}
// the dead are unmistakable: colour drains to a dull grey-brown, the abdomen shrivels as she feeds, and once she
// lets go the husk rolls belly-up with its legs curled in
const DEAD_C = new THREE.Color(.2, .18, .16);
function deadLook(p, dt){
  const P = p.m.userData.parts;
  if(!P.mats){ P.mats = []; p.m.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for(const m of ms) if(m.color && !P.mats.some(e => e.m === m)) P.mats.push({m, c0: m.color.clone()}); }); P.abdS = P.abd ? P.abd.scale.clone() : null; }
  const fed = sp.feed && sp.feed.p === p, d = p.dead ? Math.max(.45, p.drain || 0) : 0;
  p.grey = (p.grey || 0) + (d - (p.grey || 0))*(1 - Math.exp(-3*dt));
  for(const e of P.mats) e.m.color.copy(e.c0).lerp(DEAD_C, .75*p.grey);
  const dr = p.dead ? p.drain || 0 : 0;
  if(P.abd && P.abdS){ const k = 1 - .55*dr; P.abd.scale.set(P.abdS.x*k, P.abdS.y*k*.7 + P.abdS.y*.3*(1 - dr), P.abdS.z*(.65 + .35*k)); }   // sucked flat and wrinkled
  P.body.scale.setScalar(1 - .15*dr);                                                                                                     // the whole husk shrinks a little
  if(p.held) return;                                                                                                                       // in her fangs: she places it
  const flat = p.kind !== 'argiope' || p.dropped;
  p.flip = (p.flip || 0) + ((p.dead && !fed && flat ? 1 : 0) - (p.flip || 0))*(1 - Math.exp(-4*dt));
  if(flat && p.flip > .001){ const e = p.flip*p.flip*(3 - 2*p.flip), hb = P.body.position.y;
    p.m.rotation.z = Math.PI*e; p.m.position.y = p.pos.y + (2*hb + .02)*e; }
  else if(flat) p.m.rotation.z = 0;
}
function respawnPrey(p){
  p.drain = 0; p.flip = 0; p.held = false; p.dropped = false; p.limp = 0; p.fallH = 0; p.hl = 0;
  Object.assign(p, {dead: false, deadT: 0, alert: 0, temp: p.temp0, close: 0, idleT: 0});
  if(p.kind === 'scytodes'){ p.pos.copy(p.home); p.egg = rnd() < .5; p.state = 'idle'; }
  if(p.kind === 'badumna'){ p.pos.copy(BAD.mouth); Object.assign(p, {state:'retreat', interest: 0, known: false, sulk: 0}); }
  if(p.kind === 'argiope'){ p.pos.copy(ARG.C); p.state = 'hub'; p.wary = 0; p.fwd.set(0, -1, 0); }
}

function updScytodes(p, dt){
  if(deadTick(p, dt)) return;
  const dx = sp.pos.x - p.pos.x, dz = sp.pos.z - p.pos.z, dist = Math.hypot(dx, dz), near = dist < 3 && Math.abs(sp.pos.y - p.pos.y) < .8;
  const pk = preyPluck(p), faceP = Math.atan2(dx, dz), front = angDiff(p.yaw, faceP);
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*1.4 + (pk ? dt*.6 : 0) - dt*.12);
  p.motion = 0; p.vib = 0; p.cool -= dt;
  if(p.state === 'idle'){
    p.t -= dt; if(p.t <= 0){ p.want = p.yaw + rr(-2.2, 2.2); p.t = rr(5, 9); }
    if(p.alert > .45 && near) p.want = faceP;                 // feels you through its silk and turns to face you
    if(pk && near) p.state = 'lured';
  }
  if(p.state === 'lured'){
    p.want = faceP;
    if(!pk){ p.idleT += dt; if(p.idleT > 3){ p.state = 'idle'; p.idleT = 0; } } else p.idleT = 0;
    if(front < .5 && dist > .38){ stepToward(p, sp.pos, .22, dt, p.plat); p.motion = .4; p.vib = .5; }
    if(dist < .42){ p.close += dt; if(p.close > 1.6){ hurt(.2, 'The spitting spider bites.'); p.close = 0; p.state = 'idle'; } } else p.close = 0;
  }
  if(p.state === 'hunt'){                                      // you are gummed: it comes to bite
    if(sp.stuck <= 0 && dist > .6){ p.state = 'idle'; }
    else if(stepToward(p, sp.pos, .35, dt, p.plat) < .4){ hurt(.45, 'Gummed down, you are bitten by the spitting spider.'); sp.stuck = 0; knockOff(); p.state = 'idle'; p.alert = 0; }
    p.motion = .5; p.vib = .6;
  } else {
    const d = angDelta(p.yaw, p.want); p.yaw = gaitTurn(p.m, p.yaw, p.yaw + Math.max(-1.4*dt, Math.min(1.4*dt, d))); if(Math.abs(d) > .05) p.motion = Math.max(p.motion, .2);
  }
  // armed and aware: anything in front of it, in range, gets spat on
  if(!p.egg && p.cool <= 0 && sp.stuck <= 0 && near && dist < 1.45 && front < .55 && (p.alert > .45 || p.state === 'lured')) spit(p);
}
function updBadumna(p, dt){
  if(deadTick(p, dt)) return;
  const pk = preyPluck(p), home = BAD.mouth.clone().addScaledVector(BAD.sd, .14);
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*1.2 - dt*.15);
  p.motion = 0; p.vib = 0;
  if(p.sulk > 0) p.sulk -= dt;
  if(p.alert > 1 && p.sulk <= 0 && (p.state === 'retreat' || p.state === 'peek')){ p.sulk = 12; p.alert = .3; p.interest = 0; toast('It felt your footsteps. It will stay hidden for a while.'); }
  if(p.state === 'retreat' || p.state === 'peek'){
    if(pk && p.sulk <= 0){
      if(pk === p.pref){ p.interest += dt*.32; p.peekT = 1; }        // only a heavy struggling fly is worth leaving the tube for
      else p.interest = Math.max(0, p.interest - dt*.08);
    } else p.interest = Math.max(0, p.interest - dt*.08);
    p.peekT = Math.max(0, p.peekT - dt);
    p.state = p.peekT > 0 ? 'peek' : 'retreat';
    const tgt = p.state === 'peek' ? BAD.mouth.clone().addScaledVector(BAD.sd, -.08) : home;
    // walk (legs and all) to the mouth or back into the tube, slowly, always facing out of the retreat
    const left = stepToward(p, tgt, p.state === 'peek' ? .12 : .09, dt, null), out = Math.atan2(-BAD.sd.x, -BAD.sd.z);
    p.yaw = gaitTurn(p.m, p.yaw, lerpAngle(p.yaw, out, 1 - Math.exp(-10*dt))); p.pos.y += (tgt.y - p.pos.y)*(1 - Math.exp(-3*dt));
    if(left > .02){ p.motion = .2; p.vib = .2; }
    if(p.state === 'peek'){ p.motion = Math.max(p.motion, .25); p.vib = .3; }
    if(p.interest >= 1){ p.state = 'out'; p.rush = pk === 'fly' ? .8 : .3; p.idleT = 0; p.known = true; p.close = 0; toast('It comes out of its retreat…'); }
  }
  if(p.state === 'out'){
    const rt = {fly: 1, midge: .35, male: .2, calm: 0}[pk] ?? 0;
    p.rush += (rt - p.rush)*(1 - Math.exp(-(pk === 'calm' ? 2.2 : .9)*dt));
    if(!pk || sp.plat !== BAD.plat){ p.idleT += dt; if(p.idleT > 4) p.state = 'back'; } else p.idleT = 0;
    p.pos.y = BAD.plat.y;
    const d = Math.hypot(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z);
    if(d > .36){ stepToward(p, sp.pos, .22 + p.rush*1.0, dt, null); p.motion = .3 + p.rush*.6; p.vib = .4 + p.rush*.6; p.close = 0; }
    else if(p.rush > .6){ hurt(.5, 'It rushes you — the bite of a bigger spider.'); knockOff(); p.state = 'back'; }
    else { p.close += dt; if(p.close > 1.5){ hurt(.35, 'It recognises you — and bites.'); knockOff(); p.state = 'back'; p.close = 0; } }
  }
  if(p.state === 'back'){
    p.rush = 0;
    if(stepToward(p, BAD.mouth, .25, dt, null) < .05){ p.state = 'retreat'; p.interest = 0; }
    p.motion = .3; p.vib = .4;
  }
}
function updArgiope(p, dt, t){
  if(deadTick(p, dt)) return;
  const pk = preyPluck(p), {C, n, R} = ARG;
  const rel = sp.pos.clone().sub(C), offPlane = Math.abs(rel.dot(n)), radial = rel.addScaledVector(n, -rel.dot(n)).length();
  const nearWeb = offPlane < 1 && radial < R + .6;
  p.alert = Math.max(0, p.alert + preyNoise(p)*dt*2.4 - dt*(pk === 'male' ? .7 : .15));
  p.motion = 0; p.vib = 0;
  if(p.wary > 0) p.wary -= dt;
  // the pump is a test: it shakes the orb and feels for anything that moves against the shaking. Real prey is
  // already stuck and struggles in rhythm with it; a hunter creeping on the silk gives itself away. Hold still and
  // it settles back on the hub; move, and it lunges straight down the threads at you.
  const onWeb = onSilkOf(p) || (sp.mode === 'hang' && nearWeb);
  if(p.state !== 'pump' && p.state !== 'wrap' && p.state !== 'rush' && p.state !== 'lunge' && pk !== 'male' && p.alert > 1 && DOOM.t < 0){ p.state = 'pump'; p.pumpT = 3; p.alert = .4; toast('The orb-weaver pumps its web — freeze, or it will strike!'); }
  if(p.state === 'pump'){
    p.pumpT -= dt; p.vib = 1.4; p.motion = .5;
    const moving = sp.speed > 0 || sp.plucking || (sp.mode === 'hang' && (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD));
    if(moving && onWeb && DOOM.t < 0){ p.state = 'lunge'; p.alert = 1; toast('It felt you move — the orb-weaver lunges!'); }
    else if(p.pumpT <= 0) p.state = 'hub';
  }
  if(p.state === 'lunge'){                                   // fast and fatal; only getting off its silk saves her
    p.motion = 1; p.vib = 1.3;
    if(DOOM.t >= 0) p.state = 'return';
    else if(!onWeb){ p.state = 'return'; p.wary = 15; p.alert = .6; toast('You got off the web in time. It stays wary.'); }
    else if(argMove(p, webPoint(sp.pos, R), 3.5, dt, true) < .3){ toast('The orb-weaver drives its fangs into you.'); die(); p.state = 'return'; p.alert = 0; }
  }
  if(p.state === 'hub'){
    argMove(p, C.clone().addScaledVector(n, .01), .3, dt); p.fwd.lerp(new V3(0, -1, 0), 1 - Math.exp(-3*dt));
    if(pk && p.wary <= 0) p.state = pk === 'fly' ? 'rush' : (pk === 'calm' ? 'hub' : 'walk');
  }
  if(p.state === 'walk' || p.state === 'rush'){
    if(pk === 'fly') p.state = 'rush';
    const rush = p.state === 'rush';
    argMove(p, webPoint(sp.pos, R*.85), rush ? 1.0 : (pk === 'male' ? .12 : .2), dt);
    p.motion = rush ? .9 : .4; p.vib = rush ? 1.1 : .5;
    if(!pk){ p.idleT += dt; if(p.idleT > 3){ p.state = 'return'; p.idleT = 0; } } else p.idleT = 0;
    if(p.pos.distanceTo(sp.pos) < .45){
      if(rush){ hurt(.6, 'The orb-weaver rushes out and wraps you in silk.'); knockOff(); p.state = 'return'; }
      else { p.close += dt; if(p.close > 1.8){ hurt(.4, 'It realises what you are — and bites.'); knockOff(); p.state = 'return'; p.close = 0; } }
    } else p.close = 0;
  }
  if(p.state === 'return'){ if(argMove(p, C.clone().addScaledVector(n, .01), .35, dt) < .03) p.state = 'hub'; p.motion = .3; }
  if(p.state === 'wrap'){
    if(sp.stuck <= 0 || sp.stuckKind !== 'web') p.state = 'return';
    else if((p.wrapDelay -= dt) > 0){ p.vib = .6; }
    else if(argMove(p, webPoint(sp.stuckPos, R), .7, dt) < .18){ hurt(.7, 'Wrapped in the sticky spiral, and bitten.'); sp.stuck = .01; p.state = 'return'; }
    p.motion = .8; p.vib = 1;
  }
}
function updatePrey(dt, t){
  for(const p of PREY){
    KILLER_NOW = p;
    if(DOOM.killer === p && DOOM.t >= 0 && !DOOM.reset) eatCorpse(p, dt);
    else if(p.kind === 'scytodes') updScytodes(p, dt); else if(p.kind === 'badumna') updBadumna(p, dt); else updArgiope(p, dt, t);
    KILLER_NOW = null;
    if(!p.dead) p.temp += ((p.motion > .6 ? .72 : .56) - p.temp)*(1 - Math.exp(-.8*dt));
    // pose: walking prey are carried on planted feet; resting or dead ones hold a pose
    const vNow = p.pos.clone().sub(p.prevPos || p.pos).divideScalar(Math.max(dt, 1e-4));
    p.velW = (p.velW || new V3()).lerp(vNow, 1 - Math.exp(-12*dt)); p.prevPos = p.pos.clone();
    if(p.held){                                                    // in her fangs: feedTick places it; it spasms, then goes limp
      const bite = sp.feed && sp.feed.t < BITE_T;
      gaitRelease(p.m); poseArach(p.m, bite ? {walk: 1, phase: t*48, bob: Math.sin(t*70)*.003} : {limp: p.limp || 0});
    } else if(p.kind === 'argiope' && !p.dropped){
      const z = p.fwd.clone().normalize(), y = ARG.n.clone(), x = new V3().crossVectors(y, z);
      M4.makeBasis(x, y, z); p.m.quaternion.setFromRotationMatrix(M4); p.m.position.copy(p.pos).add(ARG_WEB.position);
      if(!p.dead && p.state !== 'hub' && p.state !== 'pump'){
        // feet grip the silk: footholds lie on the (swaying) web plane, "up" is the web normal
        const c = ARG.C.clone().add(ARG_WEB.position);
        poseArach(p.m, {});
        gaitUpdate(p.m, dt, {vel: p.velW, up: ARG.n, stepDur: .2, free: () => false,
          place: v => v.addScaledVector(ARG.n, -v.clone().sub(c).dot(ARG.n) + .002)});
      } else { gaitRelease(p.m); poseArach(p.m, {cross: !p.dead, pump: p.state === 'pump' ? t*30 : 0, curl: p.dead}); }
    } else {
      p.m.position.x = p.pos.x; p.m.position.z = p.pos.z; p.m.rotation.y = p.yaw;
      const onSurface = !p.dead && !(p.kind === 'badumna' && (p.state === 'retreat' || p.state === 'peek'));
      if(onSurface){
        gaitBody(p.m, dt, p.pos.y); poseArach(p.m, {});
        gaitUpdate(p.m, dt, {vel: p.velW, place: v => placeOn(p.plat, v), free: () => false});
      } else {
        gaitRelease(p.m); p.m.position.y = p.pos.y; p.m.rotation.x = p.m.rotation.z = 0;
        poseArach(p.m, {curl: p.dead, tuck: !p.dead && p.kind === 'badumna' && p.state === 'retreat', walk: p.motion > .25 ? 1 : 0, phase: p.phase});
      }
    }
    if(DOOM.killer === p) eatPose(p, t);
    if(p.kind === 'scytodes') p.m.userData.egg.visible = p.egg && !p.dead;
    deadLook(p, dt);
    if(p.fallH > 0){ p.fallV += 9*dt; p.fallH = Math.max(0, p.fallH - p.fallV*dt); p.m.position.y += p.fallH;   // the dropped husk falls,
      if(p.fallH === 0) pulses.push({pos: p.pos.clone(), amp: .3, decay: 6}); }                                // and lands with a faint tap
  }
  for(let i = gums.length - 1; i >= 0; i--){ const g = gums[i]; g.t -= dt; if(g.t <= 0){ scene.remove(g.ln); drawables.splice(drawables.indexOf(g.ln), 1); gums.splice(i, 1); } }
  // webs tremble in the breeze; the orb bucks when pumped
  ARG_WEB.position.copy(ARG.n).multiplyScalar(Math.sin(t*7)*(.006 + wind.gust*.03) + (ARGI.state === 'pump' ? Math.sin(t*32)*.05 : 0));
  BAD_WEB.position.y = Math.sin(t*6)*wind.gust*.015;
  if(sp.mode === 'climb' && sp.plat && sp.plat.web && !sp.roll){          // she and her footholds ride the swaying, bucking orb
    const off = ARG_WEB.position.clone(), d = off.clone().sub(sp.plat.lastOff || off); sp.plat.lastOff = off;
    if(d.lengthSq() > 0){ sp.pos.add(d); sp.m.position.add(d); for(const L of sp.m.userData.parts.legs){ L.foot.add(d); if(L.step){ L.step.from.add(d); L.step.to.add(d); } } }
  }
}
function preyInfo(p){
  if(p.dead){ const F = sp.feed && sp.feed.p === p ? sp.feed : null;
    if(!F) return ['DEAD · a shrivelled husk', 'a new resident will move in later'];
    if(F.t < BITE_T) return ['VENOM · fangs striking', 'it convulses'];
    if(F.t < BITE_T + GRAB_T) return ['seizing it in legs and palps', 'lifting it off its feet'];
    return ['draining', '']; }
  if(p.kind === 'scytodes'){
    const facing = angDiff(p.yaw, Math.atan2(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z)) < .7;
    return [p.egg ? 'egg sac in its jaws — it cannot spit' : 'jaws empty — ARMED, spits forward',
      p.egg ? 'it cannot spit: leap onto it' : (facing ? 'facing you — detour behind it, or drop from above' : 'facing away — leap onto its back')];
  }
  if(p.kind === 'badumna'){
    const st = {retreat: p.sulk > 0 ? 'sulking deep in its tube' : 'hidden in its retreat', peek: 'stirring at the tube mouth',
      out: p.rush > .6 ? 'RUSHING — switch to calming taps' : 'creeping toward the signal', back: 'returning to its retreat'}[p.state];
    return [st, p.known ? `it answers to: ${PLUCKS.find(q => q.id === p.pref).name}` : 'pluck the sheet, try different signals · step during gusts'];
  }
  const st = {hub: 'motionless at the hub', pump: 'PUMPING the web — freeze or it strikes', lunge: 'LUNGING — it felt you move', walk: 'walking toward the signal', rush: 'RUSHING to wrap', return: 'returning to the hub', wrap: 'coming to wrap you'}[p.state];
  return [st + (p.wary > 0 ? ' · wary' : ''), 'walk its web softly (Shift), drop from the leaf above (X), or pluck from the frame leaf'];
}


const ropeGeo = new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]);
const rope = hot(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({color:0xfff4dc})), .62); rope.frustumCulled = false; rope.visible = false; scene.add(rope);
// where the dragline is tied: a bright silk knot with a halo, so you always know whether and where you're attached
const tieMark = hot(new THREE.Group(), .95); tieMark.visible = false; scene.add(tieMark);
tieMark.add(new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), new THREE.MeshBasicMaterial({color:0xfff2c0})),
  new THREE.Mesh(new THREE.RingGeometry(.045, .055, 24), new THREE.MeshBasicMaterial({color:0xffe08a, side:THREE.DoubleSide, transparent:true, opacity:.85})));
const DOTS = 36;
const dots = hot(new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({color:0xffe0a0}), DOTS), TEMP.preview);
dots.frustumCulled = false; dots.visible = false; scene.add(dots);
// the landing estimate: a ring as wide as her likely error, a small mark at its centre; hot orange when prey is inside it
const aimOwner = {temp: TEMP.preview, motion: 0};
const aimRing = new THREE.Group(); aimRing.visible = false; aimRing.userData.owner = aimOwner; scene.add(aimRing);
const aimRingM = new THREE.MeshBasicMaterial({color:0xffe0a0, transparent:true, opacity:.9, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2});
const aimOuter = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), aimRingM), aimInner = new THREE.Mesh(new THREE.RingGeometry(0, .03, 16), aimRingM);
const aimFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({color:0xffe0a0, transparent:true, opacity:.12, side:THREE.DoubleSide, depthWrite:false}));
aimRing.add(aimOuter, aimInner, aimFill);
