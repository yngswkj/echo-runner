// optimized-renderer.js - 最適化レンダリングシステムの統合

import { Canvas2DOptimizer, RenderDataBuilder } from './canvas-optimizer.js';
import { globalPoolManager } from './enhanced-object-pool.js';
import { globalFrameManager } from './frame-manager.js';
import { globalPerformanceMonitor } from './performance-monitor.js';
import { COLORS, GAME_CONFIG } from '../core/constants.js';

export class OptimizedRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 最適化システムの初期化
        this.canvasOptimizer = new Canvas2DOptimizer();
        this.frameManager = globalFrameManager;
        this.poolManager = globalPoolManager;
        this.performanceMonitor = globalPerformanceMonitor;
        
        // レンダリング統計
        this.renderStats = {
            totalRenderCalls: 0,
            totalRenderTime: 0,
            particlesRendered: 0,
            objectsRendered: 0,
            lastFrameObjects: 0
        };
        
        // 品質レベル管理
        this.qualityLevel = 1.0;
        this.adaptiveQuality = true;
        
        // レイヤー管理
        this.layerManager = new LayerManager();
        
        // キャッシュシステム
        this.renderCache = new RenderCache();
        
        this.initialize();
    }
    
    initialize() {
        // Canvas2D最適化システムの初期化
        this.canvasOptimizer.initialize(this.canvas.width, this.canvas.height);
        
        // パフォーマンス監視開始
        this.performanceMonitor.startAutoCollection();
        
        // 品質調整のコールバック設定
        this.frameManager.qualityManager.onQualityChange = (newQuality) => {
            this.updateQualityLevel(newQuality);
        };
        
        console.log('OptimizedRenderer initialized');
    }
    
    // メインレンダリング関数（既存のdraw()を置き換え）
    render(gameState) {
        const renderStart = performance.now();
        
        // フレーム予算の取得
        const frameBudget = this.frameManager.getFrameBudget();
        
        // 品質レベルの更新
        this.updateQualityFromBudget(frameBudget);
        
        // レンダーデータの構築
        const renderData = this.buildRenderData(gameState);
        
        // 最適化レンダリング実行
        const optimizedRenderTime = this.canvasOptimizer.optimizedRender(this.ctx, renderData);
        
        // 統計更新
        const totalRenderTime = performance.now() - renderStart;
        this.updateRenderStats(totalRenderTime, optimizedRenderTime, renderData.length);
        
        // パフォーマンス記録
        this.performanceMonitor.recordFrame(
            totalRenderTime,
            optimizedRenderTime,
            renderStart
        );
        
        return {
            renderTime: totalRenderTime,
            objectsRendered: renderData.length,
            qualityLevel: this.qualityLevel
        };
    }
    
    // ゲーム状態からレンダーデータを構築
    buildRenderData(gameState) {
        const builder = new RenderDataBuilder();
        
        // 背景の描画
        this.addBackgroundToRenderData(builder, gameState);
        
        // 壁の描画（エコーベース）
        this.addWallsToRenderData(builder, gameState);
        
        // ソナーリングの描画
        this.addSonarRingsToRenderData(builder, gameState);
        
        // パーティクルの描画
        this.addParticlesToRenderData(builder, gameState);
        
        // プレイヤーの描画
        this.addPlayerToRenderData(builder, gameState);
        
        // アイテムの描画
        this.addItemsToRenderData(builder, gameState);
        
        // ゴールの描画
        this.addGoalToRenderData(builder, gameState);
        
        // エコーの描画
        this.addEchoesToRenderData(builder, gameState);
        
        // UI要素の描画
        this.addUIToRenderData(builder, gameState);
        
        return builder.build();
    }
    
    addBackgroundToRenderData(builder, gameState) {
        // 背景グラデーション
        builder.addRectangle(
            0, 0, this.canvas.width, this.canvas.height,
            {
                layer: 'background',
                fillStyle: 'radial-gradient(circle at center, #000511 0%, #000 100%)',
                fill: true
            }
        );
    }
    
    addWallsToRenderData(builder, gameState) {
        if (!gameState.walls) return;
        
        gameState.walls.forEach(wall => {
            // エコーパーティクルによる可視化チェック
            let alpha = this.calculateWallVisibility(wall, gameState.echoParticles);
            
            if (alpha > 0.01) {
                const fillStyle = `rgba(${COLORS.WALL}, ${alpha * this.qualityLevel})`;
                
                builder.addRectangle(
                    wall.x, wall.y, wall.width, wall.height,
                    {
                        layer: 'walls',
                        fillStyle: fillStyle,
                        fill: true
                    }
                );
            } else if (this.qualityLevel > 0.5) {
                // デバッグ用の薄い輪郭
                const strokeStyle = `rgba(${COLORS.WALL}, ${0.05 * this.qualityLevel})`;
                
                builder.addRectangle(
                    wall.x, wall.y, wall.width, wall.height,
                    {
                        layer: 'walls',
                        strokeStyle: strokeStyle,
                        lineWidth: 1,
                        stroke: true,
                        fill: false
                    }
                );
            }
        });
    }
    
    calculateWallVisibility(wall, echoParticles) {
        if (!echoParticles || !Array.isArray(echoParticles)) return 0;
        
        let maxAlpha = 0;
        const wallCenterX = wall.x + wall.width / 2;
        const wallCenterY = wall.y + wall.height / 2;
        
        echoParticles.forEach(particle => {
            if (particle && particle.collisionData && particle.collisionData.type === 'wall') {
                const distance = Math.sqrt(
                    (particle.x - wallCenterX) ** 2 + 
                    (particle.y - wallCenterY) ** 2
                );
                
                if (distance < 120) {
                    const visibility = Math.max(0, 1 - distance / 120) * particle.alpha * 0.8;
                    maxAlpha = Math.max(maxAlpha, visibility);
                }
            }
        });
        
        return maxAlpha;
    }
    
    addSonarRingsToRenderData(builder, gameState) {
        // ソナーリングマネージャーから取得
        if (window.echoRunner && window.echoRunner.sonarRingManager) {
            const rings = window.echoRunner.sonarRingManager.rings || [];
            
            rings.forEach(ring => {
                if (ring.alpha > 0.01) {
                    const strokeStyle = `rgba(0, 255, 255, ${ring.alpha * this.qualityLevel})`;
                    
                    builder.addCircle(
                        ring.x, ring.y, ring.radius,
                        {
                            layer: 'effects',
                            strokeStyle: strokeStyle,
                            lineWidth: Math.max(1, ring.lineWidth * this.qualityLevel),
                            stroke: true,
                            fill: false
                        }
                    );
                }
            });
        }
    }
    
    addParticlesToRenderData(builder, gameState) {
        // 高度なパーティクル
        if (gameState.advancedParticles) {
            gameState.advancedParticles.forEach(particle => {
                if (particle.alpha > 0.01) {
                    this.addAdvancedParticleToRenderData(builder, particle);
                }
            });
        }
        
        // エコーパーティクル
        if (gameState.echoParticles) {
            gameState.echoParticles.forEach(particle => {
                if (particle && particle.alpha > 0.01) {
                    this.addEchoParticleToRenderData(builder, particle);
                }
            });
        }
    }
    
    addAdvancedParticleToRenderData(builder, particle) {
        const size = particle.radius * particle.scale * this.qualityLevel;
        if (size < 0.5) return; // 小さすぎる場合はスキップ
        
        const alpha = particle.alpha * this.qualityLevel;
        const fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${alpha})`;
        
        builder.addParticle(
            particle.x, particle.y, size,
            particle.color, alpha,
            {
                layer: 'particles',
                type: particle.type || 'circle'
            }
        );
    }
    
    addEchoParticleToRenderData(builder, particle) {
        const alpha = particle.alpha * this.qualityLevel;
        if (alpha < 0.01) return;
        
        const color = this.getEchoParticleColor(particle);
        const size = this.getEchoParticleSize(particle);
        
        builder.addParticle(
            particle.x, particle.y, size,
            color, alpha,
            {
                layer: 'particles',
                type: 'circle'
            }
        );
    }
    
    getEchoParticleColor(particle) {
        if (particle.collisionData) {
            switch (particle.collisionData.type) {
                case 'wall':
                    return { r: 255, g: 255, b: 255 };
                case 'item':
                    return { r: 255, g: 255, b: 0 };
                case 'goal':
                    return { r: 0, g: 255, b: 0 };
                default:
                    return { r: 0, g: 255, b: 255 };
            }
        }
        return { r: 0, g: 255, b: 255 };
    }
    
    getEchoParticleSize(particle) {
        const baseSize = 3;
        const growthFactor = 1 + (1 - particle.alpha) * 2;
        return baseSize * growthFactor * this.qualityLevel;
    }
    
    addPlayerToRenderData(builder, gameState) {
        if (!gameState.started || gameState.cleared) return;
        
        const player = gameState.player;
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 3) * 0.3 + 0.7;
        const alpha = pulse * this.qualityLevel;
        
        // アウターグロー
        if (this.qualityLevel > 0.7) {
            builder.addCircle(
                player.x, player.y, player.radius + 8,
                {
                    layer: 'effects',
                    fillStyle: `rgba(${COLORS.PLAYER}, ${0.1 * alpha})`,
                    fill: true
                }
            );
        }
        
        // メインボディ
        builder.addCircle(
            player.x, player.y, player.radius,
            {
                layer: 'effects',
                fillStyle: `rgba(${COLORS.PLAYER}, ${0.4 * alpha})`,
                strokeStyle: `rgba(${COLORS.PLAYER}, ${0.8 * alpha})`,
                lineWidth: 2,
                fill: true,
                stroke: true
            }
        );
        
        // インナーコア
        if (this.qualityLevel > 0.5) {
            builder.addCircle(
                player.x, player.y, player.radius * 0.4,
                {
                    layer: 'effects',
                    fillStyle: `rgba(${COLORS.PLAYER}, ${0.9 * alpha})`,
                    fill: true
                }
            );
        }
    }
    
    addItemsToRenderData(builder, gameState) {
        if (!gameState.itemGlows) return;
        
        gameState.itemGlows.forEach(glow => {
            const item = glow.item;
            if (!item.collected && glow.alpha > 0.01) {
                const alpha = glow.alpha * this.qualityLevel;
                const pulseSize = Math.sin(glow.pulsePhase) * 3;
                
                // 外側の光
                if (this.qualityLevel > 0.6) {
                    builder.addCircle(
                        item.x, item.y, item.radius + pulseSize + 10,
                        {
                            layer: 'effects',
                            fillStyle: `rgba(${COLORS.ITEM}, ${alpha * 0.1})`,
                            fill: true
                        }
                    );
                }
                
                // メインアイテム
                builder.addCircle(
                    item.x, item.y, item.radius + pulseSize,
                    {
                        layer: 'effects',
                        fillStyle: `rgba(${COLORS.ITEM}, ${alpha * 0.3})`,
                        strokeStyle: `rgba(${COLORS.ITEM}, ${alpha * 0.5})`,
                        lineWidth: 2,
                        fill: true,
                        stroke: true
                    }
                );
                
                // 中心の明るい点
                if (this.qualityLevel > 0.4) {
                    builder.addCircle(
                        item.x, item.y, 5,
                        {
                            layer: 'effects',
                            fillStyle: `rgba(${COLORS.ITEM}, ${alpha * 0.8})`,
                            fill: true
                        }
                    );
                }
            }
        });
    }
    
    addGoalToRenderData(builder, gameState) {
        if (!gameState.goal || !gameState.goal.active || !gameState.goalGlow) return;
        
        const goal = gameState.goal;
        const glow = gameState.goalGlow;
        const alpha = glow.alpha * this.qualityLevel;
        const pulseSize = Math.sin(glow.pulsePhase) * 5;
        
        // 外側の輪
        if (this.qualityLevel > 0.6) {
            builder.addCircle(
                goal.x, goal.y, goal.radius + pulseSize + 10,
                {
                    layer: 'effects',
                    strokeStyle: `rgba(${COLORS.GOAL}, ${alpha * 0.3})`,
                    lineWidth: 2,
                    stroke: true,
                    fill: false
                }
            );
        }
        
        // メインの円
        builder.addCircle(
            goal.x, goal.y, goal.radius + pulseSize,
            {
                layer: 'effects',
                fillStyle: `rgba(${COLORS.GOAL}, ${alpha * 0.2})`,
                strokeStyle: `rgba(${COLORS.GOAL}, ${alpha * 0.6})`,
                lineWidth: 3,
                fill: true,
                stroke: true
            }
        );
        
        // 中心の明るい点
        if (this.qualityLevel > 0.4) {
            builder.addCircle(
                goal.x, goal.y, 5,
                {
                    layer: 'effects',
                    fillStyle: `rgba(${COLORS.GOAL}, ${alpha * 0.8})`,
                    fill: true
                }
            );
        }
    }
    
    addEchoesToRenderData(builder, gameState) {
        if (!gameState.echoes) return;
        
        gameState.echoes.forEach(echo => {
            const alpha = (echo.life / echo.maxLife) * this.qualityLevel;
            if (alpha > 0.01) {
                builder.addCircle(
                    echo.x, echo.y, 3,
                    {
                        layer: 'particles',
                        fillStyle: `rgba(${COLORS.ECHO}, ${alpha})`,
                        fill: true
                    }
                );
            }
        });
    }
    
    addUIToRenderData(builder, gameState) {
        // UI要素は通常のCanvas描画で処理（最適化対象外）
        // 必要に応じてここでUI要素を追加
    }
    
    // 品質レベルの動的更新
    updateQualityLevel(newQuality) {
        this.qualityLevel = Math.max(0.1, Math.min(1.0, newQuality));
    }
    
    updateQualityFromBudget(frameBudget) {
        if (!this.adaptiveQuality) return;
        
        const budgetRatio = frameBudget.remaining / frameBudget.totalBudget;
        
        if (budgetRatio < 0.2) {
            // 予算不足時は品質を下げる
            this.qualityLevel = Math.max(0.3, this.qualityLevel - 0.05);
        } else if (budgetRatio > 0.6 && this.qualityLevel < 1.0) {
            // 予算に余裕がある時は品質を上げる
            this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.02);
        }
    }
    
    // 統計更新
    updateRenderStats(totalTime, optimizedTime, objectCount) {
        this.renderStats.totalRenderCalls++;
        this.renderStats.totalRenderTime += totalTime;
        this.renderStats.objectsRendered += objectCount;
        this.renderStats.lastFrameObjects = objectCount;
        
        // パーティクル数の記録
        this.performanceMonitor.metrics.render.recordParticleCount(objectCount);
        this.performanceMonitor.metrics.render.recordRenderTime(totalTime);
    }
    
    // リサイズ処理
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvasOptimizer.resize(width, height);
    }
    
    // 統計情報の取得
    getStats() {
        return {
            render: this.renderStats,
            quality: this.qualityLevel,
            performance: this.performanceMonitor.getCurrentStats(),
            frame: this.frameManager.getStats(),
            pool: this.poolManager.getGlobalStats()
        };
    }
    
    // 設定の更新
    updateSettings(settings) {
        if (settings.adaptiveQuality !== undefined) {
            this.adaptiveQuality = settings.adaptiveQuality;
        }
        
        if (settings.qualityLevel !== undefined) {
            this.qualityLevel = Math.max(0.1, Math.min(1.0, settings.qualityLevel));
        }
        
        if (settings.frameManager) {
            this.frameManager.updateSettings(settings.frameManager);
        }
        
        if (settings.performanceMonitor) {
            this.performanceMonitor.updateConfiguration(settings.performanceMonitor);
        }
    }
    
    // デバッグ情報の描画
    drawDebugInfo() {
        if (process.env.NODE_ENV !== 'development') return;
        
        const stats = this.getStats();
        const ctx = this.ctx;
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 300, 200);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        
        let y = 30;
        const lineHeight = 15;
        
        ctx.fillText(`FPS: ${stats.performance.frame.averageFPS.toFixed(1)}`, 20, y);
        y += lineHeight;
        ctx.fillText(`Frame Time: ${stats.performance.frame.averageFrameTime.toFixed(2)}ms`, 20, y);
        y += lineHeight;
        ctx.fillText(`Quality: ${(this.qualityLevel * 100).toFixed(0)}%`, 20, y);
        y += lineHeight;
        ctx.fillText(`Objects: ${stats.render.lastFrameObjects}`, 20, y);
        y += lineHeight;
        ctx.fillText(`Memory: ${stats.performance.memory.currentUsage.toFixed(1)}MB`, 20, y);
        y += lineHeight;
        ctx.fillText(`Pool Usage: ${stats.pool.particlePool.currentUsage}/${stats.pool.particlePool.totalCreated}`, 20, y);
        
        ctx.restore();
    }
    
    // クリーンアップ
    cleanup() {
        this.canvasOptimizer.cleanup();
        this.performanceMonitor.stopAutoCollection();
        this.renderCache.clear();
    }
    
    // 破棄
    destroy() {
        this.cleanup();
        this.performanceMonitor.destroy();
        this.poolManager.destroy();
    }
}

// レイヤー管理クラス
class LayerManager {
    constructor() {
        this.layers = new Map();
        this.layerOrder = ['background', 'walls', 'particles', 'effects', 'ui'];
        this.dirtyLayers = new Set();
    }
    
    markLayerDirty(layerName) {
        this.dirtyLayers.add(layerName);
    }
    
    isLayerDirty(layerName) {
        return this.dirtyLayers.has(layerName);
    }
    
    clearDirtyFlags() {
        this.dirtyLayers.clear();
    }
    
    getLayerOrder() {
        return [...this.layerOrder];
    }
}

// レンダリングキャッシュクラス
class RenderCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessTimes = new Map();
    }
    
    get(key) {
        if (this.cache.has(key)) {
            this.accessTimes.set(key, Date.now());
            return this.cache.get(key);
        }
        return null;
    }
    
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        
        this.cache.set(key, value);
        this.accessTimes.set(key, Date.now());
    }
    
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, time] of this.accessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
        }
    }
    
    clear() {
        this.cache.clear();
        this.accessTimes.clear();
    }
    
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.calculateHitRate()
        };
    }
    
    calculateHitRate() {
        // 実装簡略化: 実際はヒット/ミス統計を追跡
        return 0.8; // 仮の値
    }
}