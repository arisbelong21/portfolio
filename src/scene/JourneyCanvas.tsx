import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { detectQuality } from '../lib/quality'
import { stations } from '../lib/journey'
import World from './World'

type Props = {
  onReady: () => void
}

/**
 * Menyuruh preloader menunggu sampai scene benar-benar sudah tergambar.
 * Frame pertama WebGL bisa memakan beberapa detik (kompilasi shader di driver);
 * kalau preloader pergi lebih dulu, user melihat halaman yang membeku.
 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const [state] = useState({ n: 0, done: false })

  useFrame(() => {
    if (state.done) return
    state.n += 1
    if (state.n >= 4) {
      state.done = true
      onReady()
    }
  })

  return null
}

export default function JourneyCanvas({ onReady }: Props) {
  const quality = useMemo(() => detectQuality(), [])
  const [running, setRunning] = useState(true)
  const start = stations[0]?.camera ?? [0, 1, 12]

  // Jangan bakar GPU saat tab disembunyikan.
  useEffect(() => {
    const onChange = () => setRunning(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  // Jaring pengaman: kalau useFrame tidak pernah jalan (GPU bermasalah),
  // jangan biarkan preloader menahan user selamanya.
  useEffect(() => {
    const t = window.setTimeout(onReady, 12000)
    return () => window.clearTimeout(t)
  }, [onReady])

  return (
    <Canvas
      className="stage"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      dpr={quality.dpr}
      frameloop={running ? 'always' : 'never'}
      camera={{ position: start, fov: 44, near: 0.1, far: 600 }}
      gl={{
        antialias: !quality.post,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.88,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#020409'))
        // Ukuran awal langsung diset: kalau menunggu ResizeObserver, frame
        // pertama bisa tampil 300x150 (buram) sebelum di-resize.
        gl.setSize(window.innerWidth, window.innerHeight, false)
      }}
    >
      <ReadySignal onReady={onReady} />
      <World quality={quality} />
    </Canvas>
  )
}

