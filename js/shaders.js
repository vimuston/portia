'use strict';
// sense/glyph shader pipeline and aux (position/temperature) pass

/* =====================================================================
   SHADERS. Scene -> (colour RT, world-pos + temperature/motion RT) -> motion trail
   -> per-cell glyph + thermal colour with senses -> atlas stamp with moving glyphs.
   Aux alpha packs: sign = player tag, integer part = 1 + temperature*255, fraction = motion.
   ===================================================================== */
const v3u = a => ({value: new V3(...a)});
const SU = {
  uVib:{value: Array.from({length:8}, () => new THREE.Vector4())},
  uVibScr:{value: Array.from({length:8}, () => new V3())},
  uHear:{value: Array.from({length:4}, () => new THREE.Vector4())},
  uChem:{value: Array.from({length:4}, () => new THREE.Vector4())},
  uGust:{value: Array.from({length:4}, () => new THREE.Vector4())},
  uWind: WIND_U, uTime:{value: 0}, uCamYaw:{value: 0},
  uInvVP:{value: new THREE.Matrix4()}, uCamPos:{value: new V3()},
  uCfCam:{value: new V3()}, uCfT:{value: new THREE.Vector4()},   // see-through: the camera, and her (xyz) with the line-of-sight cut on (w)
  uAux:{value: null}, uGrid:{value: new THREE.Vector2(1, 1)},
  uOn:{value: new THREE.Vector4(1, 1, 1, 1)}, uChemOn:{value: 1},
  uBg:v3u(PAL.bg), uLo:v3u(PAL.lo), uMid:v3u(PAL.mid), uHi:v3u(PAL.hi),
  uMotC:v3u(PAL.mot), uAirA:v3u(PAL.air[0]), uAirB:v3u(PAL.air[1]), uAirC:v3u(PAL.air[2]), uScentC:v3u(PAL.scent)
};
const SENSE_GLSL = `
uniform vec4 uVib[8]; uniform vec4 uHear[4]; uniform vec4 uChem[4]; uniform vec4 uGust[4];
uniform vec3 uWind; uniform float uTime, uCamYaw; uniform mat4 uInvVP; uniform vec3 uCamPos;
uniform sampler2D uAux; uniform vec2 uGrid; uniform vec4 uOn; uniform float uChemOn;
uniform vec3 uBg, uLo, uMid, uHi, uMotC, uAirA, uAirB, uAirC, uScentC;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
vec3 posAt(vec2 uv, out float geo){
  vec4 a = texture(uAux, uv); geo = step(.5, abs(a.w));
  if(geo > .5) return a.xyz;
  vec4 w = uInvVP*vec4(uv*2. - 1., 1., 1.);
  return uCamPos + normalize(w.xyz/w.w - uCamPos)*9.;
}
float vibAt(vec3 p){
  float s = 0.;
  for(int i = 0; i < 8; i++){ vec4 v = uVib[i]; if(v.w < .002) continue;
    float d = length(p - v.xyz);
    s += v.w*pow(.5 + .5*sin(d*2.6 - uTime*6.5), 10.)*exp(-d*.11)*smoothstep(0., .3, d + .05); }
  return s;
}
float hearAt(vec3 p){
  float s = 0.;
  for(int i = 0; i < 4; i++){ vec4 h = uHear[i]; if(h.w < .002) continue;
    float d = length(p - h.xyz);
    s += h.w*(.5 + .5*sin(d*9. - uTime*34.))*exp(-d*.22); }
  return s;
}
vec2 windAt(vec3 p){
  vec2 w = uWind.xy*uWind.z;
  w = rot2(w, (n2(p.xz*.22 + uTime*.05) - .5)*2.2)*(.5 + .9*n2(p.xz*.4 - uWind.xy*uTime*.35));
  for(int i = 0; i < 4; i++){ vec4 g = uGust[i]; if(g.w < .002) continue;
    vec3 r = p - g.xyz; vec2 d = normalize(r.xz + vec2(1e-4));
    w += (d + vec2(-d.y, d.x)*.9)*g.w*1.8*exp(-dot(r, r)*.7); }
  return w;
}
float chemAt(vec3 p){
  vec2 wd = normalize(uWind.xy + 1e-5), wp = vec2(-wd.y, wd.x);
  float s = 0.;
  for(int i = 0; i < 4; i++){ vec4 c = uChem[i]; if(c.w < .002) continue;
    vec3 r = p - c.xyz; float al = dot(r.xz, wd), cr = dot(r.xz, wp);
    float wdt = .35 + max(al, 0.)*.3;
    float body = exp(-cr*cr/(wdt*wdt))*(al > 0. ? exp(-al*.11) : exp(-al*al*2.5))*exp(-abs(r.y)*.5);
    float fil = smoothstep(.2, .75, n2(vec2(al*1.2 - uTime*(.6 + uWind.z*1.5), cr*2.2 + c.w*7.)));
    s += c.w*body*(.3 + .7*fil); }
  return min(s, 1.4);
}
vec3 airCol(vec2 w){
  float a = atan(w.y, w.x);
  vec3 k = .5 + .5*cos(a - vec3(0., 2.0944, 4.1888)); k *= k;
  return (uAirA*k.x + uAirB*k.y + uAirC*k.z)/(k.x + k.y + k.z);
}
// ironbow ramp: black-indigo (cold, dead) -> purple -> crimson -> orange -> yellow -> white (hot, alive)
vec3 thermal(float t){
  t = clamp(t, 0., 1.);
  vec3 c0 = vec3(.03,.02,.1), c1 = vec3(.14,.06,.5), c2 = vec3(.52,.1,.58), c3 = vec3(.88,.16,.3), c4 = vec3(1.,.52,.08), c5 = vec3(1.,.88,.3), c6 = vec3(1.,1.,.92);
  if(t < .18) return mix(c0, c1, t/.18);
  if(t < .36) return mix(c1, c2, (t - .18)/.18);
  if(t < .52) return mix(c2, c3, (t - .36)/.16);
  if(t < .68) return mix(c3, c4, (t - .52)/.16);
  if(t < .84) return mix(c4, c5, (t - .68)/.16);
  return mix(c5, c6, (t - .84)/.16);
}`;

const VS_QUAD = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const auxVS = `varying vec3 vW;
void main(){ vec4 p = vec4(position, 1.);
#ifdef USE_INSTANCING
  p = instanceMatrix*p;
#endif
  vec4 w = modelMatrix*p; vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const auxFS = `uniform float uMotion, uTemp, uSelf; varying vec3 vW;
void main(){ gl_FragColor = vec4(vW, (uSelf > .5 ? -1. : 1.)*(1. + floor(clamp(uTemp, 0., 1.)*255. + .5) + min(uMotion, .99))); }`;

const motionMat = new THREE.ShaderMaterial({
  uniforms: {uAux: SU.uAux, uGrid: SU.uGrid, uPrev:{value:null}, uDecay:{value:.85}},
  vertexShader: VS_QUAD,
  fragmentShader: `uniform sampler2D uAux, uPrev; uniform vec2 uGrid; uniform float uDecay;
  void main(){ vec2 uv = gl_FragCoord.xy/uGrid;
    float aw = abs(texture(uAux, uv).w), cur = aw > .5 ? fract(aw) : 0.;
    gl_FragColor = vec4(max(cur, texture(uPrev, uv).r*uDecay), 0., 0., 1.); }`,
  depthTest:false, depthWrite:false
});

// look-lab uniforms, shared by the cell and final passes (set from LOOK by applyLook)
const LU = {uCon:{value:1.2}, uPCol:v3u([1, .85, .3]), uScene:{value:null},
  uDens:{value:1}, uCap:{value:1}, uEdges:{value:1}, uPTint:{value:0}, uPBoost:{value:0}, uWDim:{value:0}, uWDesat:{value:0}, uDFade:{value:0}};
const cellMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, SU, LU, {uMot:{value:null}, uN:{value:18}, uBlur:{value:.45}}),
  vertexShader: VS_QUAD,
  fragmentShader: `${SENSE_GLSL}
  uniform sampler2D uScene, uMot; uniform float uN, uBlur, uCon;
  uniform float uDens, uCap, uEdges, uPTint, uPBoost, uWDim, uWDesat, uDFade; uniform vec3 uPCol;
  // the world's own colours (close to the 3D view), as is, punchier, or softened; living warmth still gets a faint accent
  vec3 natCol(vec3 c, float T){
    float L = dot(c, vec3(.3, .55, .15)), heat = smoothstep(.53, .57, T); vec3 o;
    o = pow(c, vec3(.9))*1.3; o = mix(o, thermal(.72 + .2*T), heat*.3);
    return max(o, vec3(.05));
  }
  vec3 tm(vec2 uv){ vec3 e = pow(1. - exp(-texture(uScene, uv).rgb*3.6), vec3(.6));   // exposed for the dim jungle interior
    return clamp((e - .45)*uCon + .45, 0., 1.); }                                         // then the contrast slider, pivoting on mid-grey
  float lum(vec3 t){ return pow(max(dot(t, vec3(.2126,.7152,.0722)), max(t.r, max(t.g, t.b))*.6), 1.6); }
  float L(vec2 c){ return lum(tm((c + .5)/uGrid)); }
  float tempAt(vec2 uv){ float aw = abs(texture(uAux, uv).w); return aw > .5 ? floor(aw - 1.)/255. : -1.; }
  void main(){
    vec2 c = floor(gl_FragCoord.xy), px = 1./uGrid, uv = (c + .5)*px;
    vec3 t = tm(uv);
    float aw = texture(uAux, uv).w, self = step(aw, -.5);
    vec3 b = (tm(uv + vec2(px.x, 0.)) + tm(uv - vec2(px.x, 0.)) + tm(uv + vec2(0., px.y)) + tm(uv - vec2(0., px.y)))*.25;
    t = mix(t, b, uBlur*(1. - self));
    float v = lum(t);
    float geo; vec3 P = posAt(uv, geo);
    // temperature: the object's own heat, plus a little warmth where light falls on it; heat bleeds a cell outward
    float T = geo > .5 ? tempAt(uv) + .05 + .2*v : .22 + .22*v;            // daylight: sunlit surfaces warm up; the bright sky glows
    float Tn = max(max(tempAt(uv + vec2(px.x, 0.)), tempAt(uv - vec2(px.x, 0.))), max(tempAt(uv + vec2(0., px.y)), tempAt(uv - vec2(0., px.y))));
    T = max(T, Tn - .18);
    // warm bodies stay legible even in shade
    v = max(v, smoothstep(.5, .85, T)*.62) + self*.04;
    // look lab: the world can recede (distance fade, dimming) while she gains density
    float fade = uDFade*smoothstep(.6, 7., geo > .5 ? length(P - uCamPos) : 30.)*(1. - self);
    v *= (1. - fade*.75)*(1. - uWDim*.6*(1. - self));
    v = min(v*uDens + self*uPBoost*.35, 1.);
    float m = texture(uMot, uv).r*uOn.x;
    float V = geo*vibAt(P)*uOn.y*.9;
    float C = chemAt(P)*uChemOn;

    float vv = v + V*.12;
    float g = 0.; const float th = .035;
    if(vv > th){ float x = pow((vv - th)/(1. - th), .85); g = 1. + min(floor(x*(uN - 1.)), uN - 2.); }
    if(vv > th && vv < .12){ float p = (vv - th)/(.12 - th); g = fract(52.9829189*fract(dot(c, vec2(.06711056, .00583715)))) > p ? 0. : 1.; }
    if(g >= 1.) g = min(g, max(1., floor(uCap*(uN - 1.) + .5)));                 // max fill: keep dense cells airy
    if(uEdges > .5 && v > .08 && v < .92){
      float l00 = L(c + vec2(-1,-1)), l10 = L(c + vec2(0,-1)), l20 = L(c + vec2(1,-1));
      float l01 = L(c + vec2(-1,0)), l21 = L(c + vec2(1,0));
      float l02 = L(c + vec2(-1,1)), l12 = L(c + vec2(0,1)), l22 = L(c + vec2(1,1));
      float gx = (l20 + 2.*l21 + l22) - (l00 + 2.*l01 + l02), gy = (l02 + 2.*l12 + l22) - (l00 + 2.*l10 + l20);
      float G = length(vec2(gx, gy));
      float bright = step(.12,l00)+step(.12,l10)+step(.12,l20)+step(.12,l01)+step(.12,l21)+step(.12,l02)+step(.12,l12)+step(.12,l22);
      float dark = step(l00,v*.45)+step(l10,v*.45)+step(l20,v*.45)+step(l01,v*.45)+step(l21,v*.45)+step(l02,v*.45)+step(l12,v*.45)+step(l22,v*.45);
      if(G > 1.1 && bright >= 3. && dark >= 3.){ float ang = mod(atan(gy, gx) + 1.5707963, 3.14159265); g = uN + mod(floor(ang/.7853982 + .5), 4.); }
    }
    // thermal colour: hue = temperature; brightness follows light a little so shapes still read
    float mx = max(t.r, max(t.g, t.b)), bri = clamp(sqrt(mx)*1.05, 0., 1.);
    vec3 col = natCol(t, T);
    col = mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, 1. - uWDesat*(1. - self));
    col *= (1. - fade*.6)*(1. - uWDim*(1. - self));
    col = mix(col, uPCol*(.45 + .75*bri), uPTint*self)*(1. + uPBoost*self);
    if(V > .5 && g >= 1. && g < uN - 1.) g += 1.;
    col = mix(col, uScentC*(.5 + .5*bri), clamp(C*.35, 0., .35));
    if(m > .06){ g = max(min(g, uN - 1.), uN - 1. - floor((1. - min(m, 1.))*5.)); col = mix(col, uMotC, clamp(m*1.1, 0., .85)); }
    gl_FragColor = vec4(min(col, vec3(1.)), g/255.);
  }`,
  depthTest:false, depthWrite:false
});

const finalMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, SU, LU, {uCells:{value:null}, uAtlas:{value:null}, uCell:{value:new THREE.Vector2()}, uOff:{value:new THREE.Vector2()},
    uRes:{value:new THREE.Vector2()}, uAtlasN:{value:1}, uRampN:{value:18}, uBloom:{value:.5}, uMode:{value:0}, uDot:{value:1}, uStag:{value:0}}),
  vertexShader: VS_QUAD,
  fragmentShader: `${SENSE_GLSL}
  uniform sampler2D uCells, uAtlas, uScene; uniform vec2 uCell, uOff, uRes; uniform float uAtlasN, uRampN, uBloom;
  uniform vec3 uVibScr[8];
  uniform float uMode, uDot, uCon, uStag;
  vec4 cellAt(vec2 c){ return texelFetch(uCells, ivec2(clamp(c, vec2(0.), uGrid - 1.)), 0); }
  vec3 glowAt(vec2 cc){ vec4 e = cellAt(floor(cc)); float g = floor(e.a*255. + .5);
    return g < .5 ? vec3(0.) : e.rgb*(g >= uRampN ? .55 : .25 + .75*g/uRampN); }
  // the scene's own brightness under any pixel: lets braille HD draw detail finer than a cell
  float lumS(vec2 uv){ vec3 e = pow(1. - exp(-texture(uScene, uv).rgb*3.6), vec3(.6)); e = clamp((e - .45)*uCon + .45, 0., 1.);
    return pow(max(dot(e, vec3(.2126, .7152, .0722)), max(e.r, max(e.g, e.b))*.6), 1.6); }
  float dens(float l){ return l > .035 ? pow((l - .035)/.965, .85) : 0.; }
  float detail(vec2 c, vec2 suv, float lvl){ return clamp(dens(lumS(suv)) + lvl - dens(lumS((c + .5)/uGrid)), 0., 1.); }
  float aa(float d){ return clamp(.5 - d, 0., 1.); }                                   // d: signed distance in px
  float inkAt(vec2 c, vec2 f, float g){
    if(uMode < .5){ if(f.x < 0. || f.x > 1. || f.y < 0. || f.y > 1.) return 0.; return textureLod(uAtlas, vec2((g + f.x)/uAtlasN, 1. - f.y), 0.).r; }
    float lvl = g < .5 ? 0. : g >= uRampN - .5 ? .55 : g/max(uRampN - 1., 1.);
    f = clamp(f, 0., .999);
    vec2 s = floor(f*vec2(2., 4.)), sf = fract(f*vec2(2., 4.)), sub = uCell/vec2(2., 4.);   // braille HD: each of the 8 dots reads its own patch
    float O[8] = float[8](0., 5., 3., 6., 7., 2., 4., 1.);
    float on = step((O[int(s.x + s.y*2.)] + .5)/8., detail(c, (c + (s + .5)/vec2(2., 4.))/uGrid, lvl));
    return on*aa(length((sf - .5)*sub) - max(.55, min(sub.x, sub.y)*.5*uDot));
  }
  void main(){
    vec2 fc = gl_FragCoord.xy; vec3 bg = uBg;
    vec2 p = fc - uOff, c0 = floor(p/uCell);
    if(c0.x < 0. || c0.y < 0. || c0.x >= uGrid.x || c0.y >= uGrid.y){ gl_FragColor = vec4(bg, 1.); return; }
    float geo; vec3 P = posAt((c0 + .5)/uGrid, geo);
    float C = chemAt(P)*uChemOn, H = hearAt(P)*uOn.w;
    // scent: rows of text undulate like heat haze
    p.x += sin(c0.y*.42 + uTime*2.3 + c0.x*.03)*C*uCell.x*1.9;
    p.y += sin(c0.x*.16 + uTime*1.6)*C*uCell.y*.45;
    // vibration: the glyphs themselves ripple — pushed outward and back along the wave, lifted on each crest
    if(geo > .5 && uOn.y > .5){
      vec2 cp = (c0 + .5)*uCell + uOff, disp = vec2(0.);
      for(int i = 0; i < 8; i++){ vec4 v = uVib[i]; if(v.w < .002) continue;
        float d = length(P - v.xyz);
        float env = v.w*exp(-d*.11)*smoothstep(0., .4, d);
        float wv = sin(d*2.6 - uTime*6.5), crest = pow(.5 + .5*wv, 6.);
        vec3 sc = uVibScr[i]; vec2 dir = sc.z > .5 ? normalize(cp - sc.xy + vec2(.001)) : vec2(0., 1.);
        disp += dir*wv*env*.22 + vec2(0., crest*env*.18);
      }
      float dm = length(disp); if(dm > .5) disp *= .5/dm;
      p -= disp*uCell;
    }
    p.x += mod(floor(p.y/uCell.y), 2.)*uStag*uCell.x*.5;                            // row stagger breaks the square grid
    vec2 c = floor(p/uCell), f = fract(p/uCell);
    float tk = floor(uTime*26.);                                                       // hearing: glyphs shiver inside their cells
    f += (vec2(h21(c + tk), h21(c.yx + tk + 3.1)) - .5)*min(H, 1.3)*.6;
    vec4 e = cellAt(c); float g = floor(e.a*255. + .5);
    vec3 ink = e.rgb*(1. + min(H, 1.)*.35*sin(uTime*70. + c.x))*inkAt(c, f, g);
    vec2 cc = p/uCell; vec3 glow = glowAt(cc)*.18;
    for(int i = 0; i < 8; i++){ float a = float(i)*.7853982 + .39; vec2 d = vec2(cos(a), sin(a)*uCell.x/uCell.y);
      glow += glowAt(cc + d*1.4)*.07 + glowAt(cc + d*3.)*.03; }
    gl_FragColor = vec4(bg + ink + glow*uBloom, 1.);
  }`,
  depthTest:false, depthWrite:false
});

// her silhouette (cells tagged as the player in the aux pass), bilinear-filterable for the halo
const maskMat = new THREE.ShaderMaterial({uniforms:{uAux: SU.uAux, uGrid: SU.uGrid}, vertexShader: VS_QUAD,
  fragmentShader:`uniform sampler2D uAux; uniform vec2 uGrid; void main(){ gl_FragColor = vec4(step(texture(uAux, gl_FragCoord.xy/uGrid).w, -.5), 0., 0., 1.); }`,
  depthTest:false, depthWrite:false});

/* ---------- LOOK LAB passes: painterly / screen filters over the full-resolution scene, bloom glow, and the composite
   (colour grade, Portia's highlight, depth of field, post) that every look ends in ---------- */
const VS_UV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const NOISE_GLSL = `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for(int i = 0; i < 4; i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= .5; } return s; }
float lum(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + .03))/(x*(2.43*x + .59) + .14), 0., 1.); }
vec3 srgb(vec3 c){ c = max(c, 0.); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }`;
const filterMat = new THREE.ShaderMaterial({
  uniforms:{uFull:{value:null}, uDepth:{value:null}, uRes:{value:new THREE.Vector2()}, uF:{value:0}, uAmt:{value:1}, uScale:{value:1},
    uTime: SU.uTime, uCon: LU.uCon, uExp:{value:1.15}, uNear:{value:.03}, uFar:{value:1500}, uFocusY:{value:.5}},
  vertexShader: VS_UV,
  fragmentShader: `${NOISE_GLSL}
  uniform sampler2D uFull, uDepth; uniform vec2 uRes; uniform float uF, uAmt, uScale, uTime, uCon, uExp, uNear, uFar, uFocusY;
  varying vec2 vUv;
  vec2 PX;
  vec3 tex(vec2 uv){ vec3 c = srgb(aces(texture(uFull, uv).rgb*uExp)); return clamp((c - .45)*uCon + .45, 0., 1.); }
  float depthAt(vec2 uv){ float z = texture(uDepth, uv).r*2. - 1.; return 2.*uNear*uFar/(uFar + uNear - z*(uFar - uNear)); }
  float sob(vec2 uv, float s){ vec2 p = PX*s;
    float a = lum(tex(uv + vec2(-p.x, p.y))), b = lum(tex(uv + vec2(0., p.y))), c = lum(tex(uv + p)), d = lum(tex(uv - vec2(p.x, 0.))),
          f = lum(tex(uv + vec2(p.x, 0.))), g = lum(tex(uv - p)), h = lum(tex(uv - vec2(0., p.y))), i = lum(tex(uv + vec2(p.x, -p.y)));
    return length(vec2(c + 2.*f + i - a - 2.*d - g, a + 2.*b + c - g - 2.*h - i)); }
  float edgeD(vec2 uv){ vec2 p = PX*1.5; float d0 = 2.*log(depthAt(uv));          // creases and silhouettes, from depth
    float e = abs(log(depthAt(uv + vec2(p.x, 0.))) + log(depthAt(uv - vec2(p.x, 0.))) - d0) + abs(log(depthAt(uv + vec2(0., p.y))) + log(depthAt(uv - vec2(0., p.y))) - d0);
    return smoothstep(.03, .1, e); }
  vec3 blur(vec2 uv, float r){ vec3 s = tex(uv);
    for(int i = 0; i < 16; i++){ float a = float(i)*2.39996, rr = sqrt((float(i) + .5)/16.)*r; s += tex(uv + vec2(cos(a), sin(a))*rr*PX); }
    return s/17.; }
  vec3 kuwa(vec2 uv, float r){                                                          // Kuwahara: flattens texture into brush-like patches, keeps edges
    vec2 st = PX*max(r, 1.)/3.; vec3 best = vec3(0.); float bv = 1e9;
    for(int k = 0; k < 4; k++){
      vec2 sg = vec2(k == 1 || k == 3 ? 1. : -1., k >= 2 ? 1. : -1.); vec3 s = vec3(0.), s2 = vec3(0.);
      for(int j = 0; j <= 3; j++) for(int i = 0; i <= 3; i++){ vec3 c = tex(uv + vec2(i, j)*sg*st); s += c; s2 += c*c; }
      s /= 16.; s2 = s2/16. - s*s; float v = s2.r + s2.g + s2.b; if(v < bv){ bv = v; best = s; } }
    return best; }
  float bayer4(vec2 q){ q = mod(q, 4.); int i = int(q.x) + int(q.y)*4;
    float B[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.); return (B[i] + .5)/16.; }
  float halfDot(vec2 fc, float ang, float v, float sz){ vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang))*fc; vec2 q = (fract(r/sz) - .5)*sz;
    return clamp(sqrt(clamp(v, 0., 1.))*.72*sz - length(q) + .5, 0., 1.); }
  vec3 sat(vec3 c, float s){ return mix(vec3(lum(c)), c, s); }

  vec3 filt(vec2 uv, vec2 fc, float S){
    int F = int(uF + .5);
    if(F == 1){                                                                          // watercolour
      vec2 w = (vec2(fbm(fc*.01/S + 3.), fbm(fc*.01/S + 9.)) - .5)*14.*S*PX;
      vec3 c = kuwa(uv + w, 3.*S), b = blur(uv + w, 9.*S);
      float wet = clamp(length(c - b)*2.8, 0., 1.);                                     // pigment pools at the borders of washes
      c = 1. - (1. - c)*(.78 + .55*wet);
      c *= .9 + .2*fbm(fc*.35/S)*(1. - lum(c));                                         // granulation in the darks
      c = mix(c, vec3(1.), .07);
      return c*(.93 + .07*fbm(fc*.6)); }
    if(F == 2){                                                                          // oil paint, with impasto lighting
      vec3 c = kuwa(uv, 5.*S);
      vec2 g = vec2(lum(tex(uv + vec2(PX.x*3., 0.))) - lum(tex(uv - vec2(PX.x*3., 0.))), lum(tex(uv + vec2(0., PX.y*3.))) - lum(tex(uv - vec2(0., PX.y*3.))));
      float a = atan(g.y, g.x + 1e-5) + 1.5708; vec2 d = vec2(cos(a), sin(a));
      float stroke = vn(vec2(dot(fc, d)*.06, dot(fc, vec2(-d.y, d.x))*.7)/S);
      float h = lum(c)*.5 + stroke*.5;
      vec3 n = normalize(vec3(-vec2(dFdx(h), dFdy(h))*7., 1.)), L = normalize(vec3(-.4, .5, .75));
      return sat(c, 1.12)*(.78 + .32*dot(n, L)) + pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 24.)*.22; }
    if(F == 3){                                                                          // CRT screen
      vec2 q = uv*2. - 1.; q *= 1. + dot(q, q)*vec2(.05, .07); vec2 u = q*.5 + .5;
      if(abs(q.x) > 1. || abs(q.y) > 1.) return vec3(0.);
      vec3 c = tex(u)*.6 + (tex(u + vec2(PX.x*1.5, 0.)) + tex(u - vec2(PX.x*1.5, 0.)))*.2;
      float sl = .55 + .45*pow(abs(sin(u.y*uRes.y/(3.*S)*3.14159)), .7);
      vec3 m = vec3(.72); int k = int(mod(fc.x/max(1., S), 3.)); if(k == 0) m.r = 1.25; else if(k == 1) m.g = 1.25; else m.b = 1.25;
      c *= m*sl*1.25*(.97 + .03*sin(uTime*60.));
      vec2 e = 1. - abs(q); return c*smoothstep(0., .04, e.x)*smoothstep(0., .04, e.y); }
    if(F == 4){                                                                          // VHS tape
      float line = floor(fc.y/2.), band = exp(-pow((fract(uv.y*.7 - uTime*.06) - .15)*28., 2.));
      float jit = (vn(vec2(line*.05, uTime*7.)) - .5)*2.5*S*PX.x + band*(h12(vec2(line, uTime)) - .5)*.02;
      vec2 u = uv + vec2(jit, 0.);
      float y = dot(tex(u), vec3(.299, .587, .114)); vec2 iq = vec2(0.);
      for(int i = 0; i < 6; i++){ vec3 c = tex(u + vec2((3. + float(i)*2.)*S, 0.)*PX); iq += vec2(dot(c, vec3(.596, -.274, -.322)), dot(c, vec3(.211, -.523, .312))); }
      iq = iq/6.*1.15;
      vec3 c = vec3(y + .956*iq.x + .621*iq.y, y - .272*iq.x - .647*iq.y, y - 1.106*iq.x + 1.703*iq.y);
      c += (h12(fc + fract(uTime)*91.) - .5)*.07 + band*h12(vec2(fc.x*.05, fc.y + uTime))*.35;
      return clamp(c*vec3(1.03, 1., .95), 0., 1.); }
    if(F == 5){                                                                          // coloured pencil
      vec3 c = tex(uv); float dk = 1. - lum(c), n = vn(fc*.02)*6.;
      float p1 = .5 + .5*sin((fc.x + fc.y)*1.5/S + n), p2 = .5 + .5*sin((fc.x - fc.y)*1.5/S + n*1.3);
      float s1 = smoothstep(p1 - .2, p1 + .2, dk*1.25), s2 = smoothstep(p2 - .2, p2 + .2, dk*1.25 - .45);
      vec3 col = mix(vec3(.97, .95, .9), sat(c, 1.2)*.88, max(s1, s2)*.9);
      col = mix(col, c*.3, smoothstep(.2, .55, sob(uv, 1.))*.75);
      return col*(.95 + .05*h12(fc)); }
    if(F == 6){                                                                          // ink & screentone
      vec3 c = tex(uv); float L = lum(c), e = max(smoothstep(.25, .55, sob(uv, 1.)), edgeD(uv));
      vec2 rp = mat2(.707, -.707, .707, .707)*fc; float dt = step(length(fract(rp/(5.*S)) - .5), .33);
      vec3 col = L > .55 ? mix(vec3(1.), c, .45) : L > .25 ? mix(vec3(1.), c, .5)*(1. - dt*.55) : c*.22;
      return mix(col, vec3(.02), e); }
    if(F == 7){                                                                          // cel shaded
      vec3 c = kuwa(uv, 2.*S); float L = lum(c) + .001, b = max(floor(L*4. + .5)/4., .12);
      vec3 col = sat(clamp(c/L*b, 0., 1.), 1.15);
      return col*(1. - max(edgeD(uv), smoothstep(.3, .6, sob(uv, 1.)))*.85); }
    if(F == 8){                                                                          // pixel art
      float P = 6.*S; vec2 cell = floor(fc/P); vec3 c = sat(tex((cell + .5)*P/uRes), 1.15);
      return floor(c*5. + (bayer4(cell) - .5)*.9 + .5)/5.; }
    if(F == 9){                                                                          // stained glass
      float Z = 26.*S; vec2 p = fc/Z, ip = floor(p), best = vec2(0.); float d1 = 9., d2 = 9.;
      for(int j = -1; j <= 1; j++) for(int i = -1; i <= 1; i++){ vec2 o = ip + vec2(i, j), pt = o + .15 + .7*h22(o); float d = length(p - pt);
        if(d < d1){ d2 = d1; d1 = d; best = pt; } else if(d < d2) d2 = d; }
      vec3 c = sat(tex(best*Z/uRes), 1.35)*1.15*(.75 + .4*(1. - d1))*(.9 + .1*vn(fc*.08));
      return c*smoothstep(.04, .09, d2 - d1); }
    if(F == 10){                                                                         // mosaic tiles
      float Z = 9.*S; vec2 g = fc/Z, id = floor(g), f = fract(g);
      vec3 c = tex((id + .5)*Z/uRes)*(.9 + .2*h12(id))*(1. + (f.y - f.x)*.1);
      return mix(vec3(.24, .22, .2), c, smoothstep(.04, .1, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)))); }
    if(F == 11){                                                                         // pointillism
      float Z = 6.*S; vec2 p = fc/Z, ip = floor(p); vec3 col = vec3(.96, .94, .88); float bk = -1.;
      for(int j = -1; j <= 1; j++) for(int i = -1; i <= 1; i++){ vec2 o = ip + vec2(i, j), pt = o + h22(o); float r = .55 + .35*h12(o + 7.), d = length(p - pt), k = h12(o + 3.1);
        if(d < r && k > bk){ bk = k; col = (sat(tex(pt*Z/uRes), 1.4) + (h22(o + 5.).xyx - .5)*.12)*(1. - smoothstep(r - .2, r, d)*.25); } }
      return col; }
    if(F == 12){                                                                         // charcoal
      vec2 sm = (vec2(vn(fc*.03), vn(fc*.03 + 5.)) - .5)*6.*S*PX;
      vec3 c = blur(uv + sm, 2.*S); float L = lum(c), tooth = vn(fc*.9/S)*.6 + vn(fc*.3/S)*.4;
      float ink = max(smoothstep(tooth - .2, tooth + .2, pow(1. - L, 1.2)*1.25), smoothstep(.2, .5, sob(uv, 1.)));
      vec3 col = mix(vec3(.93, .9, .84), vec3(.08, .07, .07), ink*.92);
      return col*mix(vec3(1.), c/(L + .05), .12); }
    if(F == 13){                                                                         // CMYK print
      vec3 c = tex(uv); float k = 1. - max(c.r, max(c.g, c.b)); vec3 cmy = (1. - c - k)/(1. - k + 1e-4);
      float Z = 5.*S, dc = halfDot(fc, .26, cmy.x, Z), dm = halfDot(fc, 1.31, cmy.y, Z), dy = halfDot(fc, 0., cmy.z, Z), dk = halfDot(fc, .785, k*.9, Z);
      return vec3(.97, .96, .92)*vec3(1. - dc*.9, 1. - dm*.9, 1. - dy*.85)*(1. - dk*.9); }
    if(F == 14){                                                                         // gouache
      vec3 c = sat(floor(kuwa(uv, 4.*S)*7. + .5)/7., 1.15);
      return c*(.95 + .05*fbm(fc*.5))*(.96 + .06*vn(vec2(fc.x*.4, fc.y*.04)/S)); }
    if(F == 15){                                                                         // etching
      vec3 c = tex(uv); float L = lum(c), n = fbm(fc*.008)*20., w = (1. - L)*1.05;
      float l1 = abs(sin((fc.y + n + L*6.)*3.14159/(3.5*S))), l2 = abs(sin((fc.x - n)*3.14159/(3.5*S)));
      float ink = max(1. - smoothstep(w - .12, w + .12, l1), (1. - smoothstep(w - .6, w - .4, l2))*step(L, .35));
      return mix(vec3(.95, .92, .85)*mix(vec3(1.), c + .3, .2), c*.3, ink); }
    if(F == 16){                                                                         // glitch
      float t = floor(uTime*8.), burst = smoothstep(.55, .75, vn(vec2(uTime*1.3, 0.)));
      vec2 blk = floor(fc/(vec2(80., 14.)*S)); float r = h12(blk + t);
      vec2 off = vec2(step(1. - .1*burst, r)*(h12(blk*1.7 + t) - .5)*.12, 0.);
      off.x += step(.97, h12(vec2(floor(fc.y/3.), t)))*(h12(vec2(t, fc.y)) - .5)*.05*burst;
      vec2 u = uv + off; float sp = .002 + .006*burst;
      vec3 c = vec3(tex(u + vec2(sp, 0.)).r, tex(u).g, tex(u - vec2(sp, 0.)).b);
      if(r > 1. - .02*burst) c = c.gbr;
      return c + (h12(fc + t) - .5)*.05; }
    if(F == 17){                                                                         // tilt-shift miniature, focused on her row
      float b = smoothstep(.06, .35, abs(uv.y - uFocusY))*9.*S;
      vec3 c = b > .4 ? blur(uv, b) : tex(uv);
      return (sat(c, 1.3) - .5)*1.12 + .5; }
    if(F == 18){                                                                         // dreamy (Orton)
      vec3 s = tex(uv), b = max(blur(uv, 16.*S), blur(uv, 6.*S));
      vec3 o = 1. - (1. - s)*(1. - b);                                                   // screen the blur over the sharp image
      return sat(mix(s, o*o*1.05 + b*.25, .85), 1.2) + vec3(.04, .02, .05); }
    if(F == 19){                                                                         // neon edges
      vec3 s = tex(uv); float e = max(edgeD(uv), smoothstep(.15, .5, sob(uv, 1.)));
      return s*.12 + s/(max(s.r, max(s.g, s.b)) + .02)*e*1.4; }
    if(F == 20){                                                                         // wax crayon
      vec3 c = blur(uv, 1.5*S); float L = lum(c);
      vec2 r = mat2(.8, -.6, .6, .8)*fc; float streak = vn(vec2(r.x*.04, r.y*.9)/S), tooth = vn(fc*.8/S)*.6 + vn(fc*.25/S)*.4;
      float cover = smoothstep(.15, .55, (1. - L)*.9 + .2 + streak*.4 - tooth*.55);   // paper tooth shows through thin wax
      vec3 wax = sat(c, 1.5)*(.82 + .36*streak);
      return mix(vec3(.97, .95, .9), wax, cover)*(1. - smoothstep(.2, .5, sob(uv, 1.))*.55); }
    return tex(uv);
  }
  void main(){
    PX = 1./uRes; vec2 fc = vUv*uRes;
    vec3 f = filt(vUv, fc, max(uScale, .25));
    gl_FragColor = vec4(uAmt < .999 ? mix(tex(vUv), f, uAmt) : f, 1.);
  }`,
  depthTest:false, depthWrite:false
});
// glow: the bright parts of the finished image, blurred at two scales
const brightMat = new THREE.ShaderMaterial({uniforms:{uSrc:{value:null}, uThr:{value:.55}, uWarm:{value:0}, uTx:{value:new THREE.Vector2()}}, vertexShader: VS_UV,
  fragmentShader:`uniform sampler2D uSrc; uniform float uThr, uWarm; uniform vec2 uTx; varying vec2 vUv;
  void main(){ vec3 c = (texture(uSrc, vUv - uTx).rgb + texture(uSrc, vUv + uTx*vec2(1, -1)).rgb + texture(uSrc, vUv + uTx*vec2(-1, 1)).rgb + texture(uSrc, vUv + uTx).rgb)*.25;
    float m = max(c.r, max(c.g, c.b)), k = max(m - uThr, 0.)/max(1. - uThr, .05);
    gl_FragColor = vec4(mix(c, c*vec3(1.25, .95, .65), uWarm)*k/max(m, 1e-3)*min(m, 1.5), 1.); }`, depthTest:false, depthWrite:false});
const blurMat = new THREE.ShaderMaterial({uniforms:{uSrc:{value:null}, uDir:{value:new THREE.Vector2()}}, vertexShader: VS_UV,
  fragmentShader:`uniform sampler2D uSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){ vec3 s = texture(uSrc, vUv).rgb*.2270;
    s += (texture(uSrc, vUv + uDir*1.3846).rgb + texture(uSrc, vUv - uDir*1.3846).rgb)*.3162;
    s += (texture(uSrc, vUv + uDir*3.2308).rgb + texture(uSrc, vUv - uDir*3.2308).rgb)*.0703;
    gl_FragColor = vec4(s, 1.); }`, depthTest:false, depthWrite:false});
const compMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({uImg:{value:null}, uB1:{value:null}, uB2:{value:null}, uFull:{value:null}, uDepth:{value:null}, uMask:{value:null}, uAux: SU.uAux,
    uRes:{value:new THREE.Vector2()}, uMM:{value:new THREE.Vector4(1, 1, 0, 0)}, uTime: SU.uTime, uCamPos: SU.uCamPos, uCon: LU.uCon, uExp:{value:1.15},
    uNear:{value:.03}, uFar:{value:1500}, uFMode:{value:0}, uHasFull:{value:0}, uHerClean:{value:0}, uGlow:{value:0}, uFocus:{value:1.6}, uPx:{value:1},
    uPCol: LU.uPCol, uPTint: LU.uPTint, uPBoost: LU.uPBoost, uWDim: LU.uWDim, uWDesat: LU.uWDesat, uDFade: LU.uDFade,
    uPOut:{value:0}, uPGlow:{value:0}, uPGlowR:{value:3}, uPPulse:{value:0}, uSpot:{value:0}, uSpotR:{value:.35}, uDof:{value:0},
    uPOutCol:v3u([1, 1, 1]), uSpotP:v3u([0, 0, 0]),
    uGAmt:{value:1}, uTemp:{value:0}, uTint:{value:0}, uGExpo:{value:1}, uGCon:{value:1}, uGSat:{value:1}, uVib:{value:0}, uFade:{value:0}, uSh:v3u([0, 0, 0]), uHi:v3u([0, 0, 0]),
    uVig:{value:.5}, uScan:{value:.05}, uGrain:{value:0}, uChroma:{value:0}, uBright:{value:1}, uGamma:{value:1}, uSat:{value:1}}),
  vertexShader: VS_UV,
  fragmentShader: `${NOISE_GLSL}
  uniform sampler2D uImg, uB1, uB2, uFull, uDepth, uMask, uAux; uniform vec2 uRes; uniform vec4 uMM; uniform vec3 uCamPos;
  uniform float uTime, uCon, uExp, uNear, uFar, uFMode, uHasFull, uHerClean, uGlow, uFocus, uPx;
  uniform vec3 uPCol, uPOutCol, uSpotP; uniform float uPTint, uPBoost, uWDim, uWDesat, uDFade, uPOut, uPGlow, uPGlowR, uPPulse, uSpot, uSpotR, uDof;
  uniform float uGAmt, uTemp, uTint, uGExpo, uGCon, uGSat, uVib, uFade; uniform vec3 uSh, uHi;
  uniform float uVig, uScan, uGrain, uChroma, uBright, uGamma, uSat;
  varying vec2 vUv;
  float distAt(vec2 uv, vec2 muv){
    if(uHasFull > .5){ float z = texture(uDepth, uv).r*2. - 1.; return 2.*uNear*uFar/(uFar + uNear - z*(uFar - uNear)); }
    vec4 a = texture(uAux, muv); return abs(a.w) > .5 ? length(a.xyz - uCamPos) : 40.; }
  vec3 clean(vec2 uv){ vec3 c = srgb(aces(texture(uFull, uv).rgb*uExp)); return clamp((c - .45)*uCon + .45, 0., 1.); }
  vec3 grade(vec3 c){
    c *= uGExpo*vec3(1. + uTemp*.14 + uTint*.04, 1. - uTint*.08, 1. - uTemp*.14 + uTint*.04);
    c = (c - .45)*uGCon + .45;
    float l = clamp(lum(c), 0., 1.);
    c += uSh*(1. - smoothstep(0., .55, l))*.8 + uHi*smoothstep(.45, 1., l)*.8;
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    c = mix(vec3(lum(c)), c, uGSat*(1. + uVib*(1. - clamp((mx - mn)*2., 0., 1.))));
    return uFade + max(c, 0.)*(1. - uFade); }
  void main(){
    vec2 fc = gl_FragCoord.xy, uv = vUv, muv = fc*uMM.xy + uMM.zw;
    float m = texture(uMask, muv).r, dist = distAt(uv, muv);
    // depth of field: everything at a different distance from her blurs
    float coc = uDof*clamp(abs(dist - uFocus)/max(uFocus, .1) - .15, 0., 1.)*14.*uPx*(1. - m);
    vec3 col = texture(uImg, uv).rgb;
    if(coc > .5){ for(int i = 0; i < 16; i++){ float a = float(i)*2.39996, r = sqrt((float(i) + .5)/16.)*coc; col += texture(uImg, uv + vec2(cos(a), sin(a))*r/uRes).rgb; } col /= 17.; }
    if(uChroma > .01){ col.r = texture(uImg, uv + vec2(uChroma*uPx, 0.)/uRes).r; col.b = texture(uImg, uv - vec2(uChroma*uPx, 0.)/uRes).b; }
    if(uHerClean > .5) col = mix(col, clean(uv), smoothstep(.3, .6, m));
    col = mix(col, grade(col), uGAmt);
    if(uFMode > .5){                                                                     // filters: push the world back, lift her (braille does this per cell)
      float L = lum(col), wm = 1. - m;
      col = mix(col, vec3(L), uWDesat*wm)*(1. - uWDim*wm)*(1. - uDFade*smoothstep(.6, 7., dist)*.7*wm);
      col = mix(col, uPCol*(.3 + 1.1*L), uPTint*m)*(1. + uPBoost*m*.8); }
    if(uSpot > .001 && uSpotP.z > .5) col *= mix(1., mix(.1, 1., smoothstep(uSpotR, uSpotR*.25, length(fc - uSpotP.xy)/uRes.y)), uSpot*(1. - m));
    col += (texture(uB1, uv).rgb*.7 + texture(uB2, uv).rgb*.9)*uGlow;
    if(uPOut > .01){ float o = 0., r = uPOut*2.5*uPx;
      for(int i = 0; i < 12; i++){ float a = float(i)*.5236; o = max(o, texture(uMask, muv + vec2(cos(a), sin(a))*r*uMM.xy).r); }
      col = mix(col, uPOutCol, smoothstep(.25, .5, o)*(1. - smoothstep(.2, .45, m))*.95); }
    if(uPGlow > .001){ float h = 0., R = uPGlowR*5.*uPx;
      for(int i = 0; i < 12; i++){ vec2 d = vec2(cos(float(i)*.5236 + .26), sin(float(i)*.5236 + .26))*R*uMM.xy;
        h += texture(uMask, muv + d*.3).r*.45 + texture(uMask, muv + d*.65).r*.35 + texture(uMask, muv + d).r*.2; }
      col += uPCol*(h/12.)*uPGlow*(1. + uPPulse*sin(uTime*3.4))*(1. - m*.5); }
    col *= 1. - uScan + uScan*sin(fc.y*2.0944);
    vec2 q = uv - .5; q.x *= uRes.x/uRes.y; col *= 1. - smoothstep(.45, 1.15, length(q))*uVig;
    col = pow(max(mix(vec3(lum(col)), col, uSat), 0.), vec3(1./uGamma))*uBright;
    gl_FragColor = vec4(col + (h12(fc + fract(uTime*7.)*91.) - .5)*uGrain, 1.);
  }`,
  depthTest:false, depthWrite:false
});

const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cellMat); quad.frustumCulled = false; quadScene.add(quad);
function pass(mat, target){ quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }

// aux pass: swap every drawable to a material writing world position + temperature + motion
function auxFor(o){
  if(!o.userData.aux){
    let owner = null, temp = null;
    for(let p = o; p; p = p.parent){ if(temp == null && p.userData.temp != null) temp = p.userData.temp; if(p.userData.owner){ owner = p.userData.owner; break; } }
    o.userData.auxOwner = owner; o.userData.auxTemp = temp == null ? .3 : temp;
    o.userData.aux = new THREE.ShaderMaterial({uniforms:{uMotion:{value:0}, uTemp:{value:.3}, uSelf:{value:0}}, vertexShader:auxVS, fragmentShader:auxFS, side:THREE.DoubleSide});
  }
  const ow = o.userData.auxOwner, u = o.userData.aux.uniforms;
  const hl = ow && ow.hl > .01 ? ow.hl : 0, fl = .5 + .5*Math.sin(time*13);
  u.uMotion.value = ow && !ow.self ? Math.max(ow.motion, hl*(.3 + .45*fl)) : 0;
  u.uSelf.value = ow && ow.self ? 1 : 0;
  u.uTemp.value = ow ? Math.min(1, ow.temp + hl*(.2 + .1*fl)) : o.userData.auxTemp;
  return o.userData.aux;
}
const drawables = []; scene.traverse(o => { if(o.isMesh || o.isLine) drawables.push(o); });

/* ---------- aux in the scene pass: every scene material also writes the aux data (world position, temperature,
   motion, self) to two extra render targets, so the scene is drawn once for both, instead of again with swapped
   materials. Each aux output carries alpha 1, so the normal blending of the translucent hair, silk and wings
   overwrites it exactly as the old opaque aux pass did; the additive atmosphere writes zeros, which leaves it
   untouched (it was hidden from the old pass). A small pass then packs the two targets into auxRT, so every reader
   is unchanged. Needs float blending; without it the old separate aux pass is used. ---------- */
const GL = renderer.getContext();
const AUX_MRT = renderer.capabilities.isWebGL2 && !!GL.getExtension('EXT_float_blend') && GL.getParameter(GL.MAX_DRAW_BUFFERS) >= 3;
const AUX_F = new WeakMap();
const AUX_U = new WeakMap(), AUX_SRC = new WeakMap(), AUX_KEY = new WeakMap(), AUX_CLONES = new WeakMap();
const AUX_STAT = {patched: 0, clones: 0};
const AUX_MAIN = /void\s+main\s*\(\s*(void\s*)?\)/;
const AUX_VS = `
uniform mat4 uAuxIVP; varying vec3 vAuxW;
void main(){ auxMain0(); vec4 w = uAuxIVP*gl_Position; vAuxW = w.xyz/w.w; }`;   // clip -> world: includes sway, hair physics, instancing
// see-through: small scenery the camera's collision doesn't know about (mushrooms, grass, flowers, stems: instanced, too
// many to raycast) dithers away where it would crowd the lens or stand between the camera and her, instead of
// filling the view. Not her, not lines, not the soil and litter (the camera already keeps clear of those).
const AUX_FS = `
uniform vec4 uAuxO; varying vec3 vAuxW;   // temperature, motion, self, kind (0 surface, 1 skip, 2 line)
uniform vec3 uCfCam; uniform vec4 uCfT; uniform float uCfOn;
void main(){
  if(uCfOn > .5 && uAuxO.z < .5 && uAuxO.w < .5){
    vec3 d = vAuxW - uCfCam; float a = 1. - smoothstep(.12, .32, length(d));          // crowding the lens
    vec3 seg = uCfT.xyz - uCfCam; float L = length(seg);
    if(uCfT.w > .5 && L > .3){                                                         // a thin cone from the lens to just short of her
      vec3 u = seg/L; float s = dot(d, u), rr = length(d - u*s), r = .05 + .1*clamp(1. - s/L, 0., 1.);
      if(s > 0. && s < L - .2) a = max(a, (1. - smoothstep(r*.55, r, rr))*(1. - smoothstep(L - .35, L - .2, s))); }
    float th = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
    if(a > th) discard; }
  auxMain0();
  if(uAuxO.w > .5 && uAuxO.w < 1.5){ gAuxP = vec4(0.); gAuxC = vec4(0.); }
  else { gAuxP = vec4(vAuxW, 1.);
    gAuxC = vec4((uAuxO.z > .5 ? -1. : 1.)*(1. + floor(clamp(uAuxO.x, 0., 1.)*255. + .5)), min(uAuxO.y, .99), step(1.5, uAuxO.w), 1.); } }`;   // (half floats: the code's integer and motion kept apart)
function auxPatch(mat){
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey(), U = {value: new THREE.Vector4(.3, 0, 0, 0)}, F = {value: 0};
  AUX_SRC.set(mat, {prev, key}); AUX_U.set(mat, U); AUX_F.set(mat, F); AUX_STAT.patched++;
  mat.onBeforeCompile = function(sh, r){
    prev.call(this, sh, r);
    sh.uniforms = Object.assign({}, sh.uniforms, {uAuxO: U, uAuxIVP: SU.uInvVP, uCfCam: SU.uCfCam, uCfT: SU.uCfT, uCfOn: F});
    sh.vertexShader = sh.vertexShader.replace(AUX_MAIN, 'void auxMain0()') + AUX_VS;
    sh.fragmentShader = 'layout(location = 1) out highp vec4 gAuxP;\nlayout(location = 2) out highp vec4 gAuxC;\n'
      + sh.fragmentShader.replace(AUX_MAIN, 'void auxMain0()') + AUX_FS;
  };
  mat.customProgramCacheKey = () => key + '|aux';
  mat.needsUpdate = true;
}
// what an object writes: its owner's live state, or the fixed temperature of its scenery (see auxFor)
function auxInfo(o){
  if(o.userData.auxI) return o.userData.auxI;
  let owner = null, temp = null, skip = false;
  for(let p = o; p; p = p.parent){
    if(p === ATMO) skip = true;
    if(!owner){ if(temp == null && p.userData.temp != null) temp = p.userData.temp; if(p.userData.owner) owner = p.userData.owner; }
  }
  if(temp == null) temp = .3;
  const fade = !skip && !owner && temp !== TEMP.soil && temp !== TEMP.litter;
  return o.userData.auxI = {owner, temp, skip, fade, key: skip ? 'skip' : owner || 'T' + temp};
}
// one material per aux key: a material shared by objects that write different values is cloned per key
function auxMat(o, I){
  const m = o.material, k = AUX_KEY.get(m);
  if(k === undefined){ auxPatch(m); AUX_KEY.set(m, I.key); return m; }
  if(k === I.key) return m;
  let C = AUX_CLONES.get(m); if(!C) AUX_CLONES.set(m, C = new Map());
  let c = C.get(I.key);
  if(!c){
    const src = AUX_SRC.get(m); c = m.clone();
    if(m.isShaderMaterial) c.uniforms = m.uniforms;                    // keep the shared clock and sense uniforms
    c.onBeforeCompile = src.prev; c.customProgramCacheKey = () => src.key;
    auxPatch(c); AUX_KEY.set(c, I.key); C.set(I.key, c); AUX_STAT.clones++;
  }
  o.material = c; return c;
}
function auxUpdate(){
  const fl = .5 + .5*Math.sin(time*13);
  scene.traverse(o => {
    if(!(o.isMesh || o.isLine || o.isPoints)) return;
    const I = auxInfo(o), mm = auxMat(o, I), v = AUX_U.get(mm).value;
    AUX_F.get(mm).value = I.fade ? 1 : 0;
    if(I.skip){ v.set(0, 0, 0, 1); return; }
    const ow = I.owner, hl = ow && ow.hl > .01 ? ow.hl : 0;
    v.set(ow ? Math.min(1, ow.temp + hl*(.2 + .1*fl)) : I.temp, ow && !ow.self ? Math.max(ow.motion, hl*(.3 + .45*fl)) : 0, ow && ow.self ? 1 : 0, o.isLine ? 2 : 0);
  });
}
// Packs the aux targets into auxRT, one texel per cell. The old aux pass was drawn at cell size, where every hair
// and silk line covers whole cells; from a larger target, a line anywhere in the cell in front of the cell's centre
// sample wins, so her fur fringe (and her highlight mask) keeps the same extent.
const auxPackMat = new THREE.ShaderMaterial({uniforms:{uP:{value:null}, uC:{value:null}, uGrid: SU.uGrid, uCamPos: SU.uCamPos}, vertexShader: VS_QUAD,
  fragmentShader:`uniform sampler2D uP, uC; uniform vec2 uGrid; uniform vec3 uCamPos;
  void main(){
    vec2 cell = 1./uGrid, c0 = floor(gl_FragCoord.xy)*cell, uv = gl_FragCoord.xy*cell;
    vec4 c = texture(uC, uv), p = texture(uP, uv);
    float best = abs(c.r) > .5 && c.b < .5 ? distance(p.xyz, uCamPos) : 1e9;
    for(int j = 0; j < 4; j++) for(int i = 0; i < 4; i++){
      vec2 o = (vec2(i, j) + .5)*.25 - .5; if(abs(o.x) + abs(o.y) > .5) continue;   // a line covers a cell when it crosses the diamond about its centre
      vec2 u = c0 + (o + .5)*cell; vec4 cc = texture(uC, u);
      if(cc.b > .5){ vec4 pp = texture(uP, u); float dd = distance(pp.xyz, uCamPos); if(dd < best){ best = dd; c = cc; p = pp; } }
    }
    gl_FragColor = vec4(p.xyz, c.r + sign(c.r)*c.g); }`, depthTest:false, depthWrite:false});
const AUX_ZERO = new Float32Array(4);
// colour (half float, linear) + world position (float) + code (half float): the aux targets sample nearest
function auxTargets(w, h, depthTex){
  const t = new THREE.WebGLMultipleRenderTargets(w, h, 3, {depthBuffer: true, generateMipmaps: false});
  t.texture.forEach((x, i) => { x.type = i === 1 ? THREE.FloatType : THREE.HalfFloatType; x.minFilter = x.magFilter = i ? THREE.NearestFilter : THREE.LinearFilter; x.generateMipmaps = false; });
  if(depthTex) t.depthTexture = new THREE.DepthTexture(w, h);
  return t;
}
function renderSceneAux(target){
  auxUpdate();
  const bg = scene.background; scene.background = null;
  renderer.setRenderTarget(target); renderer.setClearColor(BGC, 1); renderer.clear(true, true, true);
  GL.clearBufferfv(GL.COLOR, 1, AUX_ZERO); GL.clearBufferfv(GL.COLOR, 2, AUX_ZERO);   // "nothing here", as the old aux clear
  renderer.autoClear = false; renderer.render(scene, camera); renderer.autoClear = true;
  scene.background = bg; renderer.setClearColor(0x000000, 0);
  auxPackMat.uniforms.uP.value = target.texture[1]; auxPackMat.uniforms.uC.value = target.texture[2];
  pass(auxPackMat, auxRT);
}

// husks: what is left after feeding — starts body-warm, cools toward the surface it lies on
const husks = [];
function leaveHusk(pos, surfaceT, o = {}){
  const m = makeFly(); m.position.copy(pos); m.position.y += .09; m.rotation.set(Math.PI*.9, o.yaw != null ? o.yaw : rnd()*6.3, 0, 'YXZ');
  m.userData.wings.forEach(w => w.rotation.z = rr(-.6, .6));
  const h = {m, temp:.7, floor: Math.min(TEMP.dead + .04, surfaceT), age: 0, motion: 0, y0: m.position.y, fallH: o.fallH || 0, fallV: 0}; m.userData.owner = h; husks.push(h);
  if(o.drain) flyLook({m}, o.drain);
  m.position.y += h.fallH;
  m.traverse(o => { if(o.isMesh || o.isLine) drawables.push(o); });
}
