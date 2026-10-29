export type GameStateStatus = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type GameOverReason =
  | 'SUCCESS_237'
  | 'MISSED_BUS'
  | 'ALMOST_MISSED'
  | 'SUPER_FATIGUE'
  | 'PATIENCE_BOARDED'
  | 'TOO_PATIENT'
  | 'IMPOSTER'
  | 'TIME_EXPIRED';

export type MovementState =
  | 'IDLE'
  | 'WALKING'
  | 'SPRINTING'
  | 'FATIGUE'
  | 'SUPER_FATIGUE'
  | 'TURNING';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
  icon: string;
}

export interface BusEntity {
  id: string;
  routeNumber: string;
  destination: string;
  isTargetBus: boolean;
  z: number; // world Z in meters
  speed: number; // m/s
  targetZ: number; // where it intends to stop (13.0 or curb)
  state: 'APPROACHING' | 'DECELERATING' | 'STOPPED_DOORS_OPEN' | 'DEPARTING' | 'PASSED';
  doorsOpen: boolean;
  doorsProgress: number; // 0 to 1
  doorTimer: number; // seconds left with open doors
  headlights: number; // 0 to 1
  color: string;
}

export interface PlayerState {
  z: number; // meters from starting point (0 to 13m)
  movementState: MovementState;
  speed: number; // current m/s
  sprintTimer: number; // up to 2.0s
  fatigueTimer: number; // countdown
  sprintCount: number; // total sprints triggered
  isSuperFatigued: boolean;
  totalDistanceMoved: number;
  facing: 'FORWARD' | 'REAR';
  yaw: number; // 0 (forward) to Math.PI (rear)
  targetYaw: number;
  turningTimer: number; // 1.0s countdown during turn
  headBobY: number;
  headBobX: number;
  bobTime: number;
}

export interface GameSettings {
  masterVolume: number;
  rainVolume: number;
  engineVolume: number;
  sfxVolume: number;
  crtEffect: boolean;
  screenShake: boolean;
}

export interface GameRunStats {
  elapsedTime: number;
  distanceCovered: number;
  sprintsUsed: number;
  turnsTaken: number;
  busSeen: boolean;
  busNumberSeen: string | null;
  boardingAttempted: boolean;
}
