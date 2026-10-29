# Portfolio — Aris Nanda Saputra

Portofolio pribadi dalam bentuk satu ruang 3D layar penuh. Scroll menggerakkan
kamera dari satu karya ke karya berikutnya — bukan halaman berisi section yang
di-scroll.

**Situs:** https://arisbelong21.github.io/portfolio/

## Tentang

- Kamera terbang mengikuti scroll, melambat di setiap bab tapi tidak pernah berhenti.
- Tiap karya punya satu komposisi kamera dan satu bab teks sendiri.
- Planet, bintang, nebula, dan cincin dibuat prosedural lewat shader — tanpa file
  model atau tekstur eksternal.
- Dua bahasa (Indonesia / Inggris), berganti seketika tanpa reload.
- Galeri tangkapan layar asli per proyek, tersimpan sebagai WebP.

## Teknologi

React 18 · TypeScript · Vite 5 · three.js r169 · @react-three/fiber ·
postprocessing

Seluruh konten (teks, proyek, tautan, galeri) berada di satu file: `src/content.ts`.

## Struktur

```
src/
  content.ts   isi situs: teks dua bahasa, proyek, galeri
  components/  lapisan teks dan panel
  scene/       dunia 3D, kamera, shader
  lib/         bahasa, jalur kamera, kualitas render
public/shots/  gambar galeri proyek
```

## Menjalankan secara lokal

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

Build produksi menghasilkan folder `dist/` yang statis.

## Deploy

Setiap push ke `main` membangun dan menerbitkan situs lewat GitHub Actions
(`.github/workflows/deploy.yml`). Base path dan URL sosial dihitung otomatis
dari nama repo.

## Hak cipta

© 2026 Aris Nanda Saputra. Seluruh hak dilindungi.

Repositori ini dipublikasikan sebagai arsip karya dan bahan penilaian.
Tidak ada lisensi open-source yang diberikan: kode, desain, teks, dan gambar
tidak boleh disalin, dipakai ulang, atau didistribusikan ulang tanpa izin
tertulis dari pemilik.
