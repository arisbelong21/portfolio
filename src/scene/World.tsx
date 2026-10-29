import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import * as THREE from 'three'
import { clamp, nav, smoothstep, smootherstep } from '../lib/nav'
import { fbm1 } from '../lib/motion'
import { introU, warp } from '../lib/intro'
import { planetGrabSfx } from '../lib/sfx'
import { setStoryOpen } from '../lib/story'
import { stations, type Station } from '../lib/journey'
import { deepVeils, finale, stationLight, veils, type Veil } from '../lib/cosmos'
import { FINALE_LOOK, type PlanetLook } from '../lib/planets'
import type { Quality } from '../lib/quality'
import Probe from './Probe'
import {
  atmoShellFragment,
  atmoShellVertex,
  auroraFragment,
  auroraVertex,
  beamFragment,
  beamVertex,
  cloudFragment,
  cloudVertex,
  dustFragment,
  dustVertex,
  haloFragment,
  haloVertex,
  holoFragment,
  holoVertex,
  planetFragment,
  planetVertex,
  ringFragment,
  ringVertex,
  shardFragment,
  shardVertex,
  skyFragment,
  skyVertex,
  starFragment,
  starVertex,
  veilFragment,
  veilVertex,
} from './shaders'

const FOG = { color: '#04070d', near: 24, far: 135 }

/** sumbu atas dunia; dipakai untuk orbit kamera */
const UP = new THREE.Vector3(0, 1, 0)

/** sudut pandang dasar. Naik sedikit saat scroll cepat (efek "mengejar"). */
const BASE_FOV = 44

/** Jarak kamera→subjek (satuan dunia), ditulis CameraRig tiap frame dan
 *  dibaca Effects untuk autofokus DoF. Module-level supaya kedua komponen
 *  berbagi nilai tanpa perlu context/prop drilling. */
let focusDistance = 14

const PALETTES = [
  { tint: '#1f9c7c', rim: '#8ff0cb', halo: '#1b6b58' }, // mint brand (shard pembuka)
  { tint: '#4b3596', rim: '#b79cff', halo: '#3b2a78' },
  { tint: '#8a5c1f', rim: '#ffce8a', halo: '#6d4a1e' },
  { tint: '#1f5b8a', rim: '#8ad4ff', halo: '#1e5177' },
  { tint: '#6f7570', rim: '#c3ccc4', halo: '#3c423e' }, // batu netral (asteroid)
]

/* -------------------------------------------------------------------------- */
/* Sky                                                                        */
/* -------------------------------------------------------------------------- */

function Sky() {
  const { camera } = useThree()
  const ref = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uTime: { value: 0 },
          // Malam beku ala igloo.inc: dasar hampir hitam kebiruan, awan biru
          // kutub, inti teal aurora, dan satu jejak hangat redup di cakrawala.
          uColorA: { value: new THREE.Color('#020409') },
          uColorB: { value: new THREE.Color('#0a1830') },
          uColorC: { value: new THREE.Color('#0c2b30') },
          uColorD: { value: new THREE.Color('#1a1c2e') },
        },
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    // Bola ini mengikuti kamera: kita di dalamnya, jadi tidak akan pernah
    // "tertinggal" walau kamera terbang 100 unit.
    if (ref.current) ref.current.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[120, 40, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Bintang jauh: titik dengan ukuran tetap + kerlip                          */
/* -------------------------------------------------------------------------- */

function Stars({ count }: { count: number }) {
  const { gl } = useThree()

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const scale = new Float32Array(count)
    const seed = new Float32Array(count)
    const temp = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 360
      pos[i * 3 + 1] = -110 + Math.random() * 240
      pos[i * 3 + 2] = 70 - Math.random() * 470

      const r = Math.random()
      scale[i] = r < 0.84 ? 0.45 + Math.random() * 0.5 : 1.05 + Math.random() * 1.9
      seed[i] = Math.random()
      // 0 = oranye, 1 = biru-putih. Kebanyakan bintang redup, jadi condong
      // ke putih-biru; segelintir dibuat hangat supaya tidak monoton.
      temp[i] = Math.random() < 0.22 ? Math.random() * 0.35 : 0.55 + Math.random() * 0.45
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aTemp', new THREE.BufferAttribute(temp, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: 1.9 },
          uColor: { value: new THREE.Color('#e8f1ff') },
        },
      }),
    [],
  )

  useEffect(() => {
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
  }, [material, gl])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/* -------------------------------------------------------------------------- */
/* Debu dekat jalur kamera                                                    */
/* -------------------------------------------------------------------------- */

function Dust({ count }: { count: number }) {
  const { size, gl } = useThree()

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const scale = new Float32Array(count)
    const seed = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 44
      pos[i * 3 + 1] = -12 + Math.random() * 30
      pos[i * 3 + 2] = 20 - Math.random() * 230

      scale[i] = 0.28 + Math.random() * 0.9
      seed[i] = Math.random()
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uFlow: { value: 0 },
          uColor: { value: new THREE.Color('#dfe9ff') },
        },
      }),
    [],
  )

  useEffect(() => {
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
  }, [material, gl, size.width])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uFlow.value = nav.velocity
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/* -------------------------------------------------------------------------- */
/* Meteor intro: lapangan batu yang dilewati kamera selama perjalanan.        */
/* Disusun dalam ruang kamera (terowongan di depan lensa) lalu dibawa ke ruang  */
/* dunia, jadi selalu "menerobos" ke arah penonton dari mana pun kameranya.     */
/* -------------------------------------------------------------------------- */

const METEOR_COUNT = 46

/** Geometri meteor: icosahedron detail-3 yang tiap simpulnya didorong keluar-
 *  masuk, jadi siluetnya tidak bulat. Warna faset dipanggang ke vertex color. */
function meteorGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 3)

  const pos = geo.attributes.position
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.copy(p).normalize()
    const d =
      0.17 * Math.sin(n.x * 4.7 + 1.3) * Math.cos(n.y * 4.1 - 0.7) +
      0.11 * Math.sin(n.z * 6.1 + 2.2) +
      0.06 * Math.cos((n.x + n.y) * 9.3) +
      // oktaf halus: bopeng & patahan kecil di faset dekat lensa
      0.028 * Math.sin(n.x * 15.7 + n.y * 6.1) * Math.cos(n.z * 13.3 - 1.1) +
      0.016 * Math.cos(n.z * 23.1 + n.x * 11.7)
    p.copy(n).multiplyScalar(1 + d)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const nrm = geo.attributes.normal
  const colors = new Float32Array(pos.count * 3)

  const light = new THREE.Vector3(-0.42, 0.55, 0.72).normalize()
  // Batu dingin, bukan cokelat: satu palet dengan planet es di sekitarnya.
  const cool = new THREE.Color('#0e141b')
  const warm = new THREE.Color('#59677a')
  const ice = new THREE.Color('#9dbccd')
  const c = new THREE.Color()
  const nn = new THREE.Vector3()

  // Warna per faset (3 simpul sekali) → hasilnya batu berfaset, bukan bola mulus.
  for (let i = 0; i < pos.count; i += 3) {
    nn.fromBufferAttribute(nrm, i)
    const shade = 0.16 + 0.9 * Math.max(nn.dot(light), 0)
    const face = 0.84 + Math.random() * 0.34
    c.copy(cool).lerp(warm, shade)
    c.multiplyScalar(face * (0.32 + shade * 1.0))
    // debu es tipis di faset yang menghadap cahaya
    if (Math.random() < 0.22) c.lerp(ice, 0.12 + shade * 0.28)
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = c.r
      colors[(i + k) * 3 + 1] = c.g
      colors[(i + k) * 3 + 2] = c.b
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function Meteors() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const rocks = useMemo(
    () =>
      Array.from({ length: METEOR_COUNT }, () => ({
        x: (Math.random() * 2 - 1) * 20,
        y: (Math.random() * 2 - 1) * 10,
        z: -(8 + Math.random() * 200),
        // batu kecil: puing yang dilewati, bukan planet kedua di depan lensa
        r: 0.18 + Math.random() * 1.05,
        rot: Math.random() * Math.PI,
        spin: 0.4 + Math.random() * 1.2,
        drift: (Math.random() * 2 - 1) * 0.35,
      })),
    [],
  )

  const geometry = useMemo(() => meteorGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.02,
        flatShading: true,
      }),
    [],
  )

  // Beberapa batu diberi warna es: glint kecil saat melewati cahaya.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new THREE.Color()
    for (let i = 0; i < METEOR_COUNT; i++) {
      const ice = Math.random() < 0.13
      if (ice) c.setRGB(1.16 + Math.random() * 0.3, 1.3 + Math.random() * 0.3, 1.5 + Math.random() * 0.3)
      else {
        const v = 0.55 + Math.random() * 0.5
        c.setRGB(v * 0.96, v * 0.99, v * 1.08)
      }
      mesh.setColorAt(i, c)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const w = warp()
    mesh.visible = w > 0.001
    if (!mesh.visible) return

    const dt = Math.min(delta, 0.05)
    const cam = state.camera

    for (let i = 0; i < METEOR_COUNT; i++) {
      const d = rocks[i]
      // batu yang lebih dekat tampak lebih cepat (paralaks) → kedalaman terasa
      d.z += (10 + 150 * w) * d.spin * 0.6 * dt
      d.rot += dt * (0.3 + 0.9 * w) * d.spin
      d.x += d.drift * dt * (1 + w * 2)
      if (d.z > 6) {
        d.z = -90 - Math.random() * 20
        d.x = (Math.random() * 2 - 1) * 14
        d.y = (Math.random() * 2 - 1) * 8.5
      }
      dummy.position.set(d.x, d.y, d.z)
      dummy.rotation.set(d.rot, d.rot * 0.7, d.rot * 0.4)
      dummy.scale.setScalar(d.r)
      dummy.updateMatrix()
      dummy.matrix.premultiply(cam.matrixWorld)
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, METEOR_COUNT]}
      frustumCulled={false}
      visible={false}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Streak warp: garis cahaya yang mengalir keluar dari titik tujuan.          */
/* Ini yang membuat "melesat" terasa seperti menempuh ruang, bukan guncangan.  */
/* -------------------------------------------------------------------------- */

const STREAK_COUNT = 260

function WarpStreaks() {
  const ref = useRef<THREE.LineSegments>(null)

  const lanes = useMemo(
    () =>
      Array.from({ length: STREAK_COUNT }, () => ({
        a: Math.random() * Math.PI * 2,
        spread: 0.22 + Math.random() * 0.75,
        z: -2 - Math.random() * 84,
        len: 0.35 + Math.random() * 1.5,
      })),
    [],
  )

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAK_COUNT * 6), 3))
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#d6ecff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useEffect(() => {
    const line = ref.current
    if (!line) return
    line.matrixAutoUpdate = false
    line.matrixWorldAutoUpdate = false
  }, [])

  useFrame((state, delta) => {
    const line = ref.current
    if (!line) return
    const w = warp()
    line.visible = w > 0.03
    if (!line.visible) return

    const dt = Math.min(delta, 0.05)
    const cam = state.camera
    line.matrixWorld.copy(cam.matrixWorld)

    const attr = geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const speed = (16 + 170 * w) * dt
    const tail = 0.6 + 16 * w

    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = lanes[i]
      s.z += speed
      if (s.z > -0.8) {
        s.z = -86 - Math.random() * 12
        s.a = Math.random() * Math.PI * 2
        s.spread = 0.22 + Math.random() * 0.75
      }

      // semua garis memancar dari titik hilang di depan kamera
      const headDepth = -s.z
      const tailDepth = headDepth + tail * s.len
      const hx = Math.cos(s.a) * s.spread * headDepth * 0.32
      const hy = Math.sin(s.a) * s.spread * headDepth * 0.32
      const tx = Math.cos(s.a) * s.spread * tailDepth * 0.32
      const ty = Math.sin(s.a) * s.spread * tailDepth * 0.32

      const o = i * 6
      arr[o] = hx
      arr[o + 1] = hy
      arr[o + 2] = -headDepth
      arr[o + 3] = tx
      arr[o + 4] = ty
      arr[o + 5] = -tailDepth
    }
    attr.needsUpdate = true
    material.opacity = 0.55 * w
  })

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}

/* -------------------------------------------------------------------------- */
/* Hologram: panel HUD tipis yang mengapung di samping beberapa planet.       */
/* -------------------------------------------------------------------------- */

const HOLO_STATIONS = [2, 4, 6, 7]

type HoloItem = {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  color: string
  seed: number
}

function Holograms() {
  const groups = useRef<Array<THREE.Group | null>>([])
  const rings = useRef<Array<THREE.Mesh | null>>([])
  const mats = useRef<THREE.ShaderMaterial[]>([])

  const items = useMemo<HoloItem[]>(() => {
    const out: HoloItem[] = []
    for (const idx of HOLO_STATIONS) {
      const st = stations[idx]
      if (!st) continue

      const focus = new THREE.Vector3(...st.focus)
      const camPos = new THREE.Vector3(...st.camera)
      const view = focus.clone().sub(camPos).normalize()
      const right = new THREE.Vector3().crossVectors(view, UP).normalize()
      const lift = new THREE.Vector3().crossVectors(right, view).normalize()

      const position = focus
        .clone()
        .addScaledVector(right, st.scale * 1.12 + 2.1)
        .addScaledVector(lift, st.scale * 0.38 + 0.35)
        .addScaledVector(view, 0.6)

      const facing = view.clone().multiplyScalar(-1)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing)
      // sedikit dimiringkan supaya tidak terasa seperti kartu datar
      quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.42))

      out.push({ position, quaternion, color: st.look.rim, seed: idx * 0.77 + 0.3 })
    }
    return out
  }, [])

  useEffect(() => {
    return () => {
      mats.current.forEach((m) => m.dispose())
      mats.current = []
    }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < items.length; i++) {
      const mat = mats.current[i]
      if (mat) mat.uniforms.uTime.value = t

      const g = groups.current[i]
      if (g) {
        g.rotation.z = Math.sin(t * 0.18 + i) * 0.04
        g.position.y = items[i].position.y + Math.sin(t * 0.5 + i * 1.7) * 0.08
      }

      const ring = rings.current[i]
      if (ring) ring.rotation.z = t * (0.12 + i * 0.02)
    }
  })

  return (
    <>
      {items.map((item, i) => (
        <group key={i} position={item.position} quaternion={item.quaternion} ref={(el) => (groups.current[i] = el)}>
          <mesh ref={(el) => (rings.current[i] = el)} position={[0, 0, -0.35]}>
            <ringGeometry args={[1.42, 1.435, 120, 1, 0, Math.PI * 1.35]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, -0.38]} rotation={[0, 0, -0.7]}>
            <ringGeometry args={[1.78, 1.786, 120, 1, 0, Math.PI * 0.8]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh>
            <planeGeometry args={[2.5, 1.52]} />
            <shaderMaterial
              vertexShader={holoVertex}
              fragmentShader={holoFragment}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              uniforms={{
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(item.color) },
                uOpacity: { value: 0.48 },
                uSeed: { value: item.seed },
              }}
              ref={(m) => {
                if (m) mats.current[i] = m as THREE.ShaderMaterial
              }}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Batu cerita: satu batu yang mengapung tenang di bab pembuka.               */
/* Diklik → panel deskripsi diri terbuka (lihat lib/story.ts).               */
/* -------------------------------------------------------------------------- */

const STONE_FOCUS: [number, number, number] = stations[0].focus

const stoneVec = new THREE.Vector3()

/** Lingkaran klik batu di layar (diisi tiap frame). */
const stoneHit = { x: -1e4, y: -1e4, r: 0, on: false }

/** Putaran batu cerita: klik singkat = buka panel, tahan-geser = diputar. */
const stoneSpin = { base: 0, yaw: 0, target: 0, vel: 0, hold: 0, drag: false }
let stonePress: {
  x: number
  y: number
  lastX: number
  lastY: number
  t: number
  moved: boolean
} | null = null

function ReadingStone() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const hover = useRef(0)
  const [active, setActive] = useState(false)

  // Klik/hover ditangani di level window, bukan lewat raycast R3F: lapisan teks
  // (.ch__inner) menutupi sebagian layar dan akan memakan event sebelum sampai
  // ke kanvas. Uji tabrak di layar (proyeksi bola) lebih murah dan kebal
  // terhadap tumpukan DOM.
  useEffect(() => {
    let over = false

    const inside = (e: PointerEvent) => {
      if (!stoneHit.on) return false
      const dx = e.clientX - stoneHit.x
      const dy = e.clientY - stoneHit.y
      return dx * dx + dy * dy < stoneHit.r * stoneHit.r
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (stonePress) {
        const dx = e.clientX - stonePress.x
        const dy = e.clientY - stonePress.y
        if (!stonePress.moved && dx * dx + dy * dy > 25) stonePress.moved = true
        if (stonePress.moved) {
          const now = performance.now()
          const dt = Math.max(0.008, (now - stonePress.t) / 1000)
          const mx = e.clientX - stonePress.lastX
          const my = e.clientY - stonePress.lastY
          const d = mx * 0.009 - my * 0.003
          stoneSpin.target += d
          stoneSpin.vel += (d / dt - stoneSpin.vel) * 0.32
          stonePress.lastX = e.clientX
          stonePress.lastY = e.clientY
          stonePress.t = now
        }
        return
      }
      const hit = inside(e)
      if (hit === over) return
      over = hit
      setActive(hit)
      document.body.style.cursor = hit ? 'grab' : ''
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = e.target as Element | null
      if (el?.closest('button, a, input, textarea')) return
      if (!inside(e)) return
      stonePress = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        t: performance.now(),
        moved: false,
      }
      stoneSpin.drag = true
      stoneSpin.vel = 0
      setActive(true)
      document.body.classList.add('planet-drag')
      planetGrabSfx()
    }

    const up = (e: PointerEvent) => {
      if (!stonePress) return
      const wasClick = !stonePress.moved
      stonePress = null
      stoneSpin.drag = false
      stoneSpin.vel = clamp(stoneSpin.vel, -2.6, 2.6)
      document.body.classList.remove('planet-drag')
      const hit = inside(e)
      over = hit
      setActive(hit)
      document.body.style.cursor = hit ? 'grab' : ''
      if (wasClick) {
        // Klik tanpa geser: perilaku lama, buka Manifesto.
        over = false
        setActive(false)
        document.body.style.cursor = ''
        setStoryOpen(true)
      }
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __stoneSpin?: unknown }).__stoneSpin = stoneSpin
    }
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      stonePress = null
      stoneSpin.drag = false
      document.body.classList.remove('planet-drag')
      document.body.style.cursor = ''
    }
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const g = group.current
    if (!g) return
    const idle = nav.idle
    const dt = Math.min(delta, 0.05)
    const cam = state.camera as THREE.PerspectiveCamera

    // Di layar potret kolom teks memenuhi lebar, jadi batu dinaikkan ke ruang
    // kosong di kanan judul dan dikecilkan — tidak menimpa paragraf.
    const portrait = clamp((1.15 - cam.aspect) / 0.55, 0, 1)
    const ox = STONE_FOCUS[0] + 2.55 + portrait * 0.35
    const oy = STONE_FOCUS[1] - 1.52 + portrait * 1.9

    hover.current += ((active ? 1 : 0) - hover.current) * (1 - Math.exp(-dt * 9))

    // Putaran batu: sama seperti planet — ditahan saat dipegang, lalu inersia.
    stoneSpin.hold += ((stoneSpin.drag ? 1 : 0) - stoneSpin.hold) * (1 - Math.exp(-dt * 7))
    stoneSpin.base += dt * 0.06 * (1 - stoneSpin.hold)
    if (stoneSpin.drag) {
      stoneSpin.yaw += (stoneSpin.target - stoneSpin.yaw) * (1 - Math.exp(-dt * 16))
    } else {
      stoneSpin.target += stoneSpin.vel * dt
      stoneSpin.vel *= Math.exp(-dt * 3)
      stoneSpin.yaw += (stoneSpin.target - stoneSpin.yaw) * (1 - Math.exp(-dt * 5))
    }

    // Gerak lembut: naik-turun pelan + rotasi yang tidak pernah berhenti.
    // Skala naik sedikit saat disentuh kursor, seperti batu yang "bangun".
    g.position.set(ox, oy + Math.sin(t * 0.42) * 0.14 * idle, STONE_FOCUS[2] + 1.9)
    g.rotation.y = stoneSpin.base + stoneSpin.yaw + Math.sin(t * 0.17) * 0.14
    g.rotation.z = Math.sin(t * 0.23) * 0.05
    g.scale.setScalar((0.82 - portrait * 0.18) * (1 + hover.current * 0.06))

    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      ring.current.rotation.z = t * 0.14 + stoneSpin.yaw * 0.5
      mat.opacity = (0.28 + hover.current * 0.5) * (0.82 + Math.sin(t * 0.7) * 0.18)
    }

    // Proyeksi ke layar untuk uji klik + probe dev.
    g.getWorldPosition(stoneVec)
    const dist = cam.position.distanceTo(stoneVec)
    stoneVec.project(cam)
    const h = window.innerHeight
    const w = window.innerWidth
    const radius =
      (1.5 * g.scale.x) / (Math.max(dist, 0.001) * Math.tan((cam.fov * Math.PI) / 360)) *
      (h / 2)
    stoneHit.x = (stoneVec.x * 0.5 + 0.5) * w
    stoneHit.y = (-stoneVec.y * 0.5 + 0.5) * h
    stoneHit.r = radius * 0.9
    stoneHit.on = stoneVec.z < 1 && nav.seg < 0.5 && radius > 14

    if (import.meta.env.DEV) {
      ;(window as unknown as { __stone?: typeof stoneHit }).__stone = { ...stoneHit }
    }
  })

  return (
    <group ref={group} position={STONE_FOCUS}>
      <Halo color='#9fd8c6' opacity={0.12} position={[0, 0, -1.1]} size={4.4} power={2.4} />

      <Shard position={[0, 0, 0]} scale={1} detail={5} seed={7.31} amp={0.2} palette={4} />

      {/* cincin tipis: tanda bahwa benda ini bisa dibuka */}
      <mesh ref={ring} rotation={[1.18, 0.35, 0]}>
        <torusGeometry args={[1.2, 0.007, 3, 160]} />
        <meshBasicMaterial
          color='#cfe8dc'
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-0.82, 0.2, 0.5]}>
        <torusGeometry args={[1.52, 0.004, 3, 160]} />
        <meshBasicMaterial
          color='#cfe8dc'
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Nebula: bidang besar yang selalu menghadap kamera                          */
/* -------------------------------------------------------------------------- */

function VeilMesh({ veil }: { veil: Veil }) {
  const ref = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: veilVertex,
        fragmentShader: veilFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColorA: { value: new THREE.Color(veil.a) },
          uColorB: { value: new THREE.Color(veil.b) },
          uTime: { value: veil.seed },
          uSeed: { value: veil.seed },
          uOpacity: { value: veil.opacity },
        },
      }),
    [veil],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime + veil.seed
    if (ref.current) ref.current.quaternion.copy(state.camera.quaternion)
  })

  return (
    <mesh ref={ref} position={veil.position} scale={veil.size} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Shard (bentuk asli brand)                                                  */
/* -------------------------------------------------------------------------- */

function Shard({
  position,
  scale,
  detail,
  seed,
  amp,
  palette,
}: {
  position: [number, number, number] | THREE.Vector3
  scale: number
  detail: number
  seed: number
  amp: number
  palette: number
}) {
  const pal = PALETTES[palette % PALETTES.length]
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, detail), [detail])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shardVertex,
        fragmentShader: shardFragment,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: amp },
          uSeed: { value: seed },
          uBase: { value: new THREE.Color('#0a1014') },
          uTint: { value: new THREE.Color(pal.tint) },
          uRim: { value: new THREE.Color(pal.rim) },
          uRimPower: { value: 2.5 },
          // Bump mikro hanya untuk objek besar; satelit kecil pakai versi
          // ringan supaya tidak membebani GPU tanpa terlihat bedanya.
          uDetail: { value: detail >= 8 ? 1 : 0 },
          uSparkle: { value: palette === 4 ? 0.55 : 0.42 },
          uFogColor: { value: new THREE.Color(FOG.color) },
          uFogNear: { value: FOG.near },
          uFogFar: { value: FOG.far },
        },
      }),
    [amp, seed, pal],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <mesh geometry={geometry} material={material} position={position} scale={scale} />
}

function Halo({
  color,
  opacity,
  position,
  size,
  power = 2.6,
}: {
  color: string
  opacity: number
  position: [number, number, number] | THREE.Vector3
  size: number
  power?: number
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: haloVertex,
        fragmentShader: haloFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uPower: { value: power },
        },
      }),
    [color, opacity, power],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <sprite position={position} scale={[size, size, 1]}>
      <primitive object={material} attach="material" />
    </sprite>
  )
}

const beamAnchor = new THREE.Vector3()
const beamDir = new THREE.Vector3()

function Beam({
  color,
  anchor,
  width,
  push,
}: {
  color: string
  anchor: [number, number, number]
  width: number
  push: number
}) {
  const ref = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0.06 },
        },
      }),
    [color],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ camera }) => {
    const mesh = ref.current
    if (!mesh) return
    // Dorong seluruh plane ke belakang bola planet. Kalau bidangnya melewati
    // pusat planet, tepi terang di kaki kolom memotong cakram sebagai garis
    // horizontal — persis di tengah planet.
    beamAnchor.set(anchor[0], anchor[1], anchor[2])
    beamDir.subVectors(beamAnchor, camera.position)
    const d = beamDir.length() || 1
    mesh.position.copy(beamAnchor).addScaledVector(beamDir, -(push / d))
    mesh.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={ref} scale={[width, 11, 1]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Planet: permukaan + atmosfer volumetrik + awan + aurora + cincin + bulan    */
/* -------------------------------------------------------------------------- */

/** vektor bantu (dipakai ulang tiap frame, jangan dialokasikan di useFrame) */
const worldVec = new THREE.Vector3()

function PlanetBody({
  look,
  seed,
  detail,
  light,
  dim = 1,
  quality,
}: {
  look: PlanetLook
  seed: number
  detail: number
  light: [number, number, number]
  dim?: number
  quality?: Quality
}) {
  const spec = look
  const segments = Math.min(
    quality?.tier === 'high' ? 128 : 96,
    Math.max(56, 40 + detail * 4),
  )

  const geometry = useMemo(() => new THREE.SphereGeometry(1, segments, segments / 2), [segments])
  const lightDir = useMemo(() => new THREE.Vector3(...light).normalize(), [light])

  // Model permukaan di shader: 0 gas · 1 batu · 2 es · 3 kabut · 4 bintang
  const surfaceKind =
    spec.surface === 'rock' ? 1 : spec.surface === 'ice' ? 2 : spec.surface === 'haze' ? 3 : spec.surface === 'sun' ? 4 : 0

  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: {
          uDeep: { value: new THREE.Color(spec.deep) },
          uMid: { value: new THREE.Color(spec.mid) },
          uLight: { value: new THREE.Color(spec.light) },
          uRim: { value: new THREE.Color(spec.rim) },
          uLineae: { value: new THREE.Color(spec.lineae) },
          uSurface: { value: surfaceKind },
          uLightDir: { value: lightDir },
          uTime: { value: 0 },
          uSeed: { value: seed },
          uBands: { value: spec.bands },
          uCraters: { value: spec.craters },
          uCaps: { value: spec.caps },
          uEmissive: { value: spec.emissive },
          uBandFreq: { value: spec.bandFreq },
          uStorm: { value: spec.storm },
          uSpec: { value: spec.specular },
          uDim: { value: dim * spec.bright },
          uMicro: { value: quality?.tier === 'high' ? 1 : 0 },
        },
      }),
    [spec, seed, lightDir, dim, quality],
  )

  /* ---- atmosfer volumetrik (ray-march hamburan Rayleigh + Mie) -------- */
  const isStar = spec.emissive > 0.5
  const shellSteps = quality?.tier === 'high' ? 14 : quality ? 8 : 12
  const shellRef = useRef<THREE.Mesh>(null)
  const worldScale = useRef(1)

  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoShellVertex,
        fragmentShader: atmoShellFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uPlanetCenter: { value: new THREE.Vector3() },
          uInner: { value: 1 },
          uOuter: { value: 1.12 },
          uLightDir: { value: lightDir },
          uScatter: { value: new THREE.Color(spec.scatter) },
          uMieCol: { value: new THREE.Color(spec.mie) },
          // Bintang: cukup tipis. Kalau tebal, kabut di depan piringan
          // menghapus granulasi dan bintik matahari.
          uIntensity: { value: isStar ? 0.26 : 0.16 + spec.atmo * 0.26 },
          uSteps: { value: shellSteps },
          uDensity: { value: 2.6 },
        },
      }),
    [spec, lightDir, isStar, shellSteps],
  )

  /* ---- lapisan awan ---------------------------------------------------- */
  const cloudRef = useRef<THREE.Mesh>(null)

  const clouds = useMemo(() => {
    if (isStar || spec.clouds <= 0) return null
    return new THREE.ShaderMaterial({
      vertexShader: cloudVertex,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: seed },
        uLightDir: { value: lightDir },
        uColor: { value: new THREE.Color(spec.cloudColor) },
        uShadow: { value: new THREE.Color(spec.cloudShadow) },
        uCoverage: { value: spec.clouds },
        uOpacity: { value: 0.6 },
      },
    })
  }, [spec, seed, lightDir, isStar])

  /* ---- aurora kutub ---------------------------------------------------- */
  const auroraGeo = useMemo(
    () => (spec.aurora > 0 ? new THREE.CylinderGeometry(0.52, 0.78, 0.9, 48, 1, true) : null),
    [spec.aurora],
  )

  const makeAurora = (flip: number) =>
    new THREE.ShaderMaterial({
      vertexShader: auroraVertex,
      fragmentShader: auroraFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: seed + flip * 3.7 },
        uColorLow: { value: new THREE.Color(spec.auroraLow) },
        uColorHigh: { value: new THREE.Color(spec.auroraHigh) },
        uOpacity: { value: 0.4 * spec.aurora },
      },
    })

  const auroraN = useMemo(() => (spec.aurora > 0 ? makeAurora(1) : null), [spec, seed])
  const auroraS = useMemo(() => (spec.aurora > 0 ? makeAurora(-1) : null), [spec, seed])

  useEffect(
    () => () => {
      geometry.dispose()
      surface.dispose()
      atmosphere.dispose()
      clouds?.dispose()
      auroraGeo?.dispose()
      auroraN?.dispose()
      auroraS?.dispose()
    },
    [geometry, surface, atmosphere, clouds, auroraGeo, auroraN, auroraS],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    surface.uniforms.uTime.value = t

    // Cangkang atmosfer: radius dinyatakan dalam satuan lokal (bola radius 1),
    // tapi shader march-nya di ruang dunia → kalikan dengan skala dunia induk.
    if (shellRef.current) {
      shellRef.current.getWorldPosition(atmosphere.uniforms.uPlanetCenter.value as THREE.Vector3)
      shellRef.current.getWorldScale(worldVec)
      worldScale.current = Math.max(worldVec.x, worldVec.y, worldVec.z)
      atmosphere.uniforms.uInner.value = worldScale.current
      atmosphere.uniforms.uOuter.value = worldScale.current * 1.12
    }

    // Awan berputar sedikit lebih cepat dari permukaan → badai "hidup"
    if (cloudRef.current) {
      cloudRef.current.rotation.y = t * 0.012 + seed
      if (clouds) clouds.uniforms.uTime.value = t
    }

    if (auroraN) auroraN.uniforms.uTime.value = t
    if (auroraS) auroraS.uniforms.uTime.value = t + 11.3
  })

  const moons = useMemo(() => {
    const out: Array<{ r: number; y: number; size: number; phase: number }> = []
    for (let k = 0; k < spec.moons; k++) {
      out.push({
        r: 1.5 + k * 0.42,
        y: Math.sin(k * 2.3 + seed) * 0.34,
        size: 0.055 + ((k + seed) % 3) * 0.022,
        phase: (k / Math.max(spec.moons, 1)) * Math.PI * 2,
      })
    }
    return out
  }, [spec, seed])

  const orbit = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (orbit.current) orbit.current.rotation.y = state.clock.elapsedTime * 0.16 + seed
  })

  return (
    <>
      <mesh geometry={geometry} material={surface} />

      {/* cangkang atmosfer volumetrik: bola sedikit lebih besar, di-march di
          fragment shader. depthTest tetap nyala supaya sisi belakang planet
          tertutup badan planet sendiri. */}
      <mesh ref={shellRef} geometry={geometry} material={atmosphere} scale={1.12} renderOrder={2} />

      {clouds && (
        <mesh ref={cloudRef} geometry={geometry} material={clouds} scale={1.012} renderOrder={1} />
      )}

      {auroraN && auroraGeo && (
        <mesh geometry={auroraGeo} material={auroraN} position={[0, 1.02, 0]} renderOrder={3} />
      )}
      {auroraS && auroraGeo && (
        <mesh
          geometry={auroraGeo}
          material={auroraS}
          position={[0, -1.02, 0]}
          rotation={[Math.PI, 0, 0]}
          renderOrder={3}
        />
      )}

      {spec.rings && (
        <Rings
          geometryArgs={spec.rings}
          colorA={spec.ringA}
          colorB={spec.ringB}
          seed={seed}
          detail={detail}
          light={light}
        />
      )}

      {spec.moons > 0 && (
        <group ref={orbit}>
          {moons.map((m, k) => (
            <mesh
              key={k}
              geometry={geometry}
              material={surface}
              position={[Math.cos(m.phase) * m.r, m.y, Math.sin(m.phase) * m.r]}
              scale={m.size}
            />
          ))}
        </group>
      )}
    </>
  )
}

function Rings({
  geometryArgs,
  colorA,
  colorB,
  seed,
  detail,
  light,
}: {
  geometryArgs: [number, number]
  colorA: string
  colorB: string
  seed: number
  detail: number
  light: [number, number, number]
}) {
  const ref = useRef<THREE.Mesh>(null)
  const [inner, outer] = geometryArgs
  const lightDir = useMemo(() => new THREE.Vector3(...light).normalize(), [light])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB) },
          uInner: { value: inner },
          uOuter: { value: outer },
          uSeed: { value: seed * 3.7 },
          uOpacity: { value: 0.62 },
          uPlanetCenter: { value: new THREE.Vector3() },
          uPlanetRadius: { value: 1 },
          uLightDir: { value: lightDir },
        },
      }),
    [colorA, colorB, inner, outer, seed, lightDir],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    mesh.rotation.z = state.clock.elapsedTime * 0.035 + seed

    // Pusat & radius planet untuk bayangan cincin (induk mesh = bola planet).
    const parent = mesh.parent
    if (parent) {
      parent.getWorldPosition(material.uniforms.uPlanetCenter.value as THREE.Vector3)
      parent.getWorldScale(worldVec)
      material.uniforms.uPlanetRadius.value = Math.max(worldVec.x, worldVec.y, worldVec.z)
    }
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2 + 0.52, 0, 0.16]} material={material}>
      <ringGeometry args={[inner, outer, Math.max(96, detail * 12)]} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Planet bisa diputar: klik kiri + tahan, lalu geser mouse.                   */
/* -------------------------------------------------------------------------- */

type PlanetSpin = {
  /** rotasi ambient yang berjalan sendiri (rad) */
  base: number
  /** rotasi hasil geseran + inersia (rad) */
  yaw: number
  /** sudut tujuan geseran; dibawa terus oleh inersia setelah dilepas */
  target: number
  /** kecepatan sudut lemparan (rad/detik) */
  vel: number
  /** 0..1: seberapa "dipegang" planet ini */
  hold: number
  /** 0..1: kursor sedang di atas planet */
  hover: number
  hoverOn: boolean
  drag: boolean
}

const planetSpins: PlanetSpin[] = stations.map(() => ({
  base: 0,
  yaw: 0,
  target: 0,
  vel: 0,
  hold: 0,
  hover: 0,
  hoverOn: false,
  drag: false,
}))

/** Lingkaran klik tiap planet di layar (diisi tiap frame oleh StationAnchor). */
const planetHits = stations.map(() => ({ x: -1e4, y: -1e4, r: 0, on: false }))

const hitVec = new THREE.Vector3()

let dragIndex = -1
let dragX = 0
let dragY = 0
let dragT = 0

/** Satu-satunya penangan pointer untuk memutar planet. */
function PlanetDrag() {
  useEffect(() => {
    let hoverIdx = -1

    if (import.meta.env.DEV) {
      ;(window as unknown as { __spins?: unknown; __planetHits?: unknown }).__spins = planetSpins
      ;(window as unknown as { __spins?: unknown; __planetHits?: unknown }).__planetHits = planetHits
    }

    // Planet yang paling dekat ke bab aktif menang kalau dua lingkaran bertumpuk.
    const pick = (x: number, y: number) => {
      let best = -1
      let bestDist = Infinity
      for (let i = 0; i < planetHits.length; i++) {
        const h = planetHits[i]
        if (!h.on) continue
        const dx = x - h.x
        const dy = y - h.y
        if (dx * dx + dy * dy > h.r * h.r) continue
        const d = Math.abs(nav.seg - i)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      }
      return best
    }

    const setHover = (i: number) => {
      if (i === hoverIdx) return
      if (hoverIdx >= 0) planetSpins[hoverIdx].hoverOn = false
      hoverIdx = i
      if (i >= 0) planetSpins[i].hoverOn = true
      if (dragIndex < 0) document.body.style.cursor = i >= 0 ? 'grab' : ''
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (dragIndex >= 0) {
        const sp = planetSpins[dragIndex]
        const h = planetHits[dragIndex]
        const now = performance.now()
        const dt = Math.max(0.008, (now - dragT) / 1000)
        const dx = e.clientX - dragX
        const dy = e.clientY - dragY
        // satu jari-jari planet di layar ≈ setengah putaran
        const k = 3.1 / Math.max(h.r, 70)
        const d = dx * k - dy * k * 0.32
        sp.target += d
        sp.vel += (d / dt - sp.vel) * 0.32
        dragX = e.clientX
        dragY = e.clientY
        dragT = now
        return
      }
      setHover(pick(e.clientX, e.clientY))
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = e.target as Element | null
      if (el?.closest('button, a, input, textarea')) return
      // Batu cerita punya penangan sendiri (klik = buka Manifesto); jangan
      // rebut pointer-nya walau lingkaran keduanya bersinggungan.
      if (stoneHit.on) {
        const sx = e.clientX - stoneHit.x
        const sy = e.clientY - stoneHit.y
        if (sx * sx + sy * sy < stoneHit.r * stoneHit.r) return
      }
      const i = pick(e.clientX, e.clientY)
      if (i < 0) return
      const sp = planetSpins[i]
      dragIndex = i
      sp.drag = true
      sp.vel = 0
      dragX = e.clientX
      dragY = e.clientY
      dragT = performance.now()
      document.body.classList.add('planet-drag')
      planetGrabSfx()
    }

    const release = () => {
      if (dragIndex < 0) return
      const sp = planetSpins[dragIndex]
      sp.drag = false
      sp.vel = clamp(sp.vel, -2.6, 2.6)
      dragIndex = -1
      document.body.classList.remove('planet-drag')
      document.body.style.cursor = hoverIdx >= 0 ? 'grab' : ''
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
      dragIndex = -1
      document.body.classList.remove('planet-drag')
      document.body.style.cursor = ''
    }
  }, [])

  return null
}

/* -------------------------------------------------------------------------- */
/* Satu stasiun: subjek + halo + kolom cahaya                                 */
/* -------------------------------------------------------------------------- */

function StationAnchor({
  index,
  station,
  detail,
  quality,
}: {
  index: number
  station: Station
  detail: number
  quality: Quality
}) {
  const pal = PALETTES[station.palette % PALETTES.length]
  const look = station.look
  const [fx, fy, fz] = station.focus
  const s = station.scale
  const kind = station.kind

  const group = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const cage = useRef<THREE.LineSegments>(null)
  const hud = useRef<THREE.Group>(null)
  const hudA = useRef<THREE.Mesh>(null)
  const hudB = useRef<THREE.Mesh>(null)

  const isShard = kind === 'shard' || kind === 'core'
  const haloColor = isShard ? pal.halo : look.halo
  const edgeColor = isShard ? pal.rim : look.rim

  // Kerangka low-poly: memberi struktur geometris supaya bentuknya tidak
  // cuma "gumpalan cahaya".
  const cageGeometry = useMemo(
    () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 1)),
    [],
  )

  useEffect(() => () => cageGeometry.dispose(), [cageGeometry])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const idle = nav.idle
    const dt = Math.min(delta, 0.05)
    const sp = planetSpins[index]

    // Semua subjek (planet maupun bongkahan) memakai model putaran yang sama:
    // ambient berhenti saat dipegang, lalu menyambung pelan setelah dilepas.
    sp.hold += ((sp.drag ? 1 : 0) - sp.hold) * (1 - Math.exp(-dt * 7))
    sp.hover += ((sp.hoverOn ? 1 : 0) - sp.hover) * (1 - Math.exp(-dt * 8))

    sp.base += dt * (isShard ? 0.06 : 0.035) * (1 - sp.hold)
    if (sp.drag) {
      sp.yaw += (sp.target - sp.yaw) * (1 - Math.exp(-dt * 16))
    } else {
      sp.target += sp.vel * dt
      sp.vel *= Math.exp(-dt * 3)
      sp.yaw += (sp.target - sp.yaw) * (1 - Math.exp(-dt * 5))
      if (Math.abs(sp.vel) < 1e-3 && Math.abs(sp.target - sp.yaw) < 1e-3) {
        sp.target = sp.yaw
        sp.vel = 0
      }
    }

    if (group.current) {
      group.current.rotation.y = sp.base + sp.yaw + station.palette * 1.7
      // Sumbu putar planet dimiringkan: Saturnus tidak pernah tegak lurus.
      group.current.rotation.x = isShard ? 0 : look.tilt[0]
      group.current.rotation.z = isShard ? 0 : look.tilt[1]
      group.current.position.y = fy + Math.sin(t * 0.45 + station.palette) * 0.16 * idle
    }

    const vis = Math.min(1, sp.hover * 0.62 + sp.hold * 0.7)

    if (ringA.current) {
      const m = ringA.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.5 + vis * 0.35
      ringA.current.rotation.z = t * 0.1 + station.palette + sp.yaw * 0.45
    }
    if (ringB.current) {
      const m = ringB.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.22 + vis * 0.3
      ringB.current.rotation.z = -t * 0.07 + sp.yaw * 0.25
    }
    if (cage.current) {
      const m = cage.current.material as THREE.LineBasicMaterial
      m.opacity = 0.13 + vis * 0.42
      cage.current.rotation.y = -t * 0.14 - sp.yaw * 0.3
      cage.current.rotation.x = Math.sin(t * 0.09) * 0.3
      cage.current.scale.setScalar(1.62 * s * (1 + sp.hold * 0.03))
    }

    if (!isShard) {
      // Cincin HUD menyala saat kursor menyentuh planet, dan ikut "berat"
      // saat diputar — geraknya sinkron dengan tema hologram di adegan.
      if (hud.current) hud.current.scale.setScalar(s * (1.02 + sp.hold * 0.035))
      if (hudA.current) {
        const m = hudA.current.material as THREE.MeshBasicMaterial
        m.opacity = vis * 0.58
        hudA.current.rotation.z = -t * 0.35 - sp.yaw * 0.35
      }
      if (hudB.current) {
        const m = hudB.current.material as THREE.MeshBasicMaterial
        m.opacity = vis * 0.36
        hudB.current.rotation.z = t * 0.22 + sp.yaw * 0.15
      }
    }

    // Proyeksi ke layar untuk uji klik (pola sama dengan ReadingStone).
    const hit = planetHits[index]
    if (group.current) {
      group.current.getWorldPosition(hitVec)
      const cam = state.camera as THREE.PerspectiveCamera
      const dist = cam.position.distanceTo(hitVec)
      hitVec.project(cam)
      const h = window.innerHeight
      const radius =
        (s / Math.max(dist, 0.001) / Math.tan((cam.fov * Math.PI) / 360)) * (h / 2)
      hit.x = (hitVec.x * 0.5 + 0.5) * window.innerWidth
      hit.y = (-hitVec.y * 0.5 + 0.5) * h
      hit.r = radius * (isShard ? 1.06 : 0.92)
      hit.on =
        hitVec.z < 1 &&
        Math.abs(nav.seg - index) < 0.45 &&
        radius > 18 &&
        (nav.velocity < 0.5 || sp.drag)
      if (!hit.on && !sp.drag) sp.hoverOn = false
    }
  })

  const light = stationLight(station)

  return (
    <group>
      <Halo color={haloColor} opacity={kind === 'star' ? 0.22 : 0.13} position={[fx, fy, fz - 2]} size={5.6 * s} power={2.6} />
      <Beam color={edgeColor} anchor={[fx, fy, fz]} width={1.7 * s} push={s * 1.4 + 1.6} />

      {kind === 'star' && (
        <>
          <Halo color='#ffd9a0' opacity={0.16} position={[fx, fy, fz - 4]} size={26} power={2.4} />
          <Halo color='#ff9c52' opacity={0.075} position={[fx, fy, fz - 6]} size={46} power={2.0} />
        </>
      )}

      <group ref={group} position={[fx, fy, fz]}>
        {isShard ? (
          <>
            <Shard
              position={[0, 0, 0]}
              scale={s}
              detail={detail}
              seed={station.palette * 1.37}
              amp={0.34}
              palette={station.palette}
            />

            <lineSegments ref={cage} geometry={cageGeometry} scale={1.62 * s}>
              <lineBasicMaterial
                color={pal.rim}
                transparent
                opacity={0.13}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </lineSegments>

            {/* satelit kecil, sengaja asimetris */}
            <Shard
              position={[-2.4 * s, 1.05 * s, -1.4 * s]}
              scale={0.3 * s}
              detail={Math.max(5, detail - 7)}
              seed={station.palette + 2.1}
              amp={0.55}
              palette={4}
            />
            <Shard
              position={[2.15 * s, -1.15 * s, 0.7 * s]}
              scale={0.2 * s}
              detail={Math.max(4, detail - 9)}
              seed={station.palette + 3.3}
              amp={0.62}
              palette={0}
            />

            <mesh ref={ringA} rotation={[1.24, 0.3, 0]}>
              <torusGeometry args={[2.55 * s, 0.006, 3, 220]} />
              <meshBasicMaterial color={pal.rim} transparent opacity={0.5} />
            </mesh>
            <mesh ref={ringB} rotation={[-0.9, 0.9, 0.4]}>
              <torusGeometry args={[3.3 * s, 0.0035, 3, 220]} />
              <meshBasicMaterial color={pal.rim} transparent opacity={0.22} />
            </mesh>
          </>
        ) : (
          <>
            {/* `scale` wajib: PlanetBody memakai geometri radius 1 dan
                mengharapkan induknya yang menentukan ukuran. Tanpa ini planet
                tampil 3x lebih kecil dari rencana. */}
            <group scale={s}>
              <PlanetBody look={look} seed={station.palette * 1.71 + 0.4} detail={detail} light={light} quality={quality} />
            </group>

            {/* HUD giroskop: dua cincin tipis yang muncul saat planet
                disentuh/dipegang, sejalan dengan bahasa visual hologram. */}
            <group ref={hud} scale={s}>
              <mesh ref={hudA} rotation={[0.62, 0.18, 0.2]}>
                <torusGeometry args={[1.26, 0.0045, 3, 200]} />
                <meshBasicMaterial
                  color={look.rim}
                  transparent
                  opacity={0}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh ref={hudB} rotation={[-0.95, 0.45, 0.3]}>
                <ringGeometry args={[1.44, 1.446, 140, 1, 0, Math.PI * 1.2]} />
                <meshBasicMaterial
                  color={look.rim}
                  transparent
                  opacity={0}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>

            {/* asteroid kecil yang mengorbit: pengukur jarak + gerak yang tidak berhenti.
                Warnanya sengaja netral — batu di ruang angkasa tidak hijau. */}
            <Shard
              position={[-1.75 * s, 0.75 * s, 0.6 * s]}
              scale={0.11 * s}
              detail={Math.max(4, detail - 8)}
              seed={station.palette + 4.7}
              amp={0.5}
              palette={4}
            />
            <Shard
              position={[1.5 * s, -0.95 * s, -0.9 * s]}
              scale={0.075 * s}
              detail={Math.max(3, detail - 9)}
              seed={station.palette + 6.1}
              amp={0.6}
              palette={4}
            />
          </>
        )}
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Planet raksasa di ujung perjalanan                                         */
/* -------------------------------------------------------------------------- */

function Finale({ detail, quality }: { detail: number; quality: Quality }) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.012
  })

  return (
    <group ref={group} position={finale.position} scale={finale.scale}>
      <PlanetBody look={FINALE_LOOK} seed={9.13} detail={detail} light={[-1, 0.5, 0.3]} dim={0.34} quality={quality} />
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Gerbang: cincin yang dilewati kamera → ini yang membuat gerak terbaca      */
/* -------------------------------------------------------------------------- */

function Gates({ curve, count }: { curve: THREE.CatmullRomCurve3; count: number }) {
  const items = useMemo(() => {
    const out: Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; radius: number }> = []
    const forward = new THREE.Vector3(0, 0, 1)
    // Gerbang dipasang di TENGAH antara dua pemberhentian, bukan di atasnya:
    // cincin yang berhenti tepat di depan lensa memotong layar dengan satu
    // garis lurus. Di tengah, ia terbaca sebagai gerbang yang dilewati.
    const mid = Math.max(count, stations.length - 1)
    const stops = stations.map((s) => new THREE.Vector3(...s.camera))

    for (let k = 0; k < count; k++) {
      const u = clamp((k + 0.5) / mid, 0.03, 0.97)
      const position = curve.getPoint(u)

      // Jarak ke titik berhenti terdekat mengatur ukuran gerbang.
      let nearest = Infinity
      for (const stop of stops) nearest = Math.min(nearest, position.distanceTo(stop))
      if (nearest < 6) continue

      const tangent = curve.getTangent(u).normalize()
      out.push({
        position,
        quaternion: new THREE.Quaternion().setFromUnitVectors(forward, tangent),
        radius: clamp(nearest * 0.34, 2.4, 4.6),
      })
    }
    return out
  }, [curve, count])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#cfe8dc',
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      {items.map((item, i) => (
        <mesh key={i} position={item.position} quaternion={item.quaternion}>
          <torusGeometry args={[item.radius, 0.012, 3, 190]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Kamera: tidak pernah benar-benar berhenti (rasa igloo.inc)                  */
/* -------------------------------------------------------------------------- */

function CameraRig({
  camCurve,
  lookCurve,
  introCurve,
}: {
  camCurve: THREE.CatmullRomCurve3
  lookCurve: THREE.CatmullRomCurve3
  introCurve: THREE.CatmullRomCurve3
}) {
  const position = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const spin = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const focus0 = useRef(new THREE.Vector3())
  const ahead = useRef(new THREE.Vector3())
  const tanA = useRef(new THREE.Vector3())
  const tanB = useRef(new THREE.Vector3())
  const bank = useRef(0)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const n = stations.length

    const seg = clamp(nav.seg, 0, n - 1)
    const i = Math.min(Math.floor(seg), n - 2)
    const local = seg - i

    // 45% linear + 55% smootherstep: kamera melambat di dekat bab, tapi
    // kecepatannya tidak pernah nol — jadi selalu ada gerak, seperti igloo.inc.
    const eased = local * 0.45 + smootherstep(local) * 0.55
    const u = (i + eased) / (n - 1)

    // saat scroll cepat, kamera "mendahului" sedikit ke arah tujuan
    const lookU = Math.min(u + nav.velocity * 0.012, 1)

    camCurve.getPoint(u, position.current)
    lookCurve.getPoint(lookU, look.current)

    const idle = nav.idle

    // Parallax ala igloo.inc: kamera BERPUTAR di bola mengelilingi titik
    // bidik, bukan digeser. Jarak tetap, jadi planet dekat dan nebula jauh
    // bergeser berbeda — kedalaman terbaca, bukan sekadar gambar ikut geser.
    // Ditambah drift mandiri yang sangat lambat (±2,6° per menit): selama
    // pengunjung diam di satu bab, sudutnya terus berubah halus sehingga
    // bidikan terasa seperti diambil kamera hidup, bukan foto tempel.
    spin.current.subVectors(position.current, look.current)
    spin.current.applyAxisAngle(UP, nav.x * idle * 0.052 + Math.sin(t * 0.11) * idle * 0.045)
    right.current.crossVectors(UP, spin.current)
    if (right.current.lengthSq() < 1e-6) right.current.set(1, 0, 0)
    right.current.normalize()
    spin.current.applyAxisAngle(
      right.current,
      nav.y * idle * 0.021 + Math.sin(t * 0.083 + 1.7) * idle * 0.019,
    )
    position.current.copy(look.current).add(spin.current)

    /* ---- perjalanan intro ------------------------------------------------
       Selama intro kamera TIDAK memakai posisi stasiun. Ia menempuh kurva
       dari jauh menuju kamera bab 00, melihat ke arah jalannya sendiri lalu
       beralih ke subjek saat tiba. Semua sisanya (parallax, framing,
       napas kamera) baru menyala di detik-detik terakhir, jadi transisinya
       tidak terasa seperti potongan. */
    const ip = introU()
    const arrive = ip >= 1 ? 1 : smoothstep(0.72, 1, ip)
    if (ip < 1) {
      focus0.current.copy(look.current)
      introCurve.getPointAt(ip, position.current)
      introCurve.getPointAt(Math.min(ip + 0.14, 1), ahead.current)
      look.current.lerpVectors(ahead.current, focus0.current, arrive)
    }

    const camera = state.camera as THREE.PerspectiveCamera
    camera.position.copy(position.current)
    camera.lookAt(look.current)

    // Rekam jarak ke titik bidik untuk autofokus DoF (dibaca Effects()).
    // Selama terbang jaraknya jauh; dibatasi supaya meteor di dekat lensa
    // tidak ikut meleleh.
    focusDistance = Math.min(camera.position.distanceTo(look.current), 26)

    // "punch" FOV saat scroll cepat → terasa seperti mengejar sesuatu.
    // Di layar potret FOV juga dilebarkan: dengan sudut 44° sebuah planet
    // selebar 24° tidak muat di lebar layar ponsel (21°), akibatnya seluruh
    // layar jadi satu bidang terang.
    const aspect = camera.aspect
    const portrait = clamp((1.15 - aspect) / 0.55, 0, 1)
    const w = warp()
    const fov = BASE_FOV + nav.velocity * 6.5 + w * 12 + portrait * 20
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Geser subjek ke kanan-atas supaya area teks (kiri-bawah) tetap kosong.
    // Sudutnya dihitung dari FOV, jadi komposisinya sama di layar lebar
    // maupun sempit — bukan angka tetap yang cuma pas di satu ukuran.
    // Di potret teks ada di bawah selebar layar, jadi subjek dibuat hampir
    // di tengah dan lebih tinggi.
    const halfV = (camera.fov * Math.PI) / 360
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect)
    // Posisi subjek di layar ikut berganti tiap bab (Station.frame) dan
    // disilangkan halus, jadi "angle kamera" terasa berubah tanpa hentakan.
    const blend = i + eased
    const s0 = Math.min(Math.floor(blend), n - 1)
    const s1 = Math.min(s0 + 1, n - 1)
    const fw = blend - s0
    const frameX = stations[s0].frame[0] + (stations[s1].frame[0] - stations[s0].frame[0]) * fw
    const frameY = stations[s0].frame[1] + (stations[s1].frame[1] - stations[s0].frame[1]) * fw
    const roll = stations[s0].roll + (stations[s1].roll - stations[s0].roll) * fw

    camera.rotateY(halfH * frameX * (1 - portrait * 0.9) * arrive)
    camera.rotateX(-halfV * frameY * (1 - portrait * 0.41) * arrive)

    // Napas kamera: noise dua oktaf, bukan sinus. Sinus punya periode yang
    // bisa "terbaca" kalau ditonton lama; noise tidak pernah mengulang pola.
    // 0,005 rad ≈ 0,3° — tidak terasa sebagai gerakan, tapi frame tidak
    // pernah identik. Ini yang membuat gambar terasa hidup.
    // Saat terbang, napas ini dikecilkan: guncang kecil di tengah melesat
    // itulah yang dulu membuat intro terasa kaku.
    const calm = 1 - w * 0.85
    camera.rotateX(fbm1(t * 0.13 + 4.2) * 0.0055 * idle * calm)
    camera.rotateY(fbm1(t * 0.11 + 8.9) * 0.0045 * idle * calm)
    camera.rotateZ(fbm1(t * 0.09 + 2.7) * 0.006 * idle * calm + nav.x * 0.004 * idle)
    // Kemiringan per bab: sudut kamera ikut "miring" sedikit, bukan cuma lateral.
    camera.rotateZ(roll * arrive)

    // Bank di tikungan: roll mengikuti laju perubahan arah kurva, lalu
    // kembali tegak tepat sebelum tiba.
    if (ip < 1) {
      const a0 = Math.max(ip - 0.03, 0)
      const a1 = Math.min(ip + 0.03, 1)
      introCurve.getTangentAt(a0, tanA.current)
      introCurve.getTangentAt(a1, tanB.current)
      const turn = tanA.current.z * tanB.current.x - tanA.current.x * tanB.current.z
      const target = clamp(-turn * 26, -0.17, 0.17) * (1 - smoothstep(0.8, 1, ip))
      bank.current += (target - bank.current) * 0.12
      camera.rotateZ(bank.current)
    } else if (Math.abs(bank.current) > 0.0005) {
      bank.current *= 0.9
      camera.rotateZ(bank.current)
    }

    // Saat dev saja: angka kamera untuk audit (orbit harus menjaga jarak tetap).
    if (import.meta.env.DEV) {
      ;(
        window as unknown as {
          __cam?: { x: number; y: number; z: number; d: number; rx: number; ry: number; rz: number }
        }
      ).__cam = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        d: camera.position.distanceTo(look.current),
        rx: camera.rotation.x,
        ry: camera.rotation.y,
        rz: camera.rotation.z,
      }
    }
  })

  return null
}

/* -------------------------------------------------------------------------- */

function Effects({ quality }: { quality: Quality }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aberration = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloom = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dof = useRef<any>(null)
  // Konstanta skalar, bukan Vector2: uniform `offset` effect adalah objek
  // yang sama dengan nilai prop, jadi menulis `base.x * s` ke dalamnya
  // tiap frame akan mengakumulasi perkalian dan meledak eksponensial.
  const BASE_X = 0.0002
  const BASE_Y = 0.00032
  const base = useMemo(() => new THREE.Vector2(BASE_X, BASE_Y), [])

  useFrame(() => {
    const offset: THREE.Vector2 | undefined = aberration.current?.offset
    if (offset) {
      const s = 1 + nav.velocity * 1.3
      offset.set(BASE_X * s, BASE_Y * s)
    }

    // Autofokus: kunci bidang tajam tepat di subjek (jarak ditulis CameraRig).
    // Tanpa ini planet dekat/meleleh tak menentu; dengan ini subjek selalu
    // tajam dan hanya latar yang bokeh — persis bahasa kamera film.
    const coc = dof.current?.cocMaterial
    if (coc) coc.focusDistance = focusDistance

    // Bloom ikut naik sedikit saat scroll kencang: sumber cahaya terasa
    // "terdorong", bukan cuma gambar yang bergeser.
    if (bloom.current) bloom.current.intensity = 0.3 + nav.velocity * 0.05
  })

  // Saklar debug (dev saja): `?nopost=1` mematikan seluruh rantai
  // post-processing, `?nofx=dof,bloom,ca,hs,bc,noise,vig` per efek.
  const q =
    import.meta.env.DEV && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null
  if (q?.has('nopost')) return null
  const nofx = new Set((q?.get('nofx') ?? '').split(',').filter(Boolean))

  const effects: JSX.Element[] = []
  if (!nofx.has('dof')) {
    // Deep-focus ala film luar angkasa: rentang fokus lebar (40) + bokeh kecil
    // (0.6) sehingga planet mana pun yang masuk frame tetap tajam; hanya
    // kejauhan ekstrem yang meleleh tipis. Autofokus di atas mengunci subjek.
    effects.push(
      <DepthOfField
        ref={dof}
        focusDistance={14}
        focusRange={40}
        bokehScale={0.6}
        height={quality.tier === 'high' ? 720 : 480}
      />,
    )
  }
  if (!nofx.has('bloom')) {
    effects.push(
      <Bloom ref={bloom} intensity={0.32} luminanceThreshold={0.62} luminanceSmoothing={0.32} mipmapBlur />,
    )
  }
  if (!nofx.has('ca')) {
    effects.push(
      <ChromaticAberration ref={aberration} offset={base} radialModulation={false} modulationOffset={0} />,
    )
  }
  // Grade akhir: sedikit ditarik saturasinya (warna ilustrasi → warna film),
  // kontras dinaikkan tipis supaya hitam ruang angkasa benar-benar hitam.
  if (!nofx.has('hs')) effects.push(<HueSaturation saturation={-0.07} hue={-0.01} />)
  if (!nofx.has('bc')) effects.push(<BrightnessContrast brightness={0.005} contrast={0.085} />)
  if (!nofx.has('noise')) effects.push(<Noise opacity={0.02} />)
  if (!nofx.has('vig')) effects.push(<Vignette offset={0.26} darkness={0.72} eskil={false} />)

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>
}

/* -------------------------------------------------------------------------- */

export default function World({ quality }: { quality: Quality }) {
  const camCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        stations.map((s) => new THREE.Vector3(...s.camera)),
        false,
        'centripetal',
      ),
    [],
  )

  const lookCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        stations.map((s) => new THREE.Vector3(...s.focus)),
        false,
        'centripetal',
      ),
    [],
  )

  /* Jalur intro: dari jauh di belakang-kanan kamera bab 00, menukik masuk
     dengan sedikit tikungan, lalu berhenti tepat di posisi kamera bab 00.
     Titik terakhir WAJIB sama dengan stasiun 0 supaya tidak ada "potongan"
     saat perjalanan selesai. */
  const introCurve = useMemo(() => {
    const p0 = new THREE.Vector3(...stations[0].camera)
    const f0 = new THREE.Vector3(...stations[0].focus)
    const dir = p0.clone().sub(f0)
    dir.y = 0
    dir.normalize()
    const side = new THREE.Vector3(-dir.z, 0, dir.x)

    const at = (back: number, across: number, up: number) =>
      p0
        .clone()
        .addScaledVector(dir, back)
        .addScaledVector(side, across)
        .add(new THREE.Vector3(0, up, 0))

    return new THREE.CatmullRomCurve3(
      [at(34, 13, 10.5), at(24, 8.6, 7.4), at(13, 3.6, 3.6), at(4.2, 0.6, 0.9), p0.clone()],
      false,
      'centripetal',
    )
  }, [])

  return (
    <>
      <Sky />
      <Stars count={quality.stars} />
      <Dust count={quality.dust} />
      {/* Cahaya hanya untuk meteor (satu-satunya material PBR di adegan):
          kunci dingin dari atas-kiri + pantulan hangat samar dari bawah. */}
      <ambientLight intensity={0.5} color='#223349' />
      <directionalLight position={[-9, 13, 7]} intensity={2.3} color='#d9e8ff' />
      <directionalLight position={[8, -6, -9]} intensity={0.65} color='#8d6b4c' />
      <Meteors />
      <WarpStreaks />

      {veils.slice(0, quality.veils).map((v, i) => (
        <VeilMesh key={`v${i}`} veil={v} />
      ))}
      {quality.veils > 3 && deepVeils.map((v, i) => <VeilMesh key={`d${i}`} veil={v} />)}

      {stations.map((station, i) => (
        <StationAnchor key={i} index={i} station={station} detail={quality.detail} quality={quality} />
      ))}

      <Holograms />
      <PlanetDrag />
      <ReadingStone />

      <Finale detail={quality.detail} quality={quality} />

      <Gates curve={camCurve} count={quality.gates} />
      <CameraRig camCurve={camCurve} lookCurve={lookCurve} introCurve={introCurve} />
      <Probe />

      {quality.post && <Effects quality={quality} />}
    </>
  )
}
