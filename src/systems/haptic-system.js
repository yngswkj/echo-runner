// haptic-system.js - 触覚フィードバックシステム

import { GAME_CONFIG } from '../core/constants.js';
import { DeviceUtils } from '../core/utils.js';

export class HapticSystem {
    constructor() {
        this.enabled = true;
        this.intensity = GAME_CONFIG.HAPTICS.INTENSITY;
        this.lastVibration = 0;
        this.minInterval = GAME_CONFIG.HAPTICS.MIN_INTERVAL;
        
        this.patterns = {
            echoFire: GAME_CONFIG.HAPTICS.PATTERNS.ECHO_FIRE,
            wallHit: GAME_CONFIG.HAPTICS.PATTERNS.WALL_HIT,
            itemCollect: GAME_CONFIG.HAPTICS.PATTERNS.ITEM_COLLECT,
            goalReach: GAME_CONFIG.HAPTICS.PATTERNS.GOAL_REACH,
            
            // 追加パターン
            menuSelect: [30],
            buttonPress: [20],
            achievement: [100, 50, 100, 50, 100],
            error: [50, 50, 50],
            success: [80, 40, 80]
        };

        this.checkSupport();
    }

    // 振動サポートの確認
    checkSupport() {
        this.supported = DeviceUtils.supportsVibration();
        if (!this.supported) {
            console.log('Haptic feedback not supported on this device');
        }
        return this.supported;
    }

    // 基本的な振動
    vibrate(pattern, force = false) {
        if (!this.enabled || !this.supported) return false;
        
        const now = Date.now();
        if (!force && now - this.lastVibration < this.minInterval) {
            return false; // クールダウン中
        }

        try {
            let vibratePattern;
            
            if (Array.isArray(pattern)) {
                // パターンの強度調整
                vibratePattern = pattern.map(duration => Math.round(duration * this.intensity));
            } else if (typeof pattern === 'number') {
                vibratePattern = Math.round(pattern * this.intensity);
            } else if (typeof pattern === 'string' && this.patterns[pattern]) {
                vibratePattern = this.patterns[pattern].map(duration => Math.round(duration * this.intensity));
            } else {
                console.warn('Invalid vibration pattern:', pattern);
                return false;
            }

            navigator.vibrate(vibratePattern);
            this.lastVibration = now;
            return true;
        } catch (error) {
            console.error('Vibration failed:', error);
            return false;
        }
    }

    // 距離ベースの振動（エコーロケーション用）
    vibrateDistance(distance, maxDistance = 600, baseIntensity = 100) {
        if (!this.enabled || !this.supported) return false;

        // 距離に応じた振動強度の計算
        const normalizedDistance = Math.min(distance / maxDistance, 1);
        const intensity = Math.round(baseIntensity * (1 - normalizedDistance) * this.intensity);
        
        if (intensity < 10) return false; // 最小閾値

        return this.vibrate(intensity);
    }

    // 衝突の種類に応じた振動
    vibrateCollision(collisionType, intensity = 1.0) {
        if (!this.enabled || !this.supported) return false;

        let pattern;
        switch (collisionType) {
            case 'wall':
                pattern = this.patterns.wallHit;
                break;
            case 'item':
                pattern = this.patterns.itemCollect;
                break;
            case 'goal':
                pattern = this.patterns.goalReach;
                break;
            default:
                pattern = [50]; // デフォルト
        }

        // 強度調整
        const adjustedPattern = pattern.map(duration => Math.round(duration * intensity));
        return this.vibrate(adjustedPattern);
    }

    // 方向性のある振動（左右の強弱で方向を表現）
    vibrateDirectional(angle, intensity = 100) {
        if (!this.enabled || !this.supported) return false;

        // 角度を-π〜πの範囲に正規化
        const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        // 左右の強度を計算（-1〜1の範囲）
        const leftRight = Math.sin(normalizedAngle);
        
        // パターンを生成（左側が強い場合は最初が長く、右側が強い場合は後が長く）
        let pattern;
        if (leftRight < -0.1) {
            // 左側
            const leftIntensity = Math.round(intensity * Math.abs(leftRight));
            const rightIntensity = Math.round(intensity * 0.3);
            pattern = [leftIntensity, 20, rightIntensity];
        } else if (leftRight > 0.1) {
            // 右側
            const leftIntensity = Math.round(intensity * 0.3);
            const rightIntensity = Math.round(intensity * leftRight);
            pattern = [leftIntensity, 20, rightIntensity];
        } else {
            // 中央
            pattern = [Math.round(intensity * 0.8)];
        }

        return this.vibrate(pattern);
    }

    // リズミカルな振動（音楽的な表現）
    vibrateRhythm(bpm = 120, beats = 4, intensity = 80) {
        if (!this.enabled || !this.supported) return false;

        const beatDuration = (60 / bpm) * 1000; // ミリ秒
        const vibrateDuration = Math.min(beatDuration * 0.3, 100); // ビートの30%または最大100ms
        const pattern = [];

        for (let i = 0; i < beats; i++) {
            pattern.push(Math.round(vibrateDuration * this.intensity));
            if (i < beats - 1) {
                pattern.push(Math.round((beatDuration - vibrateDuration) * 0.8)); // 休符
            }
        }

        return this.vibrate(pattern);
    }

    // 設定メソッド
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    setIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(2, intensity)); // 0-2の範囲でクランプ
    }

    setMinInterval(interval) {
        this.minInterval = Math.max(10, interval); // 最小10ms
    }

    // カスタムパターンの追加
    addPattern(name, pattern) {
        if (Array.isArray(pattern) && pattern.every(p => typeof p === 'number')) {
            this.patterns[name] = pattern;
            return true;
        }
        console.warn('Invalid pattern format for', name);
        return false;
    }

    // デバッグ用：利用可能なパターンの一覧
    getAvailablePatterns() {
        return Object.keys(this.patterns);
    }

    // デバッグ用：パターンのテスト
    testPattern(patternName) {
        if (this.patterns[patternName]) {
            console.log(`Testing haptic pattern: ${patternName}`, this.patterns[patternName]);
            return this.vibrate(patternName);
        } else {
            console.warn(`Pattern not found: ${patternName}`);
            return false;
        }
    }

    // 設定の取得
    getSettings() {
        return {
            enabled: this.enabled,
            supported: this.supported,
            intensity: this.intensity,
            minInterval: this.minInterval,
            availablePatterns: this.getAvailablePatterns()
        };
    }

    // 全ての振動を停止
    stopAll() {
        if (this.supported) {
            navigator.vibrate(0);
        }
    }
}

// シングルトンインスタンス
export const hapticSystem = new HapticSystem();