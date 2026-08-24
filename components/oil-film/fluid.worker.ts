// Runs the fluid sim off the main thread, shipping each rendered frame
// back as a transferred ImageBitmap.

import {
  createFluidSim,
  type FluidSim,
  type Palette,
  type TierConfig,
} from "./fluidSim";

export type WorkerInMessage =
  | { type: "init"; config: TierConfig; palette: Palette }
  | {
      type: "move";
      x: number;
      y: number;
      width: number;
      height: number;
      t: number;
    }
  | { type: "leave" }
  | { type: "palette"; palette: Palette }
  | { type: "clear" };

export type WorkerOutMessage = { type: "frame"; bitmap: ImageBitmap };

let sim: FluidSim | null = null;

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init": {
      const offscreen = new OffscreenCanvas(
        msg.config.gridW,
        msg.config.gridH,
      );
      const ctx = offscreen.getContext("2d", { alpha: true });
      if (!ctx) return;
      sim = createFluidSim(ctx, msg.config, msg.palette, () => {
        const bitmap = offscreen.transferToImageBitmap();
        const out: WorkerOutMessage = { type: "frame", bitmap };
        self.postMessage(out, { transfer: [bitmap] });
      });
      break;
    }
    case "move":
      sim?.pointerMove(msg.x, msg.y, msg.width, msg.height, msg.t);
      break;
    case "leave":
      sim?.pointerLeave();
      break;
    case "palette":
      sim?.setPalette(msg.palette);
      break;
    case "clear":
      sim?.clear();
      break;
  }
};
