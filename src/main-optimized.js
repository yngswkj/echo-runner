// main-optimized.js - 最適化されたメインゲームループとコントローラー

import { gameState } from './core/game-state.js';
import { GAME_CONFIG, DOM_IDS, COLORS } from './core/constants.js';
import { audioSystem } from './systems/audio-system.js';
import { particlePool, particleEffects, echoParticleManager, sonarRingManager } from './systems/particle-system.js';
import { hapticSystem } from './systems/haptic-system.js';
import { statsManager } from './ui/stats-manager.js';
import { mapGenerator } from './world/map-generator.js';
import { MathUtils, DOMUtils, DeviceUtils, TimeUtils } from './core/utils.js';

// 新しい最適化システムのインポート
import { OptimizedRenderer } from './rendering/optimized-renderer.js';
import { globalFrameManager } from './rendering/frame-manager.js';
import { globalPerformanceMonitor } from './rendering/performance-monitor.js';
import { globalPoolManager } from './rendering/enhanced-object-pool.js';

class OptimizedEchoRunnerGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.animationId = null;
        this.lastFrameTime = 0;
        
        // 最適化システム
        this.optimizedRenderer = null;
        this.frameManager = globalFrameManager;
        this.performanceMonitor = globalPerformanceMonitor;
        this.poolManager = globalPoolManager;
        
        // パフォーマンス設定
        this.performanceSettings = {
            enableOptimizedRendering: true,
            enableAdaptiveQuality: true,
            enableFrameSkipping: true,
            enablePerformanceMonitoring: true,
            maxParticleCount: 1000,
            targetFPS: 60
        };
        
        // デバッグモード
        this.debugMode = process.env.NODE_ENV === 'development';
        
        this.init();
    }

    async init() {
        try {
            // DOM要素の取得
            this.canvas = DOMUtils.getElementById(DOM_IDS.CANVAS);
            this.ctx = this.canvas.getContext('2d');
            this.container = DOMUtils.getElementById(DOM_IDS.CONTAINER);

            if (!this.canvas || !this.ctx || !this.container) {
                console.error('Required DOM elements not found');
                return;
            }

            // 最適化レンダラーの初期化
            if (this.performanceSettings.enableOptimizedRendering) {
                this.optimizedRenderer = new OptimizedRenderer(this.canvas);
                console.log('Optimized rendering system enabled');
            }

            // キャンバスサイズ設定
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());

            // イベントリスナー設定
            this.setupEventListeners();

            // オーディオシステム初期化
            await audioSystem.init();

            // パフォーマンス監視の設定
            this.setupPerformanceMonitoring();

            // フレームマネージャーの設定
            this.setupFrameManager();

            // ゲームループ開始
            this.startGameLoop();

            console.log('Optimized Echo Runner initialized successfully');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.fallbackToBasicMode();
        }
    }

    setupPerformanceMonitoring() {
        if (!this.performanceSettings.enablePerformanceMonitoring) return;

        // パフォーマンス設定の適用
        this.performanceMonitor.updateConfiguration({
            enabledMetrics: {
                fps: true,
                frameTime: true,
                memory: true,
                render: true,
                audio: true,
                input: false // 入力遅延の監視は無効
            },
            alertThresholds: {
                frameTime: 25, // 25ms = 40FPS
                memory: 100,   // 100MB
                cpu: 80        // 80%
            },
            autoCollection: true
        });

        // パフォーマンスアラートのコールバック設定
        this.performanceMonitor.alertManager.onAlert = (alert) => {
            this.handlePerformanceAlert(alert);
        };
    }

    setupFrameManager() {
        // フレームマネージャーの設定
        this.frameManager.updateSettings({
            targetFPS: this.performanceSettings.targetFPS,
            adaptiveFPS: this.performanceSettings.enableAdaptiveQuality,
            frameSkip: this.performanceSettings.enableFrameSkipping,
            maxFrameSkip: 2
        });

        // 品質調整のコールバック
        this.frameManager.qualityManager.onQualityChange = (newQuality) => {
            if (this.optimizedRenderer) {
                this.optimizedRenderer.updateQualityLevel(newQuality);
            }
            this.adjustGameQuality(newQuality);
        };
    }

    startGameLoop() {
        // 最適化されたゲームループの開始
        this.frameManager.requestFrame((currentTime, deltaTime) => {
            this.optimizedGameLoop(currentTime, deltaTime);
        });
    }

    optimizedGameLoop(currentTime, deltaTime) {
        try {
            // フレーム開始時刻記録
            const frameStart = performance.now();

            // ゲーム更新
            this.update(deltaTime);

            // レンダリング
            this.render();

            // パフォーマンス記録
            const frameEnd = performance.now();
            const frameTime = frameEnd - frameStart;

            if (this.optimizedRenderer) {
                this.performanceMonitor.recordFrame(frameTime, undefined, frameStart);
            }

            // デバッグ情報の表示
            if (this.debugMode) {
                this.drawDebugInfo();
            }

        } catch (error) {
            console.error('Game loop error:', error);
            this.handleGameLoopError(error);
        }
    }

    update(deltaTime) {
        if (!gameState.started || gameState.cleared) return;

        // 経過時間更新
        gameState.updateElapsedTime();

        // エネルギー更新
        gameState.updateEchoEnergy(deltaTime);

        // プレイヤー更新
        this.updatePlayer(deltaTime);

        // エコー更新
        this.updateEchoes();

        // パーティクル更新（最適化版）
        this.updateParticlesOptimized();

        // 衝突判定
        this.checkCollisions();

        // UI更新
        this.updateUI();

        // タスクスケジューラーにタスクを追加
        this.scheduleMaintenanceTasks();
    }

    render() {
        if (this.optimizedRenderer && this.performanceSettings.enableOptimizedRendering) {
            // 最適化レンダリング
            const renderResult = this.optimizedRenderer.render(gameState);
            
            // レンダリング統計の更新
            this.updateRenderStats(renderResult);
        } else {
            // フォールバック: 従来のレンダリング
            this.drawLegacy();
        }
    }

    updateParticlesOptimized() {
        // ソナーリング更新
        sonarRingManager.updateSonarRings();
        sonarRingManager.checkRingCollisions(gameState);

        // エコーパーティクル更新（プール使用）
        this.updateEchoParticlesWithPool();

        // 高度なパーティクル更新（品質調整付き）
        this.updateAdvancedParticlesOptimized();

        // アイテムとゴールの余韻効果更新
        this.updateGlowEffects();

        // プール調整
        this.performanceScheduleTask(() => {
            this.poolManager.performMaintenanceCleanup();
        }, 'background');
    }

    updateEchoParticlesWithPool() {
        // 期限切れパーティクルの効率的な削除
        const expiredCount = this.poolManager.particlePool.removeExpiredParticles();
        
        // パーティクル数の制限
        const maxParticles = this.performanceSettings.maxParticleCount * this.getCurrentQualityLevel();
        
        if (gameState.echoParticles && gameState.echoParticles.length > maxParticles) {
            // 古いパーティクルから削除
            const excessCount = gameState.echoParticles.length - maxParticles;
            for (let i = 0; i < excessCount; i++) {
                const particle = gameState.echoParticles.shift();
                if (particle) {
                    this.poolManager.releaseParticle(particle);
                }
            }
        }

        // 残りのパーティクルを更新
        echoParticleManager.updateEchoParticles(gameState.echoParticles, particlePool);
    }

    updateAdvancedParticlesOptimized() {
        const qualityLevel = this.getCurrentQualityLevel();
        
        for (let i = gameState.advancedParticles.length - 1; i >= 0; i--) {
            const particle = gameState.advancedParticles[i];
            
            // 品質レベルに基づいてパーティクル更新をスキップ
            if (qualityLevel < 0.7 && Math.random() > qualityLevel) {
                continue;
            }
            
            if (!particle.update()) {
                // プールに返却
                this.poolManager.release('advancedParticle', particle);
                gameState.advancedParticles.splice(i, 1);
            }
        }
    }

    updateGlowEffects() {
        // アイテムの余韻効果更新
        for (let i = gameState.itemGlows.length - 1; i >= 0; i--) {
            const glow = gameState.itemGlows[i];
            glow.alpha -= glow.decay;
            glow.pulsePhase += 0.1;
            
            if (glow.alpha <= 0 || glow.item.collected) {
                gameState.itemGlows.splice(i, 1);
            }
        }

        // ゴールの余韻効果更新
        if (gameState.goalGlow) {
            gameState.goalGlow.alpha -= gameState.goalGlow.decay;
            gameState.goalGlow.pulsePhase += 0.05;
            
            if (gameState.goalGlow.alpha <= 0 || !gameState.goal || !gameState.goal.active) {
                gameState.goalGlow = null;
            }
        }
    }

    scheduleMaintenanceTasks() {
        // 定期的なメンテナンスタスクをスケジュール
        
        // オブジェクトプールの調整（低優先度）
        this.performanceScheduleTask(() => {
            this.poolManager.multiPool.autoAdjustAllPools();
        }, 'background');

        // パフォーマンス統計の収集（通常優先度）
        this.performanceScheduleTask(() => {
            this.performanceMonitor.collectAllMetrics();
        }, 'normal');

        // メモリ使用量チェック（高優先度、条件付き）
        if (this.frameManager.frameCount % 300 === 0) { // 5秒ごと
            this.performanceScheduleTask(() => {
                this.checkMemoryUsage();
            }, 'normal');
        }
    }

    performanceScheduleTask(task, priority) {
        if (this.frameManager.taskScheduler) {
            this.frameManager.taskScheduler.addTask(task, priority);
        } else {
            // フォールバック: 即座に実行
            task();
        }
    }

    checkMemoryUsage() {
        const memoryStats = this.performanceMonitor.metrics.memory.getCurrentStats();
        
        if (memoryStats.currentUsage > 80) { // 80MB以上
            console.warn('High memory usage detected, performing cleanup');
            this.performEmergencyCleanup();
        }
    }

    performEmergencyCleanup() {
        // 緊急時のメモリクリーンアップ
        
        // パーティクル数を大幅削減
        if (gameState.advancedParticles.length > 50) {
            const toRemove = gameState.advancedParticles.splice(50);
            toRemove.forEach(particle => {
                this.poolManager.release('advancedParticle', particle);
            });
        }

        // エコーパーティクルも削減
        if (gameState.echoParticles && gameState.echoParticles.length > 100) {
            const toRemove = gameState.echoParticles.splice(100);
            toRemove.forEach(particle => {
                this.poolManager.releaseParticle(particle);
            });
        }

        // ガベージコレクションの提案
        if (window.gc) {
            window.gc();
        }

        // 品質レベルを一時的に下げる
        if (this.optimizedRenderer) {
            this.optimizedRenderer.updateQualityLevel(0.5);
        }
    }

    getCurrentQualityLevel() {
        if (this.optimizedRenderer) {
            return this.optimizedRenderer.qualityLevel;
        }
        return this.frameManager.qualityManager.getCurrentQuality();
    }

    updateRenderStats(renderResult) {
        // レンダリング統計の更新
        if (renderResult) {
            this.performanceMonitor.metrics.render.recordRenderTime(renderResult.renderTime);
            this.performanceMonitor.metrics.render.recordParticleCount(renderResult.objectsRendered);
        }
    }

    handlePerformanceAlert(alert) {
        console.warn(`Performance Alert: ${alert.type}`, alert);
        
        switch (alert.type) {
            case 'frameTime':
                this.handleFrameTimeAlert(alert);
                break;
            case 'memory':
                this.handleMemoryAlert(alert);
                break;
            default:
                console.log('Unknown alert type:', alert.type);
        }
    }

    handleFrameTimeAlert(alert) {
        // フレーム時間アラートの処理
        if (alert.severity === 'critical') {
            // 緊急時の品質削減
            if (this.optimizedRenderer) {
                this.optimizedRenderer.updateQualityLevel(0.3);
            }
            this.performanceSettings.maxParticleCount = Math.max(100, this.performanceSettings.maxParticleCount * 0.5);
        } else {
            // 段階的な品質削減
            if (this.optimizedRenderer) {
                const currentQuality = this.optimizedRenderer.qualityLevel;
                this.optimizedRenderer.updateQualityLevel(Math.max(0.4, currentQuality - 0.1));
            }
        }
    }

    handleMemoryAlert(alert) {
        // メモリアラートの処理
        if (alert.severity === 'critical') {
            this.performEmergencyCleanup();
        } else {
            // 軽度のクリーンアップ
            this.poolManager.cleanup();
        }
    }

    adjustGameQuality(qualityLevel) {
        // ゲーム全体の品質調整
        
        // パーティクル数の調整
        const baseParticleCount = 1000;
        this.performanceSettings.maxParticleCount = Math.floor(baseParticleCount * qualityLevel);
        
        // エフェクトの調整
        if (qualityLevel < 0.5) {
            // 低品質モード: エフェクトを簡略化
            GAME_CONFIG.PARTICLES.ADVANCED_DECAY = 0.05; // より速い減衰
        } else {
            // 通常品質
            GAME_CONFIG.PARTICLES.ADVANCED_DECAY = 0.02;
        }
        
        // 音響システムの調整
        if (audioSystem.setQuality) {
            audioSystem.setQuality(qualityLevel);
        }
    }

    handleGameLoopError(error) {
        console.error('Game loop error, attempting recovery:', error);
        
        // エラー回復処理
        try {
            // 最適化システムをリセット
            if (this.optimizedRenderer) {
                this.optimizedRenderer.cleanup();
            }
            
            // フレームマネージャーをリセット
            this.frameManager.reset();
            
            // パフォーマンスモニターをリセット
            this.performanceMonitor.reset();
            
            // フォールバックモードに切り替え
            this.fallbackToBasicMode();
            
        } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
        }
    }

    fallbackToBasicMode() {
        console.warn('Falling back to basic rendering mode');
        
        this.performanceSettings.enableOptimizedRendering = false;
        this.performanceSettings.enableAdaptiveQuality = false;
        this.performanceSettings.enableFrameSkipping = false;
        
        // 従来のゲームループに切り替え
        this.startLegacyGameLoop();
    }

    startLegacyGameLoop() {
        const legacyLoop = (currentTime = 0) => {
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;

            this.update(deltaTime);
            this.drawLegacy();

            this.animationId = requestAnimationFrame(legacyLoop);
        };

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.animationId = requestAnimationFrame(legacyLoop);
    }

    drawLegacy() {
        // 従来の描画システム（main.jsからコピー）
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!gameState.started) return;

        // ソナーリング描画
        sonarRingManager.drawSonarRings(this.ctx);

        // 壁の描画
        this.drawWallsLegacy();

        // アイテムの描画
        this.drawItemsLegacy();

        // ゴールの描画
        this.drawGoalLegacy();

        // パーティクル描画
        gameState.advancedParticles.forEach(particle => {
            particle.draw(this.ctx);
        });

        // エコーパーティクル描画
        echoParticleManager.drawEchoParticles(this.ctx, gameState.echoParticles, gameState);

        // プレイヤー描画
        this.drawPlayerLegacy();

        // エコー描画
        this.drawEchoesLegacy();
    }

    drawWallsLegacy() {
        gameState.walls.forEach(wall => {
            let alpha = 0;
            for (const particle of gameState.echoParticles) {
                if (particle && particle.collisionData && particle.collisionData.type === 'wall') {
                    const wallCenterX = wall.x + wall.width / 2;
                    const wallCenterY = wall.y + wall.height / 2;
                    const distance = Math.sqrt((particle.x - wallCenterX)**2 + (particle.y - wallCenterY)**2);
                    if (distance < 120) {
                        const visibility = Math.max(0, 1 - distance / 120) * particle.alpha * 0.8;
                        alpha = Math.max(alpha, visibility);
                    }
                }
            }

            if (alpha > 0.01) {
                this.ctx.fillStyle = `rgba(${COLORS.WALL}, ${alpha})`;
                this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            } else {
                this.ctx.strokeStyle = `rgba(${COLORS.WALL}, 0.05)`;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
            }
        });
    }

    drawItemsLegacy() {
        gameState.itemGlows.forEach(glow => {
            const item = glow.item;
            if (!item.collected) {
                const pulseSize = Math.sin(glow.pulsePhase) * 3;

                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius + pulseSize + 10, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.1})`;
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius + pulseSize, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.3})`;
                this.ctx.fill();
                this.ctx.strokeStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.5})`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.8})`;
                this.ctx.fill();
            }
        });
    }

    drawGoalLegacy() {
        if (gameState.goal && gameState.goal.active && gameState.goalGlow) {
            const pulseSize = Math.sin(gameState.goalGlow.pulsePhase) * 5;

            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, gameState.goal.radius + pulseSize + 10, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.3})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, gameState.goal.radius + pulseSize, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.2})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.6})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.8})`;
            this.ctx.fill();
        }
    }

    drawPlayerLegacy() {
        if (gameState.started && !gameState.cleared) {
            const time = Date.now() / 1000;
            const pulse = Math.sin(time * 3) * 0.3 + 0.7;
            
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius + 8, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.1 * pulse})`;
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.4 * pulse})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${COLORS.PLAYER}, ${0.8 * pulse})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.9 * pulse})`;
            this.ctx.fill();
        }
    }

    drawEchoesLegacy() {
        gameState.echoes.forEach(echo => {
            const alpha = echo.life / echo.maxLife;
            if (alpha > 0.01) {
                this.ctx.beginPath();
                this.ctx.arc(echo.x, echo.y, 3, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ECHO}, ${alpha})`;
                this.ctx.fill();
            }
        });
    }

    drawDebugInfo() {
        if (this.optimizedRenderer) {
            this.optimizedRenderer.drawDebugInfo();
        } else {
            // 基本的なデバッグ情報
            const stats = this.performanceMonitor.getCurrentStats();
            
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(10, 10, 200, 100);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '12px monospace';
            
            this.ctx.fillText(`FPS: ${stats.frame.averageFPS.toFixed(1)}`, 20, 30);
            this.ctx.fillText(`Frame: ${stats.frame.averageFrameTime.toFixed(2)}ms`, 20, 45);
            this.ctx.fillText(`Memory: ${stats.memory.currentUsage.toFixed(1)}MB`, 20, 60);
            this.ctx.fillText(`Mode: ${this.performanceSettings.enableOptimizedRendering ? 'Optimized' : 'Legacy'}`, 20, 75);
            
            this.ctx.restore();
        }
    }

    // 既存のメソッドたち（updatePlayer, updateEchoes, checkCollisions等）は
    // 元のmain.jsからそのまま使用
    updatePlayer(deltaTime) {
        // 入力処理
        let inputX = 0, inputY = 0;

        // キーボード入力
        if (gameState.keys['ArrowLeft'] || gameState.keys['a'] || gameState.keys['A']) inputX -= 1;
        if (gameState.keys['ArrowRight'] || gameState.keys['d'] || gameState.keys['D']) inputX += 1;
        if (gameState.keys['ArrowUp'] || gameState.keys['w'] || gameState.keys['W']) inputY -= 1;
        if (gameState.keys['ArrowDown'] || gameState.keys['s'] || gameState.keys['S']) inputY += 1;

        // ジョイスティック入力
        if (gameState.joystick.active) {
            const dx = gameState.joystick.currentX - gameState.joystick.startX;
            const dy = gameState.joystick.currentY - gameState.joystick.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 10) {
                inputX += dx / 50;
                inputY += dy / 50;
            }
        }

        // 入力の正規化
        const inputMagnitude = Math.sqrt(inputX * inputX + inputY * inputY);
        if (inputMagnitude > 1) {
            inputX /= inputMagnitude;
            inputY /= inputMagnitude;
        }

        // 慣性システム
        const player = gameState.player;
        player.vx += inputX * player.acceleration;
        player.vy += inputY * player.acceleration;

        player.actualVx = MathUtils.lerp(player.actualVx, player.vx * player.speed, 0.2);
        player.actualVy = MathUtils.lerp(player.actualVy, player.vy * player.speed, 0.2);

        player.vx *= player.friction;
        player.vy *= player.friction;

        // 位置更新
        const newX = player.x + player.actualVx;
        const newY = player.y + player.actualVy;

        // 壁衝突チェック
        if (!this.checkWallCollision(newX, player.y, player.radius)) {
            player.x = newX;
        }
        if (!this.checkWallCollision(player.x, newY, player.radius)) {
            player.y = newY;
        }

        // 境界チェック
        player.x = MathUtils.clamp(player.x, player.radius, this.canvas.width - player.radius);
        player.y = MathUtils.clamp(player.y, player.radius, this.canvas.height - player.radius);
    }

    checkWallCollision(x, y, radius) {
        const circle = { x, y, radius };
        return gameState.walls.some(wall => MathUtils.circleRectCollision(circle, wall));
    }

    updateEchoes() {
        gameState.echoes = gameState.echoes.filter(echo => {
            echo.x += echo.vx;
            echo.y += echo.vy;
            echo.life--;

            this.checkEchoCollisions(echo);

            return echo.life > 0;
        });
    }

    checkEchoCollisions(echo) {
        const echoRect = { x: echo.x - 2, y: echo.y - 2, width: 4, height: 4 };

        // 壁との衝突
        for (const wall of gameState.walls) {
            if (MathUtils.rectCollision(echoRect, wall)) {
                this.createEchoEffect(echo.x, echo.y, { type: 'wall' });
                echo.life = 0;
                return;
            }
        }

        // アイテムとの衝突
        for (const item of gameState.items) {
            if (!item.collected) {
                const distance = Math.sqrt((echo.x - item.x) ** 2 + (echo.y - item.y) ** 2);
                if (distance < item.radius + 2) {
                    this.createEchoEffect(echo.x, echo.y, { type: 'item', object: item });
                    echo.life = 0;
                    return;
                }
            }
        }

        // ゴールとの衝突
        if (gameState.goal && gameState.goal.active) {
            const distance = Math.sqrt((echo.x - gameState.goal.x) ** 2 + (echo.y - gameState.goal.y) ** 2);
            if (distance < gameState.goal.radius + 2) {
                this.createEchoEffect(echo.x, echo.y, { type: 'goal', object: gameState.goal });
                echo.life = 0;
                return;
            }
        }
    }

    createEchoEffect(x, y, collisionData) {
        // 反響音再生
        const distance = Math.sqrt((x - gameState.player.x) ** 2 + (y - gameState.player.y) ** 2);
        audioSystem.playReflectionSound(distance, collisionData.type);

        // パーティクル生成（プール使用）
        const particle = this.poolManager.acquireParticle('echo');
        if (particle) {
            particle.setPosition(x, y);
            particle.collisionData = collisionData;
            gameState.echoParticles.push(particle);
        }

        // 余韻効果の生成
        this.createGlowEffect(collisionData);
    }

    createGlowEffect(collisionData) {
        if (collisionData.type === 'item' && collisionData.object && !collisionData.object.collected) {
            const existingGlow = gameState.itemGlows.find(glow => glow.item === collisionData.object);
            if (!existingGlow) {
                gameState.itemGlows.push({
                    item: collisionData.object,
                    alpha: 1.0,
                    pulsePhase: 0,
                    decay: 0.015
                });
            } else {
                existingGlow.alpha = Math.min(1.0, existingGlow.alpha + 0.5);
            }
        } else if (collisionData.type === 'goal' && collisionData.object && collisionData.object.active) {
            if (!gameState.goalGlow) {
                gameState.goalGlow = {
                    alpha: 1.0,
                    pulsePhase: 0,
                    decay: 0.01
                };
            } else {
                gameState.goalGlow.alpha = Math.min(1.0, gameState.goalGlow.alpha + 0.5);
            }
        }
    }

    checkCollisions() {
        // アイテム収集
        gameState.items.forEach((item, index) => {
            if (!item.collected) {
                const distance = Math.sqrt(
                    (gameState.player.x - item.x) ** 2 + 
                    (gameState.player.y - item.y) ** 2
                );
                
                if (distance < gameState.player.radius + item.radius + 5) {
                    gameState.collectItem(index);
                    audioSystem.playItemCollectSound();
                    hapticSystem.vibrate('itemCollect');
                    
                    // パーティクル効果（プール使用）
                    this.createExplosionEffect(item.x, item.y, { r: 255, g: 255, b: 0 });
                }
            }
        });

        // ゴール到達
        if (gameState.isGoalActive()) {
            const distance = Math.sqrt(
                (gameState.player.x - gameState.goal.x) ** 2 + 
                (gameState.player.y - gameState.goal.y) ** 2
            );
            
            if (distance < gameState.player.radius + gameState.goal.radius) {
                this.gameComplete();
            }
        }
    }

    createExplosionEffect(x, y, color) {
        // パーティクルプールを使用した爆発効果
        for (let i = 0; i < 10; i++) {
            const particle = this.poolManager.acquireParticle('explosion');
            if (particle) {
                particle.setPosition(x, y);
                particle.setColor(color.r, color.g, color.b);
                particle.setVelocity(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                );
                gameState.advancedParticles.push(particle);
            }
        }
    }

    gameComplete() {
        gameState.clear();
        
        const gameData = gameState.getGameData();
        statsManager.recordGameClear(gameData);

        audioSystem.playGoalReachSound();
        hapticSystem.vibrate('goalReach');

        this.createExplosionEffect(
            gameState.goal.x, 
            gameState.goal.y, 
            { r: 0, g: 255, b: 0 }
        );

        this.showClearScreen();
    }

    showClearScreen() {
        const clearScreen = DOMUtils.getElementById('clearScreen');
        const clearTime = DOMUtils.getElementById('clearTime');
        const clearEchoCount = DOMUtils.getElementById('clearEchoCount');
        const clearScore = DOMUtils.getElementById('clearScore');

        if (clearScreen) {
            // 基本情報の更新
            DOMUtils.setText(clearTime, TimeUtils.formatTime(gameState.elapsedTime));
            DOMUtils.setText(clearEchoCount, gameState.echoCount.toString());
            DOMUtils.setText(clearScore, gameState.calculateScore().toString());
            
            // スコア詳細の更新
            const scoreDetails = gameState.calculateScoreDetails();
            
            const baseScore = DOMUtils.getElementById('baseScore');
            const timePenalty = DOMUtils.getElementById('timePenalty');
            const echoPenalty = DOMUtils.getElementById('echoPenalty');
            const finalScore = DOMUtils.getElementById('finalScore');
            const timePenaltyDetail = DOMUtils.getElementById('timePenaltyDetail');
            const echoPenaltyDetail = DOMUtils.getElementById('echoPenaltyDetail');
            
            if (baseScore) DOMUtils.setText(baseScore, `+${scoreDetails.baseScore}`);
            if (timePenalty) DOMUtils.setText(timePenalty, `-${scoreDetails.timePenalty}`);
            if (echoPenalty) DOMUtils.setText(echoPenalty, `-${scoreDetails.echoPenalty}`);
            if (finalScore) DOMUtils.setText(finalScore, scoreDetails.finalScore.toString());
            
            // ペナルティの詳細情報を表示
            if (timePenaltyDetail) DOMUtils.setText(timePenaltyDetail, `(${scoreDetails.timeSeconds}秒)`);
            if (echoPenaltyDetail) DOMUtils.setText(echoPenaltyDetail, `(${scoreDetails.echoCount}回)`);
            
            DOMUtils.setDisplay(clearScreen, true);
        }
    }

    updateUI() {
        this.updateEchoUI();

        const itemCount = DOMUtils.getElementById('itemCount');
        if (itemCount) {
            const collected = gameState.getCollectedItemCount();
            DOMUtils.setText(itemCount, `${collected}/${gameState.items.length}`);
        }

        const timer = DOMUtils.getElementById('timer');
        if (timer && gameState.started) {
            DOMUtils.setText(timer, TimeUtils.formatTime(gameState.elapsedTime));
        }

        const goalMessage = DOMUtils.getElementById('goalMessage');
        if (goalMessage) {
            DOMUtils.setDisplay(goalMessage, gameState.isGoalActive());
        }
    }

    updateEchoUI() {
        const now = Date.now();
        const cooldownProgress = Math.min(1, (now - gameState.lastEchoTime) / gameState.echoCooldownMax);
        const energyProgress = gameState.echoEnergy / gameState.echoEnergyMax;
        const canEcho = cooldownProgress >= 1 && gameState.echoEnergy >= GAME_CONFIG.ECHO.ENERGY_COST;

        const cooldownBar = DOMUtils.getElementById('echoCooldownBar');
        if (cooldownBar) {
            const displayProgress = Math.min(energyProgress, cooldownProgress);
            cooldownBar.style.width = (displayProgress * 100) + '%';
            
            if (energyProgress < 0.3) {
                cooldownBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
            } else if (energyProgress < 0.7) {
                cooldownBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
            } else {
                cooldownBar.style.background = 'linear-gradient(90deg, #00ffff, #0080ff, #0040ff)';
            }
        }

        const echoStatus = DOMUtils.getElementById('echoStatus');
        if (echoStatus) {
            if (canEcho) {
                DOMUtils.setText(echoStatus, 'Ready');
            } else if (cooldownProgress < 1) {
                DOMUtils.setText(echoStatus, 'Cooling...');
            } else if (gameState.echoEnergy < GAME_CONFIG.ECHO.ENERGY_COST) {
                DOMUtils.setText(echoStatus, 'Low Energy');
            }
        }

        const echoButton = DOMUtils.getElementById('echoButton');
        if (echoButton) {
            DOMUtils.toggleClass(echoButton, 'cooldown', !canEcho);
        }
    }

    // その他の既存メソッド（イベントリスナー設定等）は元のコードを使用
    resizeCanvas() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        
        if (this.optimizedRenderer) {
            this.optimizedRenderer.resize(this.canvas.width, this.canvas.height);
        }
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        if (DeviceUtils.isMobileDevice()) {
            this.setupMobileControls();
        }

        this.setupUIEvents();
    }

    handleKeyDown(e) {
        gameState.keys[e.key] = true;
        
        if (e.key === ' ' && gameState.started) {
            e.preventDefault();
            this.fireEcho();
        }
    }

    handleKeyUp(e) {
        gameState.keys[e.key] = false;
    }

    handleCanvasClick(e) {
        if (!gameState.started || DeviceUtils.isMobileDevice()) return;
        this.fireEcho();
    }

    fireEcho() {
        if (!gameState.canFireEcho()) return;

        if (gameState.fireEcho()) {
            const energyRatio = gameState.echoEnergy / gameState.echoEnergyMax;
            const frequency = GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MIN + 
                            (energyRatio * (GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MAX - GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MIN));
            
            audioSystem.playEchoSound(frequency, 0.05);
            hapticSystem.vibrate('echoFire');

            // ソナーリング生成
            sonarRingManager.createSonarRings(gameState.player.x, gameState.player.y);

            // 従来のエコー生成
            this.createEchoes();
        }
    }

    createEchoes() {
        const echoCount = GAME_CONFIG.ECHO.COUNT;
        for (let i = 0; i < echoCount; i++) {
            const angle = (Math.PI * 2 * i) / echoCount;
            gameState.echoes.push({
                x: gameState.player.x,
                y: gameState.player.y,
                vx: Math.cos(angle) * GAME_CONFIG.ECHO.SPEED,
                vy: Math.sin(angle) * GAME_CONFIG.ECHO.SPEED,
                life: GAME_CONFIG.ECHO.LIFE,
                maxLife: GAME_CONFIG.ECHO.LIFE
            });
        }
    }

    setupMobileControls() {
        const joystick = DOMUtils.getElementById(DOM_IDS.JOYSTICK);
        const echoButton = DOMUtils.getElementById(DOM_IDS.ECHO_BUTTON);

        if (joystick) {
            this.setupJoystick(joystick);
        }

        if (echoButton) {
            echoButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.fireEcho();
            });
        }
    }

    setupJoystick(joystick) {
        const handleStart = (e) => {
            if (!gameState.started) return;
            e.preventDefault();
            gameState.joystick.active = true;
            
            const rect = joystick.getBoundingClientRect();
            gameState.joystick.startX = rect.left + rect.width / 2;
            gameState.joystick.startY = rect.top + rect.height / 2;
        };

        const handleMove = (e) => {
            if (!gameState.joystick.active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const dx = touch.clientX - gameState.joystick.startX;
            const dy = touch.clientY - gameState.joystick.startY;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 50;
            
            if (distance > maxDistance) {
                const angle = Math.atan2(dy, dx);
                gameState.joystick.currentX = gameState.joystick.startX + Math.cos(angle) * maxDistance;
                gameState.joystick.currentY = gameState.joystick.startY + Math.sin(angle) * maxDistance;
            } else {
                gameState.joystick.currentX = touch.clientX;
                gameState.joystick.currentY = touch.clientY;
            }
        };

        const handleEnd = (e) => {
            e.preventDefault();
            gameState.joystick.active = false;
            gameState.joystick.currentX = gameState.joystick.startX;
            gameState.joystick.currentY = gameState.joystick.startY;
        };

        joystick.addEventListener('touchstart', handleStart);
        joystick.addEventListener('touchmove', handleMove);
        joystick.addEventListener('touchend', handleEnd);
    }

    setupUIEvents() {
        const startButton = DOMUtils.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.startGame());
        }

        const retryButton = DOMUtils.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', () => this.startGame());
        }

        const statsButton = DOMUtils.getElementById('statsButton');
        if (statsButton) {
            statsButton.addEventListener('click', () => statsManager.showStatsScreen());
        }

        const backToMenuButton = DOMUtils.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', () => statsManager.hideStatsScreen());
        }

        const backToClearButton = DOMUtils.getElementById('backToClearButton');
        if (backToClearButton) {
            backToClearButton.addEventListener('click', () => {
                statsManager.hideStatsToScreen('clearScreen');
            });
        }

        const resetStatsButton = DOMUtils.getElementById('resetStatsButton');
        if (resetStatsButton) {
            resetStatsButton.addEventListener('click', () => {
                if (confirm('統計データをすべてリセットしますか？この操作は取り消せません。')) {
                    statsManager.resetStats();
                    statsManager.updateStatsDisplay();
                }
            });
        }

        const clearStatsButton = DOMUtils.getElementById('clearStatsButton');
        if (clearStatsButton) {
            clearStatsButton.addEventListener('click', () => {
                statsManager.showStatsFromClear();
            });
        }
    }

    startGame() {
        statsManager.recordGameStart();
        gameState.start();
        audioSystem.resumeAudioContext();
        this.generateWorld();
        this.hideAllScreens();
        this.updateUI();

        // パフォーマンスモニターのリセット
        this.performanceMonitor.reset();

        console.log('Game started with optimized rendering');
    }

    generateWorld() {
        this.resizeCanvas();

        gameState.layoutType = MathUtils.randomInt(0, 2);

        gameState.walls = mapGenerator.generateMap(
            gameState.layoutType,
            this.canvas.width,
            this.canvas.height
        );

        const playerPos = mapGenerator.getSafePlayerPosition(
            gameState.walls,
            this.canvas.width,
            this.canvas.height
        );
        gameState.setPlayerPosition(playerPos.x, playerPos.y);

        const objects = mapGenerator.generateItemsAndGoal(
            gameState.walls,
            this.canvas.width,
            this.canvas.height,
            playerPos.x,
            playerPos.y
        );

        gameState.items = objects.items;
        gameState.goal = objects.goal;
    }

    hideAllScreens() {
        DOMUtils.setDisplay(DOMUtils.getElementById('startScreen'), false);
        DOMUtils.setDisplay(DOMUtils.getElementById('clearScreen'), false);
        DOMUtils.setDisplay(DOMUtils.getElementById('statsScreen'), false);
    }

    // 破棄
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.optimizedRenderer) {
            this.optimizedRenderer.destroy();
        }
        
        this.performanceMonitor.destroy();
        this.poolManager.destroy();
        audioSystem.destroy();
        hapticSystem.stopAll();
    }
}

// ゲーム開始
const game = new OptimizedEchoRunnerGame();

// グローバルアクセス用（デバッグ）
window.echoRunner = {
    game,
    gameState,
    audioSystem,
    optimizedRenderer: game.optimizedRenderer,
    frameManager: game.frameManager,
    performanceMonitor: game.performanceMonitor,
    poolManager: game.poolManager,
    sonarRingManager,
    hapticSystem,
    statsManager
};