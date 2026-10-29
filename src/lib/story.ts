// ---------------------------------------------------------------------------
// Status panel "cerita" (deskripsi diri).
//
// Dipakai bersama oleh scene 3D (batu yang diklik) dan Overlay (panelnya).
// Sengaja modul kecil tanpa React: batu ada di dalam kanvas WebGL, panel ada
// di DOM — keduanya tidak berada dalam satu pohon komponen.
// ---------------------------------------------------------------------------

let open = false
const listeners = new Set<(v: boolean) => void>()

export const isStoryOpen = () => open

export function setStoryOpen(v: boolean) {
  if (v === open) return
  open = v
  listeners.forEach((fn) => fn(v))
}

export function toggleStory() {
  setStoryOpen(!open)
}

export function subscribeStory(fn: (v: boolean) => void) {
  listeners.add(fn)
  fn(open)
  return () => {
    listeners.delete(fn)
  }
}

// Jejak untuk otomasi/screenshot saat dev: memaksa panel terbuka tanpa klik.
if (import.meta.env.DEV) {
  ;(window as unknown as { __story?: (v?: boolean) => boolean }).__story = (v) => {
    if (typeof v === 'boolean') setStoryOpen(v)
    return isStoryOpen()
  }
}
