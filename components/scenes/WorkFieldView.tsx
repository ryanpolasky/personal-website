"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { createRGeometry } from "./WorkFieldGeometry";
import { HDRI_STUDIO_HREF } from "@/lib/site";

export type WorkFieldState = { charge: number; reveal: number; x: number; y: number };

export function WorkFieldView({ state, onReady }: { state: RefObject<WorkFieldState>; onReady: (ready: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
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
      new THREE.MeshPhysicalMaterial({ color: "#101ac9", metalness: .04, roughness: .23, clearcoat: 1 }),
      new THREE.MeshPhysicalMaterial({ color: "#10121a", metalness: .22, roughness: .21, clearcoat: .9 }),
    ];
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
    let visible = false, portrait = false;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      portrait = width < 640;
      renderer.setPixelRatio(Math.min(devicePixelRatio, portrait ? 1.1 : 1.35));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(canvas);
    let frame = 0, time = 0, previous = performance.now(), announced = false;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      if (!visible || document.hidden || state.current.reveal >= 1) return;
      time += dt;
      const { charge, reveal, x, y } = state.current;
      const count = portrait ? 24 : 42;
      const slots = [0, 0, 0];
      camera.position.set(x * 0.14, y * 0.1, 13 - reveal * 2.5);
      camera.lookAt(0, 0, 0);
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399963;
        const radius = Math.sqrt((i + .5) / count);
        base.set(Math.cos(angle) * radius * (portrait ? 3.2 : 6.5), Math.sin(angle) * radius * (portrait ? 4 : 3.7) + .5, Math.sin(i * 4.1) * 1.5);
        outward.copy(base).normalize().multiplyScalar(reveal * 32);
        dummy.position.copy(base).multiplyScalar(1 - charge * 0.12).add(outward);
        dummy.position.x += Math.sin(time * 0.3 + i) * 0.12;
        dummy.position.y += Math.cos(time * 0.25 + i * 1.9) * 0.12;
        dummy.rotation.set(Math.sin(i * 2) * 1.2 + time * 0.035, i * 0.63 + time * 0.055 + reveal * 2, Math.cos(i * 7) * 0.7 + charge * 0.12);
        const scale = .8 + (Math.sin(i * 78.233) * .5 + .5) * .4;
        dummy.scale.setScalar(scale * (1 - charge * 0.12) * (1 - reveal * 0.85));
        dummy.updateMatrix();
        const kind = i % 3;
        meshes[kind].setMatrixAt(slots[kind]++, dummy.matrix);
      }
      meshes.forEach((mesh, index) => { mesh.count = slots[index]; mesh.instanceMatrix.needsUpdate = true; });
      renderer.render(scene, camera);
      if (!announced) { announced = true; onReady(true); }
    };
    const lost = (event: Event) => { event.preventDefault(); destroyed = true; cancelAnimationFrame(frame); onReady(false); };
    canvas.addEventListener("webglcontextlost", lost);
    frame = requestAnimationFrame(tick);
    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
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
