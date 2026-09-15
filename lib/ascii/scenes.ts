import type { AsciiScene } from "@/lib/ascii/types";

function frame(lines: string[]): string {
  const width = Math.max(...lines.map((line) => line.length));
  return lines.map((line) => line.padEnd(width)).join("\n");
}

const SNOWED_IN_ART = String.raw`
╲                                                                                                  ╱
 ╲________________________________________________________________________________________________╱
 │                                           .------.                                               │
 │                                       _.-'        '-._                     _                     │
 │                                     .'      .-.       '.                 _/ \_                   │
 │                                    /_______/___\________\               /  ╲|╱  \                 │
 │                                        ╲   |   ╱                       |  --●--  |                │
 │                                         ╲  |  ╱                        |   ╱|╲   |                │
 │     ╭────────────────────────────────╮    ╲_|_╱                         |         |                │
 │     │   ·          *           ·     │      |                           '----.----'                │
 │     │         .             *        │                                  ___|___                   │
 │     │              ○                 │                   ╭──────────────────────────╮             │
 │     │    *        _/ \_          ·   │                   │  8:42       i i  i i     │             │
 │     │       /\   /     \    /\       │                   ├──────────────────────────┤             │
 │     │  ·   /  \_/ /\    \__/  \   * │                   │  ▌▐▌ ▌▌▐  ▐▌▌ ▌▐▐ ▌▐     │             │
 │     │     /      /  \           \    │                   │  ▌▐▌ ▌▌▐  ▐▌▌ ▌▐▐ ▌▐     │             │
 │     ├───────────┬────────────────────┤                   ├──────────────────────────┤             │
 │     │  *        │   ·        *       │                   │  ▐▌ ▐▐▐  ▐▌ ▐▌▌▌  ▐▐     │             │
 │     │      ·    │        *       ·   │                   │  ▐▌ ▐▐▐  ▐▌ ▐▌▌▌  ▐▐     │             │
 │     │ .         │   *                │                   ╰──────────────────────────╯             │
 │     ╰───────────┴────────────────────╯                         │                 │                  │
 │                                                                                                  │
 │                                         .-""""""""""-.                                           │
 │                                      .-'              '-.                  ¿                      │
 │                                    .'                    '.                 ¡                     │
 │                                   /        /\_/\           \             .--------.               │
 │                                  /        (  -.-)           \           /          \__            │
 │                                 ;          >  ^ <             ;         |  cocoa   |  )           │
 │                                 |                              |        \__________/--'            │
 │      ╭──────────────────────╮   |      .----------------.      |          ╱      ╲                │
 │      │                      │   ;     /                  \     ;         ╱________╲               │
 │      │        ¶             │    \   /                    \   /                                    │
 │      │       ¶¤¶            │     '.'                      '.'                                     │
 │      │      §¶¤¶§           │       '-._                _.-'                                       │
 │      │     §¶¤¤¤¶§          │          |                |                                          │
 │      │    /__§§§__\         │          |                |                                          │
 │      │     ══╬═╬══          │         /|                |\                                         │
 │      ╰───────╨─╨────────────╯        /_|________________|_\                                        │
 │         ╱              ╲               ╲                ╱                                          │
 │________╱________________╲_______________ ╲______________/ __________________________________________│
 │                  _..---""""""""""""""""""""""""""""""""---.._                                     │
 │             _.-""       .     .      .      .      .         ""-._                                │
 │          .-"       .       .      .      .      .       .         "-.                             │
 │_________/__________________________________________________________________________________________\│
`.trim().split("\n");

const FRAME_GLYPHS: Array<Record<string, string>> = [
  { "¤": "(", "§": "/", "¶": "^", "¿": "(", "¡": ")" },
  { "¤": ")", "§": "\\", "¶": "*", "¿": ")", "¡": "(" },
  { "¤": "|", "§": "/", "¶": "~", "¿": "(", "¡": "(" },
  { "¤": "(", "§": "\\", "¶": "^", "¿": ")", "¡": ")" },
];

function animatedFrame(glyphs: Record<string, string>): string {
  return frame(
    SNOWED_IN_ART.map((line) =>
      Array.from(line)
        .map((character) => glyphs[character] ?? character)
        .join(""),
    ),
  );
}

export const ASCII_SCENES: AsciiScene[] = [
  {
    id: "snowed-in",
    title: "snowed in",
    subtitle: "somewhere warm, while winter passes",
    description:
      "A sleeping cat, a cup of cocoa, a tiny fire, and snow settling beyond the attic window.",
    frameDuration: 460,
    frames: FRAME_GLYPHS.map(animatedFrame),
    palette: {
      background: "#080b10",
      glow: "#c86432",
      tones: {
        ink: "#6d6968",
        shadow: "#343941",
        wood: "#9b6749",
        warm: "#d4a875",
        ember: "#ec7640",
        fire: "#ffe09a",
        moon: "#83a8c2",
        snow: "#d9edf3",
        leaf: "#799678",
        fabric: "#b38678",
      },
    },
    toneAt: (row, column, character) => {
      if (row >= 8 && row <= 20 && column >= 5 && column <= 38) {
        if ("*·.".includes(character)) return "snow";
        if (character === "○") return "snow";
        if ("│─┬┴├┤╭╮╰╯".includes(character)) return "wood";
        return "moon";
      }
      if (row >= 11 && row <= 20 && column >= 62) {
        if ("●╲╱".includes(character)) return "leaf";
        if ("▌▐i".includes(character)) return "warm";
        return "wood";
      }
      if (row >= 29 && row <= 38 && column >= 6 && column <= 34) {
        if (row >= 31 && row <= 35 && column >= 15 && column <= 25) {
          return "^*~()|/\\".includes(character) ? "fire" : "ember";
        }
        if ("═╬╨".includes(character)) return "ember";
        return "wood";
      }
      if (row >= 22 && row <= 38 && column >= 36 && column <= 69) {
        if (row >= 25 && row <= 28 && column >= 44 && column <= 56) {
          return "warm";
        }
        return "fabric";
      }
      if (row >= 22 && row <= 32 && column >= 70) {
        if ("¿¡()".includes(character)) return "snow";
        return "warm";
      }
      if (row >= 40) return "shadow";
      if (row <= 7 && column >= 38 && column <= 53) return "warm";
      if (row <= 7 && column >= 72) return "leaf";
      if ("╲╱│_".includes(character)) return "wood";
      return "ink";
    },
  },
];
