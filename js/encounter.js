'use strict';
// boss/encounter cards and HUD update

/* ---- encounters: close in on a spider and it gets a title card (once a while), then a boss bar with one plain instruction ---- */
const BOSS = {
  scytodes: {pre: 'YOUR PREY', name: 'SCYTODES PALLIDA', epi: 'THE SPITTING SPIDER', lab: 'AWARENESS'},
  badumna:  {pre: 'YOUR PREY', name: 'BADUMNA LONGINQUA', epi: 'THE LURKER IN THE TUBE', lab: 'AWARENESS'},
  argiope:  {pre: 'YOU ARE ON ITS WEB', name: 'ARGIOPE', epi: 'WEAVER OF THE CROSS', lab: 'AWARENESS'},
  male:     {pre: 'A SUITOR', name: 'PORTIA LABIATA', epi: 'HE WHO COURTS', lab: 'TRUST', ally: true},
};
const ENC = {tg: null, seen: new Map(), cardT: 0, cardDur: 0, won: false, key: ''};
const ENC_IN = 2.0, ENC_OUT = 3.0, ENC_AGAIN = 45;
// [the one thing to do now, whether it is urgent]
function bossDo(p){
  if(p === male){
    if(male.state === 'linger') return !male.pang ? ['He lingers beside you.', false]
      : male.timid ? ['He is losing his nerve. Strike now!', true] : ['Leap on him and devour him.', false];
    if(sp.mated && male.state !== 'mount') return ['You have already mated.', false];
    return {display: [sp.plat === male.plat ? 'Stay still and let him court you.' : 'Stand on his leaf and keep still.', false],
      approach: ['He is coming closer. Do not move.', false], mount: ['Mating. Do not move.', true], leave: ['He has left. Wait for him to return.', false]}[male.state] || ['', false];
  }
  if(p.kind === 'scytodes'){
    if(p.egg) return ['It holds its eggs and cannot spit. Leap onto it.', false];
    const facing = angDiff(p.yaw, Math.atan2(sp.pos.x - p.pos.x, sp.pos.z - p.pos.z)) < .7;
    return facing ? ['It faces you and will spit. Get behind it, or drop from above.', true] : ['It is looking away. Leap onto its back.', false];
  }
  if(p.kind === 'badumna') return ({
    retreat: [p.known ? `Pluck its web with the ${PLUCKS.find(q => q.id === p.pref).name} signal to lure it out.` : 'Pluck its web to lure it out. Try different signals.', false],
    peek: ['It stirs. Keep plucking.', false],
    out: p.rush > .6 ? ['It is rushing you. Switch to calming taps!', true] : ['It is coming. Wait, then leap.', false],
    back: ['It is going back. Pluck again.', false]})[p.state] || ['', false];
  return ({hub: ['Pluck the web (hold Q) to lure it toward you.', false], pump: ['It is shaking the web. FREEZE.', true],
    walk: ['It is coming toward the signal. Leap when it is close.', false], rush: ['It is coming to wrap you. Get off the web!', true],
    wrap: ['It is coming to wrap you. Get off the web!', true], return: ['It is going back to the hub. Follow softly.', false]})[p.state] || ['', false];
}
function encCard(pre, name, epi, todo, win){
  const E = $('#encounter'); E.classList.toggle('ec-win', !!win);
  E.querySelector('.ec-pre').textContent = pre; E.querySelector('.ec-name').textContent = name; E.querySelector('.ec-epi').textContent = epi;
  E.querySelector('.ec-do').innerHTML = todo ? `<b>DO</b>${todo}` : '';
  E.style.setProperty('--ec', win ? '#e8c070' : '#c9a25a');
  ENC.cardDur = ENC.cardT = win ? 3.2 : 3.8; if(!win) ENC.won = false;
}
function bossWin(name, epi){ encCard('', name, epi, '', true); ENC.won = true; if(name === 'MATED') AUDIO.sfx.mated(); }
function updateEncounter(dt){
  const now = performance.now()/1000, bar = $('#bossbar'), E = $('#encounter');
  if(introOpen()){ bar.classList.remove('on'); E.style.opacity = 0; return; }
  const live = p => p === male ? !male.gone && !male.dead && (!sp.mated || male.state === 'mount' || male.state === 'linger') : !p.dead;
  const onOrb = sp.mode === 'climb' && sp.plat && sp.plat.web;
  const dist = p => p.kind === 'argiope' ? (onOrb ? 0 : 1e9) : p.pos.distanceTo(sp.pos);   // the orb weaver: when she's on its web
  // the engaged one is kept until you are well clear of it; otherwise the nearest live spider within reach
  if(ENC.tg && (dist(ENC.tg) > ENC_OUT || !live(ENC.tg))){
    if(ENC.tg.dead && !ENC.won && sp.feed && sp.feed.p === ENC.tg) bossWin('PREY DEVOURED', ENC.tg === male ? 'PORTIA LABIATA' : BOSS[ENC.tg.kind].name);
    ENC.tg = null;
  }
  if(!ENC.tg){ let best = ENC_IN;
    for(const p of [...PREY, male]){ if(!live(p)) continue; const d = dist(p); if(d < best){ best = d; ENC.tg = p; } }
    if(ENC.tg){ ENC.won = false; const B = BOSS[ENC.tg === male ? 'male' : ENC.tg.kind];
      if(now - (ENC.seen.get(ENC.tg) ?? -1e9) > ENC_AGAIN && !(ENC.tg === male && male.state === 'linger')) encCard(B.pre, B.name, B.epi, bossDo(ENC.tg)[0]);
      bar.querySelector('.bb-name').textContent = B.name; }
  }
  const tg = ENC.tg;
  if(tg){ ENC.seen.set(tg, now);
    const B = BOSS[tg === male ? 'male' : tg.kind], hunt = tg === male && male.pang, court = tg === male && !hunt;
    const v = hunt ? 1 - male.stare/MALE_NERVE : tg === male ? 0 : tg.alert;
    const w = `${Math.round(Math.max(0, Math.min(1, v || 0))*100)}%`;
    bar.classList.toggle('ally', court); bar.classList.toggle('nobar', court);   // courtship: no meter, just what to do
    bar.querySelector('.bb-lab').textContent = court ? '' : hunt ? 'NERVE' : B.lab;
    bar.querySelector('.bb-bar i').style.width = w; bar.querySelector('.bb-bar u').style.width = w;
    const [todo, hot] = bossDo(tg), D = bar.querySelector('.bb-do');
    if(ENC.key !== todo){ D.textContent = todo; ENC.key = todo; } D.classList.toggle('hot', hot);
  }
  bar.classList.toggle('on', !!tg && ENC.cardT <= .4);
  if(ENC.cardT > 0){ ENC.cardT -= dt; const e = ENC.cardDur - ENC.cardT;
    E.style.opacity = Math.max(0, Math.min(1, e/.6, ENC.cardT/.9));
    E.style.transform = `translateY(-50%) scale(${1 + e*.012})`; }
  else E.style.opacity = 0;
}

function updateHud(dt){
  updateEncounter(dt);
  // the spider card appears over a spider when the pointer hovers it or you look straight at it (not the one you're engaged with)
  const W = innerWidth || 1280, H = innerHeight || 800, cands = [];
  if(aimPt.x != null && !aimPt.pad) cands.push([aimPt.x, aimPt.y, 70]); cands.push([W/2, H/2, 90]);
  let tg = null, best = 1e9, at = null;
  for(const p of [...PREY, male]){ if(p === ENC.tg || (p === male && (male.gone || male.dead))) continue; const c = (p.m.userData.parts.body || p.m).getWorldPosition(new V3()); if(c.distanceTo(camera.position) > 9) continue;
    const v = c.clone().project(camera); if(v.z > 1 || v.z < -1) continue; const sx = (v.x*.5 + .5)*W, sy = (.5 - v.y*.5)*H;
    for(const [x, y, r] of cands){ const d = Math.hypot(sx - x, sy - y); if(d < r && d < best){ best = d; tg = p; at = [sx, sy]; } } }
  const T = $('#target'); T.hidden = !tg;
  if(tg){ const [nm, st, hint, al] = tg === male ? ['PORTIA LABIATA · MALE', {display: 'displaying to you', approach: 'edging closer', mount: 'mating', leave: 'leaving', linger: male.timid ? 'losing his nerve' : 'lingering', flee: 'fleeing'}[male.state],
      male.state === 'mount' ? 'keep still until he is done' : maleIsPrey() ? 'leap on him and devour him' : sp.mated ? 'you have already mated' : 'stand on his leaf and keep still', male.calm/2.5] : [tg.name.toUpperCase(), ...preyInfo(tg), tg.alert];
    $('#tg-name').textContent = nm; $('#tg-state').textContent = st; $('#tg-hint').textContent = hint;
    $('#tg-alert').style.width = `${Math.round(Math.min(1, al || 0)*100)}%`;
    T.style.left = `${Math.min(W - 135, Math.max(135, at[0]))}px`; T.style.top = `${Math.max(120, at[1] - 40)}px`; }
  const pd = $('#legend .pd'); if(pd.hidden === !!pad.connected) pd.hidden = !pad.connected;
  if(flashT > 0){ flashT -= dt; const e = 1.6 - flashT, f = $('#flash'); f.style.opacity = Math.max(0, Math.min(1, e/.18, flashT/.5)); f.style.transform = `translate(-50%, ${-50 - e*6}%)`; }
  if(toastT > 0){ toastT -= dt; if(toastT <= 0) $('#toast').classList.remove('on'); }
}
