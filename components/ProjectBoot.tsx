"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const word = "PROJECTS";
const destinations = [
  [-0.49, 0.32, -0.4], [-0.22, 0.44, 0.35], [0.25, 0.42, -0.25], [0.5, 0.25, 0.5],
  [-0.48, -0.33, 0.3], [-0.2, -0.46, -0.25], [0.2, -0.44, 0.45], [0.49, -0.3, -0.25],
];
const ease = (n: number) => 1 - (1 - THREE.MathUtils.clamp(n, 0, 1)) ** 3;

function Letters({ font, section, active, reduced, ready }: {
  font: Font; section: HTMLElement; active: boolean; reduced: boolean; ready: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const started = useRef(0);
  const revealed = useRef(false);
  const skipIntro = useRef(false);
  const prepared = useRef(false);
  const color = useRef(new THREE.Color());
  const accent = useRef("");
  const { gl, camera, scene } = useThree();
  const letters = useMemo(() => Array.from(word, (letter) => {
    const geometry = new TextGeometry(letter, {
      font, size: 1, depth: 0.22, curveSegments: 6,
      bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2,
    });
    geometry.computeBoundingBox();
    const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
    geometry.center();
    return { geometry, width, material: new THREE.MeshStandardMaterial({
      color: "#2d2bc8", roughness: 0.35, metalness: 0.18, transparent: true, depthWrite: false,
    }) };
  }), [font]);

  useEffect(() => {
    let alive = true;
    if (group.current) gl.compileAsync(group.current, camera, scene).then(() => {
      if (alive) {
        prepared.current = true;
        section.dataset.boot = "prepared";
        ready();
      }
    }).catch(() => {});
    return () => {
      alive = false;
      letters.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); });
    };
  }, [letters, ready, gl, camera, scene, section]);

  useFrame(({ viewport, clock, size }, delta) => {
    if (!group.current || (!active && !reduced)) return;
    if (!prepared.current) { group.current.visible = false; return; }
    const motion = section.dataset.motion;
    group.current.visible = motion !== "waiting";
    if (motion === "waiting") return;
    if (!started.current) {
      started.current = performance.now();
      if (motion !== "boot") {
        revealed.current = true;
        skipIntro.current = true;
      }
    }
    const elapsed = (performance.now() - started.current) / 1000;
    if (motion !== "boot" && !revealed.current && elapsed < 1.15) skipIntro.current = true;
    const time = reduced || skipIntro.current ? 3 : elapsed;
    if (time > 1.15 && !revealed.current) {
      revealed.current = true;
      section.dispatchEvent(new Event("project-boot-reveal"));
    }
    const raw = section.style.getPropertyValue("--pd-active") || getComputedStyle(document.documentElement).getPropertyValue("--color-accent");
    if (raw !== accent.current) {
      accent.current = raw;
      const hsl = raw.match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
      if (hsl) color.current.setHSL(+hsl[1] / 360, +hsl[2] / 100, +hsl[3] / 100, THREE.SRGBColorSpace);
      else color.current.setStyle(raw.trim());
    }
    const phone = size.width < 650;
    const rows = phone ? [letters.slice(0, 4), letters.slice(4)] : [letters];
    const maxWidth = Math.max(...rows.map(row => row.reduce((n, letter) => n + letter.width + 0.06, -0.06)));
    const fit = Math.min(viewport.width * 0.88 / maxWidth, viewport.height * (phone ? 0.25 : 0.32));
    let rowX = 0;
    letters.forEach(({ width, material }, i) => {
      const mesh = group.current!.children[i] as THREE.Mesh;
      if (i === 0 || (phone && i === 4)) {
        const row = rows[phone && i === 4 ? 1 : 0];
        rowX = -row.reduce((n, letter) => n + letter.width + 0.06, -0.06) * fit / 2;
      }
      const intro = ease((time - i * 0.035) / 0.52);
      const scatter = ease((time - 0.95 - i * 0.025) / 1.2);
      const initialX = rowX + width * fit / 2;
      rowX += (width + 0.06) * fit;
      const initialY = phone ? (i < 4 ? 0.6 : -0.6) * fit : 0;
      const [x, y, spin] = destinations[i];
      const drift = reduced ? 0 : Math.sin(clock.elapsedTime * 0.35 + i * 1.7) * 0.08;
      mesh.position.set(
        THREE.MathUtils.lerp(initialX, x * viewport.width * 1.22, scatter),
        THREE.MathUtils.lerp(initialY - (1 - intro) * 1.5, y * viewport.height * 1.22, scatter) + drift * scatter,
        Math.sin(scatter * Math.PI) * (i % 2 ? 2.5 : 1.3) - scatter * 2,
      );
      mesh.rotation.set((1 - intro) * -1.3 + scatter * spin, scatter * (i % 2 ? -0.8 : 0.7) + drift * scatter, scatter * spin);
      const scale = fit * (0.85 + intro * 0.15) * (1 + scatter * (phone ? 1.2 : 1.8));
      mesh.scale.set(scale, scale, scale * (0.06 + ease((time - 0.25) / 0.65) * 0.94));
      material.opacity = intro * (1 - scatter * 0.88);
      material.color.lerp(color.current, 1 - Math.exp(-Math.min(delta, 0.1) * 5));
    });
    const phase = time > 2.5 ? "backdrop" : "running";
    if (section.dataset.boot !== phase) section.dataset.boot = phase;
  });

  return <group ref={group}>
    {letters.map(({ geometry, material }, i) => <mesh key={i} geometry={geometry} material={material} />)}
  </group>;
}

export default function ProjectBoot(props: { section: HTMLElement; active: boolean; reduced: boolean; ready: () => void }) {
  const [font, setFont] = useState<Font | null>(null);
  useEffect(() => {
    let alive = true;
    new FontLoader().load("/fonts/project-boot.json", (loaded) => { if (alive) setFont(loaded); }, undefined, () => {});
    return () => { alive = false; };
  }, []);
  return font ? <Letters font={font} {...props} /> : null;
}
