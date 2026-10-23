"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { usePerformanceTier } from "@/lib/performance";

const DEFAULT_COLOR = "#a1c8bc";

type ShardData = {
  position: [number, number, number];
  points: number[];
  outlinePoints: number[];
  spawn: [number, number, number];
  white: boolean;
  rotation: [number, number, number];
  seed: number;
};

function randomSource(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function createShardData(count: number): ShardData[] {
  const random = randomSource(1847);
  return Array.from({ length: count }, () => {
    const angle = (random() - 0.5) * Math.PI * 2;
    const distance = 0.4 + Math.pow(random(), 0.8) * 4.6;
    const x = Math.cos(angle) * distance * 1.2;
    const y = Math.sin(angle) * distance * 0.9;
    const length = 0.5 + random() * 2.4;
    const width = 0.08 + random() * 0.45;
    const direction = angle + (random() - 0.5) * 0.9;
    const ux = Math.cos(direction);
    const uy = Math.sin(direction);
    const nx = -uy;
    const ny = ux;
    const skew = random() * 0.5 + 0.2;
    const edgeJitter = (random() - 0.5) * width;
    const vertices: [number, number][] = [
      [-ux * length * 0.35, -uy * length * 0.35],
      [nx * width + ux * length * skew, ny * width + uy * length * skew],
      [ux * length, uy * length],
      [
        -nx * width * 0.6 + ux * length * (skew * 0.6) + edgeJitter,
        -ny * width * 0.6 + uy * length * (skew * 0.6),
      ],
    ];
    const points = vertices.flatMap(([px, py]) => [px, py, 0]);
    const outlinePoints = [...vertices, vertices[0]].flatMap(([px, py]) => [
      px,
      py,
      0,
    ]);
    const white = random() < 0.12;
    return {
      position: [x, y, (random() - 0.5) * 2.2],
      points,
      outlinePoints: white ? [] : outlinePoints,
      spawn: [(random() - 0.5) * 0.9, (random() - 0.5) * 1.5, 0],
      white,
      rotation: [(random() - 0.5) * 0.7, (random() - 0.5) * 0.8, direction],
      seed: random() * Math.PI * 2,
    };
  });
}

function Shard({
  data,
  color,
  explode,
}: {
  data: ShardData;
  color: string;
  explode: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const startedAt = useRef(0);
  const currentColor = useMemo(
    () => new THREE.Color(data.white ? "#fff" : DEFAULT_COLOR),
    [data.white],
  );
  const targetColor = useMemo(
    () => new THREE.Color(data.white ? "#fff" : color),
    [color, data.white],
  );
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.points, 3),
    );
    result.setIndex([0, 1, 2, 0, 2, 3]);
    result.computeVertexNormals();
    return result;
  }, [data.points]);
  const { size } = useThree();
  const outline = useMemo(() => {
    if (data.white) return null;
    const lineGeometry = new LineGeometry();
    lineGeometry.setPositions(data.outlinePoints);
    const lineMaterial = new LineMaterial({
      color: "#ffffff",
      linewidth: 2,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    lineMaterial.resolution.set(size.width, size.height);
    const line = new LineSegments2(lineGeometry, lineMaterial);
    line.computeLineDistances();
    return { line, lineMaterial, lineGeometry };
  }, [data.outlinePoints, data.white, size.height, size.width]);

  useEffect(() => {
    if (explode) startedAt.current = 0;
  }, [explode]);

  useEffect(() => {
    if (outline) outline.lineMaterial.resolution.set(size.width, size.height);
  }, [outline, size.height, size.width]);

  useFrame((state, delta) => {
    const element = group.current;
    const material = fill.current;
    if (!element || !material) return;
    if (explode && !startedAt.current) startedAt.current = state.clock.elapsedTime;
    const progress = explode
      ? Math.min(1, (state.clock.elapsedTime - startedAt.current) / 0.9)
      : 1;
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const spawn = data.spawn;
    element.position.set(
      spawn[0] + (data.position[0] - spawn[0]) * eased,
      spawn[1] + (data.position[1] - spawn[1]) * eased,
      spawn[2] + (data.position[2] - spawn[2]) * eased,
    );
    element.scale.setScalar(0.08 + eased * 0.92);
    element.rotation.x =
      data.rotation[0] + Math.sin(state.clock.elapsedTime * 0.7 + data.seed) * 0.05;
    element.rotation.y =
      data.rotation[1] + Math.sin(state.clock.elapsedTime * 0.45 + data.seed) * 0.07;
    element.rotation.z =
      data.rotation[2] + Math.sin(state.clock.elapsedTime * 0.6 + data.seed) * 0.03;
    element.position.y += Math.sin(state.clock.elapsedTime * 0.6 + data.seed) * 0.025;
    currentColor.lerp(targetColor, 1 - Math.exp(-delta * 2.8));
    material.color.copy(currentColor);
    if (outline) {
      outline.lineMaterial.resolution.set(size.width, size.height);
    }
  });

  return (
    <group ref={group} rotation={data.rotation}>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial
          ref={fill}
          color={data.white ? "#fff" : DEFAULT_COLOR}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {outline && <primitive object={outline.line} position={[0, 0, 0.003]} />}
    </group>
  );
}

function ShardScene({ color, explode }: { color: string; explode: boolean }) {
  const tier = usePerformanceTier();
  const shards = useMemo(
    () => createShardData(tier === "low" ? 70 : 140),
    [tier],
  );
  const root = useRef<THREE.Group>(null);
  const smoothPointer = useRef(new THREE.Vector2());
  const { pointer, viewport } = useThree();

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    smoothPointer.current.x +=
      (pointer.x - smoothPointer.current.x) * (1 - Math.exp(-delta * 2));
    smoothPointer.current.y +=
      (pointer.y - smoothPointer.current.y) * (1 - Math.exp(-delta * 2));
    const mobile = window.innerWidth < 768;
    group.position.x = mobile ? 0 : viewport.width * 0.22;
    group.position.y = mobile ? viewport.height * 0.2 : viewport.height * 0.1;
    group.scale.setScalar(mobile ? 0.66 : 1);
    group.rotation.y =
      Math.sin(performance.now() / 8000) * 0.14 + smoothPointer.current.x * 0.1;
    group.rotation.x =
      Math.sin(performance.now() / 9000) * 0.07 - smoothPointer.current.y * 0.07;
  });

  return (
    <group ref={root}>
      {shards.map((shard, index) => (
        <Shard
          key={index}
          data={shard}
          color={color}
          explode={explode}
        />
      ))}
    </group>
  );
}

export function ShardField({
  color,
  explode,
}: {
  color: string;
  explode: boolean;
}) {
  return (
    <Canvas
      className="club-shards"
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 10], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop="always"
    >
      <ShardScene color={color} explode={explode} />
    </Canvas>
  );
}
