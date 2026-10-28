"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useAccent } from "@/components/AccentProvider";
import { useIsVisible, useReducedMotion } from "@/lib/scroll";
import { tierDpr, usePerformanceTier } from "@/lib/performance";
import { HDRI_STUDIO_HREF } from "@/lib/site";

function makeGlyph() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 1);
  shape.lineTo(-0.6, -1);
  shape.lineTo(-0.35, -1);
  shape.lineTo(-0.35, 0.05);
  shape.lineTo(0.3, -1);
  shape.lineTo(0.6, -1);
  shape.lineTo(-0.05, 0.05);
  shape.bezierCurveTo(0.5, 0.05, 0.7, 0.4, 0.6, 0.66);
  shape.bezierCurveTo(0.55, 0.92, 0.4, 1, 0.2, 1);
  shape.lineTo(-0.6, 1);
  const hole = new THREE.Path();
  hole.moveTo(-0.32, 0.8);
  hole.lineTo(0.16, 0.8);
  hole.bezierCurveTo(0.4, 0.78, 0.45, 0.5, 0.16, 0.22);
  hole.lineTo(-0.32, 0.22);
  hole.lineTo(-0.32, 0.8);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.055, bevelSegments: 8, curveSegments: 32, steps: 1 });
  geometry.center();
  return geometry;
}

const pieces = [
  { position: [0.2, 0.1, 0.65], rotation: [0.18, -0.4, -0.2], scale: 1.48, finish: "accent" },
  { position: [-1.25, 1.7, -0.65], rotation: [0.5, 0.6, 0.7], scale: 0.95, finish: "silver" },
  { position: [1.4, 1.9, -1.4], rotation: [-0.7, 0.25, -0.55], scale: 0.82, finish: "white" },
  { position: [1.6, -1.15, -0.8], rotation: [0.6, -0.6, -0.4], scale: 1.05, finish: "silver" },
  { position: [-1.45, -1.7, -0.7], rotation: [-0.25, 0.5, 0.65], scale: 0.95, finish: "white" },
  { position: [0.1, -2.3, -1.3], rotation: [1.1, 0.2, -0.1], scale: 0.7, finish: "accent" },
] as const;

function Sculpture({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const accent = useAccent();
  const group = useRef<THREE.Group>(null);
  const frames = useRef(0);
  const geometry = useMemo(makeGlyph, []);
  const { gl } = useThree();
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onError);
    return () => canvas.removeEventListener("webglcontextlost", onError);
  }, [gl, onError]);
  useFrame(({ clock, pointer }, delta) => {
    if (frames.current++ === 2) onReady();
    if (!group.current) return;
    const step = Math.min(delta, 0.05);
    const time = clock.elapsedTime;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.18 + Math.sin(time * 0.16) * 0.1, 3, step);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.1 + Math.cos(time * 0.2) * 0.045, 3, step);
    group.current.position.y = Math.sin(time * 0.45) * 0.09;
  });
  return (
    <>
      <Environment files={HDRI_STUDIO_HREF} environmentIntensity={1.2} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[-4, 5, 6]} intensity={3} />
      <directionalLight position={[4, -2, 3]} intensity={1.2} />
      <group ref={group}>
        {pieces.map((piece, index) => <mesh key={index} geometry={geometry} position={[...piece.position]} rotation={[...piece.rotation]} scale={piece.scale}>
          <meshPhysicalMaterial color={piece.finish === "accent" ? accent.base : piece.finish === "silver" ? "#c8ccd0" : "#f6f5f1"} metalness={piece.finish === "silver" ? 1 : piece.finish === "accent" ? 0.24 : 0.06} roughness={piece.finish === "silver" ? 0.16 : 0.2} clearcoat={1} clearcoatRoughness={0.12} />
        </mesh>)}
      </group>
    </>
  );
}

export function HeroSculptureView({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { ref, visible } = useIsVisible<HTMLDivElement>("0px");
  const reduced = useReducedMotion();
  const tier = usePerformanceTier(reduced, visible);
  return (
    <div ref={ref} className="sculpture-canvas">
      <Canvas camera={{ position: [0, 0, 10], fov: 40 }} dpr={tierDpr(tier, 1.5, 1.1)} frameloop={visible ? "always" : "never"} resize={{ scroll: false }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }} fallback={null}>
        <Sculpture onReady={onReady} onError={onError} />
      </Canvas>
    </div>
  );
}
