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
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import projectObjects from "@/lib/projectObjects.json";
import { HDRI_STUDIO_HREF } from "@/lib/site";
import { PROJECT_REVEAL, type ProjectArrival } from "@/lib/projectMotion";
import { applyProjectTwist } from "@/lib/projectObjectGeometry";

const models = new Map<string, Promise<THREE.Group>>();

function load(id: string) {
  if (!models.has(id)) models.set(id, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(`/assets/project-objects/${projectObjects[id as keyof typeof projectObjects].file}`)
    .then(({ scene }) => {
      applyProjectTwist(scene);
      return scene;
    }).catch((error: unknown) => {
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
  arrival,
}: {
  id: string;
  active: boolean;
  reduced: boolean;
  gesture: React.RefObject<Gesture>;
  ready: () => void;
  failed: () => void;
  arrival: React.RefObject<ProjectArrival>;
}) {
  const holder = useRef<THREE.Group>(null);
  const next = useRef<THREE.Group | null>(null);
  const current = useRef<THREE.Group | null>(null);
  const phase = useRef({ name: "enter", t: 0, started: 0 });
  const idle = useRef(0);
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
    const arrivalProgress = reduced ? 1 : THREE.MathUtils.clamp((arrival.current.time - PROJECT_REVEAL) / 1.3, 0, 1);
    holder.current.visible = arrivalProgress > 0;
    if (!holder.current.visible) return;
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
      : Math.min(entering ? arrivalProgress : 1, phase.current.t / (entering ? 1.3 : 0.22));
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
    current.current.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial)) return;
        if (m.userData.projectTwist)
          m.userData.projectTwist.value = entering
            ? (1 - t) ** 3 * 2
            : t * t * 1.4;
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

export default function ProjectObjectScene({ id, arrival }: { id: string; arrival: React.RefObject<ProjectArrival> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<HTMLElement | null>(null);
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
            frameloop={active && ready && !reduced ? "always" : "demand"}
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
                  arrival={arrival}
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
