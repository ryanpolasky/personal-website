"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const word = "PROJECTS";
const burstAt = 1.15;
const revealAt = 1.35;
const destinations = [
  [-0.49, 0.32, -0.4], [-0.22, 0.44, 0.35], [0.25, 0.42, -0.25], [0.5, 0.25, 0.5],
  [-0.48, -0.33, 0.3], [-0.2, -0.46, -0.25], [0.2, -0.44, 0.45], [0.49, -0.3, -0.25],
];
const ease = (n: number) => 1 - (1 - THREE.MathUtils.clamp(n, 0, 1)) ** 3;
const expo = (n: number) => (n >= 1 ? 1 : 1 - 2 ** (-10 * THREE.MathUtils.clamp(n, 0, 1)));
const back = (n: number) => {
  const t = THREE.MathUtils.clamp(n, 0, 1) - 1;
  return 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2;
};
const turns = [1, -2, 1, 2, -1, -2, 2, -1];

function Letters({ font, section, active, reduced, ready }: {
  font: Font; section: HTMLElement; active: boolean; reduced: boolean; ready: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const started = useRef(0);
  const revealed = useRef(false);
  const skipIntro = useRef(false);
  const prepared = useRef(false);
  const color = useRef(new THREE.Color());
  const shade = useRef(new THREE.Color());
  const accent = useRef("");
  const { gl, camera, scene } = useThree();
  const letters = useMemo(() => Array.from(word, (letter) => {
    const geometry = new TextGeometry(letter, {
      font, size: 1, depth: 0.55, curveSegments: 8,
      bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.06, bevelSegments: 4,
    });
    geometry.computeBoundingBox();
    const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
    geometry.center();
    geometry.computeBoundingSphere();
    return { geometry, width, radius: geometry.boundingSphere!.radius, materials: [
      new THREE.MeshPhysicalMaterial({
        color: "#4b6dff", roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true,
      }),
      new THREE.MeshStandardMaterial({ color: "#1d2a9c", roughness: 0.4, metalness: 0.2, transparent: true }),
    ] };
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
      letters.forEach(({ geometry, materials }) => { geometry.dispose(); materials.forEach(m => m.dispose()); });
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
    if (motion !== "boot" && !revealed.current && elapsed < revealAt) skipIntro.current = true;
    const time = reduced || skipIntro.current ? 3 : elapsed;
    if (time > revealAt && !revealed.current) {
      revealed.current = true;
      section.dispatchEvent(new Event("project-boot-reveal"));
    }
    const raw = section.style.getPropertyValue("--pd-active") || getComputedStyle(document.documentElement).getPropertyValue("--color-accent");
    if (raw !== accent.current) {
      accent.current = raw;
      const hsl = raw.match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
      if (hsl) color.current.setHSL(+hsl[1] / 360, +hsl[2] / 100, +hsl[3] / 100, THREE.SRGBColorSpace);
      else color.current.setStyle(raw.trim());
      shade.current.copy(color.current).offsetHSL(0, 0.06, -0.14);
    }
    const phone = size.width < 650;
    const rows = phone ? [letters.slice(0, 4), letters.slice(4)] : [letters];
    const maxWidth = Math.max(...rows.map(row => row.reduce((n, letter) => n + letter.width + 0.06, -0.06)));
    const fit = Math.min(viewport.width * 0.82 / maxWidth, viewport.height * (phone ? 0.25 : 0.32));
    const backdropDepth = 4 + fit * (phone ? 2.2 : 2.8) * Math.max(...letters.map(letter => letter.radius));
    let rowX = 0;
    const pull = ease((time - burstAt + 0.33) / 0.3) * (1 - ease((time - burstAt) / 0.08));
    const hit = THREE.MathUtils.clamp(1 - (time - burstAt) / 0.4, 0, 1) * (time > burstAt ? 1 : 0);
    const shake = reduced ? 0 : pull * 0.025 + hit * hit * 0.18;
    group.current.position.set(Math.sin(time * 91) * shake, Math.cos(time * 77) * shake, 0);
    const tilt = 1 - ease((time - burstAt) / 0.5);
    group.current.rotation.set(-0.2 * tilt, 0.28 * tilt, -0.045 * tilt);
    const fade = 1 - Math.exp(-Math.min(delta, 0.1) * 5);
    letters.forEach(({ width, materials }, i) => {
      const mesh = group.current!.children[i] as THREE.Mesh;
      if (i === 0 || (phone && i === 4)) {
        const row = rows[phone && i === 4 ? 1 : 0];
        rowX = -row.reduce((n, letter) => n + letter.width + 0.06, -0.06) * fit / 2;
      }
      const intro = back((time - i * 0.045) / 0.55);
      const scatter = expo((time - burstAt - i * 0.012) / 1.35);
      const initialX = rowX + width * fit / 2;
      rowX += (width + 0.06) * fit;
      const initialY = phone ? (i < 4 ? 0.6 : -0.6) * fit : 0;
      const [x, y, spin] = destinations[i];
      const drift = reduced ? 0 : Math.sin(clock.elapsedTime * 0.35 + i * 1.7) * 0.08;
      const lift = Math.sin(Math.min(scatter * 1.4, 1) * Math.PI);
      mesh.position.set(
        THREE.MathUtils.lerp(initialX * (1 - pull * 0.12), x * viewport.width * 1.22, scatter),
        THREE.MathUtils.lerp(initialY * (1 - pull * 0.12), y * viewport.height * 1.22, scatter) + drift * scatter,
        (1 - intro) * -9 + lift * (i % 2 ? 3.8 : 2.6) - scatter * backdropDepth,
      );
      mesh.rotation.set(
        (1 - intro) * -1.6 + scatter * (spin + Math.PI * 2 * turns[i]),
        scatter * ((i % 2 ? -0.8 : 0.7) + Math.PI * 2 * turns[(i + 3) % 8]) + drift * scatter,
        scatter * spin,
      );
      const scale = fit * (0.7 + intro * 0.3) * (1 - pull * 0.1 + hit * 0.25) * (1 + scatter * (phone ? 1.2 : 1.8));
      mesh.scale.set(scale, scale, scale);
      const opacity = Math.min(1, Math.max(0, intro)) * (1 - ease((time - burstAt - 0.75) / 0.9) * 0.82);
      materials.forEach((m, side) => {
        m.opacity = opacity;
        m.depthWrite = opacity > 0.98;
        m.color.lerp(side ? shade.current : color.current, fade);
      });
    });
    const phase = time > burstAt + 1.55 ? "backdrop" : "running";
    if (section.dataset.boot !== phase) section.dataset.boot = phase;
  });

  return <group ref={group}>
    {letters.map(({ geometry, materials }, i) => <mesh key={i} geometry={geometry} material={materials} />)}
  </group>;
}

export default function ProjectBoot(props: { section: HTMLElement; active: boolean; reduced: boolean; ready: () => void }) {
  const [font, setFont] = useState<Font | null>(null);
  useEffect(() => {
    let alive = true;
    new FontLoader().load("/fonts/project-boot-dela.json", (loaded) => { if (alive) setFont(loaded); }, undefined, () => {});
    return () => { alive = false; };
  }, []);
  return font ? <Letters font={font} {...props} /> : null;
}
