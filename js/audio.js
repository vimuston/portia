'use strict';
// procedural music and sfx

/* ---------- SOUND: a procedural lo-fi score + effects (Web Audio, nothing loaded). A slow swung groove (74 bpm) of
   soft electric-piano chords, a round sine bass, brushed drums and vinyl crackle, all through a warm tape-ish lowpass.
   It reads what Portia is doing each frame and shifts layers: wandering (full groove), stalking (muffled, kick only),
   aiming (drums drop out, filter rises with the charge), airborne/ballooning (opens up, melody), feeding, courting,
   danger (darker chords, heartbeat kick). No pitch glides anywhere. M mutes. Starts on the first key or click. ---------- */
const AUDIO = (() => {
  let ctx = null, master, musicBus, musicF, sfxBus, verbIn, noiseBuf, L = {}, chargeOsc, chargeG, chargeN;
  let muted = store.get('muted', '0') === '1';
  const hz = midi => 440*Math.pow(2, (midi - 69)/12);
  const BEAT = 60/74, SWING = .6;
  // chord voicings (midi). Calm: Dm9 – Bbmaj7 – Gm9 – A7sus. Danger: Dm(b9) – Ebmaj7(#11)
  const CALM = [{b: 38, c: [53, 57, 60, 64]}, {b: 34, c: [50, 53, 57, 62]}, {b: 43, c: [50, 53, 57, 58]}, {b: 33, c: [50, 55, 57, 61]}];
  const DARK = [{b: 38, c: [51, 53, 57, 60]}, {b: 39, c: [50, 55, 58, 62]}];
  const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81];
  // layer levels and lowpass per mood: keys, bass, kick, snare, hat, melody density, cutoff
  const MOODS = {
    explore: {keys: 1,  bass: 1,  kick: 1,  snare: 1,  hat: 1,  mel: .22, lp: 3200},
    stalk:   {keys: .7, bass: .8, kick: .7, snare: 0,  hat: .25, mel: .08, lp: 1100},
    aim:     {keys: .6, bass: .5, kick: 0,  snare: 0,  hat: .5, mel: 0,   lp: 800},
    air:     {keys: 1,  bass: .9, kick: 1,  snare: 1,  hat: 1,  mel: .55, lp: 6000},
    balloon: {keys: 1,  bass: .6, kick: 0,  snare: 0,  hat: .3, mel: .35, lp: 5000},
    feed:    {keys: 1,  bass: 1,  kick: 1,  snare: 1,  hat: 1,  mel: .35, lp: 4200},
    court:   {keys: 1,  bass: .8, kick: .4, snare: 0,  hat: .6, mel: .45, lp: 4500},
    danger:  {keys: .8, bass: 1,  kick: 1,  snare: 0,  hat: .5, mel: 0,   lp: 1400, dark: true},
  };
  let mood = 'explore', moodHold = 0, nextT = 0, step = 0, bar = 0, stepT = 0;

  function init(){
    if(ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = muted ? 0 : .85; master.connect(comp); comp.connect(ctx.destination);
    // music runs through a warm lowpass (the mood moves it) and a gentle tape saturation
    musicF = ctx.createBiquadFilter(); musicF.type = 'lowpass'; musicF.frequency.value = 3200; musicF.Q.value = .5;
    const sat = ctx.createWaveShaper(), cv = new Float32Array(1024); for(let i = 0; i < 1024; i++){ const x = i/511.5 - 1; cv[i] = Math.tanh(x*1.4)/Math.tanh(1.4); } sat.curve = cv;
    musicBus = ctx.createGain(); musicBus.gain.value = .6; musicBus.connect(sat); sat.connect(musicF); musicF.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
    const verb = ctx.createConvolver(), n = ctx.sampleRate*2.6, ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 3); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = .4; verbIn.connect(verb); verb.connect(musicF);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for(let i = 0; i < nd.length; i++) nd[i] = Math.random()*2 - 1;
    for(const k of ['keys', 'bass', 'kick', 'snare', 'hat', 'mel']){ L[k] = ctx.createGain(); L[k].gain.value = 0; L[k].connect(musicBus); }
    L.mel.connect(verbIn); L.keys.connect(verbIn);
    // vinyl: soft hiss plus sparse crackle, looped
    const vb = ctx.createBuffer(1, ctx.sampleRate*4, ctx.sampleRate), vd = vb.getChannelData(0);
    for(let i = 0; i < vd.length; i++) vd[i] = (Math.random()*2 - 1)*.02 + (Math.random() < .0004 ? (Math.random()*2 - 1)*.7 : 0);
    const vs = ctx.createBufferSource(), vf = ctx.createBiquadFilter(), vg = ctx.createGain(); vs.buffer = vb; vs.loop = true; vf.type = 'bandpass'; vf.frequency.value = 2500; vf.Q.value = .4; vg.gain.value = .35;
    vs.connect(vf); vf.connect(vg); vg.connect(master); vs.start();
    // the charge: a soft breathy rise (no buzzing oscillator)
    chargeN = ctx.createBufferSource(); chargeN.buffer = noiseBuf; chargeN.loop = true;
    chargeOsc = ctx.createBiquadFilter(); chargeOsc.type = 'bandpass'; chargeOsc.Q.value = 8; chargeOsc.frequency.value = 900;
    chargeG = ctx.createGain(); chargeG.gain.value = 0; chargeN.connect(chargeOsc); chargeOsc.connect(chargeG); chargeG.connect(sfxBus); chargeN.start();
    nextT = ctx.currentTime + .15;
  }
  const resume = () => { init(); if(ctx && ctx.state === 'suspended') ctx.resume(); };
  addEventListener('keydown', resume); addEventListener('pointerdown', resume);
  function toggleMute(){ muted = !muted; store.set('muted', muted ? '1' : '0'); if(ctx) master.gain.setTargetAtTime(muted ? 0 : .85, ctx.currentTime, .05); toast(muted ? 'Sound off (M)' : 'Sound on (M)'); }

  // ---- voices ----
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  function osc(type, f, t, peak, a, d, out, lp){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = (Math.random() - .5)*8;   // a little tape wobble
    env(g, t, a, peak, d); let n = o;
    if(lp){ const F = ctx.createBiquadFilter(); F.type = 'lowpass'; F.frequency.value = lp; o.connect(F); n = F; }
    n.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + .05);
  }
  function noise(t, dur, peak, type, f0, f1, q, out){
    const s = ctx.createBufferSource(), F = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
    F.type = type; F.Q.value = q || 1; F.frequency.setValueAtTime(f0, t); F.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, Math.min(.008, dur*.2), peak, dur); s.connect(F); F.connect(g); g.connect(out || sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  // electric piano: sine body, a soft octave, and a short tine on the attack
  const ep = (m, t, v, out, d = 2.4) => { const f = hz(m); osc('sine', f, t, .07*v, .006, d, out); osc('sine', f*2, t, .018*v, .004, d*.5, out); osc('sine', f*7, t, .006*v, .001, .12, out); };
  const bassNote = (m, t, v) => { osc('sine', hz(m), t, .22*v, .015, BEAT*1.6, L.bass); osc('triangle', hz(m)*2, t, .02*v, .01, .25, L.bass, 600); };
  const kick = (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .07);
    env(g, t, .004, .45*v, .3); o.connect(g); g.connect(L.kick); o.start(t); o.stop(t + .4); };
  const snare = (t, v) => { noise(t, .18, .12*v, 'bandpass', 1800, 1200, .8, L.snare); osc('sine', 190, t, .05*v, .002, .08, L.snare); };
  const hat = (t, v) => noise(t, .03, .035*v, 'highpass', 7000, 6000, 1, L.hat);

  // ---- what is she doing? ----
  function senseMood(){
    let near = 1e9, threat = 0;
    for(const p of PREY){ if(p.dead || p.gone) continue; const d = p.pos.distanceTo(sp.pos); near = Math.min(near, d);
      if(d < 4.5 && ['hunt', 'out', 'rush', 'wrap', 'pump'].includes(p.state)) threat = 1;
      if(d < 2.5) threat = Math.max(threat, Math.min(1, (p.alert || 0) - .25)); }
    for(const f of flies) if(!f.gone && !f.held) near = Math.min(near, f.pos.distanceTo(sp.pos) + 1);
    if(sp.stuck > 0 || threat > .55 || sp.vigor < .3) return 'danger';
    if(sp.mode === 'feed') return 'feed';
    if(male.plat === sp.plat && ['approach', 'mount'].includes(male.state)) return 'court';
    if(sp.charging) return 'aim';
    if(sp.balloon) return 'balloon';
    if(sp.mode === 'air') return 'air';
    if(sp.sneaking || near < 2.2) return 'stalk';
    return 'explore';
  }

  function update(dt){
    if(!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const want = senseMood();   // moods hold briefly before changing, so short hops don't jerk the mix about
    if(want === mood) moodHold = 0; else { moodHold += dt; if(moodHold > (want === 'aim' || want === 'danger' ? .1 : want === 'air' ? .25 : 1)){ mood = want; moodHold = 0; } }
    const M = MOODS[mood], ch = sp.charging ? sp.charge || 0 : 0;
    for(const k of ['keys', 'bass', 'kick', 'snare', 'hat']) L[k].gain.setTargetAtTime(M[k], now, .6);
    L.mel.gain.setTargetAtTime(1, now, .5);
    musicF.frequency.setTargetAtTime(M.lp + ch*2200, now, mood === 'aim' ? .15 : .8);
    chargeOsc.frequency.setTargetAtTime(700 + ch*1800, now, .08);
    chargeG.gain.setTargetAtTime(sp.charging ? .03 + ch*.07 : 0, now, sp.charging ? .1 : .04);
    // schedule ahead on a swung eighth-note grid
    if(nextT < now) nextT = now + .02;
    while(nextT < now + .25){
      const s = step % 8, prog = M.dark ? DARK : CALM, chord = prog[bar % prog.length];
      const t = nextT + (s % 2 ? (SWING - .5)*BEAT : 0);
      if(s === 0){ chord.c.forEach((m, i) => ep(m, t + i*.018, .8, L.keys, BEAT*3.5)); bassNote(chord.b, t, 1); }   // a slightly rolled chord
      if(s === 3 && Math.random() < .5) chord.c.slice(1).forEach((m, i) => ep(m, t + i*.015, .45, L.keys, BEAT));
      if(s === 4 && Math.random() < .6) bassNote(chord.b + (Math.random() < .5 ? 12 : 7), t, .7);
      if(mood === 'danger'){ if(s % 2 === 0){ kick(t, .9); if(s % 4 === 0) kick(t + .17, .5); } }   // heartbeat
      else { if(s === 0 || (s === 5 && Math.random() < .6)) kick(t, 1); if(s === 2 || s === 6) snare(t, 1); }
      hat(t, s % 2 ? .6 : 1);
      if(Math.random() < M.mel){ const pool = mood === 'air' || mood === 'balloon' ? PENTA.slice(3) : PENTA; ep(pool[Math.random()*pool.length | 0], t, .9, L.mel, 1.8); }
      nextT += BEAT/2; step++; if(step % 8 === 0) bar++;
    }
    if((sp.mode === 'ground' || sp.mode === 'climb') && (sp.speed || 0) > .05){ stepT -= dt*(sp.sprinting ? 2.5 : 1)*Math.min(3, .6 + sp.speed*4);
      if(stepT <= 0){ stepT = .09; noise(now, .018, sp.sneaking ? .012 : .04, 'bandpass', 2600 + Math.random()*1500, 1800, 3); } }
  }

  // ---- effects (soft and organic: filtered noise, sines, piano figures) ----
  const melOut = () => sfxBus;
  const sfx = {
    jump(power){ if(!ctx) return; const t = ctx.currentTime; noise(t, .25 + power*.12, .18 + power*.12, 'bandpass', 600, 2800, 1.5); },
    land(soft){ if(!ctx) return; const t = ctx.currentTime; noise(t, .07, soft ? .06 : .16, 'lowpass', 1200, 250, 1); osc('sine', 90, t, soft ? .06 : .14, .003, .1, sfxBus); },
    bite(){ if(!ctx) return; const t = ctx.currentTime;
      for(let k = 0; k < 4; k++) noise(t + k*.06, .045, .22, 'bandpass', 2800 - k*250, 1000, 4);   // rapid fang strokes
      [62, 65, 69, 74].forEach((m, k) => ep(m, t + .08 + k*.09, 1.1, melOut(), 1.6)); },
    hurt(){ if(!ctx) return; const t = ctx.currentTime; noise(t, .22, .25, 'lowpass', 2000, 200, 1); [50, 51, 56].forEach(m => ep(m, t, 1, sfxBus, 1.2)); },
    die(){ if(!ctx) return; const t = ctx.currentTime; [69, 65, 62, 58, 53, 50].forEach((m, k) => ep(m, t + k*.22, 1, sfxBus, 2)); },
    stuck(){ if(!ctx) return; const t = ctx.currentTime; for(let k = 0; k < 5; k++) noise(t + k*.07, .09, .12, 'bandpass', 500 + k*60, 300, 8); },
    twang(){ if(!ctx) return; const t = ctx.currentTime; ep(74 + (Math.random()*3 | 0)*2, t, .7, sfxBus, .5); },
    // one pluck stroke, voiced by the signal: a midge is a faint high tick, a fly a low buzzing rattle, calm a soft thud
    pluck(id, amp){ if(!ctx) return; const t = ctx.currentTime, r = Math.random();
      if(id === 'midge'){ ep(86 + (r*3 | 0)*2, t, .35, sfxBus, .2); noise(t, .02, .03, 'highpass', 6500, 5000, 1); }
      else if(id === 'fly'){ noise(t, .08, .4*amp, 'bandpass', 520 + r*160, 300, 3); osc('sawtooth', 140 + r*30, t, .05*amp, .003, .07, sfxBus, 1400);
        ep(67 + (r*3 | 0), t, 1.1*amp, sfxBus, .2); }
      else if(id === 'calm'){ noise(t, .12, .18, 'lowpass', 900, 250, 1); ep(62, t, 1, sfxBus, .7); ep(50, t, .8, sfxBus, .5); }
      else sfx.twang(); },
    balloon(){ if(!ctx) return; const t = ctx.currentTime; noise(t, 1, .08, 'bandpass', 800, 3500, 3); [74, 81, 86].forEach((m, k) => ep(m, t + k*.1, .7, sfxBus, 1.5)); },
    snip(){ if(!ctx) return; const t = ctx.currentTime; noise(t, .03, .2, 'highpass', 6000, 4000, 1); },
    silk(){ if(!ctx) return; const t = ctx.currentTime; noise(t, .22, .07, 'bandpass', 2000, 4500, 6); },
    mated(){ if(!ctx) return; const t = ctx.currentTime; [62, 66, 69, 73, 76, 81].forEach((m, k) => ep(m, t + k*.13, 1, sfxBus, 2.2)); },
    spit(){ if(!ctx) return; const t = ctx.currentTime; noise(t, .3, .3, 'lowpass', 2600, 300, 3); noise(t + .02, .16, .14, 'bandpass', 900, 400, 5); },
    signal(){ if(!ctx) return; const t = ctx.currentTime; ep(81, t, .6, sfxBus, .4); ep(86, t + .08, .5, sfxBus, .5); },
  };
  addEventListener('keydown', e => { if(e.code === 'KeyM' && !e.repeat) toggleMute(); });
  return {update, sfx, toggleMute, get mood(){ return mood; }, get ctx(){ return ctx; }};
})();
// hook the effects onto the game's own events
{
  const wrap = (fn, before) => function(...a){ before.apply(this, a); return fn.apply(this, a); };
  const after = (fn, aft) => function(...a){ const r = fn.apply(this, a); aft(r, ...a); return r; };
  jump = wrap(jump, () => AUDIO.sfx.jump(sp.charge || 0));
  land = wrap(land, p => { if(p && p.kind !== 'climb') AUDIO.sfx.land(sp.plop); });
  hurt = wrap(hurt, () => AUDIO.sfx.hurt());
  die = wrap(die, () => AUDIO.sfx.die());
  killPrey = wrap(killPrey, () => AUDIO.sfx.bite());
  catchFly = after(catchFly, ok => { if(ok) AUDIO.sfx.bite(); });
  spit = wrap(spit, () => AUDIO.sfx.spit());
  stickInWeb = wrap(stickInWeb, () => AUDIO.sfx.stuck());
  startBalloon = wrap(startBalloon, () => { if(!sp.balloon && sp.stuck <= 0) AUDIO.sfx.balloon(); });
  cutLine = wrap(cutLine, () => { if(sp.line) AUDIO.sfx.snip(); });
  dropLine = wrap(dropLine, () => AUDIO.sfx.silk());
  cyclePluck = wrap(cyclePluck, () => AUDIO.sfx.signal());
  doPluck = after(doPluck, amp => { if(amp > 0) AUDIO.sfx.pluck(PLUCKS[pluckIdx].id, amp); });
  flash = wrap(flash, big => { if(big === 'MATED') AUDIO.sfx.mated(); });
}
