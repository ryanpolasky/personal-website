"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { createRGeometry } from "./WorkFieldGeometry";
import { HDRI_STUDIO_HREF } from "@/lib/site";
import { useAccent } from "@/components/AccentProvider";
import { createWorkFieldLayout, WORK_FIELD_DRIFT } from "@/lib/work-field-layout";

export type WorkFieldState = { charge: number; reveal: number; x: number; y: number };

export function WorkFieldView({ state, onReady, awake }: { state: RefObject<WorkFieldState>; onReady: (ready: boolean) => void; awake: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colored = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const wake = useRef<() => void>(() => {});
  const accent = useAccent().base;
  const initialAccent = useRef(accent);

  useEffect(() => {
    colored.current?.color.set(accent);
    wake.current();
  }, [accent]);

  useEffect(() => { if (awake) wake.current(); }, [awake]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" }); }
    catch { return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#11131a", 16, 45);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    const geometry = createRGeometry();
    const materials = [
      new THREE.MeshPhysicalMaterial({ color: "#dce2ed", metalness: .16, roughness: .22, clearcoat: .7 }),
      new THREE.MeshPhysicalMaterial({ color: initialAccent.current, metalness: .04, roughness: .23, clearcoat: 1 }),
      new THREE.MeshPhysicalMaterial({ color: "#10121a", metalness: .22, roughness: .21, clearcoat: .9 }),
    ];
    colored.current = materials[1];
    const meshes = materials.map((material) => {
      const mesh = new THREE.InstancedMesh(geometry, material, 42);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    });
    scene.add(new THREE.HemisphereLight("#ffffff", "#35384c", 1));
    const key = new THREE.DirectionalLight("#f3f6ff", 3);
    key.position.set(-4, 7, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#e1e6ff", 2);
    rim.position.set(5, 1, -3);
    scene.add(rim);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let environment: THREE.WebGLRenderTarget | undefined;
    let destroyed = false;
    new RGBELoader().load(HDRI_STUDIO_HREF, (texture) => {
      if (destroyed) { texture.dispose(); return; }
      environment = pmrem.fromEquirectangular(texture);
      scene.environment = environment.texture;
      texture.dispose();
    }, undefined, () => {});
    const dummy = new THREE.Object3D();
    const base = new THREE.Vector3();
    const outward = new THREE.Vector3();
    let visible = false;
    let layout = createWorkFieldLayout(1, geometry.boundingSphere?.radius ?? 1.41);
    let frame = 0, time = 0, previous = performance.now(), announced = false;
    const schedule = () => {
      if (!destroyed && !frame && visible && !document.hidden && state.current.reveal < 1) frame = requestAnimationFrame(tick);
    };
    wake.current = schedule;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, width < 640 ? 1.1 : 1.35));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      layout = createWorkFieldLayout(camera.aspect, geometry.boundingSphere?.radius ?? 1.41);
      schedule();
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    observer.observe(canvas);
    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);
    const tick = (now: number) => {
      frame = 0;
      if (destroyed || !visible || document.hidden || state.current.reveal >= 1) return;
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      time += dt;
      const { charge, reveal, x, y } = state.current;
      const slots = [0, 0, 0];
      camera.position.set(x * 0.14, y * 0.1, 13 - reveal * 2.5);
      camera.lookAt(0, 0, 0);
      for (let i = 0; i < layout.length; i++) {
        const item = layout[i];
        base.set(item.x, item.y, item.z);
        outward.copy(base).normalize().multiplyScalar(reveal * 32);
        dummy.position.copy(base).multiplyScalar(1 - charge * 0.12).add(outward);
        dummy.position.x += Math.sin(time * 0.3 + i) * WORK_FIELD_DRIFT;
        dummy.position.y += Math.cos(time * 0.25 + i * 1.9) * WORK_FIELD_DRIFT;
        dummy.rotation.set(Math.sin(i * 2) * 1.2 + time * 0.035, i * 0.63 + time * 0.055 + reveal * 2, Math.cos(i * 7) * 0.7 + charge * 0.12);
        dummy.scale.setScalar(item.scale * (1 - charge * 0.12) * (1 - reveal * 0.85));
        dummy.updateMatrix();
        const kind = i % 3;
        meshes[kind].setMatrixAt(slots[kind]++, dummy.matrix);
      }
      meshes.forEach((mesh, index) => { mesh.count = slots[index]; mesh.instanceMatrix.needsUpdate = true; });
      renderer.render(scene, camera);
      if (!announced) { announced = true; onReady(true); }
      schedule();
    };
    const lost = (event: Event) => { event.preventDefault(); destroyed = true; cancelAnimationFrame(frame); onReady(false); };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", lost);
      wake.current = () => {};
      colored.current = null;
      meshes.forEach((mesh) => mesh.dispose());
      materials.forEach((material) => material.dispose());
      geometry.dispose();
      environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [state, onReady]);
  return <canvas ref={ref} className="work-field" aria-hidden />;
}
