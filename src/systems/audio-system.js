// audio-system.js - 音響システム

import { GAME_CONFIG, COLORS } from '../core/constants.js';
import { MathUtils, ColorUtils } from '../core/utils.js';

export class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.initialized = false;
        
        // オーディオノードプール
        this.audioNodePool = {
            oscillators: [],
            gainNodes: [],
            filterNodes: [],
            delayNodes: [],
            maxPoolSize: 20
        };

        // パフォーマンス監視
        this.performanceMonitor = {
            lastEchoTime: 0,
            echoCount: 0,
            maxEchoesPerSecond: GAME_CONFIG.AUDIO.MAX_ECHOES_PER_SECOND,
            currentlyPlaying: 0,
            maxConcurrentSounds: GAME_CONFIG.AUDIO.MAX_CONCURRENT_SOUNDS,
            lastCloseWallEcho: 0,
            closeWallCooldown: 100
        };

        this.init();
    }

    // 初期化
    async init() {
        try {
            // AudioContext作成（ブラウザ互換性対応）
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('Web Audio API not supported');
                return false;
            }

            this.audioContext = new AudioContextClass();
            
            // マスターゲイン設定
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = GAME_CONFIG.AUDIO.MASTER_VOLUME;
            
            // マスターコンプレッサー（音割れ防止）
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.25;
            
            this.masterGain.connect(compressor);
            compressor.connect(this.audioContext.destination);

            this.initialized = true;
            console.log('Audio system initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
            return false;
        }
    }

    // AudioContextの再開
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (error) {
                console.error('Failed to resume audio context:', error);
            }
        }
    }

    // オーディオノードプール管理
    getOscillator() {
        if (this.audioNodePool.oscillators.length > 0) {
            return this.audioNodePool.oscillators.pop();
        }
        return this.audioContext ? this.audioContext.createOscillator() : null;
    }

    getGainNode() {
        if (this.audioNodePool.gainNodes.length > 0) {
            const node = this.audioNodePool.gainNodes.pop();
            node.gain.value = 1.0;
            node.disconnect();
            return node;
        }
        return this.audioContext ? this.audioContext.createGain() : null;
    }

    getFilterNode() {
        if (this.audioNodePool.filterNodes.length > 0) {
            const node = this.audioNodePool.filterNodes.pop();
            node.frequency.value = 1000;
            node.Q.value = 1;
            node.type = 'lowpass';
            node.disconnect();
            return node;
        }
        return this.audioContext ? this.audioContext.createBiquadFilter() : null;
    }

    getDelayNode() {
        if (this.audioNodePool.delayNodes.length > 0) {
            const node = this.audioNodePool.delayNodes.pop();
            node.delayTime.value = 0;
            node.disconnect();
            return node;
        }
        return this.audioContext ? this.audioContext.createDelay() : null;
    }

    // ノードをプールに戻す
    returnGainNode(node) {
        if (this.audioNodePool.gainNodes.length < this.audioNodePool.maxPoolSize) {
            node.disconnect();
            this.audioNodePool.gainNodes.push(node);
        }
    }

    returnFilterNode(node) {
        if (this.audioNodePool.filterNodes.length < this.audioNodePool.maxPoolSize) {
            node.disconnect();
            this.audioNodePool.filterNodes.push(node);
        }
    }

    returnDelayNode(node) {
        if (this.audioNodePool.delayNodes.length < this.audioNodePool.maxPoolSize) {
            node.disconnect();
            this.audioNodePool.delayNodes.push(node);
        }
    }

    // パフォーマンス監視
    canCreateEcho() {
        const now = Date.now();
        if (now - this.performanceMonitor.lastEchoTime > 1000) {
            this.performanceMonitor.echoCount = 0;
            this.performanceMonitor.lastEchoTime = now;
        }
        
        if (this.performanceMonitor.echoCount >= this.performanceMonitor.maxEchoesPerSecond) {
            return false;
        }
        
        if (this.performanceMonitor.currentlyPlaying >= this.performanceMonitor.maxConcurrentSounds) {
            return false;
        }
        
        this.performanceMonitor.echoCount++;
        this.performanceMonitor.currentlyPlaying++;
        return true;
    }

    canCreateCloseWallEcho() {
        const now = Date.now();
        if (now - this.performanceMonitor.lastCloseWallEcho < this.performanceMonitor.closeWallCooldown) {
            return false;
        }
        this.performanceMonitor.lastCloseWallEcho = now;
        return true;
    }

    soundFinished() {
        this.performanceMonitor.currentlyPlaying = Math.max(0, this.performanceMonitor.currentlyPlaying - 1);
    }

    // エコー音生成
    playEchoSound(frequency = 1000, duration = 0.05) {
        if (!this.audioContext || !this.initialized) return;

        try {
            // デュアルオシレーター構成
            const oscillator1 = this.audioContext.createOscillator();
            const oscillator2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filterNode = this.audioContext.createBiquadFilter();
            const delayNode = this.audioContext.createDelay();
            const feedbackGain = this.audioContext.createGain();

            // フィルター設定
            filterNode.type = 'bandpass';
            filterNode.frequency.value = frequency;
            filterNode.Q.value = 5;

            // ディレイ設定
            delayNode.delayTime.value = 0.05;
            feedbackGain.gain.value = 0.2;

            // オシレーター設定
            oscillator1.type = 'sine';
            oscillator1.frequency.value = frequency;
            oscillator2.type = 'triangle';
            oscillator2.frequency.value = frequency * 1.01; // 少しデチューン

            // 接続
            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(filterNode);
            filterNode.connect(delayNode);
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            delayNode.connect(this.masterGain);

            // エンベロープ
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            // 再生
            oscillator1.start(this.audioContext.currentTime);
            oscillator2.start(this.audioContext.currentTime);
            oscillator1.stop(this.audioContext.currentTime + duration);
            oscillator2.stop(this.audioContext.currentTime + duration);

            // クリーンアップ
            setTimeout(() => {
                this.soundFinished();
            }, duration * 1000);

        } catch (error) {
            console.error('Error playing echo sound:', error);
        }
    }

    // 反響音生成（距離と物体タイプに基づく）
    playReflectionSound(distance, objectType, intensity = 1.0) {
        if (!this.audioContext || !this.initialized || !this.canCreateEcho()) return;

        try {
            const baseFrequency = this.getFrequencyForObjectType(objectType);
            const adjustedFrequency = this.adjustFrequencyForDistance(baseFrequency, distance);
            const volume = this.calculateVolumeForDistance(distance) * intensity;
            
            if (volume < 0.08) return; // 音量が小さすぎる場合はスキップ

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filterNode = this.audioContext.createBiquadFilter();

            // 物体タイプに応じた音色設定
            const audioConfig = this.getAudioConfigForObjectType(objectType);
            oscillator.type = audioConfig.waveform;
            oscillator.frequency.value = adjustedFrequency;

            // フィルター設定
            filterNode.type = audioConfig.filterType;
            filterNode.frequency.value = adjustedFrequency * audioConfig.filterMultiplier;
            filterNode.Q.value = audioConfig.q;

            // 接続
            oscillator.connect(gainNode);
            gainNode.connect(filterNode);
            filterNode.connect(this.masterGain);

            // エンベロープ（距離に応じた減衰）
            const duration = audioConfig.baseDuration + (distance / 1000);
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            // 再生
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);

            // クリーンアップ
            setTimeout(() => {
                this.soundFinished();
            }, duration * 1000);

        } catch (error) {
            console.error('Error playing reflection sound:', error);
        }
    }

    // アイテム取得音
    playItemCollectSound() {
        if (!this.audioContext || !this.initialized) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'triangle';
            oscillator.connect(gainNode);
            gainNode.connect(this.masterGain);

            // 周波数スイープ（上昇）
            oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(2500, this.audioContext.currentTime + 0.2);

            // エンベロープ
            gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);

        } catch (error) {
            console.error('Error playing item collect sound:', error);
        }
    }

    // ゴール到達音
    playGoalReachSound() {
        if (!this.audioContext || !this.initialized) return;

        try {
            // C-E-Gの和音
            const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();

                    oscillator.type = 'triangle';
                    oscillator.frequency.value = freq;
                    oscillator.connect(gainNode);
                    gainNode.connect(this.masterGain);

                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.5);
                }, index * 100);
            });

        } catch (error) {
            console.error('Error playing goal reach sound:', error);
        }
    }

    // 物体タイプに応じた基本周波数を取得
    getFrequencyForObjectType(objectType) {
        const frequencies = GAME_CONFIG.AUDIO.FREQUENCIES;
        
        switch (objectType) {
            case 'item':
                return MathUtils.randomRange(frequencies.ITEM_MIN, frequencies.ITEM_MAX);
            case 'goal':
                return MathUtils.randomRange(frequencies.GOAL_MIN, frequencies.GOAL_MAX);
            case 'wall':
            default:
                return MathUtils.randomRange(frequencies.WALL_MIN, frequencies.WALL_MAX);
        }
    }

    // 距離に応じた周波数調整
    adjustFrequencyForDistance(baseFrequency, distance) {
        // 距離が遠いほど高周波がカットされる
        const distanceFactor = MathUtils.clamp(1 - (distance / 600), 0.5, 1);
        return baseFrequency * distanceFactor;
    }

    // 距離に応じた音量計算
    calculateVolumeForDistance(distance) {
        return MathUtils.clamp(1 / (distance / 50 + 1), 0.1, 1.0);
    }

    // 物体タイプに応じた音響設定
    getAudioConfigForObjectType(objectType) {
        switch (objectType) {
            case 'item':
                return {
                    waveform: 'triangle',
                    filterType: 'highpass',
                    filterMultiplier: 0.8,
                    q: 3,
                    baseDuration: 0.15
                };
            case 'goal':
                return {
                    waveform: 'sine',
                    filterType: 'lowpass',
                    filterMultiplier: 1.2,
                    q: 2,
                    baseDuration: 0.25
                };
            case 'wall':
            default:
                return {
                    waveform: 'square',
                    filterType: 'bandpass',
                    filterMultiplier: 1.0,
                    q: 4,
                    baseDuration: 0.1
                };
        }
    }

    // 音量設定
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = MathUtils.clamp(volume, 0, 1);
        }
    }

    // クリーンアップ
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.initialized = false;
    }
}

// シングルトンインスタンス
export const audioSystem = new AudioSystem();