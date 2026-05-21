import Renderer from './renderer.js';
import Physics from './physics.js';
import InputManager from './input.js';

export default class GameCore {
  constructor(canvas, ctx, tileSize, levelData) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.tileSize = tileSize;
    this.levelData = levelData;
    this.state = 'PLAYING';
    this.running = false;
    this.frameCount = 0;
    this.renderer = new Renderer(canvas, ctx, tileSize);
    this.physics = new Physics(tileSize);
    this.input = new InputManager();
    this.onDeath = null;
    this.onLevelComplete = null;
    this.onGameStateChange = null;
    this.player = this.createPlayer(levelData.player);
    this.goal = levelData.goal;
    this.walls = levelData.walls || [];
    this.spikes = levelData.spikes || [];
    this.enemies = this.createEnemies(levelData.enemies || []);
    this.slowZones = levelData.slowZones || [];
    this.platforms = levelData.platforms || [];
    this.playerDirection = { x: 0, y: 0 };
    this.playerSpawnPoint = { x: this.player.x, y: this.player.y };
  }

  createPlayer(playerData) {
    return {
      x: playerData.x * this.tileSize,
      y: playerData.y * this.tileSize,
      width: playerData.width * this.tileSize,
      height: playerData.height * this.tileSize,
      speed: playerData.speed,
      originalSpeed: playerData.speed,
    };
  }

  createEnemies(enemyDataArray) {
    return enemyDataArray.map((data) => ({
      x: data.x * this.tileSize,
      y: data.y * this.tileSize,
      width: data.width * this.tileSize,
      height: data.height * this.tileSize,
      speed: data.speed,
      pattern: data.pattern,
      direction: data.direction,
      patrolDistance: (data.patrolDistance || 0) * this.tileSize,
      radius: (data.radius || 0) * this.tileSize,
      startX: data.x * this.tileSize,
      startY: data.y * this.tileSize,
      angle: 0,
      distanceTraveled: 0,
    }));
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  pause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.onGameStateChange?.(this.state);
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.onGameStateChange?.(this.state);
    }
  }

  loop = () => {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(this.loop);
  };

  update() {
    if (this.state === 'PAUSED' || this.state === 'LEVEL_COMPLETE') return;
    const inputDir = this.input.getDirection();
    this.playerDirection = inputDir;
    if (this.input.isPausePressed()) {
      this.pause();
      this.input.resetPauseKey();
    }
    if (this.input.isRestartPressed()) {
      this.respawnPlayer();
      this.input.resetRestartKey();
    }
    this.updatePlayer();
    this.updateEnemies();
    this.updatePlatforms();
    this.checkCollisions();
    if (this.physics.isColliding(this.player, this.convertTilesToPixels(this.goal))) {
      this.state = 'LEVEL_COMPLETE';
      this.running = false;
      this.onLevelComplete?.();
    }
  }

  updatePlayer() {
    this.player.x += this.playerDirection.x * this.player.speed;
    this.player.y += this.playerDirection.y * this.player.speed;
    const mapWidth = this.levelData.width * this.tileSize;
    const mapHeight = this.levelData.height * this.tileSize;
    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x + this.player.width > mapWidth) this.player.x = mapWidth - this.player.width;
    if (this.player.y < 0) this.player.y = 0;
    if (this.player.y + this.player.height > mapHeight) this.player.y = mapHeight - this.player.height;
    this.player.speed = this.player.originalSpeed;
    for (const zone of this.slowZones) {
      const zoneRect = this.convertTilesToPixels(zone);
      if (this.physics.isColliding(this.player, zoneRect)) {
        this.player.speed = this.player.originalSpeed * 0.5;
        break;
      }
    }
  }

  updateEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.pattern === 'straight' || enemy.pattern === 'patrol') {
        const dx = enemy.direction === 'left' ? -1 : enemy.direction === 'right' ? 1 : 0;
        const dy = enemy.direction === 'up' ? -1 : enemy.direction === 'down' ? 1 : 0;
        enemy.x += dx * enemy.speed;
        enemy.y += dy * enemy.speed;
        enemy.distanceTraveled += enemy.speed;
        if (enemy.distanceTraveled >= enemy.patrolDistance) {
          enemy.distanceTraveled = 0;
          enemy.direction = enemy.direction === 'left' ? 'right' : enemy.direction === 'right' ? 'left' : enemy.direction === 'up' ? 'down' : 'up';
        }
      } else if (enemy.pattern === 'circle') {
        enemy.angle = (enemy.angle || 0) + (enemy.speed / Math.max(enemy.radius, 1)) * 0.1;
        enemy.x = enemy.startX + Math.cos(enemy.angle) * enemy.radius;
        enemy.y = enemy.startY + Math.sin(enemy.angle) * enemy.radius;
      } else if (enemy.pattern === 'zigzag') {
        const currentPattern = Math.floor(enemy.distanceTraveled / (enemy.patrolDistance / 2)) % 2;
        const direction = currentPattern === 0 ? enemy.direction : enemy.direction === 'left' ? 'up' : 'right';
        const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
        const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
        enemy.x += dx * enemy.speed;
        enemy.y += dy * enemy.speed;
        enemy.distanceTraveled += enemy.speed;
        if (enemy.distanceTraveled >= enemy.patrolDistance * 2) enemy.distanceTraveled = 0;
      }
    }
  }

  updatePlatforms() {
    for (const platform of this.platforms) {
      if (!platform.speed) continue;
      const dx = platform.direction === 'left' ? -1 : platform.direction === 'right' ? 1 : 0;
      const dy = platform.direction === 'up' ? -1 : platform.direction === 'down' ? 1 : 0;
      platform.x += dx * (platform.speed || 2);
      platform.y += dy * (platform.speed || 2);
      platform.distanceTraveled = (platform.distanceTraveled || 0) + (platform.speed || 2);
      if (platform.distanceTraveled >= ((platform.range || 5) * this.tileSize)) {
        platform.distanceTraveled = 0;
        platform.direction = platform.direction === 'left' ? 'right' : platform.direction === 'right' ? 'left' : platform.direction === 'up' ? 'down' : 'up';
      }
    }
  }

  checkCollisions() {
    for (const wall of this.walls) {
      const wallRect = this.convertTilesToPixels(wall);
      if (this.physics.isColliding(this.player, wallRect)) {
        this.physics.resolveCollision(this.player, wallRect);
      }
    }
    for (const enemy of this.enemies) {
      if (this.physics.isColliding(this.player, enemy)) {
        this.respawnPlayer();
        this.onDeath?.();
        return;
      }
    }
    for (const spike of this.spikes) {
      const spikeRect = this.convertTilesToPixels(spike);
      if (this.physics.isColliding(this.player, spikeRect)) {
        this.respawnPlayer();
        this.onDeath?.();
        return;
      }
    }
  }

  respawnPlayer() {
    this.player.x = this.playerSpawnPoint.x;
    this.player.y = this.playerSpawnPoint.y;
  }

  convertTilesToPixels(obj) {
    return {
      x: obj.x * this.tileSize,
      y: obj.y * this.tileSize,
      width: obj.width * this.tileSize,
      height: obj.height * this.tileSize,
    };
  }

  render() {
    this.renderer.clear(this.levelData.width * this.tileSize, this.levelData.height * this.tileSize);
    this.renderer.drawSlowZones(this.slowZones.map((z) => this.convertTilesToPixels(z)));
    this.renderer.drawPlatforms(this.platforms.map((p) => this.convertTilesToPixels(p)));
    this.renderer.drawWalls(this.walls.map((w) => this.convertTilesToPixels(w)));
    this.renderer.drawSpikes(this.spikes.map((s) => this.convertTilesToPixels(s)));
    this.renderer.drawEnemies(this.enemies);
    this.renderer.drawGoal(this.convertTilesToPixels(this.goal));
    this.renderer.drawPlayer(this.player);
    this.frameCount++;
  }
}