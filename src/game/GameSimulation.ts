import {
  Achievement,
  BusEntity,
  GameOverReason,
  GameStateStatus,
  PlayerState,
  GameRunStats,
} from '../types/game';
import { soundManager } from '../audio/SoundManager';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'made_it',
    title: 'Made It',
    description: 'Stepped onto Bus 237 on time. Warm heater, condensation on the windows, headed home.',
    unlocked: false,
    icon: '🚌',
  },
  {
    id: 'wrong_destination',
    title: 'Wrong Destination',
    description: 'Boarded Bus 842. Guess you work at the industrial shipping docks now.',
    unlocked: false,
    icon: '🛑',
  },
  {
    id: 'not_today',
    title: 'Not Today',
    description: 'Bus 237 arrived and waited for you, but you chose to stand there in the rain. Iconic.',
    unlocked: false,
    icon: '🌧️',
  },
  {
    id: 'patience_pays',
    title: 'Patience Pays',
    description: 'The driver pulled over right next to you because you didn\'t even move an inch.',
    unlocked: false,
    icon: '🧘',
  },
  {
    id: 'marathon_runner',
    title: 'Marathon Runner',
    description: 'Three sprints in freezing rain. Your lungs are officially on strike.',
    unlocked: false,
    icon: '🏃',
  },
  {
    id: 'almost',
    title: 'Heartbreak',
    description: 'The doors slammed shut right as you reached out. Cinematic tragedy.',
    unlocked: false,
    icon: '💨',
  },
  {
    id: 'delayed_transit',
    title: 'Delayed Transit',
    description: 'Endured an agonizingly late bus in the freezing rain, but made it onboard.',
    unlocked: false,
    icon: '⏳',
  },
  {
    id: 'ghost_bus',
    title: 'Ghost Bus',
    description: 'You swore you heard the engine, but nothing ever emerged from the fog.',
    unlocked: false,
    icon: '👻',
  },
  {
    id: 'cancelled_service',
    title: 'Cancelled Service',
    description: 'No engine, no headlights, just cold rain. The route was cancelled hours ago.',
    unlocked: false,
    icon: '🚏',
  },
  {
    id: 'hospitalized',
    title: 'Hospitalized',
    description: 'Caught your toe on a wet cobblestone. At least the ambulance has central heating.',
    unlocked: false,
    icon: '🏥',
  },
];

export type RunVariant =
  | 'STANDARD'
  | 'DECOY_ONLY'
  | 'DELAYED_BUS'
  | 'GHOST_BUS'
  | 'NO_BUS';

export class GameSimulation {
  public status: GameStateStatus = 'TITLE';
  public gameOverReason: GameOverReason | null = null;
  public timeRemaining: number = 25.0;
  public readonly TOTAL_TIME: number = 25.0;
  public readonly TARGET_DISTANCE: number = 20.0;
  public readonly TURN_DURATION: number = 0.5; // Fast 0.5s snap turn

  public player: PlayerState = {
    z: 0,
    movementState: 'IDLE',
    speed: 0,
    sprintTimer: 0,
    fatigueTimer: 0,
    sprintCount: 0,
    isSuperFatigued: false,
    totalDistanceMoved: 0,
    facing: 'FORWARD',
    yaw: 0,
    targetYaw: 0,
    turningTimer: 0,
    headBobY: 0,
    headBobX: 0,
    bobTime: 0,
    tripped: false,
  };

  public buses: BusEntity[] = [];

  public achievements: Achievement[] = [];
  public newlyUnlockedAchievement: Achievement | null = null;
  public feedbackMessage: string | null = null;
  public feedbackTimer: number = 0;

  // Run variation flags
  public runVariant: RunVariant = 'STANDARD';
  public isPatienceCurbRun: boolean = false;
  private ghostBusZ: number = -60;
  private tripChanceChecked: boolean = false;

  public runStats: GameRunStats = {
    elapsedTime: 0,
    distanceCovered: 0,
    sprintsUsed: 0,
    turnsTaken: 0,
    busSeen: false,
    busNumberSeen: null,
    boardingAttempted: false,
  };

  // Input states
  public keys: {
    forward: boolean;
    sprint: boolean;
    turnLeft: boolean;
    turnRight: boolean;
    board: boolean;
  } = {
    forward: false,
    sprint: false,
    turnLeft: false,
    turnRight: false,
    board: false,
  };

  constructor() {
    this.loadAchievements();
  }

  public loadAchievements() {
    try {
      const saved = localStorage.getItem('board237_achievements_v4');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, { unlocked: boolean; unlockedAt: number }>;
        this.achievements = INITIAL_ACHIEVEMENTS.map((a) => {
          if (parsed[a.id]?.unlocked) {
            return { ...a, unlocked: true, unlockedAt: parsed[a.id].unlockedAt };
          }
          return a;
        });
        return;
      }
    } catch (e) {
      console.warn('Could not read achievements:', e);
    }
    this.achievements = [...INITIAL_ACHIEVEMENTS];
  }

  public saveAchievements() {
    try {
      const record: Record<string, { unlocked: boolean; unlockedAt?: number }> = {};
      this.achievements.forEach((a) => {
        record[a.id] = { unlocked: a.unlocked, unlockedAt: a.unlockedAt };
      });
      localStorage.setItem('board237_achievements_v4', JSON.stringify(record));
    } catch (e) {
      console.warn('Could not save achievements:', e);
    }
  }

  public resetAchievements() {
    this.achievements = INITIAL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, unlockedAt: undefined }));
    this.newlyUnlockedAchievement = null;
    try {
      localStorage.removeItem('board237_achievements_v4');
      localStorage.removeItem('board237_achievements_v3');
      localStorage.removeItem('board237_achievements_v2');
      localStorage.removeItem('board237_achievements');
    } catch (e) {
      console.warn('Error clearing achievements:', e);
    }
  }

  public unlockAchievement(id: string) {
    const ach = this.achievements.find((a) => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      this.newlyUnlockedAchievement = ach;
      soundManager.playAchievementUnlock();
      this.saveAchievements();
    }
  }

  public startNewGame() {
    soundManager.init();
    this.status = 'PLAYING';
    this.gameOverReason = null;
    this.timeRemaining = this.TOTAL_TIME;
    this.newlyUnlockedAchievement = null;
    this.feedbackMessage = null;
    this.feedbackTimer = 0;
    this.tripChanceChecked = false;
    this.ghostBusZ = -70;

    this.player = {
      z: 0,
      movementState: 'IDLE',
      speed: 0,
      sprintTimer: 0,
      fatigueTimer: 0,
      sprintCount: 0,
      isSuperFatigued: false,
      totalDistanceMoved: 0,
      facing: 'FORWARD',
      yaw: 0,
      targetYaw: 0,
      turningTimer: 0,
      headBobY: 0,
      headBobX: 0,
      bobTime: 0,
      tripped: false,
    };

    this.runStats = {
      elapsedTime: 0,
      distanceCovered: 0,
      sprintsUsed: 0,
      turnsTaken: 0,
      busSeen: false,
      busNumberSeen: null,
      boardingAttempted: false,
    };

    // Determine Run Scenario:
    const rand = Math.random();
    if (rand < 0.38) {
      this.runVariant = 'STANDARD';
    } else if (rand < 0.56) {
      // If decoy bus comes, real bus DOES NOT COME
      this.runVariant = 'DECOY_ONLY';
    } else if (rand < 0.74) {
      // Delayed bus scenario (need to wait long time)
      this.runVariant = 'DELAYED_BUS';
    } else if (rand < 0.88) {
      // Ghost bus: hearing engine hum continuously, but no bus ever arrives
      this.runVariant = 'GHOST_BUS';
    } else {
      // No bus at all: complete silence, no engine humming
      this.runVariant = 'NO_BUS';
    }

    // Patience curbside pickup is a rare chance (~30%) when player stands still
    this.isPatienceCurbRun = Math.random() < 0.30;

    this.spawnBuses();
  }

  private spawnBuses() {
    this.buses = [];

    if (this.runVariant === 'DECOY_ONLY') {
      // ONLY Decoy bus 842 comes! The real 237 NEVER arrives.
      this.buses.push({
        id: 'bus_decoy_842',
        routeNumber: '842',
        destination: 'HARBOR DOCKS',
        isTargetBus: false,
        z: -95,
        speed: 16.5,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 6.0,
        headlights: 1.0,
        color: '#065f46',
      });
    } else if (this.runVariant === 'DELAYED_BUS') {
      // Delayed bus: starts extremely far away (-235m) so the wait is long and tense
      this.buses.push({
        id: 'bus_target_237',
        routeNumber: '237',
        destination: 'CENTRAL TERMINAL',
        isTargetBus: true,
        z: -235,
        speed: 16.5,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 6.5,
        headlights: 1.0,
        color: '#065f46',
      });
    } else if (this.runVariant === 'STANDARD') {
      // Standard run: authentic Bus 237 arrives from -140m
      this.buses.push({
        id: 'bus_target_237',
        routeNumber: '237',
        destination: 'CENTRAL TERMINAL',
        isTargetBus: true,
        z: -140,
        speed: 17.5,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 6.5,
        headlights: 1.0,
        color: '#065f46',
      });
    } else if (this.runVariant === 'GHOST_BUS') {
      // No bus entity created! Engine sounds will be simulated in updateBuses()
      this.buses = [];
    } else if (this.runVariant === 'NO_BUS') {
      // No bus and silence! Immediately stop engine
      this.buses = [];
      soundManager.stopEngine();
    }
  }

  public setFeedback(msg: string, duration: number = 2.0) {
    this.feedbackMessage = msg;
    this.feedbackTimer = duration;
  }

  // Handle discrete key actions
  public onKeyDown(code: string) {
    if (this.status === 'TITLE') {
      if (code === 'Space' || code === 'Enter') {
        this.startNewGame();
      }
      return;
    }

    if (this.status === 'GAMEOVER') {
      if (code === 'KeyR' || code === 'Space' || code === 'Enter') {
        this.startNewGame();
      }
      return;
    }

    if (code === 'Escape') {
      this.status = this.status === 'PLAYING' ? 'PAUSED' : 'PLAYING';
      return;
    }

    if (this.status !== 'PLAYING') return;

    if (code === 'KeyW' || code === 'ArrowUp') {
      this.keys.forward = true;
      if (this.player.facing === 'REAR' && this.player.turningTimer <= 0) {
        this.setFeedback('Facing backwards! Press A or D to turn towards the stop.', 1.8);
      }
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.triggerSprint();
    } else if (code === 'KeyA' || code === 'ArrowLeft') {
      this.triggerTurn();
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      this.triggerTurn();
    } else if (code === 'Space') {
      this.attemptBoarding();
    }
  }

  public onKeyUp(code: string) {
    if (code === 'KeyW' || code === 'ArrowUp') {
      this.keys.forward = false;
    }
  }

  private triggerTurn() {
    if (this.player.turningTimer > 0 || this.player.tripped) return;

    this.runStats.turnsTaken++;
    soundManager.playTurnWhoosh();

    if (this.player.facing === 'FORWARD') {
      this.player.targetYaw = Math.PI;
      this.player.turningTimer = this.TURN_DURATION;
      this.player.movementState = 'TURNING';
    } else {
      this.player.targetYaw = 0;
      this.player.turningTimer = this.TURN_DURATION;
      this.player.movementState = 'TURNING';
    }
  }

  private triggerSprint() {
    if (this.player.turningTimer > 0 || this.player.tripped) return;

    // Increment sprint count immediately
    this.player.sprintCount++;
    this.runStats.sprintsUsed++;

    // 3rd sprint triggers Marathon Runner & Super Fatigue
    if (this.player.sprintCount >= 3) {
      this.player.isSuperFatigued = true;
      this.player.sprintTimer = 0;
      this.player.fatigueTimer = 4.5;
      this.player.movementState = 'SUPER_FATIGUE';
      this.unlockAchievement('marathon_runner');
      soundManager.playFatigueGasp(true);
      this.setFeedback('Exhausted! 3 sprints pushed you over the edge!', 3.0);
      return;
    }

    // Start 2.0s sprint
    this.player.sprintTimer = 2.0;
    this.player.fatigueTimer = 0;
    this.player.movementState = 'SPRINTING';
    soundManager.playClick(0.3, 750);
  }

  private triggerTripOnStone() {
    this.player.tripped = true;
    this.player.speed = 0;
    this.player.headBobY = 35; // camera slams down to pavement level
    soundManager.playTripStone();
    this.unlockAchievement('hospitalized');
    this.gameOverReason = 'TRIPPED_STONE';
    this.status = 'GAMEOVER';
    this.setFeedback('OUCH! Tripped on a loose curb stone! Ambulance called.', 4.5);
  }

  public attemptBoarding() {
    if (this.status !== 'PLAYING' || this.player.tripped) return;
    this.runStats.boardingAttempted = true;

    // Find any bus currently with doors open or opening within boarding distance
    let nearestBus: BusEntity | null = null;
    let nearestDist = 999;

    for (const bus of this.buses) {
      const doorZ = bus.z + 1.2;
      const d = Math.abs(this.player.z - doorZ);
      if (d < nearestDist) {
        nearestDist = d;
        nearestBus = bus;
      }
    }

    // Generous boarding distance radius (3.8m)
    if (!nearestBus || nearestDist > 3.8 || (!nearestBus.doorsOpen && nearestBus.doorsProgress < 0.15)) {
      soundManager.playBuzzer();
      this.setFeedback('No open bus doors within reach!', 1.5);

      if (nearestBus && nearestDist < 5.0 && (nearestBus.state === 'DEPARTING' || nearestBus.doorsProgress < 0.35)) {
        this.unlockAchievement('almost');
      }
      return;
    }

    // Attempting to board
    if (nearestBus.isTargetBus) {
      soundManager.playSuccessChime();

      if (this.player.totalDistanceMoved < 0.2) {
        this.unlockAchievement('patience_pays');
        this.gameOverReason = 'PATIENCE_BOARDED';
      } else if (this.runVariant === 'DELAYED_BUS') {
        this.unlockAchievement('delayed_transit');
        this.unlockAchievement('made_it');
        this.gameOverReason = 'DELAYED_SUCCESS';
      } else {
        this.unlockAchievement('made_it');
        this.gameOverReason = 'SUCCESS_237';
      }
      this.status = 'GAMEOVER';
      this.setFeedback('BOARDED BUS 237!', 4.0);
    } else {
      // Boarded decoy bus (842)
      soundManager.playBuzzer();
      this.unlockAchievement('wrong_destination');
      this.gameOverReason = 'IMPOSTER';
      this.status = 'GAMEOVER';
      this.setFeedback(`Boarded Bus ${nearestBus.routeNumber}! Wrong destination!`, 4.0);
    }
  }

  public update(dt: number) {
    if (this.status !== 'PLAYING') return;

    this.runStats.elapsedTime += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedbackMessage = null;
    }

    this.updatePlayer(dt);
    this.updateBuses(dt);
    this.checkTimeOutcomes();
  }

  private updatePlayer(dt: number) {
    if (this.player.tripped) {
      this.player.speed = 0;
      return;
    }

    // 1. Turning transition (0.5s duration)
    if (this.player.turningTimer > 0) {
      this.player.turningTimer = Math.max(0, this.player.turningTimer - dt);
      const progress = 1 - this.player.turningTimer / this.TURN_DURATION;

      if (this.player.targetYaw > 0) {
        this.player.yaw = progress * Math.PI;
      } else {
        this.player.yaw = (1 - progress) * Math.PI;
      }

      if (this.player.turningTimer <= 0) {
        this.player.yaw = this.player.targetYaw;
        this.player.facing = this.player.targetYaw > 0 ? 'REAR' : 'FORWARD';
        this.player.movementState = 'IDLE';
      }
      this.player.speed = 0;
      return;
    }

    // 2. Sprinting & Fatigue Timers
    if (this.player.sprintTimer > 0) {
      this.player.sprintTimer = Math.max(0, this.player.sprintTimer - dt);
      if (this.player.sprintTimer <= 0) {
        this.player.fatigueTimer = 2.5;
        this.player.movementState = 'FATIGUE';
        soundManager.playFatigueGasp(false);
      }
    } else if (this.player.fatigueTimer > 0) {
      this.player.fatigueTimer = Math.max(0, this.player.fatigueTimer - dt);
      if (this.player.fatigueTimer <= 0) {
        this.player.isSuperFatigued = false;
        this.player.movementState = 'IDLE';
      }
    }

    // 3. Movement calculation
    let targetSpeed = 0;
    const isTryingToMove = this.keys.forward && this.player.facing === 'FORWARD';

    if (this.player.sprintTimer > 0) {
      targetSpeed = 2.5;
      this.player.movementState = 'SPRINTING';
    } else if (this.player.isSuperFatigued && this.player.fatigueTimer > 0) {
      targetSpeed = isTryingToMove ? 0.2 : 0;
      this.player.movementState = 'SUPER_FATIGUE';
    } else if (this.player.fatigueTimer > 0) {
      targetSpeed = isTryingToMove ? 0.5 : 0;
      this.player.movementState = 'FATIGUE';
    } else if (isTryingToMove) {
      targetSpeed = 1.0;
      this.player.movementState = 'WALKING';
    } else {
      targetSpeed = 0;
      this.player.movementState = 'IDLE';
    }

    this.player.speed = targetSpeed;

    if (this.player.speed > 0) {
      const deltaZ = this.player.speed * dt;
      if (this.player.z + deltaZ <= this.TARGET_DISTANCE + 1.5) {
        this.player.z += deltaZ;
        this.player.totalDistanceMoved += deltaZ;
        this.runStats.distanceCovered = this.player.z;
      }

      // Check chance to trip over a stone (especially while sprinting through the puddles around 7-14m)
      if (
        !this.tripChanceChecked &&
        this.player.movementState === 'SPRINTING' &&
        this.player.z > 6.0 &&
        this.player.z < 16.0
      ) {
        this.tripChanceChecked = true;
        // 14% chance to trip while sprinting
        if (Math.random() < 0.14) {
          this.triggerTripOnStone();
          return;
        }
      }

      this.player.bobTime += dt * (this.player.speed >= 2.0 ? 16 : 8);
      const bobAmp = this.player.speed >= 2.0 ? 4.5 : 2.5;
      this.player.headBobY = Math.sin(this.player.bobTime) * bobAmp;
      this.player.headBobX = Math.cos(this.player.bobTime * 0.5) * (bobAmp * 0.4);

      const isSprinting = this.player.movementState === 'SPRINTING';
      const isFatigued = this.player.movementState === 'FATIGUE' || this.player.movementState === 'SUPER_FATIGUE';
      soundManager.playFootstep(isSprinting, isFatigued);
    } else {
      this.player.headBobY *= 0.85;
      this.player.headBobX *= 0.85;
    }
  }

  private updateBuses(dt: number) {
    // 1. Ghost Bus Simulation (eerie continuous engine hum in distance, but no actual bus)
    if (this.runVariant === 'GHOST_BUS') {
      // Hover engine sound around 30-45m behind player
      this.ghostBusZ += Math.sin(this.runStats.elapsedTime * 2) * dt * 2.0;
      soundManager.updateBusEngine(this.ghostBusZ, this.player.z, 8.0, true);
      return;
    }

    // 2. No Bus Simulation (Cancelled Service - absolute quiet)
    if (this.runVariant === 'NO_BUS') {
      soundManager.stopEngine();
      return;
    }

    // 3. Physical Buses Simulation
    const isPlayerStill = this.player.totalDistanceMoved < 0.2;

    for (const bus of this.buses) {
      const distToPlayer = Math.abs(bus.z - this.player.z);
      if (distToPlayer < 30) {
        this.runStats.busSeen = true;
        this.runStats.busNumberSeen = bus.routeNumber;
      }

      if (bus.isTargetBus) {
        if (isPlayerStill && this.isPatienceCurbRun) {
          bus.targetZ = 1.5;
        } else {
          bus.targetZ = this.TARGET_DISTANCE;
        }
      }

      // Audio engine update
      soundManager.updateBusEngine(
        bus.z,
        this.player.z,
        bus.speed,
        bus.z < this.player.z
      );

      // Bus state machine
      if (bus.state === 'APPROACHING') {
        bus.z += bus.speed * dt;

        const distToTarget = bus.targetZ - bus.z;
        if (distToTarget <= 28 && distToTarget > 0) {
          bus.state = 'DECELERATING';
          soundManager.playAirBrake();
        }
      } else if (bus.state === 'DECELERATING') {
        const distToTarget = bus.targetZ - bus.z;
        if (distToTarget > 0.3) {
          bus.speed = Math.max(1.8, (distToTarget / 28) * 17.5);
          bus.z += bus.speed * dt;
        } else {
          bus.speed = 0;
          bus.state = 'STOPPED_DOORS_OPEN';
          bus.doorsOpen = true;
          soundManager.playDoorsOpen();
        }
      } else if (bus.state === 'STOPPED_DOORS_OPEN') {
        bus.doorsProgress = Math.min(1.0, bus.doorsProgress + dt * 3);
        bus.doorTimer -= dt;

        if (bus.doorTimer <= 0) {
          bus.doorsOpen = false;
          bus.state = 'DEPARTING';
          soundManager.playDoorsClose();
          soundManager.playAirBrake();
        }
      } else if (bus.state === 'DEPARTING') {
        bus.doorsProgress = Math.max(0, bus.doorsProgress - dt * 3);
        bus.speed = Math.min(20, bus.speed + 7.5 * dt);
        bus.z += bus.speed * dt;

        if (bus.z > this.TARGET_DISTANCE + 25) {
          bus.state = 'PASSED';
        }
      } else if (bus.state === 'PASSED') {
        bus.z += bus.speed * dt;
      }
    }
  }

  private checkTimeOutcomes() {
    if (this.status !== 'PLAYING') return;

    // Check if a target bus arrived, opened doors, but player chose not to board ("Not Today")
    const targetBus = this.buses.find((b) => b.isTargetBus);
    if (targetBus && targetBus.state === 'PASSED') {
      if (!this.runStats.boardingAttempted) {
        // Player let the bus arrive, wait, and leave without boarding
        this.unlockAchievement('not_today');
        this.gameOverReason = 'NOT_TODAY';
        this.status = 'GAMEOVER';
        this.setFeedback('You watched Bus 237 drive away into the dark. Not today.', 4.0);
        return;
      } else {
        const distToDoor = Math.abs(this.player.z - this.TARGET_DISTANCE);
        if (distToDoor < 3.8) {
          this.unlockAchievement('almost');
          this.gameOverReason = 'ALMOST_MISSED';
        } else {
          this.gameOverReason = 'MISSED_BUS';
        }
        this.status = 'GAMEOVER';
        this.setFeedback('The bus drove away without you!', 4.0);
        return;
      }
    }

    // If decoy bus was the only bus and passed away
    const decoyBus = this.buses.find((b) => !b.isTargetBus);
    if (this.runVariant === 'DECOY_ONLY' && decoyBus && decoyBus.state === 'PASSED') {
      this.gameOverReason = 'MISSED_BUS';
      this.status = 'GAMEOVER';
      this.setFeedback('Bus 842 departed. No other bus is coming tonight.', 4.0);
      return;
    }

    // Time expiry outcomes
    if (this.timeRemaining <= 0) {
      if (this.runVariant === 'GHOST_BUS') {
        this.unlockAchievement('ghost_bus');
        this.gameOverReason = 'GHOST_BUS';
        this.status = 'GAMEOVER';
        this.setFeedback('The engine sound faded away. A phantom bus in the night.', 4.5);
        return;
      }

      if (this.runVariant === 'NO_BUS') {
        this.unlockAchievement('cancelled_service');
        this.gameOverReason = 'CANCELLED_SERVICE';
        this.status = 'GAMEOVER';
        this.setFeedback('Total silence. The route was cancelled hours ago.', 4.5);
        return;
      }

      soundManager.playHorn();
      const distToDoor = Math.abs(this.player.z - this.TARGET_DISTANCE);
      if (distToDoor < 3.8) {
        this.unlockAchievement('almost');
        this.gameOverReason = 'ALMOST_MISSED';
      } else if (this.player.isSuperFatigued) {
        this.gameOverReason = 'SUPER_FATIGUE';
      } else {
        this.gameOverReason = 'TIME_EXPIRED';
      }
      this.status = 'GAMEOVER';
      this.setFeedback('Time expired! Stranded in the cold rain.', 4.0);
    }
  }
}

export const gameSim = new GameSimulation();
