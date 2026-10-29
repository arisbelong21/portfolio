# Portfolio — satu halaman, satu dunia 3D

Bukan website berisi section yang di-scroll. Ini **satu ruang 3D layar penuh**
yang kameranya terbang mengikuti scroll:

- scroll = kamera bergerak; melambat di tiap bab tapi **tidak pernah berhenti**
- setiap karya punya satu "shot" kamera sendiri + satu bab teks
- teks dan kamera memakai angka progres yang sama, jadi tidak pernah lepas
- planet, bintang, nebula, cincin, debu, dan grid semuanya dibuat lewat shader —
  **tanpa satu pun file model atau tekstur**
- dua bahasa (**Indonesia / Inggris**) dengan tombol ID / EN di kanan atas;
  berganti seketika, tanpa reload, dan jalur kamera tetap sama

Semua isi ada di satu file: `src/content.ts`.

---

## 1. Jalankan

```powershell
cd portfolio-l2
npm.cmd install
npm.cmd run dev -- --port 5199
```

Buka `http://localhost:5199`.

> Di PowerShell, pakai `npm.cmd` / `npx.cmd` (bukan `npm` / `npx`) — PowerShell
> memblokir `*.ps1` milik npm.

Build produksi:

```powershell
npm.cmd run build
npm.cmd run preview     # cek hasil build di http://localhost:4173
```

Catatan: `npm.cmd run build` kadang berakhir dengan *exit code 1* padahal
build-nya sukses — itu hanya karena Vite menulis peringatan (chunk > 500 kB) ke
stderr. Yang menentukan: baris terakhir `✓ built in …` dan isi folder `dist/`.

---

## 2. Ganti isi portofolio

Buka `src/content.ts`. Tidak perlu menyentuh file lain.

Isinya **dua bahasa** dengan bentuk yang persis sama:

```ts
export const copy = {
  en: { name: 'Aris Nanda Saputra', headline: ['If the tool', 'doesn’t exist,', 'I build it.'], ... },
  id: { name: 'Aris Nanda Saputra', headline: ['Kalau alatnya', 'belum ada,', 'saya bikin.'], ... },
}
```

Ganti nilai di `copy.en` **dan** `copy.id`. Urutan `projects` dan `links` harus
sama di keduanya, karena kamera 3D memakai urutan yang sama.

| Field | Dipakai untuk |
| --- | --- |
| `name`, `monogram`, `role`, `location` | brand di kiri atas, bab intro, footer |
| `email` | tombol pil di bab terakhir (`mailto:`) |
| `availability` | teks status di bar bawah |
| `headline[]` | judul raksasa bab intro (1 string = 1 baris) |
| `tagline` | paragraf pembuka |
| `statement`, `statementNote` | isi bab **Approach** |
| `studioHeading[]` | judul besar bab **Approach** |
| `contactHeading[]`, `contactNote` | judul + kalimat bab terakhir |
| `facts[]` | baris kiri di bab Approach |
| `capabilities[]` | tiga kelompok isi di bab Approach |
| `projects[]` | **satu project = satu bab + satu pemberhentian kamera** |
| `links[]` | baris "Elsewhere / Tautan" di bab terakhir |
| `labels` | label kecil di kolom meta (Name/Role/Year/…) |
| `footerNote` | catatan kecil di bab Contact |

Teks antarmuka yang bukan isi portofolio (menu Work/Approach/Contact, "Scroll",
tahap preloader) ada di `src/lib/i18n.ts`, juga dua bahasa.

Catatan penting:

- Nada penulisan (sudah dipakai di semua teks): seperti orang bicara, bukan
  brosur. Kalimat pendek, kata kerja konkret, angka nyata, dan paragraf project
  selalu dimulai dari masalah yang terasa. Hindari "passionate", "visioner",
  "rockstar", "solusi inovatif" — pembaca melewatinya.
- Menambah/menghapus project **otomatis** menambah/menghapus bab dan
  memperpanjang perjalanan kamera. Tidak ada angka yang perlu disesuaikan.
- Judul project sebaiknya 1–3 kata. Lebih dari 13 karakter otomatis dipecah
  jadi dua baris.
- `projects[].href` opsional → memunculkan tautan "Open project".
- `projects[].year` opsional → kalau kosong, baris "Year" hilang dan kicker
  cukup berbunyi "Selected work".
- Setiap project otomatis dapat "planet"-nya sendiri, bergiliran:
  bercincin → gas → berbatu → es. Jadi variasi bentuk mengikuti urutan project.
- Setelah ganti nama/email, rapikan juga `index.html`: `<title>`,
  `<meta name="description">`, `og:*`, `twitter:*`, monogram favicon, dan teks
  di `<noscript>`.
- Saat dev, console memberi peringatan kalau masih ada isi contoh di salah satu
  bahasa.

### Bahasa

- Tombol **ID / EN** ada di kanan atas, di samping menu.
- Pilihan disimpan di `localStorage`; saat pertama kali dibuka, bahasa mengikuti
  bahasa browser (Indonesia → `id`, lainnya → `en`).
- `?lang=id` / `?lang=en` di URL mengalahkan keduanya, jadi tautan bisa dibagikan
  dalam satu bahasa. Tombol bahasa juga memperbarui URL tanpa reload.

---

## 3. Struktur file

```
src/
  content.ts              ← SEMUA ISI. Ini satu-satunya file yang kamu edit.
  App.tsx                 ← preloader, satu loop scroll, perakitan halaman
  styles.css              ← seluruh tampilan teks/chrome
  components/
    Overlay.tsx           ← 9 bab teks (ID/EN) + brand + rail + progress
  lib/
    i18n.ts               ← bahasa aktif + teks antarmuka (ID/EN)
    journey.ts            ← menyusun bab, jenis subjek & posisi kamera
    cosmos.ts             ← nebula (veil), planet penutup, arah cahaya
    nav.ts                ← objek state scroll bersama + helper math
    motion.ts             ← redaman dua tahap + noise (fbm) untuk kamera
    quality.ts            ← deteksi tier perangkat (dpr, partikel, post)
  scene/
    JourneyCanvas.tsx     ← <Canvas> WebGL + lazy load + sinyal "siap"
    World.tsx             ← seluruh dunia: sky, grid, planet, kamera, efek
    shaders.ts            ← GLSL prosedural (planet, cincin, nebula, debu)
    Probe.tsx             ← alat ukur dev-only (lihat bagian 5)
```

---

## 4. Cara kerjanya

### Satu sumber gerak

`src/lib/nav.ts` menyimpan satu objek:

```ts
nav = { p, seg, active, x, y, idle, velocity }
```

`App.tsx` menjalankan **satu** `requestAnimationFrame` yang:

1. membaca `window.scrollY` → `raw` (0..1, angka asli)
2. menahan `raw` dengan rem `maxLead` (1,9 bab) → `lead`
3. `lead` masuk **tahap 1** (`p1`, redaman 0,075 per frame), lalu `p1`
   menggerakkan **tahap 2** (`nav.p`, redaman 0,15). Dua lapis ini yang
   memberi akselerasi dan ekor; satu lapis terasa seperti menempel ke scroll.
4. `seg = nav.p × unitsTotal` (0 = intro, 1 = karya pertama, dst)
5. menghitung `velocity` (0..1) dari selisih `p1` — satu lapis lebih responsif
   daripada visual, jadi bloom/aberasi bereaksi sebelum kamera sampai
6. menulis `nav` lalu memanggil `emitNav()`

`Overlay.tsx` berlangganan `nav` dan menulis style DOM langsung (tanpa
re-render React). `World.tsx` membaca `nav` di `useFrame` untuk menggerakkan
kamera. Karena keduanya membaca angka yang sama pada frame yang sama, teks tidak
pernah "ketinggalan" dari gambar.

Rem `maxLead` bukan peredam harian. Saat scroll roda biasa, `raw` naik pelan
sehingga batas itu tidak pernah tersentuh. Yang direm hanya lompatan besar
(klik rail, Home/End, browser memulihkan posisi): kecepatan visual dibatasi
sekitar 0,7 progress/detik, jadi kamera tidak teleport.

### Kamera

`journey.ts` menaruh tiap bab di satu titik fokus, dengan posisi kamera
mengorbit fokus itu. Dua `CatmullRomCurve3` (posisi & target lihat) membuat jalur
halus dari bab 1 ke bab terakhir.

Per segmen, progres memakai campuran **45% linear + 55% smootherstep**. Artinya
kamera melambat di dekat tiap bab (maksimal 45% kecepatan normal) tapi
**kecepatannya tidak pernah nol** — selalu ada gerak, seperti igloo.inc. Waktu
scroll cepat, kamera juga "mendahului" sedikit ke arah tujuan.

Subjek 3D sengaja digeser ke **kanan-atas**. Sudutnya dihitung dari FOV, jadi
komposisinya sama di layar lebar maupun HP. Di layar potret FOV otomatis
dilebarkan (+20°) dan subjek dibuat hampir di tengah: dengan FOV 44°, planet
selebar 24° tidak mungkin muat di lebar layar ponsel (21°) — tanpa ini seluruh
layar jadi satu bidang terang.

### Akibat scroll: tiga hal sekaligus

`nav.velocity` (0..1) dipakai untuk tiga hal yang membuat scroll terasa punya
berat:

| Efek | Besaran |
| --- | --- |
| FOV "punch" | 44° → 50,5° saat scroll cepat |
| chromatic aberration | 1 → 3,2 |
| aliran debu | kecepatan debu naik |
| bloom | 0,52 → 0,56 (ikut kecepatan, bukan berdenyut sendiri) |

Ganti bahasa tidak mengubah jalur kamera: `buildChapters()` menyusun ulang teks,
sementara posisi stasiun hanya dihitung dari **jumlah** bab — sama di kedua bahasa.

### Gerak saat tidak di-scroll

- planet berputar pelan, permukaannya bergerak lewat `uTime`
- satelit kecil mengorbit, cincin berputar
- nebula bernapas (opacity + skala)
- debu melayang, bintang berkelip
- kamera **mengorbit** titik lihat mengikuti pointer (±3° / ±1,2°), bukan
  geser datar: jarak ke titik lihat tetap 12,056 di semua posisi
- kamera juga **bergoyang** dengan noise (fbm, ±0,3°) yang tidak pernah
  berulang — bukan sinus yang kembali ke titik awal
- roll tipis mengikuti pointer; bloom mengikuti kecepatan scroll

### Kalau sistem minta "kurangi gerak"

Kalau Windows/browser menyalakan *reduce motion*, situs **tetap** menampilkan
dunia 3D dan tetap bergerak saat kamu scroll (gerak itu dipicu user, bukan
autoplay). Yang dikurangi hanya gerak diam-diam (napas objek, parallax pointer,
roll kamera). Muncul tombol kecil di atas untuk menyalakan gerak penuh.

### Jaring aman

- preloader baru menutup setelah **4 frame benar-benar tergambar**, dengan
  batas 12 detik. Ini perlu karena frame pertama WebGL bisa stall ~10 detik
  (kompilasi shader); kalau preloader menutup lebih awal, halaman terlihat beku.
- `gl.setSize()` dipanggil saat `onCreated` supaya frame pertama tidak buram
  (300×150)
- canvas di-pause saat tab disembunyikan
- tidak ada WebGL2 → latar gradien statis, teks + navigasi tetap jalan
- semua animasi teks dimulai dari keadaan terlihat; tidak ada konten yang bisa
  "hilang" kalau JS telat
- scrim dua lapis (bawah + kiri) menjaga teks tetap terbaca walau nebula di
  belakangnya terang

---

## 5. Cara saya memverifikasi (tanpa melihat layar)

Saya tidak bisa menilai keindahan, jadi yang diukur adalah hal-hal yang bisa
salah tanpa terlihat:

- **tangkap layar sungguhan** lewat Chrome DevTools Protocol
  (`Page.captureScreenshot`) di 1440×900 dan 390×844, menunggu sampai posisi
  kamera benar-benar sampai di target (bukan `sleep`).
- **luminance map**: rata-rata kecerahan per region, persentase piksel > 45,
  persentase piksel putih. Dipakai untuk memastikan tidak ada area yang
  "blowout" dan area teks tetap gelap.
- **probe scene graph** (`src/scene/Probe.tsx`, aktif hanya saat dev): menghitung
  ukuran tiap objek di layar dalam derajat dan persen, supaya komposisinya bisa
  dicek angka — bukan tebakan. Dari console browser:

  ```js
  __probe()            // daftar objek terbesar di layar
  __probe('Sphere')    // filter berdasarkan tipe geometri
  __cam()              // posisi & FOV kamera
  __toggle('Sphere')   // sembunyikan sekelompok objek (uji isolasi)
  __setDim(0)          // matikan kontribusi cahaya permukaan planet
  ```

  Probe ini terbuang otomatis di build produksi (`import.meta.env.DEV`).
- **probe gerak** (`window.__nav`, `window.__cam` — hanya dev): membaca
  progress, velocity, jarak kamera ke titik lihat, dan sudut kamera langsung
  dari frame. Dipakai untuk membuktikan redaman dan orbit dengan angka,
  bukan menebak dari gambar.
- **pembanding komposisi**: titik berat area terang (luminance > 120) tiap
  frame dibandingkan dengan frame v7 pada posisi scroll yang sama. Diff piksel
  mentah tidak dipakai karena planet berputar terus antar-run.
- **FPS** diukur setelah warm-up di setiap bab.

Hasil terakhir (v8): 180 fps di semua bab (1440×900, RTX 4060), 0 error
halaman, tidak ada piksel putih bertumpuk, dan teks tidak keluar layar di 4
ukuran viewport — diuji di **kedua bahasa**. Lompatan 4 bab (p 0 → 0,4651)
mendarat dalam 1,54 detik tanpa lompatan; kamera mengorbit dengan jarak tetap
(12,0562 → 12,0564, beda 0,0016%); posisi titik berat frame bergeser 4–13 px
dibanding v7. Bukti tangkapan layar ada di `preview/index.html`, angka lengkap
di `preview/v8/motion.txt`.

---

## 6. Ukuran bundle (build produksi)

| Bagian | Isi | gzip |
| --- | --- | --- |
| `index.js` | React + Overlay + i18n + logika scroll | **9,6 kB** |
| `style.css` | seluruh tampilan | **3,2 kB** |
| `JourneyCanvas.js` (lazy) | seluruh scene + shader | 8,6 kB |
| `three.js` (lazy) | three r169 | 171,2 kB |
| `r3f.js` (lazy) | @react-three/fiber + drei | 86,0 kB |
| `post.js` (lazy) | postprocessing (bloom, aberration) | 17,1 kB |
| `og-image.jpg` | gambar social card 1200×630 | 116 kB (hanya untuk crawler) |

Yang diunduh sebelum teks muncul: **≈ 9 kB**. three.js menyusul setelahnya,
ditutupi preloader.

---

## 7. Deploy

Situs ini statis (hasil build ada di `dist/`), tidak butuh server atau database.

**GitHub Pages (otomatis)** — `.github/workflows/deploy.yml` membangun dan
mendeploy setiap push ke `main`. Setelah repo dibuat, buka
**Settings → Pages → Source: GitHub Actions**. Workflow mendeteksi nama repo:

- `username.github.io` → `https://username.github.io/`
- repo lain (mis. `portfolio`) → `https://username.github.io/portfolio/`

Base path (`VITE_BASE`) dan `og:image` absolut (`SITE_URL`) diisi workflow,
jadi tidak perlu diedit manual. Kalau build lokal untuk subfolder:
`VITE_BASE=/nama-repo/ npm run build`.

**Netlify / Vercel / Cloudflare Pages** — build `npm run build`, publish `dist`,
tanpa env tambahan (base `/`).

Gambar di `public/shots/` dipanggil lewat helper `asset()` di `src/content.ts`
yang menambahkan `import.meta.env.BASE_URL`; path absolut baru seperti
`/shots/foo.webp` akan rusak kalau situs di-host di subfolder.

---

## 8. Kalau nanti mau pakai model 3D sendiri (.glb)

Sekarang objeknya prosedural. Untuk mengganti satu bab dengan model `.glb`:

1. Kompres dulu (jangan taruh glb mentah 20 MB):

   ```powershell
   npx.cmd gltf-transform optimize model.glb model.opt.glb --compress draco --texture-compress webp
   ```

2. Taruh di `public/models/`.
3. Di `World.tsx`, ganti `<PlanetBody …/>` pada stasiun itu dengan:

   ```tsx
   import { useGLTF } from '@react-three/drei'
   const { scene } = useGLTF('/models/model.opt.glb')
   // <primitive object={scene} scale={s} />
   ```

4. `draco` butuh decoder: salin `node_modules/three/examples/jsm/libs/draco/`
   ke `public/draco/` dan set `useGLTF.setDecoderPath('/draco/')`.

Perhatian: model `.glb` biasanya butuh material sendiri; shader planet di
`shaders.ts` tidak akan otomatis berlaku untuknya.

---

## 9. Checklist sebelum publish

- [ ] `copy.en` **dan** `copy.id` sudah benar (nama, email, headline, project)
- [ ] urutan `projects` sama di kedua bahasa
- [ ] `links` diisi (sekarang GitHub + TikTok)
- [ ] `<title>` + `description` + `og:*` + `twitter:*` di `index.html` sudah diganti
- [ ] favicon sudah sesuai (sekarang monogram "AN")
- [ ] `public/og-image.jpg` sesuai (1200×630 — jalankan `make-og.ps1` lagi
      setelah ganti desain/nama)
- [ ] dites di HP: teks tidak menabrak bar bawah
- [ ] dites dengan `prefers-reduced-motion: reduce` (DevTools → Rendering)
- [ ] `npm.cmd run build` lolos, `npm.cmd run preview` dicek sekali
- [ ] tombol ID/EN dicoba di build produksi (juga `?lang=id` / `?lang=en`)

### Status isi (v8)

Halaman sudah memakai data pemilik, dua bahasa, dengan teks yang dibuat untuk
dibaca — bukan formalitas.

- Identitas: Aris Nanda Saputra, `arischopper1@gmail.com`, Lampung Timur,
  "Solo Developer | AI Automation", monogram AN.
- Headline EN "If the tool / doesn’t exist, / I build it." · ID "Kalau alatnya /
  belum ada, / saya bikin." — satu kalimat posisi, bukan daftar jabatan.
- `tagline` menjelaskan asal-usulnya ("I didn’t start in an engineering team" /
  "Saya tidak mulai dari tim engineering") lalu menyebut bukti konkret: asisten
  suara, pipeline klip, Python · Gemini Live · Whisper.
- `statement` + `statementNote` memakai JARVIS sebagai bukti cara kerja (niat →
  izin → eksekusi → verifikasi) dan menutup dengan pembeda: "That’s the
  difference between a tool you can trust and a demo that looks smart."
- `contactHeading` sekarang pertanyaan yang menyentuh pekerjaan pembaca ("Got
  work that / should already / run itself?"), dan `contactNote` meminta satu
  pekerjaan yang paling menyita waktu + janji balasan 1–2 hari kerja (WIB).
- 6 fakta di bab Approach: domisili, fokus, stack, 6 produk, jangkauan (5.467
  pengikut · 433.800 tayangan satu video), pendidikan.
- 6 project → 9 bab: intro, JARVIS, Chopster, Racuninaja, Chopsterin,
  Gabutstream, Kamoeta Uga, Approach, Contact. Semua punya `href`.
- `links`: GitHub + TikTok → baris "Elsewhere / Tautan" muncul.
- Tampilan: arang hangat + putih gading, mint tenang, angka pasir, tombol
  email berbentuk pil kaca, garis pemisah bergradasi, dan lapisan `.grade`
  tipis di atas kanvas.
- Gerak (v8): scroll melewati dua tahap redaman dengan rem lompatan, kamera
  mengorbit pointer dengan jarak tetap, goyang noise yang tidak berulang,
  bloom mengikuti kecepatan, dan judul muncul lebih dulu daripada baris meta.
- `index.html` (title, description, og, twitter, favicon AN, noscript dua
  bahasa) dan `public/og-image.jpg` sudah diperbarui.

Yang masih perlu keputusan pemilik:

- `projects[].year` — sengaja tidak dipakai. Semua project dibuat dalam
  beberapa bulan terakhir, jadi baris "Year" tidak ditampilkan dan kicker
  cukup "Selected work".
- Tautan Gabutstream — sudah dikonfirmasi pemilik memakai blog
  (`https://gabutstream.blogspot.com/`), jadi tidak perlu diganti.
- Bahasa default untuk pengunjung baru: sekarang mengikuti bahasa browser, dan
  jatuh ke Indonesia kalau browser bukan Indonesia/Inggris. Bilang kalau mau
  selalu Indonesia.

Verifikasi v8: `tsc` bersih, build OK, 9 bab, 0 error halaman, `white%` 0,00 di
semua frame, 30 baris judul diperiksa dan **0 yang membungkus** (1440×900 dan
390×844, dua bahasa), tidak ada luapan teks di 1440×900 (sisa 77–342 px) maupun
390×844 (sisa 142–359 px), tidak ada nilai meta yang terpotong, dan
`?lang=id` / `?lang=en` dihormati build produksi. Untuk gerak: lompatan 4 bab
mendarat dalam 1,54 detik, jarak kamera tetap saat pointer dipindah
(12,0562 → 12,0564), dan komposisi bergeser 4–13 px dibanding v7. Bukti:
`preview/v7/v7en-*`, `v7id-*`, `v7men-*`, `v7mid-*`, `v7prod-*` (tata letak) dan
`preview/v8/v8en-*`, `motion-*.png`, `motion.txt` (gerak).

---

## 10. Batasan yang jujur

- Semua materi dibuat **prosedural** (shader). Tidak ada model, tekstur, atau
  sound design — saya tidak bisa membuat aset seperti itu.
- "Mirip igloo.inc" di sini berarti **struktur pengalamannya**: layar penuh,
  scroll menggerakkan kamera, teks sebagai lapisan tipografis, palet gelap
  dengan objek bercahaya. Bukan tiruan asetnya.
- Situs ini butuh WebGL2 + JavaScript. Tanpa itu, yang tampil hanya versi teks.
- Belum ada: halaman detail per project, CMS, analitik, dan audio.
- Keindahan tidak bisa saya ukur. Yang saya ukur: tidak ada error, tidak ada
  piksel putih bertumpuk, teks tidak keluar layar di 4 ukuran viewport, gambar
  benar-benar berubah antar posisi scroll, dan ukuran objek di layar.
