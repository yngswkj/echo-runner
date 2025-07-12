// game-state.js - ゲーム状態管理

import { GAME_CONFIG, COLORS } from './constants.js';
import { Vector2 } from './utils.js';

export class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.player = {
            x: 400,
            y: 300,
            radius: GAME_CONFIG.PLAYER.RADIUS,
            speed: GAME_CONFIG.PLAYER.SPEED,
            vx: 0,
            vy: 0,
            actualVx: 0,
            actualVy: 0,
            friction: GAME_CONFIG.PLAYER.FRICTION,
            acceleration: GAME_CONFIG.PLAYER.ACCELERATION
        };

        this.echoes = [];
        this.echoParticles = [];
        this.advancedParticles = [];
        this.walls = [];
        this.items = [];
        this.itemGlows = [];
        this.goal = null;
        this.goalGlow = null;

        this.layoutType = 0;
        this.echoCooldown = 0;
        this.echoCooldownMax = GAME_CONFIG.ECHO.COOLDOWN_MAX;
        this.lastEchoTime = 0;
        this.echoCount = 0;
        this.echoEnergy = GAME_CONFIG.ECHO.ENERGY_MAX;
        this.echoEnergyMax = GAME_CONFIG.ECHO.ENERGY_MAX;
        this.echoEnergyRegenRate = GAME_CONFIG.ECHO.ENERGY_REGEN_RATE;
        
        this.startTime = 0;
        this.elapsedTime = 0;
        this.lastUpdateTime = 0;
        
        this.keys = {};
        this.started = false;
        this.cleared = false;
        this.mobileControlsInitialized = false;

        this.haptics = {
            enabled: true,
            intensity: GAME_CONFIG.HAPTICS.INTENSITY,
            lastVibration: 0,
            minInterval: GAME_CONFIG.HAPTICS.MIN_INTERVAL
        };

        this.transitions = {
            fadeAlpha: 1.0,
            isTransitioning: false,
            transitionType: 'none'
        };

        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };
    }

    // ゲーム開始
    start() {
        this.started = true;
        this.cleared = false;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.echoCount = 0;
        this.lastEchoTime = 0;
        this.echoEnergy = this.echoEnergyMax;
        this.lastUpdateTime = Date.now();

        // 配列のクリア
        this.echoes = [];
        this.echoParticles = [];
        this.advancedParticles = [];
        this.itemGlows = [];
        this.goalGlow = null;
    }

    // ゲームクリア
    clear() {
        this.cleared = true;
    }

    // プレイヤー位置設定
    setPlayerPosition(x, y) {
        this.player.x = x;
        this.player.y = y;
    }

    // プレイヤー速度設定
    setPlayerVelocity(vx, vy) {
        this.player.vx = vx;
        this.player.vy = vy;
    }

    // アイテム追加
    addItem(x, y) {
        this.items.push({
            x: x,
            y: y,
            radius: 6,
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }

    // ゴール設定
    setGoal(x, y) {
        this.goal = {
            x: x,
            y: y,
            radius: 15,
            active: false,
            pulsePhase: 0
        };
    }

    // アイテム収集
    collectItem(index) {
        if (index >= 0 && index < this.items.length && !this.items[index].collected) {
            this.items[index].collected = true;
            
            // すべてのアイテムが収集されたかチェック
            const allCollected = this.items.every(item => item.collected);
            if (allCollected && this.goal) {
                this.goal.active = true;
            }
            
            return true;
        }
        return false;
    }

    // 収集済みアイテム数を取得
    getCollectedItemCount() {
        return this.items.filter(item => item.collected).length;
    }

    // ゴールがアクティブかチェック
    isGoalActive() {
        return this.goal && this.goal.active;
    }

    // エコーエネルギー更新
    updateEchoEnergy(deltaTime) {
        if (this.echoEnergy < this.echoEnergyMax) {
            this.echoEnergy += (this.echoEnergyRegenRate * deltaTime) / 1000;
            this.echoEnergy = Math.min(this.echoEnergy, this.echoEnergyMax);
        }
    }

    // エコー発射可能かチェック
    canFireEcho() {
        const now = Date.now();
        const timeSinceLastEcho = now - this.lastEchoTime;
        const energyCost = GAME_CONFIG.ECHO.ENERGY_COST;
        
        return timeSinceLastEcho >= this.echoCooldownMax && this.echoEnergy >= energyCost;
    }

    // エコー発射
    fireEcho() {
        if (!this.canFireEcho()) return false;
        
        const energyCost = GAME_CONFIG.ECHO.ENERGY_COST;
        this.echoEnergy -= energyCost;
        this.lastEchoTime = Date.now();
        this.echoCount++;
        
        return true;
    }

    // 経過時間更新
    updateElapsedTime() {
        if (this.started && !this.cleared) {
            this.elapsedTime = Date.now() - this.startTime;
        }
    }

    // スコア計算
    calculateScore() {
        const baseScore = GAME_CONFIG.GAME.BASE_SCORE;
        const timeSeconds = Math.floor(this.elapsedTime / 1000);
        const timePenalty = Math.min(timeSeconds * GAME_CONFIG.GAME.TIME_PENALTY_RATE, GAME_CONFIG.GAME.MAX_TIME_PENALTY);
        const echoPenalty = Math.min(this.echoCount * GAME_CONFIG.GAME.ECHO_PENALTY_RATE, GAME_CONFIG.GAME.MAX_ECHO_PENALTY);
        
        return Math.max(0, baseScore - timePenalty - echoPenalty);
    }

    // ゲーム状態の取得（統計用）
    getGameData() {
        return {
            elapsedTime: this.elapsedTime,
            echoCount: this.echoCount,
            score: this.calculateScore(),
            itemsCollected: this.getCollectedItemCount(),
            completed: this.cleared
        };
    }

    // デバッグ情報
    getDebugInfo() {
        return {
            playerPos: { x: this.player.x, y: this.player.y },
            echoEnergy: this.echoEnergy,
            echoCount: this.echoCount,
            itemsCollected: this.getCollectedItemCount(),
            goalActive: this.isGoalActive(),
            elapsedTime: this.elapsedTime
        };
    }
}

// シングルトンインスタンス
export const gameState = new GameState();