"use client";

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { HDRI_STUDIO_HREF } from "@/lib/site";
import ProjectBoot from "./ProjectBoot";

const models = new Map<string, Promise<THREE.Group>>();
const box = new THREE.Box3();
const sphere = new THREE.Sphere();

function material(color: string, metalness = 0.05, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function add(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material | THREE.Material[],
  position: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  root.add(mesh);
  return mesh;
}

function label(text: string, color: string, background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 145px sans-serif";
  ctx.fillText(text, 256, 260);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 });
}

async function build(id: string) {
  const root = new THREE.Group();
  if (id === "marralhinha") {
    const gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync("/assets/project-objects/marralhinha-oak.glb");
    root.add(gltf.scene);
    root.rotation.set(0.95, -0.22, -0.18);
  } else if (id === "nimby") {
    const response = await fetch("/assets/project-objects/frog-voxels.json");
    if (!response.ok) throw new Error("Frog artwork unavailable");
    const pixels = (await response.json()) as [number, number, string][];
    const voxels = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.088, 0.088, 0.45),
      material("white", 0.1, 0.5),
      pixels.length,
    );
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    pixels.forEach(([x, y, hex], i) => {
      voxels.setMatrixAt(i, matrix.makeTranslation(x, y, 0));
      voxels.setColorAt(i, color.set(hex));
    });
    root.add(voxels);
    root.rotation.set(-0.08, -0.28, 0.1);
  } else if (id === "rycord") {
    const black = material("#17171b", 0.6, 0.25);
    const disc = add(
      root,
      new THREE.CylinderGeometry(2.25, 2.25, 0.13, 80),
      black,
    );
    disc.rotation.x = Math.PI / 2;
    const groove = material("#383641", 0.8, 0.27);
    const geometry = new THREE.TorusGeometry(1, 0.006, 3, 80);
    for (let r = 0.85; r < 2.2; r += 0.055) {
      const ring = add(root, geometry, groove, [0, 0, 0.072]);
      ring.scale.set(r, r, 1);
    }
    add(
      root,
      new THREE.CircleGeometry(0.77, 48),
      label("ry", "#302b25", "#efe3c3"),
      [0, 0, 0.08],
    );
    add(root, new THREE.CircleGeometry(0.1, 24), black, [0, 0, 0.09]);
    root.rotation.set(-0.15, -0.3, -0.25);
  } else if (id === "utd-roommates") {
    const response = await fetch("/assets/project-objects/meteormate.svg");
    if (!response.ok) throw new Error("MeteorMate artwork unavailable");
    const svg = new SVGLoader().parse((await response.text()).replace(/url\(#[^)]+\)/g, "#ff9100"));
    const orange = new THREE.Color("#ff9100");
    const gold = new THREE.Color("#ffc94c");
    for (const path of svg.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 12, bevelEnabled: true, bevelSize: 0.8,
          bevelThickness: 0.8, bevelSegments: 3, curveSegments: 16,
        });
        const position = geometry.getAttribute("position");
        geometry.computeBoundingBox();
        const { min, max } = geometry.boundingBox!;
        const colors = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
          orange.clone().lerp(gold, (position.getX(i) - min.x) / (max.x - min.x)).toArray(colors, i * 3);
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const face = new THREE.MeshBasicMaterial({ vertexColors: true });
        const edge = material("#df7900", 0.08, 0.45);
        edge.envMapIntensity = 0.2;
        add(root, geometry, [face, edge]);
      }
    }
    root.rotation.set(Math.PI - 0.1, -0.22, 0.06);
  } else if (id === "autopsy") {
    add(
      root,
      new RoundedBoxGeometry(3.7, 3.7, 0.65, 3, 0.25),
      material("#090b17", 0.45, 0.25),
    );
    const white = material("#f5f5ff", 0.15, 0.2);
    const blue = material("#347fff", 0.3, 0.23);
    const tube = (
      points: [number, number, number][],
      mat: THREE.Material,
      radius: number,
    ) => {
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < points.length; i++)
        curve.add(
          new THREE.LineCurve3(
            new THREE.Vector3(...points[i - 1]),
            new THREE.Vector3(...points[i]),
          ),
        );
      add(
        root,
        new THREE.TubeGeometry(curve, points.length * 6, radius, 8, false),
        mat,
      );
    };
    tube(
      [
        [-1.2, -1.3, 0.4],
        [0, 1.3, 0.4],
        [1.2, -1.3, 0.4],
      ],
      white,
      0.11,
    );
    tube(
      [
        [-1.55, 0, 0.54],
        [-0.8, 0, 0.54],
        [-0.57, 0.48, 0.54],
        [-0.34, -0.5, 0.54],
        [0, 0.6, 0.54],
        [0.34, -0.5, 0.54],
        [0.57, 0.48, 0.54],
        [0.8, 0, 0.54],
        [1.55, 0, 0.54],
      ],
      blue,
      0.09,
    );
    root.rotation.set(-0.15, -0.35, -0.1);
  } else if (id === "readme-ryvamper") {
    add(
      root,
      new RoundedBoxGeometry(3.8, 3.8, 0.7, 4, 0.4),
      material("#ff6b1b", 0.18, 0.25),
    );
    add(
      root,
      new THREE.PlaneGeometry(3.35, 3.35),
      label(".md", "#ffffff", "#ff6b1b"),
      [0, 0, 0.36],
    );
    root.rotation.set(-0.1, -0.35, 0.15);
  } else if (id === "apple-triage") {
    add(root, new RoundedBoxGeometry(3, 3.8, 0.3, 3, 0.14), material("#18252e"));
    const paper = material("#f5f2ed", 0, 0.5);
    add(root, new THREE.BoxGeometry(2.5, 0.4, 0.08), paper, [0, 1.4, 0.2]);
    for (let i = 0; i < 4; i++) {
      add(root, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), material(i === 1 ? "#ed6675" : "#68bfa2"), [-1, 0.8 - i * 0.65, 0.2]).rotation.x = Math.PI / 2;
      add(root, new THREE.BoxGeometry(1.6, 0.07, 0.05), paper, [0.18, 0.8 - i * 0.65, 0.2]);
    }
    const glass = new THREE.Group();
    add(glass, new THREE.TorusGeometry(0.78, 0.12, 12, 48), material("#777bdf", 0.4, 0.2));
    const lens = new THREE.MeshPhysicalMaterial({ color: "#c3ccff", transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1 });
    add(glass, new THREE.CircleGeometry(0.72, 48), lens);
    add(glass, new RoundedBoxGeometry(0.23, 1.1, 0.25, 2, 0.07), material("#303661"), [0.7, -0.9, 0]).rotation.z = 0.65;
    glass.position.set(1, -0.4, 0.5);
    root.add(glass);
    root.rotation.set(-0.12, -0.35, -0.12);
  } else {
    const silver = material("#dce4df", 0.4, 0.32);
    const edge = material("#607d73", 0.4, 0.3);
    for (let i = 0; i < 3; i++) {
      add(root, new THREE.CylinderGeometry(1.65, 1.65, 0.85, 64), silver, [0, -1 + i * 0.95, 0]);
      add(root, new THREE.TorusGeometry(1.65, 0.04, 8, 64), edge, [0, -1.42 + i * 0.95, 0]).rotation.x = Math.PI / 2;
    }
    add(root, new RoundedBoxGeometry(2.25, 1.4, 0.22, 3, 0.1), material("#263c36"), [0.8, -0.7, 1.6]);
    add(
      root,
      new THREE.PlaneGeometry(1.6, 1.1),
      label(">_", "#a6e0b7", "#263c36"),
      [0.8, -0.7, 1.72],
    );
    root.rotation.set(-0.12, -0.35, -0.12);
  }
  root.updateMatrixWorld(true);
  box.setFromObject(root).getBoundingSphere(sphere);
  const vertex = new THREE.Vector3();
  let radius = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const position = o.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++)
      radius = Math.max(
        radius,
        vertex
          .fromBufferAttribute(position, i)
          .applyMatrix4(o.matrixWorld)
          .distanceTo(sphere.center),
      );
  });
  if (radius > 0) sphere.radius = radius;
  const projectCenter = { value: new THREE.Vector3() };
  const projectRadius = { value: 3 };
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial)) continue;
      const twist = { value: 0 };
      mat.userData.projectTwist = twist;
      mat.userData.projectCenter = projectCenter;
      mat.userData.projectRadius = projectRadius;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uProjectTwist = twist;
        shader.uniforms.uProjectCenter = projectCenter;
        shader.uniforms.uProjectRadius = projectRadius;
        const deform = `vec3 p = mvPosition.xyz - uProjectCenter; float a = p.y * uProjectTwist / max(uProjectRadius, 0.0001); float s = sin(a); float c = cos(a); mvPosition.xz = mat2(c,-s,s,c) * p.xz + uProjectCenter.xz;`;
        shader.vertexShader =
          `uniform float uProjectTwist; uniform vec3 uProjectCenter; uniform float uProjectRadius;\n${shader.vertexShader}`.replace(
            "#include <project_vertex>",
            THREE.ShaderChunk.project_vertex.replace(
              "mvPosition = modelViewMatrix * mvPosition;",
              `mvPosition = modelViewMatrix * mvPosition;\n${deform}`,
            ),
          );
      };
      mat.customProgramCacheKey = () => `project-object-${id}`;
    }
  });
  const normalized = new THREE.Group();
  root.position.sub(sphere.center);
  normalized.add(root);
  normalized.scale.setScalar(3 / sphere.radius);
  normalized.updateMatrixWorld(true);
  return normalized;
}

function load(id: string) {
  if (!models.has(id)) models.set(id, build(id).catch((error: unknown) => {
    models.delete(id);
    throw error;
  }));
  return models.get(id)!;
}

type Gesture = {
  down: boolean;
  x: number;
  y: number;
  rx: number;
  ry: number;
  vx: number;
  vy: number;
};

function ObjectRig({
  id,
  active,
  reduced,
  gesture,
  ready,
  failed,
  section,
}: {
  id: string;
  active: boolean;
  reduced: boolean;
  gesture: React.RefObject<Gesture>;
  ready: () => void;
  failed: () => void;
  section: HTMLElement;
}) {
  const holder = useRef<THREE.Group>(null);
  const next = useRef<THREE.Group | null>(null);
  const current = useRef<THREE.Group | null>(null);
  const phase = useRef({ name: "enter", t: 0, started: 0 });
  const idle = useRef(0);
  const center = useRef(new THREE.Vector3());
  const scale = useRef(new THREE.Vector3());
  const { invalidate, gl, camera, scene } = useThree();

  useEffect(() => {
    let alive = true;
    load(id)
      .then(async (model) => {
        if (!alive || !holder.current) return;
        const incoming = model.clone(true);
        await gl.compileAsync(incoming, camera, scene);
        if (!alive || !holder.current) return;
        next.current = incoming;
        if (!current.current) {
          current.current = next.current;
          holder.current.add(current.current);
          next.current = null;
        }
        phase.current = { name: next.current ? "exit" : "enter", t: 0, started: 0 };
        if (!next.current) holder.current.scale.setScalar(0.001);
        if (alive) {
          ready();
          invalidate();
        }
      })
      .catch(() => {
        if (alive) {
          holder.current?.clear();
          current.current = null;
          next.current = null;
          failed();
        }
      });
    return () => {
      alive = false;
    };
  }, [id, gl, camera, scene, invalidate, ready, failed]);

  useFrame((state, delta) => {
    if (!holder.current || !current.current) return;
    if (!active && !reduced) return;
    if (section.dataset.motion === "waiting" || section.dataset.motion === "boot") return;
    const dt = Math.min(delta, 0.045);
    const p = phase.current;
    if (!p.started) p.started = performance.now();
    p.t = (performance.now() - p.started) / 1000;
    if (p.name === "exit" && (p.t > 0.22 || reduced)) {
      holder.current.remove(current.current);
      current.current = next.current!;
      next.current = null;
      holder.current.add(current.current);
      phase.current = { name: "enter", t: 0, started: 0 };
      Object.assign(gesture.current, {
        down: false,
        rx: 0,
        ry: 0,
        vx: 0,
        vy: 0,
      });
      idle.current = 0;
    }
    const g = gesture.current;
    if (!g.down && !reduced) idle.current += dt * 0.45;
    if (!g.down) {
      g.rx += g.vx * dt;
      g.ry += g.vy * dt;
      g.vx *= Math.exp(-dt * 4);
      g.vy *= Math.exp(-dt * 4);
    }
    const entering = phase.current.name === "enter";
    const t = reduced
      ? 1
      : Math.min(1, phase.current.t / (entering ? 1.3 : 0.22));
    const spring = entering ? 1 - Math.exp(-6 * t) * Math.cos(t * 9) : 1 - t;
    holder.current.scale.setScalar(Math.max(0.001, spring));
    holder.current.rotation.set(
      g.ry + (reduced ? 0 : Math.sin(idle.current * 0.7) * 0.08),
      g.rx +
        (reduced ? 0 : Math.sin(idle.current) * 0.16) +
        (entering ? (1 - t) ** 3 * Math.PI * 1.6 : t * 1.6),
      (entering ? (1 - t) ** 3 : t) * -0.35,
    );
    holder.current.position.y =
      0.25 +
      (reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * 0.1) +
      (entering ? (1 - t) ** 3 * -1.8 : t * 0.8);
    holder.current.getWorldPosition(center.current).applyMatrix4(camera.matrixWorldInverse);
    const radius = 3 * holder.current.getWorldScale(scale.current).x;
    current.current.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial)) return;
        m.wireframe = entering && t < 0.18;
        if (m.userData.projectTwist)
          m.userData.projectTwist.value = entering
            ? (1 - t) ** 3 * 2
            : t * t * 1.4;
        m.userData.projectCenter?.value.copy(center.current);
        if (m.userData.projectRadius) m.userData.projectRadius.value = radius;
      });
    });
    if (active && !reduced) invalidate();
  });

  return <group ref={holder} dispose={null} />;
}

function StageViewport({ element, section, children }: {
  element: HTMLDivElement; section: HTMLElement; children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const { viewport, invalidate } = useThree();
  useLayoutEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const stage = element.getBoundingClientRect();
      const canvas = section.getBoundingClientRect();
      ref.current.position.set(
        ((stage.left + stage.width / 2 - canvas.left) / canvas.width - 0.5) * viewport.width,
        (0.5 - (stage.top + stage.height / 2 - canvas.top) / canvas.height) * viewport.height,
        0,
      );
      ref.current.scale.setScalar(stage.height / canvas.height);
      invalidate();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(section);
    return () => observer.disconnect();
  }, [element, section, viewport, invalidate]);
  useFrame(() => {
    if (ref.current) ref.current.visible = section.dataset.motion !== "waiting" && section.dataset.motion !== "boot";
  });
  return <group ref={ref}>{children}</group>;
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ProjectObjectScene({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const [section, setSection] = useState<HTMLElement | null>(null);
  const onBootReady = useRef(() => setBootReady(true)).current;
  const gesture = useRef<Gesture>({
    down: false,
    x: 0,
    y: 0,
    rx: 0,
    ry: 0,
    vx: 0,
    vy: 0,
  });
  const render = useRef(() => {});
  const onReady = useRef(() => {
    setReady(true);
    ref.current?.parentElement?.setAttribute("data-live", "true");
  }).current;
  const onError = useRef(() => {
    setReady(false);
    ref.current?.parentElement?.removeAttribute("data-live");
  }).current;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const host = element.closest("section")!;
    setSection(host);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    const warm = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          warm.disconnect();
        }
      },
      { rootMargin: "700px" },
    );
    const visible = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.15 },
    );
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!connection?.saveData) warm.observe(host);
    visible.observe(host);
    const visibility = () =>
      setActive(
        document.visibilityState === "visible" &&
          host.getBoundingClientRect().bottom > 0 &&
          host.getBoundingClientRect().top < innerHeight,
      );
    document.addEventListener("visibilitychange", visibility);
    return () => {
      warm.disconnect();
      visible.disconnect();
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <><div
      ref={ref}
      className="project-object-scene"
      data-ready={ready}
      tabIndex={ready ? 0 : -1}
      role="group"
      aria-label={
        ready
          ? "Interactive 3D project object. Drag to rotate; arrow keys rotate; space resets."
          : "Project artwork preview"
      }
      onPointerDown={(e) => {
        gesture.current.down = true;
        gesture.current.x = e.clientX;
        gesture.current.y = e.clientY;
        gesture.current.vx = 0;
        gesture.current.vy = 0;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g.down) return;
        const dx = (e.clientX - g.x) * 0.012,
          dy = (e.clientY - g.y) * 0.012;
        g.rx += dx;
        g.ry += dy;
        g.vx = dx * 12;
        g.vy = dy * 12;
        g.x = e.clientX;
        g.y = e.clientY;
        render.current();
      }}
      onPointerUp={() => {
        gesture.current.down = false;
      }}
      onPointerCancel={() => {
        gesture.current.down = false;
        gesture.current.vx = 0;
        gesture.current.vy = 0;
      }}
      onKeyDown={(e) => {
        const g = gesture.current;
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          g.rx +=
            e.key === "ArrowLeft" ? -0.25 : e.key === "ArrowRight" ? 0.25 : 0;
          g.ry +=
            e.key === "ArrowUp" ? -0.25 : e.key === "ArrowDown" ? 0.25 : 0;
        } else if (e.key === " ") {
          e.preventDefault();
          g.rx = 0;
          g.ry = 0;
          g.vx = 0;
          g.vy = 0;
        }
        render.current();
      }}
    />
      {near && section && ref.current && createPortal(
        <div className="project-scene-layer" aria-hidden="true">
        <SceneBoundary onError={onError}>
          <Canvas
            onCreated={({ invalidate, gl }) => {
              render.current = invalidate;
              gl.domElement.addEventListener("webglcontextlost", onError);
            }}
            frameloop={active && (ready || bootReady) && !reduced ? "always" : "demand"}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 10], fov: 38 }}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: "high-performance",
            }}
            fallback={null}
          >
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[-4, 7, 6]}
              intensity={2}
              color="#fff4dc"
            />
            <directionalLight
              position={[5, -1, -2]}
              intensity={2}
              color="#b6ddff"
            />
            <Suspense fallback={null}>
              <Environment files={HDRI_STUDIO_HREF} />
              <ProjectBoot section={section} active={active} reduced={reduced} ready={onBootReady} />
            </Suspense>
            <Suspense fallback={null}>
              <StageViewport element={ref.current} section={section}>
                <ObjectRig
                  id={id}
                  active={active}
                  reduced={reduced}
                  gesture={gesture}
                  ready={onReady}
                  failed={onError}
                  section={section}
                />
              </StageViewport>
            </Suspense>
          </Canvas>
        </SceneBoundary>
        </div>, section,
      )}
    </>
  );
}
