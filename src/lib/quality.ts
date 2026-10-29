// Deteksi kemampuan perangkat untuk memilih "tier" kualitas.
// Tujuannya cuma memutuskan berapa DPR, berapa banyak partikel, dan perlu
// postprocessing atau tidak — bukan benchmark.

export type QualityTier = 'high' | 'mid' | 'low'

export type Quality = {
  tier: QualityTier
  /** [min, max] device pixel ratio untuk <Canvas dpr> */
  dpr: [number, number]
  /** bloom + vignette + grain + chromatic aberration */
  post: boolean
  /** jumlah partikel debu */
  dust: number
  /** jumlah bintang jauh */
  stars: number
  /** jumlah gumpalan nebula */
  veils: number
  /** detail geometri icosahedron */
  detail: number
  /** jumlah cincin yang dilewati kamera */
  gates: number
  /** renderer string, untuk badge di dev */
  renderer: string
}

export function supportsWebGL2(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null
    return !!gl && typeof gl.getParameter === 'function'
  } catch {
    return false
  }
}

function readRenderer(): string {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return ''
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
  } catch {
    return ''
  }
}

export function detectQuality(): Quality {
  const renderer = readRenderer()
  const r = renderer.toLowerCase()

  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8

  // Software rasterizer atau GPU lama → jangan pernah pasang efek mahal.
  const isSoftware = /swiftshader|llvmpipe|software|basic render/.test(r)
  const isWeak = /mali|adreno|powervr|intel(r)? (hd|uhd) graphics [3-6]/.test(r)

  if (isSoftware || cores <= 4 || mem <= 4) {
    return {
      tier: 'low',
      dpr: [1, 1.25],
      post: false,
      dust: 420,
      stars: 520,
      veils: 2,
      detail: 6,
      gates: 4,
      renderer,
    }
  }
  if (coarse || isWeak) {
    return {
      tier: 'mid',
      dpr: [1, 1.5],
      post: false,
      dust: 850,
      stars: 900,
      veils: 3,
      detail: 9,
      gates: 6,
      renderer,
    }
  }
  return {
    tier: 'high',
    // min 1.5: layar 1x pun di-supersample lalu di-downscale → tepi planet,
    // bintang, dan teks jauh lebih tajam (kunci kesan "4K/jernih").
    dpr: [1.5, 2],
    post: true,
    dust: 1700,
    stars: 1700,
    veils: 7,
    detail: 14,
    gates: 8,
    renderer,
  }
}
