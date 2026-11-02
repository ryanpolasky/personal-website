export const PROJECT_HOLD = 1.65;
export const PROJECT_RIPPLE = { delay: 0.12, step: 0.085, duration: 0.5 };
export const PROJECT_REVEAL = PROJECT_HOLD + 0.27;
export const PROJECT_ARRIVAL_END = PROJECT_REVEAL + 1.5;

export interface ProjectArrival {
  time: number;
}
