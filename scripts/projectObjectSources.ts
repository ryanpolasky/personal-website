import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { bakeProjectObject } from "../lib/projectObjectGeometry.js";

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

function label(text: string, color: string, background: string, textY = 260) {
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
  ctx.fillText(text, 256, textY);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 });
}

export async function buildProjectObject(id: string) {
  const root = new THREE.Group();
  if (id === "marralhinha") {
    const gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync("/assets/project-objects/marralhinha-oak.glb?v=e7766c94");
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
      label("ry", "#302b25", "#efe3c3", 132),
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
  const baked = bakeProjectObject(root);
  return baked;
}
