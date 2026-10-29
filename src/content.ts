// ---------------------------------------------------------------------------
// SEMUA ISI HALAMAN ADA DI FILE INI — DUA BAHASA (id / en).
//
// Cara pakai:
//   1. Ganti nilai di `copy.id` dan `copy.en` (keduanya harus punya bentuk
//      yang sama). Tidak perlu menyentuh file lain.
//   2. Setelah ganti nama/email, buka index.html dan ganti juga:
//      <title>, <meta name="description">, og:*, twitter:*, monogram favicon,
//      dan email di <noscript>.
//   3. Jalankan: npm.cmd run dev -- --port 5199
//
// Catatan gaya (penting kalau nanti mengedit):
//   - Tulis seperti orang bicara, bukan seperti brosur. Kalimat pendek,
//     kata kerja konkret, angka nyata. Hindari "passionate", "visioner",
//     "rockstar", "solusi inovatif".
//   - Setiap paragraf pembuka project sebaiknya dimulai dari masalah yang
//     terasa, baru menjelaskan apa yang dibangun.
//   - headline: 2–3 baris, ideal ≤ 14 karakter per baris. Lebih dari itu
//     baris akan turun sendiri, tapi komposisinya jadi kurang rapi.
//   - Setiap project menjadi satu "bab" penuh di dalam perjalanan kamera 3D.
//     Jadi judul project sebaiknya 1–3 kata; judul panjang otomatis dipotong
//     jadi dua baris.
//   - projects[].href opsional. Kalau diisi, muncul tautan "Open project".
//   - projects[].year opsional. Kalau dikosongkan, baris "Year" hilang dan
//     kicker cukup berbunyi "Selected work".
//   - Jumlah project bebas (2–8 paling enak); menambah project otomatis
//     menambah satu bab dan memanjangkan perjalanan.
//   - projects dan links wajib berurutan sama di kedua bahasa, karena kamera
//     3D memakai urutan yang sama.
// ---------------------------------------------------------------------------

export type Project = {
  title: string
  year?: string
  role: string
  summary: string
  tags: string[]
  href?: string
  /** status rilis yang jujur (opsional), tampil sebagai chip abu-abu di panel */
  status?: string
  /** narasi terstruktur untuk panel Summary: masalah → bangun → cara → hasil */
  story: { problem: string; built: string; how: string; result?: string }
}

export type ProjectShot = {
  /** path relatif terhadap public/ */
  src: string
  /** lebar / tinggi — memesan ruang sebelum gambar selesai dimuat */
  ratio: number
  /** keterangan singkat yang tampil di atas gambar */
  label: { en: string; id: string }
}

/** Awalan base Vite agar gambar tetap ketemu saat di-host di subfolder. */
const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '')

/**
 * Galeri gambar produk asli di panel Summary, satu entri per proyek sesuai
 * urutan `projects` (gambar pertama = sampul). `undefined` berarti proyek itu
 * tidak punya galeri dan panelnya tetap rapi tanpa ikon rusak.
 * Sumber file: public/shots/ — ganti nama di sini kalau filenya diganti.
 */
export const projectShots: Array<ProjectShot[] | undefined> = [
  [
    { src: asset('/shots/jarvis.webp'), ratio: 16 / 9, label: { en: 'Product overview', id: 'Ringkasan produk' } },
    { src: asset('/shots/jarvis-hud.webp'), ratio: 1600 / 845, label: { en: 'Main HUD', id: 'HUD utama' } },
    {
      src: asset('/shots/jarvis-connections.webp'),
      ratio: 1600 / 913,
      label: { en: 'Connections', id: 'Koneksi' },
    },
    {
      src: asset('/shots/jarvis-plugins.webp'),
      ratio: 1600 / 910,
      label: { en: 'Plugin manager', id: 'Manajer plugin' },
    },
  ],
  [
    {
      src: asset('/shots/chopster.webp'),
      ratio: 16 / 9,
      label: { en: 'Product overview', id: 'Ringkasan produk' },
    },
    {
      src: asset('/shots/chopster-clipper.webp'),
      ratio: 1600 / 645,
      label: { en: 'Viral clip scoring', id: 'Skor klip viral' },
    },
    {
      src: asset('/shots/chopster-studio.webp'),
      ratio: 1600 / 652,
      label: { en: 'Auto Clip Studio', id: 'Auto Clip Studio' },
    },
    {
      src: asset('/shots/chopster-subtitles.webp'),
      ratio: 1600 / 644,
      label: { en: 'Subtitle engine', id: 'Mesin subtitle' },
    },
  ],
  [
    {
      src: asset('/shots/racuninaja-storefront.webp'),
      ratio: 1600 / 974,
      label: { en: 'Storefront', id: 'Etalase' },
    },
    {
      src: asset('/shots/racuninaja-shelves.webp'),
      ratio: 1400 / 991,
      label: { en: 'Budget shelves', id: 'Rak anggaran' },
    },
  ],
  [
    {
      src: asset('/shots/chopsterin-download.webp'),
      ratio: 1310 / 900,
      label: { en: 'TikTok downloader', id: 'Pengunduh TikTok' },
    },
  ],
  [
    {
      src: asset('/shots/gabutstream-catalogue.webp'),
      ratio: 1229 / 790,
      label: { en: 'Catalogue home', id: 'Beranda katalog' },
    },
    {
      src: asset('/shots/gabutstream-film.webp'),
      ratio: 845 / 675,
      label: { en: 'Film page', id: 'Halaman film' },
    },
  ],
  [
    {
      src: asset('/shots/kamoeta-uga-profile.webp'),
      ratio: 1600 / 1195,
      label: { en: 'Profile & clip grid', id: 'Profil & grid klip' },
    },
  ],
]

/** Proyek yang paling kuat menggambarkan arah kerja (ditonjolkan di panel). */
export const projectFlags: boolean[] = [true, true, false, false, false, false]

export type Capability = {
  group: string
  items: string[]
}

export type Link = {
  label: string
  href: string
}

/** Label kecil di kolom meta tiap bab. */
export type Labels = {
  name: string
  role: string
  basedIn: string
  status: string
  year: string
  stack: string
  location: string
  elsewhere: string
  selectedWork: string
  portfolio: string
}

export type SiteCopy = {
  name: string
  monogram: string
  role: string
  email: string
  location: string
  availability: string
  headline: string[]
  tagline: string
  statement: string
  statementNote: string
  /** paragraf penutup di panel Manifesto (cara kerja + ukuran keberhasilan) */
  closingNote: string
  studioHeading: string[]
  contactHeading: string[]
  contactNote: string
  facts: Array<{ k: string; v: string }>
  projects: Project[]
  capabilities: Capability[]
  links: Link[]
  labels: Labels
  footerNote: string
}

const projects: { en: Project[]; id: Project[] } = {
  en: [
    {
      title: 'JARVIS',
      role: 'Solo — architecture, code, release',
      summary:
        'A computer should answer to your voice, not to ten clicks. JARVIS listens, uses the screen as context, then acts: opens apps, changes settings, drives browser tabs, renames and files documents with undo, and plans tasks that take several steps. Every request runs one chain — intent, permission, execution, verification, reply — before it answers. A holographic face and waveform show when it is listening, thinking, or speaking; skills and plugins add tools without touching the core.',
      tags: ['Python', 'Gemini Live API', 'Computer control', 'Plugins', 'Memory'],
      href: 'https://github.com/arisbelong21/jarvis',
      status: 'In development',
      story: {
        problem:
          'Most assistants stop at answers. The actual work — apps, tabs, files, settings — still waits for manual clicks.',
        built:
          'A voice-first desktop assistant: Gemini Live for real-time speech with mic and speaker choice, push-to-talk, an optional wake word, and a custom API as the brain. Skills, a plugin manager, connectors for Gmail, Calendar, Drive, GitHub and Telegram, plus recallable local memory.',
        how: 'Every request passes intent → permission → execute → verify → reply. Sensitive actions ask first, supported actions can be undone, and each step is written to the activity log, remote commands included. If a model times out, it falls back instead of failing silently.',
        result:
          'Public repo under CC BY-NC 4.0, still in active development: features are tested per release and documented as they ship, not promised as finished.',
      },
    },
    {
      title: 'Chopster',
      role: 'Solo — product, engine, release',
      summary:
        'One video becomes ten clips, captioned and posted to four platforms — without four tabs. Chopster downloads the source with yt-dlp, reads audience retention to rank the moments worth cutting, transcribes locally with Whisper, and styles captions with an animated word-level engine. The AI writes the title, description, hashtags, SEO and pinned comment per platform; the automation wizard handles clip → account → schedule → review → upload, and says when a platform still needs authentication instead of pretending it posted.',
      tags: ['Python', 'Whisper', 'OAuth', 'Scheduling', 'yt-dlp'],
      href: 'https://github.com/arisbelong21/chopsterizzz',
      status: 'Windows source release',
      story: {
        problem:
          'Turning one video into publishable content meant a downloader, a cutter, a subtitle tool, and an uploader — four apps and the same manual steps every time.',
        built:
          'A single Windows app: yt-dlp download queue → retention-ranked clips → local Whisper transcript → animated subtitles with a live 9:16 preview → AI content pack → publish. A Chrome extension sends links straight into the queue.',
        how: 'The automation wizard goes clip → platform and account → immediate or scheduled → review → upload → verification, and keeps a history per run. Credentials are stored encrypted on Windows. If a platform needs approval or a fresh login, the app says so — it never reports a post that did not happen.',
        result:
          'Shipped as a Windows source release, not a prebuilt EXE. Each platform integration depends on its own developer credentials and review, so I test locally before promising a feature.',
      },
    },
    {
      title: 'Racuninaja',
      role: 'Owner — build, curation, marketing',
      summary:
        'A Shopee storefront sorted by what people actually spend: under Rp20,000, under Rp50,000, and whatever is trending this week. Every card carries the rating, units sold, and a direct affiliate link, so the buying decision happens on one page.',
      tags: ['Blogspot', 'Shopee affiliate', 'Product curation'],
      href: 'https://racuninaja.blogspot.com/',
      story: {
        problem: 'Shopee lists millions of products; shoppers on a small budget can’t tell what’s worth buying.',
        built: 'A curated storefront grouped by real budgets — under Rp20,000, under Rp50,000 — plus a weekly trending shelf.',
        how: 'Each card carries rating, units sold, and a direct affiliate link, so the decision happens on one page.',
      },
    },
    {
      title: 'Chopsterin',
      role: 'Solo — interface & tool',
      summary:
        'Sometimes the job is one thing: a TikTok video without the watermark, right now. Copy the link, paste it, download — three steps, nothing to install, still clean on a phone.',
      tags: ['Web app', 'Responsive', 'Tool'],
      href: 'https://chopsterin.blogspot.com/',
      story: {
        problem: 'People want one TikTok video without the watermark, right now, without installing anything.',
        built: 'A three-step web tool: paste the link, process, download.',
        how: 'It runs in the browser on any phone — no install, no account, no menu — and rejects a link it can’t handle with a clear message instead of spinning.',
      },
    },
    {
      title: 'Gabutstream',
      role: 'Solo — build & catalogue',
      summary:
        'A film and series catalogue with one page per title, genre markers, and release dates, built light enough to open fast on mobile data — because a slow catalogue may as well not exist.',
      tags: ['Blogspot', 'Catalogue', 'UI'],
      href: 'https://gabutstream.blogspot.com/',
      story: {
        problem: 'Choosing what to watch shouldn’t cost a heavy app or a slow page on mobile data.',
        built: 'A light catalogue with one page per title, genre markers, and release dates.',
        how: 'Static-first pages keep it fast on a weak connection; genre and release metadata do the sorting, so browsing stays shallow.',
      },
    },
    {
      title: 'Kamoeta Uga',
      role: 'Owner — dubbing & editing',
      summary:
        'An Indonesian football dubbing account that grew from zero to 5.4K followers in one month. The profile shows 76.1K likes, the top clip passed 927K views, and three more sit above 70K. Every clip — cut, scripted, dubbed, uploaded — edited alone.',
      tags: ['TikTok', 'YouTube', 'Dubbing', 'Video editing'],
      href: 'https://www.tiktok.com/@kamoe_tauga',
      story: {
        problem: 'Football clips travel further when the commentary speaks the audience’s language.',
        built: 'An Indonesian football dubbing account — clip selection, script, dub, edit, and publish, handled solo.',
        how: 'Each video’s performance data decides the next experiment: hook, pacing, and subject.',
        result:
          'Grew from zero to 5.4K followers in one month; the profile shows 76.1K likes, and the top clip passed 927K views.',
      },
    },
  ],
  id: [
    {
      title: 'JARVIS',
      role: 'Solo — arsitektur, kode, rilis',
      summary:
        'Komputer seharusnya menjawab suara Anda, bukan menunggu sepuluh klik. JARVIS mendengar, memakai layar sebagai konteks, lalu bertindak: membuka aplikasi, mengubah pengaturan, mengendalikan tab peramban, menamai dan merapikan berkas dengan undo, serta menyusun tugas yang butuh beberapa langkah. Setiap permintaan melewati satu rantai — niat, izin, eksekusi, verifikasi, jawaban — sebelum ia menjawab. Wajah holografik dan waveform menunjukkan kapan ia mendengar, berpikir, atau bicara; skills dan plugin menambah alat tanpa menyentuh inti.',
      tags: ['Python', 'Gemini Live API', 'Kendali komputer', 'Plugin', 'Memori'],
      href: 'https://github.com/arisbelong21/jarvis',
      status: 'Dalam pengembangan',
      story: {
        problem:
          'Kebanyakan asisten berhenti di jawaban. Pekerjaan sebenarnya — aplikasi, tab, berkas, pengaturan — masih menunggu klik manual.',
        built:
          'Asisten desktop berbasis suara: Gemini Live untuk suara real-time dengan pilihan mikrofon dan speaker, push-to-talk, wake word opsional, dan API custom sebagai otak. Skills, plugin manager, konektor Gmail, Calendar, Drive, GitHub, dan Telegram, serta memori lokal yang bisa dipanggil kembali.',
        how: 'Setiap permintaan melewati niat → izin → eksekusi → verifikasi → jawaban. Tindakan sensitif meminta konfirmasi, tindakan yang didukung bisa di-undo, dan setiap langkah tercatat di activity log, termasuk perintah jarak jauh. Kalau model timeout, sistem beralih ke cadangan, bukan gagal diam-diam.',
        result:
          'Repo publik berlisensi CC BY-NC 4.0, masih dalam pengembangan aktif: fitur diuji per rilis dan didokumentasikan saat siap, bukan dijanjikan sebagai selesai.',
      },
    },
    {
      title: 'Chopster',
      role: 'Solo — produk, mesin, rilis',
      summary:
        'Satu video jadi sepuluh klip, lengkap dengan caption, lalu terkirim ke empat platform — tanpa membuka empat tab. Chopster mengunduh sumber dengan yt-dlp, membaca retensi penonton untuk memeringkat momen yang layak dipotong, mentranskripsi lokal dengan Whisper, dan menata caption lewat mesin animasi per kata. AI menulis judul, deskripsi, hashtag, SEO, dan pinned comment sesuai platform; wizard automation menangani klip → akun → jadwal → review → unggah, dan menampilkan kalau suatu platform masih butuh autentikasi, bukan berpura-pura sudah terkirim.',
      tags: ['Python', 'Whisper', 'OAuth', 'Penjadwalan', 'yt-dlp'],
      href: 'https://github.com/arisbelong21/chopsterizzz',
      status: 'Rilis sumber Windows',
      story: {
        problem:
          'Mengubah satu video jadi konten siap tayang berarti alat unduh, pemotong, alat subtitle, dan pengunggah — empat aplikasi dengan langkah manual yang sama setiap kali.',
        built:
          'Satu aplikasi Windows: antrean unduh yt-dlp → klip berperingkat retensi → transkrip Whisper lokal → subtitle animasi dengan pratinjau 9:16 → paket konten AI → publikasi. Ekstensi Chrome mengirim tautan langsung ke antrean.',
        how: 'Wizard automation berjalan klip → platform dan akun → langsung atau terjadwal → review → unggah → verifikasi, dan menyimpan riwayat tiap proses. Kredensial disimpan terenkripsi di Windows. Kalau platform butuh persetujuan atau login ulang, aplikasi menampilkannya — tidak pernah melaporkan posting yang tidak terjadi.',
        result:
          'Dirilis sebagai paket sumber Windows, bukan EXE siap pakai. Tiap integrasi platform bergantung pada kredensial developer dan audit masing-masing, jadi saya uji lokal dulu sebelum menjanjikan fitur.',
      },
    },
    {
      title: 'Racuninaja',
      role: 'Pemilik — bangun, kurasi, pemasaran',
      summary:
        'Etalase Shopee yang diurutkan berdasarkan harga yang benar-benar dibelanjakan orang: di bawah Rp20 ribu, di bawah Rp50 ribu, dan yang sedang ramai minggu ini. Tiap kartu memuat rating, jumlah terjual, dan tautan afiliasi langsung, sehingga keputusan beli selesai di satu halaman.',
      tags: ['Blogspot', 'Afiliasi Shopee', 'Kurasi produk'],
      href: 'https://racuninaja.blogspot.com/',
      story: {
        problem: 'Shopee memuat jutaan produk; pembeli beranggaran kecil sulit menilai mana yang layak dibeli.',
        built: 'Etalase kurasi yang dikelompokkan menurut anggaran nyata — di bawah Rp20 ribu, di bawah Rp50 ribu — plus rak tren mingguan.',
        how: 'Tiap kartu memuat rating, jumlah terjual, dan tautan afiliasi langsung, sehingga keputusan selesai di satu halaman.',
      },
    },
    {
      title: 'Chopsterin',
      role: 'Solo — antarmuka & tool',
      summary:
        'Kadang yang dibutuhkan cuma satu hal: video TikTok tanpa watermark, sekarang juga. Salin tautan, tempel, unduh — tiga langkah, tanpa pemasangan, tetap rapi di ponsel.',
      tags: ['Web app', 'Responsif', 'Tool'],
      href: 'https://chopsterin.blogspot.com/',
      story: {
        problem: 'Orang menginginkan satu video TikTok tanpa watermark, sekarang juga, tanpa memasang apa pun.',
        built: 'Web tool tiga langkah: tempel tautan, proses, unduh.',
        how: 'Berjalan di peramban ponsel mana pun — tanpa instalasi, tanpa akun, tanpa menu — dan menolak tautan yang tidak didukung dengan pesan jelas, bukan berputar tanpa hasil.',
      },
    },
    {
      title: 'Gabutstream',
      role: 'Solo — bangun & katalog',
      summary:
        'Katalog film dan serial dengan satu halaman untuk tiap judul, penanda genre, dan tanggal rilis. Dibangun ringan supaya tetap cepat dibuka di data seluler — karena katalog yang lambat sama saja dengan tidak ada.',
      tags: ['Blogspot', 'Katalog', 'UI'],
      href: 'https://gabutstream.blogspot.com/',
      story: {
        problem: 'Memilih tontonan seharusnya tidak butuh aplikasi berat atau halaman lambat di data seluler.',
        built: 'Katalog ringan dengan satu halaman per judul, penanda genre, dan tanggal rilis.',
        how: 'Halaman statis membuatnya tetap cepat di koneksi lemah; genre dan metadata rilis yang mengurutkan, jadi penjelajahan tetap dangkal.',
      },
    },
    {
      title: 'Kamoeta Uga',
      role: 'Pemilik — dubbing & editing',
      summary:
        'Akun dubbing sepak bola berbahasa Indonesia yang tumbuh dari nol ke 5,4K pengikut dalam sebulan. Profilnya menunjukkan 76,1K suka, klip teratas menembus 927K tayangan, dan tiga klip lain di atas 70K. Semua klip — potong, tulis, dubbing, unggah — dikerjakan sendiri.',
      tags: ['TikTok', 'YouTube', 'Dubbing', 'Editing video'],
      href: 'https://www.tiktok.com/@kamoe_tauga',
      story: {
        problem: 'Klip sepak bola menyebar lebih jauh saat komentarnya berbahasa penonton.',
        built: 'Akun dubbing sepak bola Indonesia — pilih klip, tulis naskah, dubbing, edit, sampai unggah, dikerjakan sendiri.',
        how: 'Data performa tiap video menentukan eksperimen berikutnya: hook, pacing, dan subjek.',
        result:
          'Tumbuh dari nol ke 5,4K pengikut dalam sebulan; profil menunjukkan 76,1K suka, dan klip teratas menembus 927K tayangan.',
      },
    },
  ],
}

const links: Link[] = [
  { label: 'GitHub', href: 'https://github.com/arisbelong21' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@kamoe_tauga' },
]

export const copy: { en: SiteCopy; id: SiteCopy } = {
  en: {
    name: 'Aris Nanda Saputra',
    monogram: 'AN',
    role: 'Independent developer | AI automation | Product builder',
    email: 'arischopper1@gmail.com',
    location: 'Lampung Timur, Indonesia',
    availability: 'Open to freelance, collaboration & roles',

    headline: ['If the tool', 'doesn’t exist,', 'I build it.'],
    tagline:
      'I build tools, apps, websites, and automation workflows for problems I meet in daily digital work — turning repetitive tasks into systems that actually run. I started on the marketing side, where the work should already have been automated, so I built the tools myself: sketch, test, release.',

    statement:
      'I don’t wait for the perfect tool. If it doesn’t exist, I build it — then test it until it’s genuinely useful.',
    statementNote:
      'Start from a real problem, pick technology by need, integrate what’s missing, verify, then ship. JARVIS is the proof: every request is read for intent, cleared for permission, executed, then checked against evidence before it replies — and when a step fails, it says so. A screen that looks finished isn’t finished; the main function has to work and failures have to be handled.',
    closingNote:
      'I work end to end — problem, interface, engine, testing, release — and the thread across all six projects is the same: turn a practical problem into a workflow, a tool, or a system someone can use. Starting on the marketing side keeps me close to the people who will hold it. A product only counts as successful when it solves the reason it was built.',

    studioHeading: ['From marketing', 'to automation.'],
    contactHeading: ['Got work that', 'should already', 'run itself?'],
    contactNote:
      'Tell me the task that eats the most time — reports rebuilt by hand, clips processed one by one, data copied between systems. If it’s repetitive and spread across tools, it’s worth automating. Open to freelance projects, collaboration, and professional roles.',

    facts: [
      { k: 'Based in', v: 'Lampung Timur, Indonesia — WIB (GMT+7)' },
      { k: 'Stack', v: 'Python · Whisper · Gemini Live · HTML / CSS / JS · Git' },
      { k: 'Building', v: 'JARVIS & Chopster — active development' },
      { k: 'Shipped', v: '6 products, built end to end solo' },
      { k: 'Reach', v: '5.4K followers · 76.1K likes · 927K views on the top clip' },
      { k: 'Education', v: 'S1 Sistem Informasi' },
    ],
    projects: projects.en,
    capabilities: [
      {
        group: 'AI & automation',
        items: [
          'Voice assistants on Gemini Live',
          'Computer control: apps, files, browser',
          'Permission, undo & action verification',
          'Skills and plugin architecture',
        ],
      },
      {
        group: 'Product & web',
        items: [
          'Windows desktop apps in Python',
          'Web tools & content catalogues',
          'Testing, debugging, releases with Git',
          'Interactive web: React & React Three Fiber',
        ],
      },
      {
        group: 'Content & video',
        items: [
          'Download → clip → transcribe workflows',
          'Animated subtitles & 9:16 framing',
          'AI copy per platform: title, caption, hashtag',
          'Scheduling & publish verification',
        ],
      },
      {
        group: 'Growth & marketing',
        items: [
          'Affiliate product curation',
          'Social content development',
          'Audience building from zero',
          'Reading performance data before deciding',
        ],
      },
    ],
    links,
    labels: {
      name: 'Name',
      role: 'Role',
      basedIn: 'Based in',
      status: 'Status',
      year: 'Year',
      stack: 'Stack',
      location: 'Location',
      elsewhere: 'Elsewhere',
      selectedWork: 'Selected work',
      portfolio: 'Portfolio',
    },
    footerNote: 'Built with React Three Fiber. No page builder, no template.',
  },

  id: {
    name: 'Aris Nanda Saputra',
    monogram: 'AN',
    role: 'Pengembang independen | AI otomasi | Pembangun produk',
    email: 'arischopper1@gmail.com',
    location: 'Lampung Timur, Indonesia',
    availability: 'Terbuka untuk proyek lepas, kolaborasi & posisi',

    headline: ['Kalau alatnya', 'belum ada,', 'saya bikin.'],
    tagline:
      'Saya membangun tools, aplikasi, website, dan workflow otomasi untuk masalah yang saya temui dalam pekerjaan digital sehari-hari — mengubah tugas berulang menjadi sistem yang benar-benar berjalan. Saya mulai dari sisi pemasaran, tempat pekerjaan itu seharusnya sudah otomatis, jadi saya bangun sendiri alatnya: sketsa, uji, rilis.',

    statement:
      'Saya tidak menunggu alat yang sempurna. Kalau belum ada, saya membangunnya — lalu mengujinya sampai benar-benar berguna.',
    statementNote:
      'Mulai dari masalah nyata, pilih teknologi sesuai kebutuhan, integrasikan yang kurang, verifikasi, lalu kirimkan. JARVIS buktinya: setiap permintaan dibaca niatnya, diminta izinnya, dijalankan, lalu dicek terhadap bukti sebelum dijawab — dan kalau ada langkah yang gagal, ia bilang gagal. Tampilan yang rapi belum berarti selesai; fungsi utamanya harus bekerja dan kegagalan harus ditangani.',
    closingNote:
      'Saya bekerja dari ujung ke ujung — masalah, antarmuka, mesin, pengujian, rilis — dan benang merah keenam proyek ini sama: ubah masalah praktis menjadi workflow, alat, atau sistem yang bisa dipakai orang. Karena mulai dari sisi pemasaran, saya tetap dekat dengan orang yang nanti memakainya. Produk baru saya anggap berhasil kalau ia menyelesaikan alasan ia dibuat.',

    studioHeading: ['Dari pemasaran', 'ke otomasi.'],
    contactHeading: ['Punya pekerjaan', 'yang harusnya', 'sudah otomatis?'],
    contactNote:
      'Ceritakan pekerjaan yang paling menyita waktu Anda — laporan yang dirakit manual, klip yang diproses satu per satu, data yang dipindahkan antar-sistem. Kalau pekerjaan itu berulang dan tersebar di banyak alat, ia layak diotomatisasi. Terbuka untuk proyek lepas, kolaborasi, maupun posisi profesional.',

    facts: [
      { k: 'Domisili', v: 'Lampung Timur, Indonesia — WIB (GMT+7)' },
      { k: 'Stack', v: 'Python · Whisper · Gemini Live · HTML / CSS / JS · Git' },
      { k: 'Dikerjakan', v: 'JARVIS & Chopster — pengembangan aktif' },
      { k: 'Dirilis', v: '6 produk, dibangun sendiri dari awal sampai akhir' },
      { k: 'Jangkauan', v: '5,4K pengikut · 76,1K suka · 927K tayangan klip teratas' },
      { k: 'Pendidikan', v: 'S1 Sistem Informasi' },
    ],
    projects: projects.id,
    capabilities: [
      {
        group: 'AI & otomasi',
        items: [
          'Asisten suara dengan Gemini Live',
          'Kendali komputer: aplikasi, berkas, peramban',
          'Izin, undo & verifikasi tindakan',
          'Arsitektur skills dan plugin',
        ],
      },
      {
        group: 'Produk & web',
        items: [
          'Aplikasi desktop Windows dengan Python',
          'Web tool & katalog konten',
          'Pengujian, debugging, rilis dengan Git',
          'Web interaktif: React & React Three Fiber',
        ],
      },
      {
        group: 'Konten & video',
        items: [
          'Workflow unduh → potong → transkrip',
          'Subtitle animasi & framing 9:16',
          'Copy AI per platform: judul, caption, hashtag',
          'Penjadwalan & verifikasi publikasi',
        ],
      },
      {
        group: 'Pertumbuhan & pemasaran',
        items: [
          'Kurasi produk afiliasi',
          'Pengembangan konten media sosial',
          'Membangun audiens dari nol',
          'Baca data performa sebelum memutuskan',
        ],
      },
    ],
    links,
    labels: {
      name: 'Nama',
      role: 'Peran',
      basedIn: 'Domisili',
      status: 'Status',
      year: 'Tahun',
      stack: 'Stack',
      location: 'Lokasi',
      elsewhere: 'Tautan',
      selectedWork: 'Karya pilihan',
      portfolio: 'Portofolio',
    },
    footerNote: 'Dibangun dengan React Three Fiber. Tanpa page builder, tanpa template.',
  },
}

export type Lang = keyof typeof copy
