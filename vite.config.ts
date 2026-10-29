import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config berjalan di Node; @types/node sengaja tidak ditambahkan hanya untuk ini.
declare const process: { env: Record<string, string | undefined> }

/**
 * GitHub Pages menyajikan project site dari /<repo>/, jadi base diisi CI lewat
 * VITE_BASE. SITE_URL (opsional) membuat og:image absolut karena sebagian
 * crawler menolak path relatif.
 */
function socialMeta(siteUrl: string): Plugin {
  const url = siteUrl.replace(/\/+$/, '')
  return {
    name: 'social-meta',
    transformIndexHtml(html) {
      if (!url) return html
      return html
        .replace(/"\/og-image\.jpg"/g, `"${url}/og-image.jpg"`)
        .replace(
          '</head>',
          `    <meta property="og:url" content="${url}/" />\n    <link rel="canonical" href="${url}/" />\n  </head>`,
        )
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), socialMeta(process.env.SITE_URL ?? '')],
  server: {
    // `portfolio 3D.zip` di root project terkunci proses lain; watcher chokidar
    // melempar EBUSY saat mencoba mengawasinya dan mematikan seluruh dev server.
    watch: { ignored: ['**/*.zip', '**/preview/**', '**/node_modules/**'] },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
})
