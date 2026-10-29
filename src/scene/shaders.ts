// ---------------------------------------------------------------------------
// Semua materi di situs ini prosedural: tidak ada satu pun file tekstur / model.
// Noise-nya "murah" (value noise + fbm), bukan simplex, supaya tetap ringan.
// ---------------------------------------------------------------------------

export const noiseChunk = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Tone map yang sama dengan material PBR di adegan (ACES, exposure 0.92),
// lalu sedikit desaturasi filmik. Tanpa ini warna planet ditulis mentah ke
// layar dan terlihat seperti ilustrasi, bukan hasil foto.
vec3 filmGrade(vec3 c) {
  c *= 0.92;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(c, vec3(l), 0.07), 0.0, 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Sky: bola besar yang selalu mengikuti kamera. Ini "nebula"-nya: awan 3D    */
/* (noise dihitung dari arah, bukan UV, jadi tidak ada jahitan di kutub).     */
/* -------------------------------------------------------------------------- */

export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const skyFragment = /* glsl */ `
precision highp float;

varying vec3 vDir;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uColorD;

${noiseChunk}

void main() {
  vec3 d = normalize(vDir);
  float t = uTime * 0.004;

  /* ---- pita galaksi ---------------------------------------------------
     Satu bidang besar (bukan cakrawala) yang miring terhadap jalur kamera.
     Inti pita lebih hangat, pinggirnya dingin — seperti foto langit malam. */
  vec3 bn = normalize(vec3(0.34, 0.80, -0.42));
  float bd = dot(d, bn);
  float band = exp(-bd * bd * 15.0);
  float core = exp(-bd * bd * 90.0);

  /* ---- awan antar-bintang: dua oktaf + warp -------------------------- */
  float w = fbm(d * 2.0 + vec3(3.1, t, 0.0));
  float n1 = fbm(d * 3.2 + vec3(w * 1.3, 0.0, t * 0.7));
  float n2 = fbm3(d * 8.0 - vec3(0.0, t * 0.9, 0.0) + n1 * 0.9);

  float cloud = smoothstep(0.42, 0.88, n1 * 0.72 + n2 * 0.46);
  cloud = pow(cloud, 2.3);
  float dense = smoothstep(0.50, 1.0, cloud);

  /* ---- jalur debu: siluet gelap yang memotong pita ------------------- */
  float laneN = fbm3(d * 5.2 + vec3(7.7, 1.3, 0.0));
  float lane = smoothstep(0.46, 0.64, laneN);

  vec3 col = uColorA;
  col += uColorB * cloud * 0.26;
  col += uColorC * dense * 0.20;

  // pita: biru kutub dingin → teal aurora tipis di inti.
  // CATATAN: angka di sini ada di ruang linear, bukan sRGB. 0.05 linear sudah
  // setara ~0.25 sRGB setelah tone mapping — cukup untuk "jalur susu", dan
  // tidak menenggelamkan planet.
  vec3 cool = vec3(0.016, 0.028, 0.052);
  vec3 warm = vec3(0.030, 0.048, 0.046);
  vec3 bandCol = mix(cool, warm, core);
  col += bandCol * band * (0.50 + cloud * 1.35) * (1.0 - lane * 0.55);

  // inti galaksi: kabut hangat tipis, bukan lampu
  float gc = pow(max(dot(d, normalize(vec3(-0.55, 0.42, -0.72))), 0.0), 6.0);
  col += uColorD * gc * 0.55;

  // butiran bintang yang tak terurai (debris bintang)
  float s = hash31(floor(d * 700.0) + 0.5);
  float grains = smoothstep(0.9970, 1.0, s);
  col += vec3(0.06, 0.07, 0.085) * grains * (0.25 + cloud * 0.8);

  // langit "atas" lebih hitam, kaki langit sedikit hangat (debu)
  float horizon = pow(1.0 - clamp(abs(d.y), 0.0, 1.0), 4.0);
  col *= 0.72 + 0.28 * (1.0 - horizon * 0.55);
  col += vec3(0.008, 0.007, 0.006) * horizon;

  float dither = (hash31(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col + dither, 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Grid lantai: garis tipis dengan fade radial dari kamera.                   */
/* -------------------------------------------------------------------------- */

export const gridVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const gridFragment = /* glsl */ `
precision highp float;

varying vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uOpacity;

float gridMask(vec2 p, float scale) {
  vec2 q = p * scale;
  vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(0.0001));
  return 1.0 - min(min(g.x, g.y), 1.0);
}

void main() {
  float d = length(vWorld.xz - uCenter.xz);
  float fade = smoothstep(uRadius, uRadius * 0.12, d);

  float g = gridMask(vWorld.xz, 0.4) * 0.5 + gridMask(vWorld.xz, 2.0) * 0.22;
  float a = g * fade * uOpacity;
  if (a < 0.003) discard;

  gl_FragColor = vec4(uColor, a);
}
`

/* -------------------------------------------------------------------------- */
/* Shard: icosahedron yang digeser noise + fresnel + urat + fog.              */
/* -------------------------------------------------------------------------- */

export const shardVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uSeed;

varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vPos;
varying vec3 vObjN;
varying float vDepth;

${noiseChunk}

// Dua oktaf: bentuk besar (bongkahan) + lipatan kecil (punggung batu).
// Normal dihitung dari gradien field yang sama, jadi cahaya mengikuti relief.
float field(vec3 p) {
  float t = uTime * 0.09 + uSeed;
  float big = fbm(p * 1.75 + vec3(t, t * 0.7, -t * 0.5));
  float fine = fbm(p * 5.4 + vec3(-t * 0.6, t * 0.9, uSeed));
  return big * 0.8 + fine * 0.2;
}

void main() {
  vec3 p = position;
  vec3 n = normalize(normal);

  float base = field(p);

  vec3 tangent = normalize(cross(n, vec3(0.0, 1.0, 0.0) + vec3(0.001)));
  vec3 bitangent = normalize(cross(n, tangent));

  float step_ = 0.045;
  float nx = field(p + tangent * step_);
  float ny = field(p + bitangent * step_);

  vec3 displaced = p + n * (base - 0.5) * uAmp;

  vec3 dx = tangent * step_ + n * (nx - base) * uAmp;
  vec3 dy = bitangent * step_ + n * (ny - base) * uAmp;
  vec3 newNormal = normalize(cross(dx, dy));

  vPos = displaced;
  vObjN = n;

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vec4 view = viewMatrix * world;

  vDepth = -view.z;
  vNormalW = normalize(mat3(modelMatrix) * newNormal);
  vViewDir = normalize(cameraPosition - world.xyz);

  gl_Position = projectionMatrix * view;
}
`

export const shardFragment = /* glsl */ `
precision highp float;

varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vPos;
varying vec3 vObjN;
varying float vDepth;

uniform vec3 uBase;
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uSeed;
uniform float uRimPower;
uniform float uDetail;
uniform float uSparkle;

${noiseChunk}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);

  float t = uTime * 0.03 + uSeed;
  vec3 q = vPos * 2.4 + vec3(uSeed * 1.7, t * 0.4, -t * 0.3);

  // --- badan batu: dua skala + serat + retakan ---
  float body = fbm(q);
  float broad = fbm3(q * 0.62 + 3.7);
  float grain = fbm3(q * 6.5 + vec3(0.0, t * 0.8, uSeed));
  float crease = 1.0 - abs(2.0 * fbm3(q * 3.2 + 7.1) - 1.0);
  float cracks = smoothstep(0.60, 0.88, crease);

  float m = smoothstep(0.22, 0.78, body * 0.72 + broad * 0.42);
  vec3 rock = mix(uBase, uTint, m * 0.85);
  rock *= 0.70 + 0.55 * grain;
  rock = mix(rock, uTint * 1.2 + uBase, smoothstep(0.55, 0.9, grain) * 0.26);
  // celah retak lebih gelap: memberi kedalaman, bukan sekadar noda rata
  rock = mix(rock, uBase * 0.5, cracks * 0.62);

  // --- bump mikro: relief halus yang menangkap cahaya (tier detail) ---
  if (uDetail > 0.5) {
    vec3 upv = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 T = normalize(cross(upv, N));
    vec3 B = cross(N, T);
    vec3 bq = vPos * 9.5 + vec3(uSeed, t * 1.2, 0.0);
    float e = 0.055;
    float h0 = fbm3(bq);
    float hx = fbm3(bq + T * e);
    float hy = fbm3(bq + B * e);
    N = normalize(N - (T * (hx - h0) + B * (hy - h0)) * 2.6);
  }

  vec3 L = normalize(vec3(0.55, 0.85, 0.6));
  vec3 L2 = normalize(vec3(-0.65, -0.15, -0.45));
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float fill = max(dot(N, L2), 0.0) * 0.22;
  float spec = pow(max(dot(N, H), 0.0), 110.0);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);

  vec3 col = rock * (0.14 + ndl * 1.08 + fill);
  col += uRim * (fres * 0.62 + spec * 0.55);

  // debu es di permukaan atas: dingin dan sedikit lebih terang
  float dust = smoothstep(0.05, 0.85, N.y) * smoothstep(0.42, 0.78, grain);
  col = mix(col, col * 1.18 + uRim * 0.14, dust * 0.55);

  // kilau butiran: hanya titik noise paling tajam, ikut arah cahaya
  float gl = smoothstep(0.82, 0.94, fbm3(vPos * 26.0 + vec3(uSeed * 3.0, t * 1.5, 0.0)));
  col += uRim * gl * (0.12 + spec * 1.6) * uSparkle;

  // tepi bawah sedikit gelap → objek terasa punya berat
  col *= 0.80 + 0.20 * smoothstep(-1.0, 0.6, N.y);

  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFogColor, fog);

  gl_FragColor = vec4(col, 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Planet: bola dengan permukaan prosedural (pita gas / kawah batu / tudung   */
/* es / bintang menyala) + terminasi cahaya + fresnel atmosfer.               */
/* -------------------------------------------------------------------------- */

export const planetVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;

void main() {
  vPos = position;

  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const planetFragment = /* glsl */ `
precision highp float;

varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;

uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uRim;
uniform vec3 uLineae;
uniform vec3 uLightDir;

uniform float uTime;
uniform float uSeed;
uniform float uBands;
uniform float uCraters;
uniform float uCaps;
uniform float uEmissive;
uniform float uBandFreq;
uniform float uStorm;
uniform float uSpec;
uniform float uDim;
uniform float uMicro;
uniform float uSurface;   // 0 gas · 1 batu · 2 es · 3 kabut · 4 bintang

${noiseChunk}

// Tinggi relief batu untuk bump. Kawah dibuat dari sel acak (satu kawah per
// sel: cekungan + bibir terangkat), bukan noise bergerigi — noise bergerigi
// menghasilkan pegunungan menyambung yang terbaca seperti karang.
float craterLayer(vec3 q, float scale, float seed) {
  vec3 g = q * scale;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  vec3 rnd = fract(sin(id * 0.13 + seed) * 43758.5453);
  // Tiap sel punya satu kawah dengan ukuran dan kedalaman sendiri, supaya
  // permukaan tidak terlihat seperti bola golf.
  float rad = 0.15 + rnd.x * 0.24;
  float d = length(f - (rnd - 0.5) * 0.62);
  float bowl = smoothstep(rad, rad * 0.45, d);
  float rimH = smoothstep(rad * 1.30, rad * 1.02, d) * (1.0 - bowl);
  return rimH * 0.5 - bowl * (0.50 + rnd.y * 0.50);
}

float craterField(vec3 q) {
  // Kawah bergerombol di beberapa wilayah saja, seperti medan tumbukan asli.
  float mask = smoothstep(0.30, 0.78, fbm3(q * 2.2 + 3.0));
  return craterLayer(q, 4.6, 1.7) * mask
       + craterLayer(q, 9.5, 9.3) * 0.35 * smoothstep(0.22, 0.66, mask);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uLightDir);

  float t = uTime * 0.012;
  vec3 p = vPos + vec3(uSeed * 0.37, 0.0, 0.0);
  float lon = atan(p.z, p.x);
  vec2 cyl = vec2(cos(lon), sin(lon));

  // Tiga skala turbulensi dipakai semua tipe permukaan. Noise yang sama
  // membuat pita, kawah, dan retakan saling "setuju" — ciri permukaan planet
  // sungguhan, bukan tekstur acak yang ditempel di bola.
  float n1 = fbm(vec3(p.x * 1.7, p.y * 4.0, p.z * 1.7) + vec3(uSeed, t * 0.4, 0.0));
  float n2 = fbm3(vec3(cyl * 2.1, p.y * 13.0) + vec3(uSeed * 2.0, t * 1.1, 0.0));
  float n3 = fbm3(vec3(cyl * 5.4, p.y * 31.0) + vec3(0.0, t * 2.0, uSeed));

  vec3 albedo = uMid;
  float gloss = 0.0;

  if (uSurface < 0.5) {
    /* ---- raksasa gas: pita zonal, jet, tepi pita yang digeser --------- */
    // uBands menentukan seberapa tegas pita: Saturnus ~1, Neptunus ~0.5.
    float amp = clamp(uBands, 0.0, 1.0);
    float warp = n1 * 1.30 + n2 * 0.80;
    float lat = p.y * uBandFreq * 3.14159 + warp * 2.4 + uSeed * 0.9;

    // pita lebar: dua nada bergantian, tepinya digeser turbulensi
    float belt = smoothstep(-0.15, 0.55, sin(lat) + (n2 - 0.5) * 1.1);
    // jet stream tipis di dalam pita — inilah "goresan" khas Saturnus
    float jet = smoothstep(0.60, 0.97, 0.5 + 0.5 * sin(lat * 6.3 + n3 * 3.4));
    // tepi pita yang paling terang: hanya segelintir, bukan seluruh lingkaran
    float shear = smoothstep(0.86, 0.98, 1.0 - abs(2.0 * n3 - 1.0));
    // pinstripe: goresan sangat halus di dalam pita, seperti foto Saturnus
    float pins = smoothstep(0.58, 0.98, 0.5 + 0.5 * sin(lat * 18.0 + n3 * 5.5 + n1 * 2.2));

    // Bahkan di planet berpita samar (Neptunus, uBands ≈ 0.5) pita harus
    // tetap terbaca — karena itu dasarnya 0.30, tidak dikalikan penuh.
    albedo = mix(uMid, uDeep, belt * (0.30 + 0.40 * amp));
    albedo = mix(albedo, uLight, jet * (0.09 + 0.13 * amp) * (1.0 - belt * 0.4));
    albedo = mix(albedo, uLight, shear * (0.05 + 0.14 * amp));
    albedo = mix(albedo, uDeep, pins * (0.03 + 0.05 * amp));
    albedo = mix(albedo, uLight, (1.0 - pins) * (0.02 + 0.03 * amp));

    // serat memanjang searah pita: di foto Cassini, arus gas tampak seperti
    // sapuan kuas yang jauh lebih panjang daripada tebalnya — bukan bintik.
    float wf = fbm3(vec3(cyl * 7.0, p.y * 46.0) + vec3(uSeed * 2.0, t * 1.6, n2 * 0.9));
    float wispAmp = 0.6 + 0.4 * amp;
    albedo = mix(albedo, uLight, smoothstep(0.56, 0.80, wf) * 0.12 * wispAmp);
    albedo = mix(albedo, uDeep, smoothstep(0.40, 0.24, wf) * 0.07 * wispAmp);

    albedo *= 0.96 + 0.08 * n1;

    // badai oval: inti terang dengan cincin gelap, bukan bintik tempelan
    if (uStorm > 0.001) {
      vec2 uv = vec2(lon / 6.28318 + 0.5, asin(clamp(p.y, -1.0, 1.0)) / 3.14159 + 0.5);
      vec2 dd = (uv - vec2(0.588, 0.435)) * vec2(1.0, 2.6);
      float r2 = length(dd);
      float spot = smoothstep(0.075, 0.03, r2);
      float ring = smoothstep(0.095, 0.075, r2) * (1.0 - spot);
      float swirl = smoothstep(0.35, 0.75, fbm3(vec3(uv * 20.0, uSeed)));
      albedo = mix(albedo, uLight * 0.96, spot * uStorm * (0.32 + swirl * 0.25));
      albedo = mix(albedo, uDeep, ring * uStorm * 0.35);
    }
  } else if (uSurface < 1.5) {
    /* ---- batu: basal gelap-terang, kawah, tudung kutub ---------------- */
    float basalt = smoothstep(0.32, 0.64, fbm3(vec3(cyl * 1.5, p.y * 2.4) + vec3(uSeed)));
    // Kawah: pakai medan yang sama dengan bump, jadi bercak terang di
    // albedo selalu jatuh tepat di bibir yang juga terangkat.
    float crH = craterField(p);
    float rimA = smoothstep(0.02, 0.30, crH);
    float bowl = smoothstep(-0.05, -0.55, crH);
    float mottle = fbm3(p * 7.0 + vec3(uSeed * 2.0, 0.0, 0.0));
    float fine = fbm3(p * 21.0 + vec3(uSeed, 0.0, t));

    albedo = mix(uLight, uMid, basalt * 0.88);
    albedo = mix(albedo, uDeep, smoothstep(0.50, 0.88, basalt) * 0.42);
    // Debu menutupi kontras: Mars tidak pernah bergaris tegas seperti marmer.
    albedo = mix(albedo, uMid, 0.16);
    albedo *= 0.86 + 0.26 * (mottle * 0.6 + fine * 0.4);
    albedo = mix(albedo, uLight * 0.95, rimA * uCraters * 0.20);
    albedo = mix(albedo, uDeep, bowl * uCraters * 0.28);

    float cap = smoothstep(0.80, 0.96, abs(p.y) + (n1 - 0.5) * 0.12);
    albedo = mix(albedo, vec3(0.82, 0.83, 0.82), cap * uCaps * 0.7);

    gloss = 0.02;
  } else if (uSurface < 2.5) {
    /* ---- es: dataran pucat + retakan tipis (Europa) ------------------- */
    float plains = fbm3(p * 3.2 + vec3(uSeed));
    float ridge = 1.0 - abs(2.0 * fbm3(vec3(cyl * 3.2, p.y * 16.0) + uSeed * 3.0) - 1.0);
    float lineae = smoothstep(0.90, 0.99, ridge);
    // retakan halus kedua: jaringan tipis di antara patahan besar
    float ridge2 = 1.0 - abs(2.0 * fbm3(vec3(cyl * 8.0, p.y * 34.0) + uSeed * 5.0) - 1.0);
    float cracks = smoothstep(0.93, 0.995, ridge2);
    // retakan bergerombol, bukan jaring rata di seluruh bola
    float groups = smoothstep(0.42, 0.74, fbm3(vec3(cyl * 0.9, p.y * 1.8) + 7.0));

    // Chaos terrain: bongkahan kerak es yang naik dan ternoda, seperti
    // Conamara Chaos di foto Galileo — bukan noda acak.
    float chaos = smoothstep(0.56, 0.84, fbm3(p * 4.4 + vec3(11.0) + uSeed));

    albedo = mix(uMid, uLight, smoothstep(0.22, 0.80, plains));
    albedo = mix(albedo, uLineae, chaos * 0.20);
    albedo = mix(albedo, uLineae, lineae * (0.26 + groups * 0.34));
    albedo = mix(albedo, uLineae, cracks * 0.26);
    albedo *= 0.92 + 0.16 * n3;

    gloss = 0.55;
  } else if (uSurface < 3.5) {
    /* ---- kabut tebal (Venus/Titan): hampir tanpa kontras permukaan ----- */
    // Frekuensi vertikal rendah: Venus adalah selimut belerang, bukan pita.
    float swirl = fbm3(vec3(cyl * 0.9, p.y * 1.8) + vec3(uSeed, t * 0.4, 0.0));
    float streak = fbm3(vec3(cyl * 2.4, p.y * 4.5) + vec3(swirl * 1.2, t * 0.8, uSeed));
    // serat halus di dalam selimut: kabut yang bergerak, bukan bidang rata
    float veil = fbm3(vec3(cyl * 5.4, p.y * 9.0) + vec3(t * 0.25, uSeed, 0.0));

    albedo = mix(uMid, uLight, smoothstep(0.30, 0.78, swirl * 0.80 + streak * 0.30) * 0.6);
    albedo = mix(albedo, uDeep, smoothstep(0.68, 0.95, n1) * 0.10);

    // Pita lintang tipis: Venus (foto UV) dan Titan punya arah, bukan bidang
    // rata. Kontrasnya rendah — cukup supaya bola terbaca berlapis.
    float latBand = sin(p.y * 9.0 + n1 * 2.4 + uSeed);
    albedo = mix(albedo, uDeep, smoothstep(0.30, 0.95, latBand * 0.5 + 0.5) * 0.16);
    // goresan halus sejajar ekuator, bukan bintik
    float fiber = fbm3(vec3(cyl * 3.6, p.y * 26.0) + vec3(t * 0.6, uSeed * 1.3, 0.0));
    albedo = mix(albedo, uLight, smoothstep(0.55, 0.86, fiber) * 0.10);
    // tudung kutub yang lebih gelap (Titan): tebal di kutub, pudar ke ekuator
    albedo = mix(albedo, uDeep, smoothstep(0.58, 0.96, abs(p.y)) * 0.14);

    albedo *= 0.95 + 0.10 * veil;
    gloss = 0.0;
  } else {
    /* ---- bintang: granulasi, jaring faculae, bintik matahari ---------- */
    // Supergranulasi: variasi terang-gelap skala besar, kontras rendah.
    float superg = fbm3(p * 9.0 + vec3(0.0, t * 1.4, 0.0));
    // Granula = sel konveksi rapat. Frekuensinya sedang: lebih halus dari
    // skala benua, tapi tetap terbaca sebagai butiran di layar 1440.
    float gA = fbm3(p * 64.0 + vec3(uSeed, t * 3.0, 0.0));
    float gB = fbm3(p * 148.0 + vec3(uSeed * 2.0, t * 4.6, 0.0));
    float cells = smoothstep(0.32, 0.68, gA * 0.64 + gB * 0.36);
    // Faculae: jaring terang tipis di tepi sel, bukan di seluruh piringan.
    float fac = smoothstep(0.60, 0.78, gA) * smoothstep(0.44, 0.62, gB);

    albedo = mix(uMid, uLight, 0.04 + 0.36 * cells + 0.17 * superg);
    albedo = mix(albedo, uLight, fac * 0.22);
    // Tone mapping meratakan warna bagian terang; saturasi dinaikkan dulu
    // supaya piringannya tetap emas, bukan krem.
    float lum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
    albedo = mix(vec3(lum), albedo, 1.3);

    // Bintik matahari: umbra gelap dengan penumbra lebih terang di
    // sekelilingnya, hanya di lintang rendah seperti piringan sungguhan.
    float zone = smoothstep(0.78, 0.20, abs(p.y));
    float field = fbm3(p * 7.0 + vec3(uSeed * 9.0, t * 0.22, 0.0));
    float umbra = smoothstep(0.80, 0.89, field) * zone;
    float penumbra = smoothstep(0.72, 0.81, field) * (1.0 - umbra) * zone;
    albedo = mix(albedo, uDeep * 1.3, umbra * 0.88 + penumbra * 0.30);

    // Tepi piringan bergeser jingga: warna matahari asli, bukan cakram rata.
    albedo *= mix(vec3(1.0), vec3(1.05, 0.84, 0.62), pow(1.0 - dot(N, V), 1.7) * 0.85);
    gloss = 0.0;
  }

  // Butiran permukaan: tekstur halus yang menangkap cahaya. Tanpa ini bola
  // terbaca sebagai bidang warna yang dihaluskan, bukan materi.
  float grain = fbm3(p * 64.0 + vec3(uSeed * 3.0, t * 0.7, 0.0));
  float speck = vnoise(p * 148.0 + vec3(0.0, t * 2.0, uSeed));
  float fineTex = grain * 0.7 + speck * 0.3;
  if (uSurface > 0.5 && uSurface < 1.5) {
    albedo *= 0.84 + fineTex * 0.32; // batu: debu dan kerikil
  } else if (uSurface > 1.5 && uSurface < 2.5) {
    albedo *= 0.90 + fineTex * 0.22; // es: butiran kristal
  } else if (uSurface > 2.5) {
    albedo *= 0.94 + fineTex * 0.14; // kabut / bintang
  } else {
    albedo *= 0.92 + fineTex * 0.16; // gas: tekstur di dalam pita
  }

  // Relief mikro (tier high): gradien noise menggeser normal di batu & es,
  // supaya butiran permukaan menangkap cahaya seperti tekstur fisik.
  // Tiga skala: kawah/punggung batuan, bentuk kasar, lalu butiran halus.
  if (uMicro > 0.5 && uSurface > 0.5 && uSurface < 2.5) {
    vec3 upv = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 T = normalize(cross(upv, N));
    vec3 B = cross(N, T);
    float e = 0.05;
    // Di tepi bola gradien normal meledak; redam supaya tidak berdesir.
    float facing = smoothstep(0.02, 0.34, dot(N, V));

    // Kawah dan pegunungan: relief besar yang benar-benar menangkap bayangan,
    // bukan cuma bercak terang di albedo.
    if (uSurface < 1.5) {
      float k = 0.02;
      float k0 = craterField(p);
      float kx = craterField(p + T * k);
      float ky = craterField(p + B * k);
      // 2.4, bukan 6: relief terlalu dalam membuat permukaan terlihat
      // seperti karang, bukan kerak berdebu.
      N = normalize(N - (T * (kx - k0) + B * (ky - k0)) * 2.4 * facing);
    }

    vec3 bq = p * 15.0 + vec3(uSeed, t * 1.4, 0.0);
    float h0 = fbm3(bq);
    float hx = fbm3(bq + T * e);
    float hy = fbm3(bq + B * e);
    N = normalize(N - (T * (hx - h0) + B * (hy - h0)) * (uSurface < 1.5 ? 3.0 : 2.0) * facing);

    vec3 bq2 = p * 58.0 + vec3(uSeed * 1.7, t * 2.6, 0.0);
    float g0 = vnoise(bq2);

    float gx = vnoise(bq2 + T * e);
    float gy = vnoise(bq2 + B * e);
    N = normalize(N - (T * (gx - g0) + B * (gy - g0)) * (uSurface < 1.5 ? 1.6 : 1.1) * facing);
  }

  /* ---- cahaya -------------------------------------------------------- */
  float ndl = dot(N, L);
  // Terminator lunak khas foto luar angkasa: siang penuh, malam hampir habis.
  float day = smoothstep(-0.06, 0.34, ndl);
  float lit = max(ndl, 0.0);

  vec3 col = albedo * (0.035 + day * (0.42 + 0.92 * lit));

  // malam: hanya pantulan bintang yang sangat samar, bukan hitam pekat
  col += uRim * (1.0 - day) * 0.008;

  // glint es/laut: lebar dan tenang, bukan titik panas
  if (gloss > 0.001 || uSpec > 0.001) {
    vec3 H = normalize(L + V);
    float s = pow(max(dot(N, H), 0.0), 26.0);
    col += uLight * s * (gloss * 0.18 + uSpec * 0.2) * day;
  }

  // tepi atmosfer hanya di sisi yang tersinari — sisi malam tetap hitam.
  // Bintang tidak butuh tepi bercahaya: piringannya justru meredup ke tepi.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  float rimAmp = uSurface > 3.5 ? 0.07 : 1.0;
  col += uRim * fres * (0.05 + 0.42 * day) * (0.30 + 0.70 * lit) * rimAmp;

  // limb darkening: tepi bola meredup seperti lensa menangkap bola
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float limb = 0.74 + 0.26 * pow(mu, 0.45);
  // Matahari meredup jauh lebih dalam di tepi (limb darkening asli).
  if (uSurface > 3.5) limb = 0.38 + 0.62 * pow(mu, 0.30);
  col *= limb;

  if (uEmissive > 0.5) {
    // Bintang menyala dari albedonya sendiri (granulasi ikut terbaca) —
    // tapi limb darkening tetap dipakai, kalau tidak piringan jadi cakram
    // rata seperti stiker.
    col = albedo * 1.06 * limb;
  }

  gl_FragColor = vec4(filmGrade(col * uDim), 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Atmosfer volumetrik: ray-march cangkang bola dengan hamburan Rayleigh +    */
/* Mie. Ini yang membuat tepi planet menyala seperti foto satelit sungguhan —  */
/* halo tipis di terminator, cahaya maju yang hangat di sisi matahari.         */
/* Dipasang di bola FrontSide radius uOuter, depthWrite off, additive.         */
/* -------------------------------------------------------------------------- */

export const atmoShellVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const atmoShellFragment = /* glsl */ `
precision highp float;

varying vec3 vWorld;

uniform vec3 uPlanetCenter;
uniform float uInner;
uniform float uOuter;
uniform vec3 uLightDir;
uniform vec3 uScatter;   // warna hamburan Rayleigh (biru/teal)
uniform vec3 uMieCol;    // warna haze depan (hangat)
uniform float uIntensity;
uniform float uSteps;
uniform float uDensity;

${noiseChunk}

vec2 shellHit(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float h = b * b - c;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  // March sepanjang sinar pandang: dari kamera menembus kulit atmosfer sampai
  // permukaan planet. Arah harus MENUJU planet — kalau dibalik, sinar keluar
  // dari kulit dan hasilnya cuma piringan rata tanpa gradasi limb.
  vec3 ro = cameraPosition - uPlanetCenter;
  vec3 rd = normalize(vWorld - cameraPosition);

  vec2 tO = shellHit(ro, rd, uOuter);
  float tStart = max(tO.x, 0.0);
  if (tO.y <= tStart) discard;

  vec2 tI = shellHit(ro, rd, uInner);
  // kalau sinar menabrak bola planet, berhenti di permukaan depannya
  float tEnd = tI.x > tStart ? tI.x : tO.y;
  float span = tEnd - tStart;
  if (span <= 0.0) discard;

  // jitter per-piksel: memecah "pita" langkah march tanpa biaya tambahan
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float stepLen = span / uSteps;
  float t = tStart + stepLen * jit;

  vec3 L = normalize(uLightDir);
  vec3 scatter = vec3(0.0);
  float opticalDepth = 0.0;

  for (float i = 0.0; i < 24.0; i++) {
    if (i >= uSteps) break;
    vec3 pos = ro + rd * t;
    float h = clamp((length(pos) - uInner) / (uOuter - uInner), 0.0, 1.0);

    // densitas: paling pekat di kulit dalam, jatuh eksponensial ke luar
    float density = exp(-h * 3.4) * (1.0 - h);
    opticalDepth += density * stepLen;

    // Hanya sisi yang tersinari yang berpendar. Sisi malam planet di foto
    // ruang angkasa hampir hitam — bukan cincin cahaya yang mengelilingi bola.
    float mu = dot(rd, L);
    float lit = smoothstep(-0.32, 0.42, dot(normalize(pos), L));
    float rim = smoothstep(-0.30, 0.55, mu);
    float mie = pow(max(mu, 0.0), 16.0);

    scatter +=
      (uScatter * lit * (0.16 + rim * 1.15) + uMieCol * mie * lit * 0.7) *
      density * stepLen;
    t += stepLen;
  }

  vec3 transmittance = vec3(exp(-opticalDepth * uDensity * 1.35));
  vec3 glow = scatter * uIntensity * uDensity * transmittance;

  if (max(glow.r, max(glow.g, glow.b)) < 0.002) discard;
  gl_FragColor = vec4(filmGrade(glow * 1.35), 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* Awan: kulit tipis di atas permukaan, coverage dari fbm yang mengalir,      */
/* disinari terminator yang sama dengan planet, dengan bayangan ke permukaan.  */
/* -------------------------------------------------------------------------- */

export const cloudVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;

void main() {
  vPos = position;

  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const cloudFragment = /* glsl */ `
precision highp float;

varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;

uniform float uTime;
uniform float uSeed;
uniform vec3 uLightDir;
uniform vec3 uColor;
uniform vec3 uShadow;
uniform float uCoverage;
uniform float uOpacity;

${noiseChunk}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);

  // Awan raksasa gas terseret aliran zonal: memanjang mendatar, bukan
  // gumpalan bulat seperti cumulus di Bumi.
  float t = uTime * 0.014;
  vec3 p = vec3(vPos.x, vPos.y * 3.2, vPos.z) * 2.4 + vec3(uSeed * 5.0, 0.0, 0.0);
  float warp = fbm3(p * 0.55 + vec3(t * 0.3, 0.0, 0.0));
  float n = fbm(p + vec3(warp * 1.8, t * 0.5, warp * 0.6));
  float filaments = fbm3(vec3(vPos.x, vPos.y * 7.0, vPos.z) * 4.5 + vec3(uSeed, t * 0.2, 0.0));
  n = n * 0.78 + filaments * 0.22;

  float cover = smoothstep(0.58 - uCoverage, 0.88 - uCoverage * 0.45, n);
  if (cover < 0.004) discard;

  // terminator yang sama dengan permukaan + sedikit cahaya tembus
  float ndl = dot(N, L);
  float day = smoothstep(-0.25, 0.35, ndl);
  float trans = pow(clamp(-ndl * 0.5 + 0.5, 0.0, 1.0), 3.0) * 0.12;

  // tepi gumpalan lebih tipis → lebih gelap; inti lebih tebal → lebih terang
  float thickness = smoothstep(0.0, 0.55, cover);
  vec3 col = mix(uShadow, uColor, day * (0.35 + 0.65 * thickness) + trans);

  // limb: dekat tepi bola awan menipis (sudut pandang dangkal)
  float fres = pow(1.0 - clamp(dot(N, normalize(vViewDir)), 0.0, 1.0), 2.2);
  float a = cover * uOpacity * (1.0 - fres * 0.85) * (0.25 + day * 0.75);
  if (a < 0.004) discard;

  gl_FragColor = vec4(filmGrade(col * 1.2), a);
}
`

/* -------------------------------------------------------------------------- */
/* Aurora: tirai cahaya di kutub — pita vertikal yang bergelombang,            */
/* hijau-teal di bawah, ungu di atas, seperti tirai nyata di foto long-expose. */
/* Dipasang di silinder terbuka sekitar kutub, mengikuti kemiringan planet.    */
/* -------------------------------------------------------------------------- */

export const auroraVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const auroraFragment = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vPos;

uniform float uTime;
uniform float uSeed;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uOpacity;

${noiseChunk}

void main() {
  float ang = atan(vPos.z, vPos.x);

  // tirai bergelombang: noise 1D sepanjang sudut yang mengalir pelan
  float w1 = fbm3(vec3(cos(ang) * 2.0 + uSeed, sin(ang) * 2.0, uTime * 0.07));
  float w2 = fbm3(vec3(cos(ang * 2.3) * 1.6, sin(ang * 2.3) * 1.6 + uSeed, uTime * 0.11 + 5.0));
  float curtain = smoothstep(0.15, 0.75, w1 * 0.7 + w2 * 0.45);

  // profil vertikal: terang di kaki tirai, memudar ke atas sambil bergerigi
  float h = clamp(vUv.y, 0.0, 1.0);
  float vertical = pow(1.0 - h, 1.7) * smoothstep(0.0, 0.14, h);
  float flicker = 0.72 + 0.28 * fbm3(vec3(ang * 5.0, uTime * 0.5, uSeed * 2.0));

  float a = curtain * vertical * flicker * uOpacity;
  if (a < 0.003) discard;

  vec3 col = mix(uColorLow, uColorHigh, smoothstep(0.05, 0.85, h + w2 * 0.22));
  gl_FragColor = vec4(col * (0.6 + vertical * 0.8), a);
}
`

/* -------------------------------------------------------------------------- */
/* Cincin planet: pita radial dengan celah (Cassini) + noise.                 */
/* -------------------------------------------------------------------------- */

export const ringVertex = /* glsl */ `
varying float vR;
varying vec3 vWorld;
void main() {
  vR = length(position.xy);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const ringFragment = /* glsl */ `
precision highp float;

varying float vR;
varying vec3 vWorld;

uniform vec3 uColor;
uniform vec3 uColorB;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform vec3 uLightDir;

${noiseChunk}

void main() {
  float x = clamp((vR - uInner) / max(uOuter - uInner, 0.0001), 0.0, 1.0);

  float b = fbm3(vec3(x * 16.0, uSeed, 0.0));
  // Cincin asli hampir merata: variasi lembut, bukan garis-garis keras.
  float bands = 0.62 + 0.38 * smoothstep(0.18, 0.82, b);

  // micro-banding: ribuan garis tipis seperti cincin Saturnus asli
  float micro = fbm3(vec3(x * 54.0, uSeed + 4.2, 0.0));
  bands *= 0.90 + micro * 0.18;

  // celah tipis supaya terbaca sebagai cincin, bukan donat
  float gap = smoothstep(0.40, 0.44, x) * smoothstep(0.50, 0.46, x);

  float edge = smoothstep(0.0, 0.08, x) * smoothstep(1.0, 0.9, x);
  float a = edge * bands * (1.0 - gap * 0.92) * uOpacity;
  if (a < 0.004) discard;

  // Bayangan planet pada cincin: bagian cincin yang berada di belakang planet
  // relatif terhadap cahaya menjadi gelap. Inilah yang membuat cincin terasa
  // benar-benar mengelilingi benda, bukan stiker di belakangnya.
  vec3 toL = normalize(uLightDir);
  vec3 oc = uPlanetCenter - vWorld;
  float along = dot(oc, toL);
  float perp = sqrt(max(dot(oc, oc) - along * along, 0.0));
  float shadow = 1.0;
  if (along > 0.0) {
    shadow = mix(0.16, 1.0, smoothstep(uPlanetRadius * 0.94, uPlanetRadius * 1.10, perp));
  }

  vec3 col = mix(uColor, uColorB, smoothstep(0.3, 0.9, x));
  gl_FragColor = vec4(filmGrade(col * mix(0.55, 1.0, shadow) * 1.15), a * mix(0.35, 1.0, shadow));
}
`

/* -------------------------------------------------------------------------- */
/* Nebula: bidang besar yang di-billboard ke kamera, bentuknya dari fbm.      */
/* -------------------------------------------------------------------------- */

export const veilVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const veilFragment = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;

${noiseChunk}

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;

  float mask = smoothstep(1.0, 0.08, r);
  mask *= mask;

  // Tiga lapis: awan, detail, lalu filamen tipis. Filamen inilah yang
  // membuat nebula terlihat seperti gas, bukan lingkaran blur.
  float n1 = fbm3(vec3(vUv * 2.8 + vec2(uSeed), uTime * 0.008));
  float n2 = fbm3(vec3(vUv * 6.4 - vec2(uTime * 0.005), uSeed + 3.7));
  float n3 = fbm3(vec3(vUv * 14.0 + n1 * 1.4, uSeed + 9.1));

  float cloud = smoothstep(0.24, 0.80, n1 * 0.72 + n2 * 0.44);
  float filament = smoothstep(0.56, 0.86, n3) * smoothstep(0.20, 0.70, n1);
  float a = mask * (cloud * 0.72 + filament * 0.5) * uOpacity;
  if (a < 0.002) discard;

  vec3 col = mix(uColorA, uColorB, smoothstep(0.30, 0.92, n2 + filament * 0.35));
  gl_FragColor = vec4(col, a);
}
`

/* -------------------------------------------------------------------------- */
/* Bintang: titik dengan ukuran tetap (tidak mengecil oleh jarak) + twinkle.  */
/* -------------------------------------------------------------------------- */

export const starVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

attribute float aScale;
attribute float aSeed;
attribute float aTemp;

varying float vAlpha;
varying float vTemp;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  gl_PointSize = uSize * aScale * uPixelRatio;

  float twinkle = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.8) + aSeed * 39.0);
  vAlpha = twinkle * (0.45 + aScale * 0.4);
  vTemp = aTemp;
}
`

export const starFragment = /* glsl */ `
precision mediump float;

varying float vAlpha;
varying float vTemp;
uniform vec3 uColor;

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  if (r > 0.5) discard;

  // suhu bintang: biru-putih di satu ujung, oranye di ujung lain. Tanpa ini
  // semua bintang terlihat seperti debu yang sama.
  vec3 cool = vec3(0.72, 0.84, 1.0);
  vec3 warm = vec3(1.0, 0.84, 0.62);
  vec3 col = mix(warm, cool, vTemp) * uColor;

  float core = smoothstep(0.5, 0.0, r);
  float halo = smoothstep(0.5, 0.12, r) * 0.35;
  // Difraksi: bintang paling terang menumbuhkan spike 4 arah (silang tipis),
  // seperti lensa kamera merekam titik cahaya jauh. Bintang redup dilewati.
  float spike = 0.0;
  if (vAlpha > 0.72) {
    float ax = pow(max(0.0, 1.0 - abs(d.y) * 14.0), 3.0) * smoothstep(0.5, 0.05, abs(d.x));
    float ay = pow(max(0.0, 1.0 - abs(d.x) * 14.0), 3.0) * smoothstep(0.5, 0.05, abs(d.y));
    spike = (ax + ay) * (vAlpha - 0.72) * 2.2;
  }
  float a = (core + halo + spike) * vAlpha;
  gl_FragColor = vec4(col, a);
}
`

/* -------------------------------------------------------------------------- */
/* Dust: titik kecil melayang sepanjang jalur kamera.                         */
/* -------------------------------------------------------------------------- */

export const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uFlow;

attribute float aScale;
attribute float aSeed;

varying float vAlpha;
varying float vStretch;

void main() {
  vec3 p = position;

  p.x += sin(uTime * 0.20 + aSeed * 6.28) * 0.5;
  p.y += cos(uTime * 0.16 + aSeed * 4.71) * 0.4;
  p.z += sin(uTime * 0.13 + aSeed * 3.14) * 0.35;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float dist = -mv.z;
  float stretch = 1.0 + uFlow * 2.6;
  gl_PointSize = aScale * uPixelRatio * (16.0 / max(dist, 0.5)) * (1.0 + uFlow * 0.55) * stretch;
  vStretch = stretch;

  vAlpha = clamp(1.0 - (dist - 4.0) / 46.0, 0.0, 1.0) * (0.5 + uFlow * 0.5);
}
`

export const dustFragment = /* glsl */ `
precision mediump float;

varying float vAlpha;
varying float vStretch;
uniform vec3 uColor;

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  // saat scroll cepat partikel memanjang vertikal → terbaca sebagai garis
  // kecepatan (motion streak), bukan titik yang tiba-tiba membesar.
  d.y /= max(vStretch, 1.0);
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.05, r) * vAlpha;
  gl_FragColor = vec4(uColor, a);
}
`

/* -------------------------------------------------------------------------- */
/* Halo: cahaya radial. Dipasang sebagai sprite supaya selalu menghadap kamera */
/* -------------------------------------------------------------------------- */

export const haloVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const haloFragment = /* glsl */ `
precision mediump float;

varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPower;

void main() {
  float d = distance(vUv, vec2(0.5));
  float a = smoothstep(0.5, 0.02, d);
  a = pow(a, uPower);
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`

/* -------------------------------------------------------------------------- */
/* Beam: kolom cahaya vertikal (plane yang di-billboard ke kamera)            */
/* -------------------------------------------------------------------------- */

export const beamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const beamFragment = /* glsl */ `
precision mediump float;

varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  // Kedua ujung melebur ke latar. Dulu hanya ujung atas yang pudar; tepi bawah
  // bidang menjadi garis lurus terang begitu kamera turun ke bawah planet.
  float vertical = pow(1.0 - vUv.y, 2.4) * smoothstep(0.0, 0.32, vUv.y);
  float side = smoothstep(0.0, 0.45, vUv.x) * smoothstep(1.0, 0.55, vUv.x);
  gl_FragColor = vec4(uColor, vertical * side * uOpacity);
}
`

/* -------------------------------------------------------------------------- */
/* Hologram: panel HUD tipis dengan garis pindai, gelombang, dan bar data.     */
/* Additive + redup — informasi, bukan lampu neon.                            */
/* -------------------------------------------------------------------------- */

export const holoVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const holoFragment = /* glsl */ `
precision mediump float;

varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSeed;

void main() {
  vec2 uv = vUv;
  float t = uTime + uSeed * 9.0;

  // bingkai tepi
  vec2 e = min(uv, 1.0 - uv);
  float frame = smoothstep(0.0045, 0.0, e.y) + smoothstep(0.0045, 0.0, e.x);

  // sapuan vertikal yang berjalan pelan
  float sweep = smoothstep(0.035, 0.0, abs(fract(uv.y - t * 0.06) - 0.5));

  // garis pindai halus
  float scan = 0.5 + 0.5 * sin(uv.y * 150.0 - t * 5.0);

  // gelombang sinyal di tengah
  float base = 0.52 + 0.1 * sin(t * 0.5 + uSeed * 4.0);
  float waveY = base + 0.15 * sin(uv.x * 15.0 + t * 1.6) * sin(uv.x * 3.1 - t * 0.7);
  float wave = smoothstep(0.018, 0.0, abs(uv.y - waveY));

  // bar data di bagian bawah
  float col = floor(uv.x * 24.0);
  float h = 0.015 + 0.13 * (0.5 + 0.5 * sin(col * 2.1 + t * 1.3 + uSeed * 6.0));
  float bars = step(uv.y, h) * step(0.08, fract(uv.x * 24.0));

  // garis bantu horizontal tipis
  float rules = smoothstep(0.0025, 0.0, abs(fract(uv.y * 6.0) - 0.5)) * 0.25;

  // kedipan: dua frekuensi saling mengalahkan, tidak berirama
  float flick = 0.86 + 0.14 * sin(t * 15.0) * sin(t * 2.7 + 1.3);

  float a = frame * 0.6 + sweep * 0.18 + scan * 0.05 + wave * 0.85 + bars * 0.4 + rules;

  // tepi panel memudar supaya tidak terlihat seperti kartu
  float fade = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x)
             * smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);

  a *= fade * flick * uOpacity;

  vec3 col3 = uColor * (0.75 + wave * 1.6 + frame * 0.5);
  gl_FragColor = vec4(col3, a);
}
`
