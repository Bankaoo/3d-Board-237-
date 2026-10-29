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
    description: 'Board bus 237.',
    unlocked: false,
    icon: '🚌',
  },
  {
    id: 'imposter',
    title: 'Imposter',
    description: 'Board the decoy bus.',
    unlocked: false,
    icon: '🛑',
  },
  {
    id: 'marathon_runner',
    title: 'Marathon Runner',
    description: 'Sprint 3 times until completely out of breath.',
    unlocked: false,
    icon: '🏃',
  },
  {
    id: 'patience_pays',
    title: 'Patience Pays',
    description: 'Board without taking a single step.',
    unlocked: false,
    icon: '🧘',
  },
  {
    id: 'too_patient',
    title: 'Too Patient',
    description: 'Stand still and let the bus pass.',
    unlocked: false,
    icon: '🌧️',
  },
  {
    id: 'almost',
    title: 'Almost',
    description: 'Miss the bus by a small margin.',
    unlocked: false,
    icon: '💨',
  },
];

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
  };

  public buses: BusEntity[] = [];

  public achievements: Achievement[] = [];
  public newlyUnlockedAchievement: Achievement | null = null;
  public feedbackMessage: string | null = null;
  public feedbackTimer: number = 0;

  // Run variation flags
  public isDecoyRun: boolean = false;
  public isPatienceCurbRun: boolean = false;

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
      const saved = localStorage.getItem('board237_achievements_v3');
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
      localStorage.setItem('board237_achievements_v3', JSON.stringify(record));
    } catch (e) {
      console.warn('Could not save achievements:', e);
    }
  }

  public resetAchievements() {
    this.achievements = INITIAL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, unlockedAt: undefined }));
    this.newlyUnlockedAchievement = null;
    try {
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

    // Roll rare optionals:
    // Decoy bus is rare: ~22% chance
    this.isDecoyRun = Math.random() < 0.22;
    // Patience curbside pickup is rare: ~30% chance when staying still
    this.isPatienceCurbRun = Math.random() < 0.30;

    this.spawnBuses();
  }

  private spawnBuses() {
    this.buses = [];

    if (this.isDecoyRun) {
      // Rare Decoy Bus 842 arrives ahead of 237
      this.buses.push({
        id: 'bus_decoy_842',
        routeNumber: '842',
        destination: 'HARBOR DOCKS',
        isTargetBus: false,
        z: -95,
        speed: 17.0,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 4.8,
        headlights: 1.0,
        color: '#065f46',
      });

      // Target Bus 237 follows behind
      this.buses.push({
        id: 'bus_target_237',
        routeNumber: '237',
        destination: 'CENTRAL TERMINAL',
        isTargetBus: true,
        z: -175,
        speed: 18.0,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 6.5,
        headlights: 1.0,
        color: '#065f46',
      });
    } else {
      // Standard run: authentic Bus 237 starts far down the street (-145m)
      this.buses.push({
        id: 'bus_target_237',
        routeNumber: '237',
        destination: 'CENTRAL TERMINAL',
        isTargetBus: true,
        z: -145,
        speed: 18.0,
        targetZ: this.TARGET_DISTANCE,
        state: 'APPROACHING',
        doorsOpen: false,
        doorsProgress: 0,
        doorTimer: 6.5,
        headlights: 1.0,
        color: '#065f46',
      });
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
    if (this.player.turningTimer > 0) return; // already turning

    this.runStats.turnsTaken++;
    soundManager.playTurnWhoosh();

    if (this.player.facing === 'FORWARD') {
      this.player.targetYaw = Math.PI;
      this.player.turningTimer = this.TURN_DURATION; // Fast 0.5s turn
      this.player.movementState = 'TURNING';
    } else {
      this.player.targetYaw = 0;
      this.player.turningTimer = this.TURN_DURATION;
      this.player.movementState = 'TURNING';
    }
  }

  private triggerSprint() {
    if (this.player.turningTimer > 0) return;

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

  public attemptBoarding() {
    if (this.status !== 'PLAYING') return;
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
      } else {
        this.unlockAchievement('made_it');
        this.gameOverReason = 'SUCCESS_237';
      }
      this.status = 'GAMEOVER';
      this.setFeedback('BOARDED BUS 237!', 4.0);
    } else {
      // Boarded decoy bus (842)
      soundManager.playBuzzer();
      this.unlockAchievement('imposter');
      this.gameOverReason = 'IMPOSTER';
      this.status = 'GAMEOVER';
      this.setFeedback(`Boarded Bus ${nearestBus.routeNumber}! Wrong bus!`, 4.0);
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
        // Sprint ended -> enter ordinary fatigue (2.5s)
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
    const isPlayerStill = this.player.totalDistanceMoved < 0.2;

    for (const bus of this.buses) {
      const distToPlayer = Math.abs(bus.z - this.player.z);
      if (distToPlayer < 30) {
        this.runStats.busSeen = true;
        this.runStats.busNumberSeen = bus.routeNumber;
      }

      // If player remains completely still AND this run rolled the rare patience curbside pickup:
      if (bus.isTargetBus) {
        if (isPlayerStill && this.isPatienceCurbRun) {
          bus.targetZ = 1.5; // Rare curbside stop
        } else {
          bus.targetZ = this.TARGET_DISTANCE; // Regular shelter stop
        }
      }

      // Audio engine update for primary approaching bus (supports far distance rumble)
      if (bus.isTargetBus || (bus.state !== 'PASSED' && this.buses.length > 0)) {
        soundManager.updateBusEngine(
          bus.z,
          this.player.z,
          bus.speed,
          bus.z < this.player.z
        );
      }

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

    const targetBus = this.buses.find((b) => b.isTargetBus);

    // If target bus drove past and departed
    if (targetBus && targetBus.state === 'PASSED') {
      if (this.player.totalDistanceMoved < 0.2) {
        this.unlockAchievement('too_patient');
        this.gameOverReason = 'TOO_PATIENT';
        this.status = 'GAMEOVER';
        this.setFeedback('You stood still in the rain as 237 passed into the dark.', 4.0);
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

    // Time expiry
    if (this.timeRemaining <= 0) {
      soundManager.playHorn();
      const distToDoor = Math.abs(this.player.z - this.TARGET_DISTANCE);
      if (distToDoor < 3.8) {
        this.unlockAchievement('almost');
        this.gameOverReason = 'ALMOST_MISSED';
      } else if (this.player.isSuperFatigued) {
        this.gameOverReason = 'SUPER_FATIGUE';
      } else if (this.player.totalDistanceMoved < 0.2) {
        this.unlockAchievement('too_patient');
        this.gameOverReason = 'TOO_PATIENT';
      } else {
        this.gameOverReason = 'TIME_EXPIRED';
      }
      this.status = 'GAMEOVER';
      this.setFeedback('Time expired! Stranded in the rain.', 4.0);
    }
  }
}

export const gameSim = new GameSimulation();
