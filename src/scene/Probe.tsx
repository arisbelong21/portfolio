// ---------------------------------------------------------------------------
// Alat bantu verifikasi (hanya aktif saat `npm run dev`).
//
// Kenapa ada: memeriksa komposisi 3D dari screenshot itu tidak akurat —
// objek gelap bisa "hilang" padahal ada, dan bloom mengaburkan ukuran asli.
// Probe ini menghitung ukuran objek di layar secara langsung dari scene graph.
//
// Pakai dari console browser:
//   __probe()            → daftar semua mesh: ukuran (derajat), posisi layar (%)
//   __probe('Sphere')    → filter berdasarkan tipe geometry
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

type Row = {
  type: string
  /** radius dunia (satuan scene) */
  r: number
  /** jarak dari kamera */
  dist: number
  /** pusat objek di layar, persen */
  x: number
  y: number
  /** diameter sudut, derajat */
  size: number
  /** perkiraan lebar di layar, persen dari lebar viewport */
  w: number
}

export default function Probe() {
  const { scene, camera } = useThree()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const win = window as unknown as Record<string, unknown>

    win.__probe = (filter?: string) => {
      const cam = camera as THREE.PerspectiveCamera
      const rows: Row[] = []
      const v = new THREE.Vector3()

      scene.updateMatrixWorld(true)

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh || !mesh.geometry) return
        const geo = mesh.geometry as THREE.BufferGeometry
        if (!geo.boundingSphere) geo.computeBoundingSphere()
        const bs = geo.boundingSphere
        if (!bs) return
        if (filter && !geo.type.toLowerCase().includes(filter.toLowerCase())) return

        const scale = mesh.getWorldScale(v).clone()
        const r = bs.radius * Math.max(scale.x, scale.y, scale.z)
        const center = bs.center.clone().applyMatrix4(mesh.matrixWorld)
        const dist = center.distanceTo(cam.position)
        if (dist < 0.001) return

        const ndc = center.clone().project(cam)
        const halfH = (cam.fov * Math.PI) / 360
        const w = (r / Math.max(dist, 0.001) / Math.tan(halfH)) * (100 / cam.aspect) * 2

        rows.push({
          type: geo.type,
          r: +r.toFixed(2),
          dist: +dist.toFixed(1),
          x: +(50 + ndc.x * 50).toFixed(1),
          y: +(50 - ndc.y * 50).toFixed(1),
          size: +((2 * Math.atan(r / dist) * 180) / Math.PI).toFixed(1),
          w: +w.toFixed(1),
        })
      })

      return rows.sort((a, b) => b.w - a.w).slice(0, 24)
    }

    win.__cam = () => {
      const cam = camera as THREE.PerspectiveCamera
      return {
        pos: cam.position.toArray().map((n) => +n.toFixed(2)),
        fov: +cam.fov.toFixed(2),
        aspect: +cam.aspect.toFixed(3),
      }
    }

    // Isolasi: matikan sekelompok objek untuk tahu mana yang menyumbang
    // kecerahan. __toggle('Sphere') mematikan semua bola.
    win.__toggle = (fragment: string, on?: boolean) => {
      let n = 0
      const f = fragment.toLowerCase()
      scene.traverse((obj) => {
        const mesh = obj as unknown as THREE.Mesh & { isSprite?: boolean; isPoints?: boolean }
        const mat = mesh.material as THREE.ShaderMaterial | undefined
        const u = mat?.uniforms
        const hit =
          (f === 'sky' && !!u?.uColorA) ||
          (f === 'atmo' && !!u?.uColor && !!u?.uOpacity && !u?.uDeep && !u?.uColorA) ||
          (f === 'planet' && !!u?.uDeep) ||
          (f === 'ring' && mesh.geometry?.type === 'RingGeometry') ||
          (mesh.isSprite && f === 'sprite') ||
          (mesh.isPoints && f === 'points') ||
          (mesh.isMesh && !!mesh.geometry && mesh.geometry.type.toLowerCase().includes(f))
        if (!hit) return
        mesh.visible = on === undefined ? !mesh.visible : on
        n++
      })
      return n
    }

    // Dump material: untuk memastikan warna yang dipakai shader memang yang
    // kita maksud (bukan warna default atau uniform yang tertukar).
    win.__dump = () => {
      const rows: Array<Record<string, unknown>> = []
      scene.traverse((obj) => {
        const mesh = obj as unknown as THREE.Mesh & { isSprite?: boolean; isPoints?: boolean }
        if (!mesh.isMesh && !mesh.isSprite && !mesh.isPoints) return
        const mat = mesh.material as THREE.ShaderMaterial
        if (!mat?.uniforms) return
        const u = mat.uniforms
        const hex = (c?: THREE.Color) => (c ? `#${c.getHexString()}` : null)
        const p = new THREE.Vector3()
        mesh.getWorldPosition(p)
        rows.push({
          type: mesh.isSprite ? 'sprite' : mesh.isPoints ? 'points' : 'mesh',
          geo: mesh.geometry?.type,
          vis: mesh.visible,
          pos: p.toArray().map((n) => +n.toFixed(1)),
          scale: +mesh.scale.x.toFixed(2),
          deep: hex(u.uDeep?.value),
          mid: hex(u.uMid?.value),
          light: hex(u.uLight?.value),
          rim: hex(u.uRim?.value),
          dim: u.uDim?.value,
          color: hex(u.uColor?.value),
          colorA: hex(u.uColorA?.value),
          opacity: u.uOpacity?.value,
        })
      })
      return rows
    }

    // Dump semua uniform (nama apa pun) per mesh — untuk audit warna shader baru.
    win.__dumpFull = () => {
      const rows: Array<Record<string, unknown>> = []
      const p = new THREE.Vector3()
      scene.traverse((obj) => {
        const mesh = obj as unknown as THREE.Mesh & { isSprite?: boolean; isPoints?: boolean }
        if (!mesh.isMesh && !mesh.isSprite && !mesh.isPoints) return
        const mat = mesh.material as THREE.ShaderMaterial
        if (!mat?.uniforms) return
        mesh.getWorldPosition(p)
        const uniforms: Record<string, unknown> = {}
        for (const [k, u] of Object.entries(mat.uniforms)) {
          const v = (u as { value?: unknown }).value
          if (v && (v as THREE.Color).isColor) uniforms[k] = `#${(v as THREE.Color).getHexString()}`
          else if (typeof v === 'number') uniforms[k] = +v.toFixed(3)
        }
        rows.push({
          geo: mesh.isSprite ? 'sprite' : mesh.isPoints ? 'points' : mesh.geometry?.type,
          vis: mesh.visible,
          pos: p.toArray().map((n) => +n.toFixed(1)),
          scale: +mesh.scale.x.toFixed(2),
          uniforms,
        })
      })
      return rows
    }

    // Uji kontribusi permukaan planet: paksa uDim ke nilai tertentu.
    win.__setDim = (v: number) => {
      let n = 0
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        const mat = mesh.material as THREE.ShaderMaterial
        if (mat?.uniforms?.uDim) {
          mat.uniforms.uDim.value = v
          n++
        }
      })
      return n
    }

    // Untuk capture: `?hide=sphere,plane` / `?dim=0` / `?nocanvas=1` / `?blackplanets=1`.
    const q = new URLSearchParams(location.search)
    const hide = q.get('hide')
    const dim = q.get('dim')
    const noCanvas = q.get('nocanvas')
    const blackPlanets = q.get('blackplanets')
    if (hide || dim !== null || noCanvas || blackPlanets) {
      const t = window.setTimeout(() => {
        if (hide) {
          for (const frag of hide.split(',')) {
            if (frag.trim()) (win.__toggle as (f: string, on?: boolean) => number)(frag.trim(), false)
          }
        }
        if (dim !== null) (win.__setDim as (v: number) => number)(Number(dim))
        if (blackPlanets) {
          scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            const mat = mesh.material as THREE.ShaderMaterial
            const u = mat?.uniforms
            if (u?.uDeep && u?.uMid && u?.uLight) {
              u.uDeep.value.set(0,0,0)
              u.uMid.value.set(0,0,0)
              u.uLight.value.set(0,0,0)
            }
          })
        }
        if (noCanvas) {
          for (const c of Array.from(document.querySelectorAll('canvas'))) {
            (c as HTMLCanvasElement).style.visibility = 'hidden'
          }
        }
      }, 900)
      return () => window.clearTimeout(t)
    }
  }, [scene, camera])

  return null
}
