import { BusEntity, PlayerState } from '../types/game';

interface Raindrop {
  x: number;
  y: number;
  z: number;
  speed: number;
  length: number;
}

interface Splash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface LensDrop {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
  dist: number;
}

export class PerspectiveRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public readonly WIDTH = 640;
  public readonly HEIGHT = 360;
  private readonly FOCAL_LENGTH = 360;
  private readonly CAMERA_HEIGHT = 1.65; // Eye height in meters
  private readonly PLAYER_X = 1.2; // Player walks on sidewalk

  // Rain particles
  private raindrops: Raindrop[] = [];
  private splashes: Splash[] = [];
  private lensDrops: LensDrop[] = [];
  private animTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initWeather();
  }

  private initWeather() {
    this.raindrops = [];
    for (let i = 0; i < 180; i++) {
      this.raindrops.push({
        x: (Math.random() - 0.5) * 18,
        y: Math.random() * 6 + 0.2,
        z: Math.random() * 35 + 0.5,
        speed: 12 + Math.random() * 8,
        length: 0.25 + Math.random() * 0.2,
      });
    }

    this.lensDrops = [];
    for (let i = 0; i < 22; i++) {
      this.lensDrops.push({
        x: Math.random() * this.WIDTH,
        y: Math.random() * this.HEIGHT,
        radius: 1.5 + Math.random() * 2.5,
        speed: 0.1 + Math.random() * 0.3,
        alpha: 0.25 + Math.random() * 0.35,
      });
    }
  }

  // 3D Perspective Projection helper
  private project(
    worldX: number,
    worldY: number,
    worldZ: number,
    player: PlayerState
  ): ProjectedPoint {
    const vpX = this.WIDTH / 2 + player.headBobX;
    const vpY = this.HEIGHT * 0.42 + player.headBobY;

    const dx = worldX - this.PLAYER_X;
    const dz = worldZ - player.z;

    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);

    const camX = dx * cosYaw - dz * sinYaw;
    const camZ = dx * sinYaw + dz * cosYaw;

    if (camZ <= 0.35) {
      return { x: 0, y: 0, scale: 0, visible: false, dist: camZ };
    }

    const scale = this.FOCAL_LENGTH / camZ;
    const sx = vpX + camX * scale;
    const sy = vpY + (this.CAMERA_HEIGHT - worldY) * scale;

    return {
      x: sx,
      y: sy,
      scale,
      visible: camZ > 0.35 && camZ < 65,
      dist: camZ,
    };
  }

  // 2D screen cross-product for backface culling (clockwise order)
  private isFaceVisible(p0: ProjectedPoint, p1: ProjectedPoint, p2: ProjectedPoint): boolean {
    if (!p0.visible || !p1.visible || !p2.visible) return false;
    const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    return cross > 0;
  }

  public render(
    player: PlayerState,
    buses: BusEntity[],
    dt: number,
    isSuperFatigued: boolean
  ) {
    this.animTime += dt;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
    ctx.imageSmoothingEnabled = false;

    // LAYER 1 & 2: Sky, Distant City Skyline, Parallax
    this.renderSkyAndSkyline(player);

    // LAYER 3: Road & Sidewalk Ground Perspective
    this.renderGround(player, buses);

    // LAYER 4: Streetlights and Light Pools
    this.renderStreetlights(player);

    // LAYER 5: Bus Stop Shelter at Z = 20.0m
    this.renderBusShelter(player);

    // LAYER 6: Dynamic 3D Buses with realistic pixel-art details
    this.renderBuses(player, buses);

    // LAYER 7: Rain, Splashes, Headlight Cones, Lens Moisture
    this.renderWeather(player, dt, isSuperFatigued);
  }

  private renderSkyAndSkyline(player: PlayerState) {
    const ctx = this.ctx;
    const vpY = this.HEIGHT * 0.42 + player.headBobY;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, vpY + 20);
    skyGrad.addColorStop(0, '#040711');
    skyGrad.addColorStop(0.65, '#091122');
    skyGrad.addColorStop(1, '#111b33');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.WIDTH, vpY + 20);

    const yawNorm = (player.yaw / Math.PI) * 0.5;
    const skylineOffset = (yawNorm * this.WIDTH * 1.5) % this.WIDTH;

    // Moon with rainy halo
    const moonX = ((this.WIDTH * 0.75 - skylineOffset) + this.WIDTH) % this.WIDTH;
    const moonY = vpY - 75;
    ctx.save();
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 32);
    moonGlow.addColorStop(0, 'rgba(230, 240, 255, 0.4)');
    moonGlow.addColorStop(0.3, 'rgba(150, 180, 220, 0.15)');
    moonGlow.addColorStop(1, 'rgba(10, 20, 40, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Distant City Skyline Silhouettes
    const buildings = [
      { x: 10, w: 45, h: 80, lights: true },
      { x: 60, w: 30, h: 55, lights: true },
      { x: 95, w: 65, h: 105, antenna: true, lights: true },
      { x: 165, w: 40, h: 70, lights: false },
      { x: 210, w: 55, h: 90, lights: true },
      { x: 270, w: 75, h: 120, antenna: true, lights: true },
      { x: 350, w: 35, h: 60, lights: true },
      { x: 390, w: 85, h: 95, lights: true },
      { x: 480, w: 50, h: 85, lights: true },
      { x: 535, w: 60, h: 110, antenna: true, lights: true },
      { x: 600, w: 50, h: 65, lights: false },
    ];

    ctx.save();
    buildings.forEach((b) => {
      const bx = ((b.x - skylineOffset) % (this.WIDTH + 50) + this.WIDTH + 50) % (this.WIDTH + 50) - 40;
      const by = vpY - b.h;

      ctx.fillStyle = '#0a101f';
      ctx.fillRect(bx, by, b.w, b.h + 20);

      if (b.antenna) {
        ctx.strokeStyle = '#0a101f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + b.w / 2, by);
        ctx.lineTo(bx + b.w / 2, by - 16);
        ctx.stroke();

        const pulse = (Math.sin(this.animTime * 3 + b.x) + 1) * 0.5;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.6})`;
        ctx.fillRect(bx + b.w / 2 - 2, by - 18, 4, 4);
      }

      if (b.lights) {
        ctx.fillStyle = '#fef08a';
        for (let wy = by + 12; wy < vpY - 5; wy += 9) {
          for (let wx = bx + 6; wx < bx + b.w - 6; wx += 8) {
            const lit = ((wx * 17 + wy * 31) % 7) > 3;
            if (lit) {
              ctx.globalAlpha = 0.4 + (((wx + wy) % 5) / 10);
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }
    });
    ctx.restore();

    // Horizon fog
    const haze = ctx.createLinearGradient(0, vpY - 20, 0, vpY + 10);
    haze.addColorStop(0, 'rgba(10, 20, 35, 0)');
    haze.addColorStop(0.7, 'rgba(15, 26, 46, 0.7)');
    haze.addColorStop(1, 'rgba(12, 22, 38, 0.95)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, vpY - 20, this.WIDTH, 35);
  }

  private renderGround(player: PlayerState, buses: BusEntity[]) {
    const ctx = this.ctx;
    const vpY = this.HEIGHT * 0.42 + player.headBobY;

    const groundGrad = ctx.createLinearGradient(0, vpY, 0, this.HEIGHT);
    groundGrad.addColorStop(0, '#0c1626');
    groundGrad.addColorStop(0.4, '#09101b');
    groundGrad.addColorStop(1, '#050a12');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, vpY, this.WIDTH, this.HEIGHT - vpY);

    const zSteps: number[] = [];
    const zMin = Math.floor(player.z - 20);
    const zMax = Math.ceil(player.z + 55);
    for (let z = zMin; z <= zMax; z += 1.0) {
      zSteps.push(z);
    }

    // 1. Curb Stone Line at X = 0.4
    ctx.save();
    for (let i = 0; i < zSteps.length - 1; i++) {
      const z1 = zSteps[i];
      const z2 = zSteps[i + 1];

      const p1Road = this.project(0.4, 0, z1, player);
      const p2Road = this.project(0.4, 0, z2, player);
      const p1Curb = this.project(0.4, 0.12, z1, player);
      const p2Curb = this.project(0.4, 0.12, z2, player);
      const p1Walk = this.project(0.6, 0.12, z1, player);
      const p2Walk = this.project(0.6, 0.12, z2, player);

      if (p1Road.visible && p2Road.visible) {
        ctx.fillStyle = (Math.abs(z1) % 2 === 0) ? '#1e293b' : '#334155';
        ctx.beginPath();
        ctx.moveTo(p1Road.x, p1Road.y);
        ctx.lineTo(p2Road.x, p2Road.y);
        ctx.lineTo(p2Curb.x, p2Curb.y);
        ctx.lineTo(p1Curb.x, p1Curb.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(p1Curb.x, p1Curb.y);
        ctx.lineTo(p2Curb.x, p2Curb.y);
        ctx.lineTo(p2Walk.x, p2Walk.y);
        ctx.lineTo(p1Walk.x, p1Walk.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Road Markings
    for (let i = 0; i < zSteps.length - 1; i++) {
      const z1 = zSteps[i];
      const z2 = zSteps[i + 1];

      // Double yellow center line at X = -2.0
      const pl1 = this.project(-2.05, 0, z1, player);
      const pl2 = this.project(-2.05, 0, z2, player);
      const pr1 = this.project(-1.95, 0, z1, player);
      const pr2 = this.project(-1.95, 0, z2, player);

      if (pl1.visible && pl2.visible) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(1, pl1.scale * 0.05);
        ctx.beginPath();
        ctx.moveTo(pl1.x, pl1.y);
        ctx.lineTo(pl2.x, pl2.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pr1.x, pr1.y);
        ctx.lineTo(pr2.x, pr2.y);
        ctx.stroke();
      }

      // White dashed lane line at X = -0.7
      if (Math.abs(Math.floor(z1)) % 3 === 0) {
        const pd1 = this.project(-0.7, 0, z1, player);
        const pd2 = this.project(-0.7, 0, z2, player);
        if (pd1.visible && pd2.visible) {
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)';
          ctx.lineWidth = Math.max(1, pd1.scale * 0.08);
          ctx.beginPath();
          ctx.moveTo(pd1.x, pd1.y);
          ctx.lineTo(pd2.x, pd2.y);
          ctx.stroke();
        }
      }

      // Sidewalk paving slabs grid
      const sw1 = this.project(1.8, 0.12, z1, player);
      const sw2 = this.project(1.8, 0.12, z2, player);
      if (sw1.visible && sw2.visible) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sw1.x, sw1.y);
        ctx.lineTo(sw2.x, sw2.y);
        ctx.stroke();
      }
    }

    // 3. Bus Stop painted box at Z = 18.5 to 21.5 (Destination Shelter)
    const b1 = this.project(0.2, 0, 18.5, player);
    const b2 = this.project(0.2, 0, 21.5, player);
    const b3 = this.project(-1.4, 0, 21.5, player);
    const b4 = this.project(-1.4, 0, 18.5, player);
    if (b1.visible && b2.visible && b3.visible && b4.visible) {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = Math.max(1.5, b1.scale * 0.05);
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(b3.x, b3.y);
      ctx.lineTo(b4.x, b4.y);
      ctx.closePath();
      ctx.stroke();

      const bCenter = this.project(-0.6, 0.01, 20.0, player);
      if (bCenter.visible) {
        ctx.save();
        ctx.font = `bold ${Math.max(7, Math.floor(bCenter.scale * 0.35))}px monospace`;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText('BUS STOP 237', bCenter.x, bCenter.y);
        ctx.restore();
      }
    }

    // 4. Wet asphalt reflections
    this.renderWetReflections(player, buses);
    ctx.restore();
  }

  private renderWetReflections(player: PlayerState, buses: BusEntity[]) {
    const ctx = this.ctx;
    const puddleLocations = [
      { x: 1.1, z: 3.0, w: 0.6, l: 1.2 },
      { x: 1.4, z: 9.5, w: 0.8, l: 1.5 },
      { x: 1.0, z: 16.0, w: 0.7, l: 1.3 },
      { x: 1.2, z: 19.5, w: 0.8, l: 1.4 },
      { x: -1.2, z: 5.0, w: 1.2, l: 2.5 },
      { x: -2.8, z: 12.0, w: 1.5, l: 3.0 },
      { x: -0.8, z: 18.0, w: 1.0, l: 2.0 },
    ];

    puddleLocations.forEach((pud) => {
      const proj = this.project(pud.x, 0.05, pud.z, player);
      if (proj.visible) {
        const pw = pud.w * proj.scale;
        const ph = pud.l * proj.scale * 0.35;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, pw, ph, 0, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createLinearGradient(proj.x - pw, proj.y, proj.x + pw, proj.y);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
        grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.25)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, pw * 0.8, ph * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // Reflect bus headlights
    buses.forEach((bus) => {
      if (bus.headlights > 0) {
        const hlCenter = this.project(-2.4, 0.02, bus.z + 5.0, player);
        if (hlCenter.visible) {
          const rw = Math.max(16, hlCenter.scale * 2.5);
          const rh = Math.max(6, hlCenter.scale * 0.7);
          const hlGrad = ctx.createRadialGradient(hlCenter.x, hlCenter.y, 2, hlCenter.x, hlCenter.y, rw);
          hlGrad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
          hlGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.2)');
          hlGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
          ctx.fillStyle = hlGrad;
          ctx.beginPath();
          ctx.ellipse(hlCenter.x, hlCenter.y, rw, rh, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  private renderStreetlights(player: PlayerState) {
    const ctx = this.ctx;
    const lightZPositions = [-20, -10, 0, 10, 20, 30, 40];

    lightZPositions.forEach((lz) => {
      const base = this.project(0.55, 0.12, lz, player);
      const lantern = this.project(0.4, 3.8, lz, player);

      if (base.visible && lantern.visible) {
        const poolRadius = Math.max(12, base.scale * 1.8);
        const poolGrad = ctx.createRadialGradient(base.x, base.y, 1, base.x, base.y, poolRadius);
        poolGrad.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
        poolGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
        poolGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
        ctx.fillStyle = poolGrad;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, poolRadius, poolRadius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.5, base.scale * 0.04);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(lantern.x, lantern.y);
        ctx.stroke();

        const lSize = Math.max(3, base.scale * 0.12);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(lantern.x - lSize / 2, lantern.y - lSize / 2, lSize, lSize);

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lantern.x - lSize * 0.35, lantern.y - lSize * 0.35, lSize * 0.7, lSize * 0.7);

        const glowRad = Math.max(8, base.scale * 0.4);
        const glow = ctx.createRadialGradient(lantern.x, lantern.y, 1, lantern.x, lantern.y, glowRad);
        glow.addColorStop(0, 'rgba(254, 240, 138, 0.6)');
        glow.addColorStop(0.4, 'rgba(251, 191, 36, 0.2)');
        glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lantern.x, lantern.y, glowRad, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private renderBusShelter(player: PlayerState) {
    const ctx = this.ctx;
    const shelterZ = 20.0;

    // Shelter at Z = 19.0 to 21.2
    const pBL = this.project(2.0, 0.12, 19.0, player);
    const pBR = this.project(2.0, 0.12, 21.2, player);
    const pTL = this.project(2.0, 2.6, 19.0, player);
    const pTR = this.project(2.0, 2.6, 21.2, player);

    const pBackBL = this.project(3.2, 0.12, 19.0, player);
    const pBackBR = this.project(3.2, 0.12, 21.2, player);
    const pBackTL = this.project(3.2, 2.6, 19.0, player);
    const pBackTR = this.project(3.2, 2.6, 21.2, player);

    if (pBL.visible && pBR.visible && pTL.visible && pTR.visible) {
      if (pBackBL.visible && pBackBR.visible) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.beginPath();
        ctx.moveTo(pBackBL.x, pBackBL.y);
        ctx.lineTo(pBackBR.x, pBackBR.y);
        ctx.lineTo(pBackTR.x, pBackTR.y);
        ctx.lineTo(pBackTL.x, pBackTL.y);
        ctx.closePath();
        ctx.fill();

        // Wooden bench
        const benchL = this.project(2.6, 0.55, 19.4, player);
        const benchR = this.project(2.6, 0.55, 20.8, player);
        if (benchL.visible && benchR.visible) {
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = Math.max(2, benchL.scale * 0.08);
          ctx.beginPath();
          ctx.moveTo(benchL.x, benchL.y);
          ctx.lineTo(benchR.x, benchR.y);
          ctx.stroke();
        }

        // Illuminated Timetable Board
        const boardL = this.project(3.15, 1.1, 19.8, player);
        const boardR = this.project(3.15, 1.1, 20.4, player);
        const boardTopL = this.project(3.15, 2.0, 19.8, player);
        if (boardL.visible && boardR.visible && boardTopL.visible) {
          const bw = Math.abs(boardR.x - boardL.x);
          const bh = Math.abs(boardTopL.y - boardL.y);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.fillRect(Math.min(boardL.x, boardR.x), boardTopL.y, Math.max(bw, 4), Math.max(bh, 8));

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(Math.min(boardL.x, boardR.x) + 2, boardTopL.y + 3, Math.max(bw - 4, 2), 2);
        }
      }

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(2, pBL.scale * 0.06);

      ctx.beginPath();
      ctx.moveTo(pBL.x, pBL.y);
      ctx.lineTo(pTL.x, pTL.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pBR.x, pBR.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pTR.x, pTR.y);
      if (pBackTR.visible && pBackTL.visible) {
        ctx.lineTo(pBackTR.x, pBackTR.y);
        ctx.lineTo(pBackTL.x, pBackTL.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bus Stop Roundel Sign
      const signPost = this.project(1.7, 0.12, 18.6, player);
      const signHead = this.project(1.7, 2.7, 18.6, player);
      if (signPost.visible && signHead.visible) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.5, signPost.scale * 0.04);
        ctx.beginPath();
        ctx.moveTo(signPost.x, signPost.y);
        ctx.lineTo(signHead.x, signHead.y);
        ctx.stroke();

        const sRad = Math.max(4, signPost.scale * 0.18);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(signHead.x, signHead.y, sRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(signHead.x, signHead.y, sRad * 0.65, 0, Math.PI * 2);
        ctx.fill();

        if (sRad > 8) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold ${Math.floor(sRad * 0.6)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('237', signHead.x, signHead.y);
        }
      }
    }
  }

  // 3D / 2.5D Bus Rendering
  private renderBuses(player: PlayerState, buses: BusEntity[]) {
    // Sort buses furthest to nearest
    const sorted = [...buses].sort((a, b) => {
      const da = Math.abs(a.z - player.z);
      const db = Math.abs(b.z - player.z);
      return db - da;
    });

    sorted.forEach((bus) => {
      this.renderSingle3DBus(player, bus);
    });
  }

  private renderSingle3DBus(player: PlayerState, bus: BusEntity) {
    const ctx = this.ctx;

    // Bus 3D Geometry
    const busFrontZ = bus.z + 9.5;
    const busRearZ = bus.z;
    const xL = -3.8; // Streetside
    const xR = -1.2; // Curbside (doors)
    const yBottom = 0.28;
    const yTop = 3.35;

    // 8 Box Vertices
    const fBL = this.project(xL, yBottom, busFrontZ, player);
    const fBR = this.project(xR, yBottom, busFrontZ, player);
    const fTL = this.project(xL, yTop, busFrontZ, player);
    const fTR = this.project(xR, yTop, busFrontZ, player);

    const rBL = this.project(xL, yBottom, busRearZ, player);
    const rBR = this.project(xR, yBottom, busRearZ, player);
    const rTL = this.project(xL, yTop, busRearZ, player);
    const rTR = this.project(xR, yTop, busRearZ, player);

    // If whole bus outside frustum
    if (!fBL.visible && !rBL.visible && !fBR.visible && !rBR.visible) {
      return;
    }

    ctx.save();

    // 1. Headlight Cones on Road (projected forward from front bumper)
    if (fBL.visible && fBR.visible && bus.headlights > 0) {
      const bmL = this.project(xL - 0.6, 0.04, busFrontZ + 16, player);
      const bmR = this.project(xR + 1.2, 0.04, busFrontZ + 16, player);
      if (bmL.visible && bmR.visible) {
        const bmGrad = ctx.createLinearGradient(fBR.x, fBR.y, bmR.x, bmR.y);
        bmGrad.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        bmGrad.addColorStop(0.35, 'rgba(253, 224, 71, 0.3)');
        bmGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = bmGrad;
        ctx.beginPath();
        ctx.moveTo(fBL.x, fBL.y);
        ctx.lineTo(fBR.x, fBR.y);
        ctx.lineTo(bmR.x, bmR.y);
        ctx.lineTo(bmL.x, bmL.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Chassis Shadow on Asphalt
    const sh1 = this.project(xL - 0.2, 0.02, busFrontZ + 0.4, player);
    const sh2 = this.project(xR + 0.2, 0.02, busFrontZ + 0.4, player);
    const sh3 = this.project(xR + 0.2, 0.02, busRearZ - 0.4, player);
    const sh4 = this.project(xL - 0.2, 0.02, busRearZ - 0.4, player);
    if (sh1.visible && sh2.visible && sh3.visible && sh4.visible) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
      ctx.beginPath();
      ctx.moveTo(sh1.x, sh1.y);
      ctx.lineTo(sh2.x, sh2.y);
      ctx.lineTo(sh3.x, sh3.y);
      ctx.lineTo(sh4.x, sh4.y);
      ctx.closePath();
      ctx.fill();
    }

    // Determine face visibility using 2D screen cross-products (backface culling)
    const showFront = this.isFaceVisible(fBL, fBR, fTR);
    const showRear = this.isFaceVisible(rBR, rBL, rTL);
    const showCurbside = this.isFaceVisible(fBR, rBR, rTR);
    const showStreetside = this.isFaceVisible(rBL, fBL, fTL);
    const showRoof = this.isFaceVisible(fTL, fTR, rTR);

    // List of visible faces sorted by camera distance (painter's algorithm)
    interface FaceItem {
      id: 'FRONT' | 'REAR' | 'CURBSIDE' | 'STREETSIDE' | 'ROOF';
      dist: number;
    }
    const faces: FaceItem[] = [];

    if (showFront) faces.push({ id: 'FRONT', dist: (fBL.dist + fBR.dist) / 2 });
    if (showRear) faces.push({ id: 'REAR', dist: (rBL.dist + rBR.dist) / 2 });
    if (showCurbside) faces.push({ id: 'CURBSIDE', dist: (fBR.dist + rBR.dist) / 2 });
    if (showStreetside) faces.push({ id: 'STREETSIDE', dist: (fBL.dist + rBL.dist) / 2 });
    if (showRoof) faces.push({ id: 'ROOF', dist: (fTL.dist + rTR.dist) / 2 });

    // Sort furthest face first
    faces.sort((a, b) => b.dist - a.dist);

    // Draw each face in depth order
    for (const f of faces) {
      if (f.id === 'ROOF') {
        this.drawBusRoof(player, bus, fTL, fTR, rTR, rTL);
      } else if (f.id === 'STREETSIDE') {
        this.drawBusStreetside(player, bus, rBL, fBL, fTL, rTL, xL, yBottom, busRearZ, busFrontZ);
      } else if (f.id === 'CURBSIDE') {
        this.drawBusCurbside(player, bus, fBR, rBR, rTR, fTR, xR, yBottom, busRearZ, busFrontZ);
      } else if (f.id === 'FRONT') {
        this.drawBusFront(player, bus, fBL, fBR, fTR, fTL, xL, xR, busFrontZ);
      } else if (f.id === 'REAR') {
        this.drawBusRear(player, bus, rBR, rBL, rTL, rTR, xL, xR, busRearZ);
      }
    }

    ctx.restore();
  }

  // --- BUS FACE DRAWING IMPLEMENTATIONS ---

  private drawBusRoof(
    _player: PlayerState,
    _bus: BusEntity,
    p1: ProjectedPoint,
    p2: ProjectedPoint,
    p3: ProjectedPoint,
    p4: ProjectedPoint
  ) {
    const ctx = this.ctx;
    ctx.fillStyle = '#042f2e'; // Dark roof tone
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBusCurbside(
    player: PlayerState,
    bus: BusEntity,
    pFrontB: ProjectedPoint,
    pRearB: ProjectedPoint,
    pRearT: ProjectedPoint,
    pFrontT: ProjectedPoint,
    xR: number,
    yBottom: number,
    busRearZ: number,
    busFrontZ: number
  ) {
    const ctx = this.ctx;

    // Body base (Emerald Green Livery #065f46)
    ctx.fillStyle = bus.color;
    ctx.beginPath();
    ctx.moveTo(pRearB.x, pRearB.y);
    ctx.lineTo(pFrontB.x, pFrontB.y);
    ctx.lineTo(pFrontT.x, pFrontT.y);
    ctx.lineTo(pRearT.x, pRearT.y);
    ctx.closePath();
    ctx.fill();

    // Dark lower skirt
    const skirtF = this.project(xR, yBottom + 0.35, busFrontZ, player);
    const skirtR = this.project(xR, yBottom + 0.35, busRearZ, player);
    if (skirtF.visible && skirtR.visible) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(pRearB.x, pRearB.y);
      ctx.lineTo(pFrontB.x, pFrontB.y);
      ctx.lineTo(skirtF.x, skirtF.y);
      ctx.lineTo(skirtR.x, skirtR.y);
      ctx.closePath();
      ctx.fill();
    }

    // Cream / Off-White Transit Stripe (#fef3c7)
    const st1F = this.project(xR, 1.35, busFrontZ, player);
    const st1R = this.project(xR, 1.35, busRearZ, player);
    const st2F = this.project(xR, 1.55, busFrontZ, player);
    const st2R = this.project(xR, 1.55, busRearZ, player);
    if (st1F.visible && st1R.visible && st2F.visible && st2R.visible) {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(st1R.x, st1R.y);
      ctx.lineTo(st1F.x, st1F.y);
      ctx.lineTo(st2F.x, st2F.y);
      ctx.lineTo(st2R.x, st2R.y);
      ctx.closePath();
      ctx.fill();
    }

    // Upper Dark Window Belt
    const winBF = this.project(xR, 1.6, busFrontZ, player);
    const winBR = this.project(xR, 1.6, busRearZ, player);
    const winTF = this.project(xR, 2.75, busFrontZ, player);
    const winTR = this.project(xR, 2.75, busRearZ, player);
    if (winBF.visible && winBR.visible && winTF.visible && winTR.visible) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(winBR.x, winBR.y);
      ctx.lineTo(winBF.x, winBF.y);
      ctx.lineTo(winTF.x, winTF.y);
      ctx.lineTo(winTR.x, winTR.y);
      ctx.closePath();
      ctx.fill();
    }

    // 4 Glowing Passenger Windows
    for (let w = 0; w < 4; w++) {
      const wZ1 = busRearZ + 1.2 + w * 1.45;
      const wZ2 = wZ1 + 1.15;
      const wBL = this.project(xR, 1.7, wZ1, player);
      const wBR = this.project(xR, 1.7, wZ2, player);
      const wTL = this.project(xR, 2.65, wZ1, player);
      const wTR = this.project(xR, 2.65, wZ2, player);

      if (wBL.visible && wBR.visible && wTL.visible && wTR.visible) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.88)'; // Warm incandescent yellow
        ctx.beginPath();
        ctx.moveTo(wBL.x, wBL.y);
        ctx.lineTo(wBR.x, wBR.y);
        ctx.lineTo(wTR.x, wTR.y);
        ctx.lineTo(wTL.x, wTL.y);
        ctx.closePath();
        ctx.fill();

        // Commuter silhouettes inside
        if (w % 2 === 1) {
          const cx = (wBL.x + wBR.x) / 2;
          const cy = (wBL.y + wTL.y) / 2 + 1;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(2, pFrontB.scale * 0.08), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Front Passenger Bi-Fold Doors at Curbside
    const dZ1 = busFrontZ - 2.4;
    const dZ2 = busFrontZ - 0.8;
    const dBL = this.project(xR, yBottom + 0.1, dZ1, player);
    const dBR = this.project(xR, yBottom + 0.1, dZ2, player);
    const dTL = this.project(xR, 2.75, dZ1, player);
    const dTR = this.project(xR, 2.75, dZ2, player);

    if (dBL.visible && dBR.visible && dTL.visible && dTR.visible) {
      if (bus.doorsOpen || bus.doorsProgress > 0) {
        // Stepwell illuminates brightly
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(dBL.x, dBL.y);
        ctx.lineTo(dBR.x, dBR.y);
        ctx.lineTo(dTR.x, dTR.y);
        ctx.lineTo(dTL.x, dTL.y);
        ctx.closePath();
        ctx.fill();

        // Safety grab rail
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        const midX = (dBL.x + dBR.x) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, dBL.y);
        ctx.lineTo(midX, dTL.y);
        ctx.stroke();

        // Folded panels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(dBL.x, dTL.y, (midX - dBL.x) * (1 - bus.doorsProgress), Math.abs(dTL.y - dBL.y));
        ctx.fillRect(midX + (dBR.x - midX) * bus.doorsProgress, dTR.y, (dBR.x - midX) * (1 - bus.doorsProgress), Math.abs(dTR.y - dBR.y));
      } else {
        // Closed doors with rubber seals
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(dBL.x, dBL.y);
        ctx.lineTo(dBR.x, dBR.y);
        ctx.lineTo(dTR.x, dTR.y);
        ctx.lineTo(dTL.x, dTL.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Side LED Route Display above door
    const sLed1 = this.project(xR, 2.9, busFrontZ - 2.8, player);
    const sLed2 = this.project(xR, 2.9, busFrontZ - 1.0, player);
    if (sLed1.visible && sLed2.visible) {
      const lw = Math.abs(sLed2.x - sLed1.x);
      ctx.fillStyle = '#020617';
      ctx.fillRect(Math.min(sLed1.x, sLed2.x), sLed1.y - 7, Math.max(lw, 10), 12);
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${Math.max(6, Math.floor(pFrontB.scale * 0.16))}px monospace`;
      ctx.fillText(bus.routeNumber, Math.min(sLed1.x, sLed2.x) + 2, sLed1.y + 2);
    }

    // Wheels (Front and Rear Double Wheels)
    const wheelF = this.project(xR, 0.45, busFrontZ - 1.8, player);
    const wheelR = this.project(xR, 0.45, busRearZ + 2.0, player);
    [wheelF, wheelR].forEach((wProj) => {
      if (wProj.visible) {
        const r = Math.max(3, wProj.scale * 0.18);
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(wProj.x, wProj.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(wProj.x, wProj.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(wProj.x, wProj.y, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawBusStreetside(
    player: PlayerState,
    bus: BusEntity,
    _pRearB: ProjectedPoint,
    pFrontB: ProjectedPoint,
    pFrontT: ProjectedPoint,
    pRearT: ProjectedPoint,
    xL: number,
    yBottom: number,
    busRearZ: number,
    busFrontZ: number
  ) {
    const ctx = this.ctx;
    ctx.fillStyle = bus.color;
    ctx.beginPath();
    ctx.moveTo(pFrontB.x, pFrontB.y);
    ctx.lineTo(pFrontT.x, pFrontT.y);
    ctx.lineTo(pRearT.x, pRearT.y);
    ctx.lineTo(_pRearB.x, _pRearB.y);
    ctx.closePath();
    ctx.fill();

    // Windows
    const winBF = this.project(xL, 1.6, busFrontZ, player);
    const winBR = this.project(xL, 1.6, busRearZ, player);
    const winTF = this.project(xL, 2.75, busFrontZ, player);
    const winTR = this.project(xL, 2.75, busRearZ, player);
    if (winBF.visible && winBR.visible && winTF.visible && winTR.visible) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.82)';
      ctx.beginPath();
      ctx.moveTo(winBR.x, winBR.y);
      ctx.lineTo(winBF.x, winBF.y);
      ctx.lineTo(winTF.x, winTF.y);
      ctx.lineTo(winTR.x, winTR.y);
      ctx.closePath();
      ctx.fill();
    }

    // Wheels
    const wF = this.project(xL, 0.45, busFrontZ - 1.8, player);
    const wR = this.project(xL, 0.45, busRearZ + 2.0, player);
    [wF, wR].forEach((wp) => {
      if (wp.visible) {
        const r = Math.max(3, wp.scale * 0.18);
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawBusFront(
    player: PlayerState,
    bus: BusEntity,
    pBL: ProjectedPoint,
    pBR: ProjectedPoint,
    pTR: ProjectedPoint,
    pTL: ProjectedPoint,
    xL: number,
    xR: number,
    busFrontZ: number
  ) {
    const ctx = this.ctx;

    // Front Body Face
    ctx.fillStyle = bus.color;
    ctx.beginPath();
    ctx.moveTo(pBL.x, pBL.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pTL.x, pTL.y);
    ctx.closePath();
    ctx.fill();

    // Windshield (Large Dual-Pane)
    const wsBL = this.project(xL + 0.15, 1.35, busFrontZ, player);
    const wsBR = this.project(xR - 0.15, 1.35, busFrontZ, player);
    const wsTL = this.project(xL + 0.15, 2.75, busFrontZ, player);
    const wsTR = this.project(xR - 0.15, 2.75, busFrontZ, player);

    if (wsBL.visible && wsBR.visible && wsTL.visible && wsTR.visible) {
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(wsBL.x, wsBL.y);
      ctx.lineTo(wsBR.x, wsBR.y);
      ctx.lineTo(wsTR.x, wsTR.y);
      ctx.lineTo(wsTL.x, wsTL.y);
      ctx.closePath();
      ctx.fill();

      // Driver silhouette in driver seat
      const drvX = wsBL.x + (wsBR.x - wsBL.x) * 0.28;
      const drvY = wsBL.y - (wsBL.y - wsTL.y) * 0.4;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.arc(drvX, drvY, Math.max(2, pBL.scale * 0.09), 0, Math.PI * 2);
      ctx.fill();

      // Windshield rain glass sheen
      const wsGrad = ctx.createLinearGradient(wsBL.x, wsBL.y, wsTR.x, wsTR.y);
      wsGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      wsGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
      wsGrad.addColorStop(1, 'rgba(15, 23, 42, 0.1)');
      ctx.fillStyle = wsGrad;
      ctx.fill();

      // Wiper Blades wiping
      const wiperAngle = Math.sin(this.animTime * 5) * 0.45;
      const midWsX = (wsBL.x + wsBR.x) / 2;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, pBL.scale * 0.035);
      ctx.beginPath();
      ctx.moveTo(midWsX - 10, wsBL.y);
      ctx.lineTo(midWsX - 10 + Math.sin(wiperAngle) * 16, wsBL.y - Math.cos(wiperAngle) * 16);
      ctx.moveTo(midWsX + 10, wsBL.y);
      ctx.lineTo(midWsX + 10 + Math.sin(wiperAngle) * 16, wsBL.y - Math.cos(wiperAngle) * 16);
      ctx.stroke();
    }

    // Glowing LED Dot-Matrix Destination Box
    const ledBL = this.project(xL + 0.35, 2.82, busFrontZ, player);
    const ledBR = this.project(xR - 0.35, 2.82, busFrontZ, player);
    const ledTL = this.project(xL + 0.35, 3.28, busFrontZ, player);

    if (ledBL.visible && ledBR.visible && ledTL.visible) {
      const ledW = Math.abs(ledBR.x - ledBL.x);
      const ledH = Math.abs(ledTL.y - ledBL.y);
      const boxX = Math.min(ledBL.x, ledBR.x);
      const boxY = Math.min(ledTL.y, ledBL.y);

      ctx.fillStyle = '#000000';
      ctx.fillRect(boxX, boxY, Math.max(ledW, 10), Math.max(ledH, 6));

      ctx.fillStyle = '#f59e0b'; // Dot matrix amber
      const fontSize = Math.max(7, Math.floor(pBL.scale * 0.3));
      ctx.font = `bold ${fontSize}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bus.routeNumber, boxX + ledW / 2, boxY + ledH / 2);
    }

    // Dual Circular Headlights with Chrome Bezels
    const hlLeft = this.project(xL + 0.35, 0.75, busFrontZ, player);
    const hlRight = this.project(xR - 0.35, 0.75, busFrontZ, player);

    if (hlLeft.visible && hlRight.visible) {
      const hlSize = Math.max(3, pBL.scale * 0.12);

      [hlLeft, hlRight].forEach((hl) => {
        // Chrome bezel
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, hlSize + 1.5, 0, Math.PI * 2);
        ctx.fill();

        // White Halogen bulb
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, hlSize, 0, Math.PI * 2);
        ctx.fill();

        // Amber turn signal below
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(hl.x - hlSize * 0.7, hl.y + hlSize + 1, hlSize * 1.4, 2.5);

        // Radial bloom glow
        const bRad = hlSize * 3.5;
        const bGrad = ctx.createRadialGradient(hl.x, hl.y, 1, hl.x, hl.y, bRad);
        bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        bGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.45)');
        bGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, bRad, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Protruding Side Mirrors (Left & Right)
    const mirL1 = this.project(xL, 2.2, busFrontZ, player);
    const mirL2 = this.project(xL - 0.45, 2.2, busFrontZ, player);
    const mirR1 = this.project(xR, 2.2, busFrontZ, player);
    const mirR2 = this.project(xR + 0.45, 2.2, busFrontZ, player);
    if (mirL1.visible && mirL2.visible) {
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mirL1.x, mirL1.y);
      ctx.lineTo(mirL2.x, mirL2.y);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mirL2.x - 2, mirL2.y - 6, 4, 12);
    }
    if (mirR1.visible && mirR2.visible) {
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mirR1.x, mirR1.y);
      ctx.lineTo(mirR2.x, mirR2.y);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mirR2.x - 2, mirR2.y - 6, 4, 12);
    }

    // License Plate B-237
    const lp = this.project((xL + xR) / 2, 0.42, busFrontZ, player);
    if (lp.visible) {
      const lpW = Math.max(8, pBL.scale * 0.22);
      const lpH = Math.max(4, pBL.scale * 0.08);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(lp.x - lpW / 2, lp.y - lpH / 2, lpW, lpH);
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.max(5, Math.floor(lpH * 0.8))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`B-${bus.routeNumber}`, lp.x, lp.y);
    }
  }

  private drawBusRear(
    player: PlayerState,
    bus: BusEntity,
    pBR: ProjectedPoint,
    pBL: ProjectedPoint,
    pTL: ProjectedPoint,
    pTR: ProjectedPoint,
    xL: number,
    xR: number,
    busRearZ: number
  ) {
    const ctx = this.ctx;

    // Rear Body Face
    ctx.fillStyle = bus.color;
    ctx.beginPath();
    ctx.moveTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.lineTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.closePath();
    ctx.fill();

    // Rear Window
    const rwBL = this.project(xL + 0.35, 1.8, busRearZ, player);
    const rwBR = this.project(xR - 0.35, 1.8, busRearZ, player);
    const rwTL = this.project(xL + 0.35, 2.7, busRearZ, player);
    const rwTR = this.project(xR - 0.35, 2.7, busRearZ, player);
    if (rwBL.visible && rwBR.visible && rwTL.visible && rwTR.visible) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.75)'; // Glow from interior
      ctx.beginPath();
      ctx.moveTo(rwBL.x, rwBL.y);
      ctx.lineTo(rwBR.x, rwBR.y);
      ctx.lineTo(rwTR.x, rwTR.y);
      ctx.lineTo(rwTL.x, rwTL.y);
      ctx.closePath();
      ctx.fill();
    }

    // Rear LED Number
    const rLed = this.project((xL + xR) / 2, 2.95, busRearZ, player);
    if (rLed.visible) {
      const boxW = Math.max(14, pBR.scale * 0.3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(rLed.x - boxW / 2, rLed.y - 5, boxW, 10);
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${Math.max(6, Math.floor(pBR.scale * 0.18))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(bus.routeNumber, rLed.x, rLed.y + 3);
    }

    // Dual Vertical Taillights (Red brake lights + orange signals)
    const tlL = this.project(xL + 0.25, 0.85, busRearZ, player);
    const tlR = this.project(xR - 0.25, 0.85, busRearZ, player);
    [tlL, tlR].forEach((tl) => {
      if (tl.visible) {
        const tw = Math.max(2, pBR.scale * 0.05);
        const th = Math.max(6, pBR.scale * 0.18);
        ctx.fillStyle = '#000000';
        ctx.fillRect(tl.x - tw / 2, tl.y - th / 2, tw, th);

        // Bright Red Brake Lights (brighter if decelerating/stopped)
        const isBraking = bus.state === 'DECELERATING' || bus.state === 'STOPPED_DOORS_OPEN';
        ctx.fillStyle = isBraking ? '#ef4444' : '#991b1b';
        ctx.fillRect(tl.x - tw / 2 + 1, tl.y - th / 2 + 1, Math.max(1, tw - 2), th * 0.55);

        // Amber turn signal
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(tl.x - tw / 2 + 1, tl.y + 1, Math.max(1, tw - 2), th * 0.35);
      }
    });

    // Engine Ventilation Louvers (horizontal slats at bottom)
    const vent = this.project((xL + xR) / 2, 0.55, busRearZ, player);
    if (vent.visible) {
      const vw = Math.max(12, pBR.scale * 0.35);
      ctx.fillStyle = '#0f172a';
      for (let s = -4; s <= 4; s += 2) {
        ctx.fillRect(vent.x - vw / 2, vent.y + s, vw, 1);
      }
    }

    // Chrome Exhaust Pipe on Lower Left
    const ex = this.project(xL + 0.3, 0.32, busRearZ, player);
    if (ex.visible) {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, Math.max(1.5, pBR.scale * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderWeather(player: PlayerState, dt: number, isSuperFatigued: boolean) {
    const ctx = this.ctx;

    // 1. 3D Rain Particles
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
    ctx.lineWidth = 1;

    for (let i = 0; i < this.raindrops.length; i++) {
      const drop = this.raindrops[i];
      drop.y -= drop.speed * dt;
      drop.x += dt * 1.5;

      if (drop.y <= 0) {
        const proj = this.project(drop.x + this.PLAYER_X, 0.05, drop.z + player.z, player);
        if (proj.visible && this.splashes.length < 40) {
          this.splashes.push({
            x: proj.x,
            y: proj.y,
            radius: 1,
            maxRadius: Math.max(3, proj.scale * 0.12),
            alpha: 0.6,
          });
        }

        drop.y = Math.random() * 5 + 4;
        drop.x = (Math.random() - 0.5) * 18;
        drop.z = Math.random() * 35 + 0.5;
      }

      const p1 = this.project(drop.x + this.PLAYER_X, drop.y, drop.z + player.z, player);
      const p2 = this.project(drop.x + this.PLAYER_X + 0.05, drop.y + drop.length, drop.z + player.z, player);

      if (p1.visible && p2.visible) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 2. Ground Rain Splashes (ripples)
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.radius += dt * 14;
      s.alpha -= dt * 3.5;

      if (s.alpha <= 0 || s.radius >= s.maxRadius) {
        this.splashes.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(186, 230, 253, ${Math.max(0, s.alpha)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Raindrops dripping on camera lens
    ctx.save();
    for (const ld of this.lensDrops) {
      ld.y += ld.speed;
      if (ld.y > this.HEIGHT) {
        ld.y = -5;
        ld.x = Math.random() * this.WIDTH;
      }

      ctx.fillStyle = `rgba(224, 242, 254, ${ld.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(ld.x, ld.y, ld.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${ld.alpha * 0.8})`;
      ctx.fillRect(ld.x - ld.radius * 0.4, ld.y - ld.radius * 0.4, ld.radius * 0.5, ld.radius * 0.5);
    }
    ctx.restore();

    // 4. Super-fatigue Tunnel Vision Effect
    if (isSuperFatigued) {
      const pulse = (Math.sin(this.animTime * 6) + 1) * 0.5;
      const vigGrad = ctx.createRadialGradient(
        this.WIDTH / 2,
        this.HEIGHT / 2,
        this.WIDTH * 0.25,
        this.WIDTH / 2,
        this.HEIGHT / 2,
        this.WIDTH * 0.65
      );
      vigGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      vigGrad.addColorStop(0.6, `rgba(185, 28, 28, ${0.15 + pulse * 0.2})`);
      vigGrad.addColorStop(1, `rgba(5, 5, 10, ${0.75 + pulse * 0.2})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    }
  }
}
