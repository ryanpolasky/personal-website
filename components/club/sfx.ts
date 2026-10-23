type Sound = "hover" | "click" | "open" | "close" | "typing" | "shatter";

let enabled = true;
let master: GainNode | null = null;

function getMaster(context: AudioContext): GainNode {
  if (!master) {
    master = context.createGain();
    master.gain.value = 0.25;
    master.connect(context.destination);
  }
  return master;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

export function playClubSfx(sound: Sound) {
  if (!enabled || typeof window === "undefined") return;
  const audioWindow = window as Window & {
    __ryClubAudioContext?: AudioContext;
  };
  const context =
    audioWindow.__ryClubAudioContext ?? new AudioContext();
  audioWindow.__ryClubAudioContext = context;
  void context.resume();
  const output = getMaster(context);
  const now = context.currentTime;

  if (sound === "typing" || sound === "shatter") {
    const length = sound === "typing" ? 0.012 : 0.18;
    const buffer = context.createBuffer(
      1,
      Math.max(1, Math.floor(context.sampleRate * length)),
      context.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = sound === "typing" ? 2200 : 500;
    gain.gain.setValueAtTime(sound === "typing" ? 0.13 : 0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    source.connect(filter).connect(gain).connect(output);
    source.start(now);
    if (sound === "shatter") {
      const oscillator = context.createOscillator();
      const thump = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(92, now);
      oscillator.frequency.exponentialRampToValueAtTime(38, now + 0.2);
      thump.gain.setValueAtTime(0.3, now);
      thump.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      oscillator.connect(thump).connect(output);
      oscillator.start(now);
      oscillator.stop(now + 0.21);
    }
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain).connect(output);
  oscillator.type = "square";
  const duration = sound === "hover" ? 0.03 : sound === "click" ? 0.1 : 0.18;
  const start = sound === "hover" ? 1200 : sound === "click" ? 720 : 440;
  const end =
    sound === "open" ? 880 : sound === "close" ? 220 : sound === "click" ? 980 : start;
  oscillator.frequency.setValueAtTime(start, now);
  if (sound === "click") {
    oscillator.frequency.setValueAtTime(980, now + 0.045);
  } else if (sound !== "hover") {
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  }
  gain.gain.setValueAtTime(sound === "hover" ? 0.12 : 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration);
}
