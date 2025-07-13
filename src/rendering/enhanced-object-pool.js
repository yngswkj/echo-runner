// enhanced-object-pool.js - 拡張オブジェクトプールシステム

export class EnhancedObjectPool {
    constructor(createFn, resetFn, maxSize = 1000) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
        this.available = [];
        this.inUse = new Set();
        this.totalCreated = 0;
        this.stats = {
            created: 0,
            reused: 0,
            destroyed: 0,
            peakUsage: 0,
            currentUsage: 0
        };
        
        // プールの自動調整機能
        this.autoResize = true;
        this.resizeThreshold = 0.8; // 80%使用率で拡張
        this.shrinkThreshold = 0.3;  // 30%使用率で縮小
        this.lastResizeTime = Date.now();
        this.resizeInterval = 5000; // 5秒
        
        // プリウォーミング
        this.preWarmCount = Math.min(50, Math.floor(maxSize * 0.1));
        this.preWarm();
    }
    
    // プールの事前ウォーミング
    preWarm() {
        for (let i = 0; i < this.preWarmCount; i++) {
            const obj = this.createFn();
            this.available.push(obj);
            this.totalCreated++;
            this.stats.created++;
        }
    }
    
    // オブジェクトの取得
    acquire() {
        let obj;
        
        if (this.available.length > 0) {
            obj = this.available.pop();
            this.stats.reused++;
        } else {
            if (this.totalCreated >= this.maxSize) {
                // 最大サイズに達している場合は最も古いオブジェクトを再利用
                obj = this.forceReclaim();
            } else {
                obj = this.createFn();
                this.totalCreated++;
                this.stats.created++;
            }
        }
        
        this.inUse.add(obj);
        this.stats.currentUsage = this.inUse.size;
        this.stats.peakUsage = Math.max(this.stats.peakUsage, this.stats.currentUsage);
        
        return obj;
    }
    
    // オブジェクトの返却
    release(obj) {
        if (!this.inUse.has(obj)) {
            console.warn('Attempting to release object not in use');
            return false;
        }
        
        this.inUse.delete(obj);
        this.stats.currentUsage = this.inUse.size;
        
        // リセット関数でオブジェクトを初期化
        if (this.resetFn) {
            this.resetFn(obj);
        }
        
        // 利用可能プールに戻す
        if (this.available.length < this.maxSize) {
            this.available.push(obj);
        } else {
            // プールが満杯の場合は破棄
            this.stats.destroyed++;
            this.totalCreated--;
        }
        
        return true;
    }
    
    // 強制的にオブジェクトを回収
    forceReclaim() {
        if (this.inUse.size === 0) {
            return this.createFn();
        }
        
        // 最も古いオブジェクトを取得（実装簡略化のため最初のもの）
        const iterator = this.inUse.values();
        const oldestObj = iterator.next().value;
        
        this.inUse.delete(oldestObj);
        this.stats.currentUsage = this.inUse.size;
        
        if (this.resetFn) {
            this.resetFn(oldestObj);
        }
        
        return oldestObj;
    }
    
    // プールサイズの自動調整
    autoAdjustSize() {
        if (!this.autoResize) return;
        
        const now = Date.now();
        if (now - this.lastResizeTime < this.resizeInterval) return;
        
        const usageRate = this.stats.currentUsage / this.maxSize;
        
        if (usageRate > this.resizeThreshold) {
            // 使用率が高い場合は拡張
            this.expandPool();
        } else if (usageRate < this.shrinkThreshold && this.maxSize > this.preWarmCount * 2) {
            // 使用率が低い場合は縮小
            this.shrinkPool();
        }
        
        this.lastResizeTime = now;
    }
    
    expandPool() {
        const expandSize = Math.floor(this.maxSize * 0.2); // 20%拡張
        const newMaxSize = this.maxSize + expandSize;
        
        console.log(`ObjectPool expanding: ${this.maxSize} -> ${newMaxSize}`);
        this.maxSize = newMaxSize;
        
        // 新しいオブジェクトを事前作成
        for (let i = 0; i < Math.min(expandSize, 20); i++) {
            const obj = this.createFn();
            this.available.push(obj);
            this.totalCreated++;
            this.stats.created++;
        }
    }
    
    shrinkPool() {
        const shrinkSize = Math.floor(this.maxSize * 0.1); // 10%縮小
        const newMaxSize = this.maxSize - shrinkSize;
        
        console.log(`ObjectPool shrinking: ${this.maxSize} -> ${newMaxSize}`);
        this.maxSize = newMaxSize;
        
        // 余剰なオブジェクトを削除
        const excessCount = this.available.length - (newMaxSize - this.inUse.size);
        if (excessCount > 0) {
            this.available.splice(0, excessCount);
            this.totalCreated -= excessCount;
            this.stats.destroyed += excessCount;
        }
    }
    
    // 全てのオブジェクトを強制的に返却
    releaseAll() {
        this.inUse.forEach(obj => {
            if (this.resetFn) {
                this.resetFn(obj);
            }
            this.available.push(obj);
        });
        
        this.inUse.clear();
        this.stats.currentUsage = 0;
    }
    
    // プールの統計情報
    getStats() {
        return {
            ...this.stats,
            availableCount: this.available.length,
            inUseCount: this.inUse.size,
            totalCreated: this.totalCreated,
            maxSize: this.maxSize,
            usageRate: this.stats.currentUsage / this.maxSize,
            efficiency: this.stats.reused / (this.stats.created + this.stats.reused)
        };
    }
    
    // プールの状態をリセット
    clear() {
        this.releaseAll();
        this.available = [];
        this.inUse.clear();
        this.totalCreated = 0;
        this.stats = {
            created: 0,
            reused: 0,
            destroyed: 0,
            peakUsage: 0,
            currentUsage: 0
        };
    }
}

// マルチタイプオブジェクトプール
export class MultiTypeObjectPool {
    constructor() {
        this.pools = new Map();
        this.globalStats = {
            totalMemoryUsage: 0,
            totalObjects: 0,
            poolCount: 0
        };
    }
    
    // 新しいプールタイプを登録
    registerPool(typeName, createFn, resetFn, maxSize = 500) {
        if (this.pools.has(typeName)) {
            console.warn(`Pool ${typeName} already exists`);
            return;
        }
        
        const pool = new EnhancedObjectPool(createFn, resetFn, maxSize);
        this.pools.set(typeName, pool);
        this.globalStats.poolCount++;
        
        console.log(`Registered object pool: ${typeName}`);
    }
    
    // オブジェクト取得
    acquire(typeName) {
        const pool = this.pools.get(typeName);
        if (!pool) {
            throw new Error(`Pool ${typeName} not found`);
        }
        
        return pool.acquire();
    }
    
    // オブジェクト返却
    release(typeName, obj) {
        const pool = this.pools.get(typeName);
        if (!pool) {
            console.warn(`Pool ${typeName} not found for release`);
            return false;
        }
        
        return pool.release(obj);
    }
    
    // 全プールの自動調整
    autoAdjustAllPools() {
        this.pools.forEach(pool => {
            pool.autoAdjustSize();
        });
        
        this.updateGlobalStats();
    }
    
    updateGlobalStats() {
        let totalMemory = 0;
        let totalObjects = 0;
        
        this.pools.forEach(pool => {
            const stats = pool.getStats();
            totalMemory += stats.totalCreated * 100; // 仮のメモリサイズ
            totalObjects += stats.totalCreated;
        });
        
        this.globalStats.totalMemoryUsage = totalMemory;
        this.globalStats.totalObjects = totalObjects;
    }
    
    // 全プールの統計情報
    getAllStats() {
        const poolStats = {};
        
        this.pools.forEach((pool, typeName) => {
            poolStats[typeName] = pool.getStats();
        });
        
        return {
            global: this.globalStats,
            pools: poolStats
        };
    }
    
    // メモリクリーンアップ
    cleanup() {
        this.pools.forEach(pool => {
            pool.autoAdjustSize();
        });
    }
    
    // 特定プールの削除
    removePool(typeName) {
        const pool = this.pools.get(typeName);
        if (pool) {
            pool.clear();
            this.pools.delete(typeName);
            this.globalStats.poolCount--;
            console.log(`Removed object pool: ${typeName}`);
        }
    }
}

// 特殊化されたパーティクルプール
export class ParticleObjectPool extends EnhancedObjectPool {
    constructor(maxSize = 2000) {
        super(
            () => new ParticleObject(),
            (particle) => particle.reset(),
            maxSize
        );
        
        // パーティクル固有の最適化
        this.typeGroups = new Map(); // タイプ別グループ化
        this.sizeGroups = new Map();  // サイズ別グループ化
    }
    
    // タイプとサイズを指定してパーティクルを取得
    acquireTyped(type = 'default', size = 'medium') {
        const particle = this.acquire();
        particle.type = type;
        particle.sizeCategory = size;
        
        // グループに追加
        this.addToTypeGroup(particle, type);
        this.addToSizeGroup(particle, size);
        
        return particle;
    }
    
    addToTypeGroup(particle, type) {
        if (!this.typeGroups.has(type)) {
            this.typeGroups.set(type, new Set());
        }
        this.typeGroups.get(type).add(particle);
    }
    
    addToSizeGroup(particle, size) {
        if (!this.sizeGroups.has(size)) {
            this.sizeGroups.set(size, new Set());
        }
        this.sizeGroups.get(size).add(particle);
    }
    
    release(particle) {
        // グループから削除
        if (particle.type && this.typeGroups.has(particle.type)) {
            this.typeGroups.get(particle.type).delete(particle);
        }
        
        if (particle.sizeCategory && this.sizeGroups.has(particle.sizeCategory)) {
            this.sizeGroups.get(particle.sizeCategory).delete(particle);
        }
        
        return super.release(particle);
    }
    
    // タイプ別のパーティクル取得
    getParticlesByType(type) {
        return this.typeGroups.get(type) || new Set();
    }
    
    // サイズ別のパーティクル取得
    getParticlesBySize(size) {
        return this.sizeGroups.get(size) || new Set();
    }
    
    // バッチ更新（同じタイプを一括処理）
    updateByType(type, updateFn) {
        const particles = this.getParticlesByType(type);
        particles.forEach(updateFn);
    }
    
    // 期限切れパーティクルの一括削除
    removeExpiredParticles() {
        const expired = [];
        
        this.inUse.forEach(particle => {
            if (particle.life <= 0 || particle.alpha <= 0) {
                expired.push(particle);
            }
        });
        
        expired.forEach(particle => {
            this.release(particle);
        });
        
        return expired.length;
    }
}

// パーティクルオブジェクトクラス
class ParticleObject {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.radius = 2;
        this.life = 60;
        this.maxLife = 60;
        this.alpha = 1.0;
        this.color = { r: 255, g: 255, b: 255 };
        this.type = 'default';
        this.sizeCategory = 'medium';
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.scale = 1.0;
        this.scaleSpeed = 0;
        this.active = true;
        
        // 描画用プロパティ
        this.fillStyle = null;
        this.strokeStyle = null;
        this.lineWidth = 1;
        this.globalAlpha = 1.0;
        
        return this;
    }
    
    update() {
        if (!this.active) return false;
        
        this.vx += this.ax;
        this.vy += this.ay;
        this.x += this.vx;
        this.y += this.vy;
        
        this.rotation += this.rotationSpeed;
        this.scale += this.scaleSpeed;
        
        this.life--;
        this.alpha = this.life / this.maxLife;
        
        return this.life > 0 && this.alpha > 0;
    }
    
    setColor(r, g, b) {
        this.color.r = r;
        this.color.g = g;
        this.color.b = b;
        this.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.alpha})`;
        return this;
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    
    setVelocity(vx, vy) {
        this.vx = vx;
        this.vy = vy;
        return this;
    }
    
    setSize(radius) {
        this.radius = radius;
        
        if (radius <= 1) this.sizeCategory = 'tiny';
        else if (radius <= 3) this.sizeCategory = 'small';
        else if (radius <= 6) this.sizeCategory = 'medium';
        else if (radius <= 10) this.sizeCategory = 'large';
        else this.sizeCategory = 'huge';
        
        return this;
    }
}

// グローバルプールマネージャー
export class GlobalPoolManager {
    constructor() {
        this.multiPool = new MultiTypeObjectPool();
        this.particlePool = new ParticleObjectPool(5000);
        
        // 標準プールを登録
        this.initializeStandardPools();
        
        // 自動クリーンアップ
        this.cleanupInterval = setInterval(() => {
            this.performMaintenanceCleanup();
        }, 10000); // 10秒間隔
    }
    
    initializeStandardPools() {
        // 標準的なオブジェクトプールを登録
        this.multiPool.registerPool('vector2', 
            () => ({ x: 0, y: 0 }),
            (v) => { v.x = 0; v.y = 0; },
            1000
        );
        
        this.multiPool.registerPool('boundingBox',
            () => ({ x: 0, y: 0, width: 0, height: 0 }),
            (bb) => { bb.x = 0; bb.y = 0; bb.width = 0; bb.height = 0; },
            500
        );
        
        this.multiPool.registerPool('renderItem',
            () => ({ type: '', x: 0, y: 0, layer: 'default' }),
            (item) => { item.type = ''; item.x = 0; item.y = 0; item.layer = 'default'; },
            2000
        );
    }
    
    // パーティクル専用メソッド
    acquireParticle(type = 'default', size = 'medium') {
        return this.particlePool.acquireTyped(type, size);
    }
    
    releaseParticle(particle) {
        return this.particlePool.release(particle);
    }
    
    // 汎用オブジェクト
    acquire(typeName) {
        return this.multiPool.acquire(typeName);
    }
    
    release(typeName, obj) {
        return this.multiPool.release(typeName, obj);
    }
    
    // メンテナンスクリーンアップ
    performMaintenanceCleanup() {
        // 期限切れパーティクルの削除
        const removedCount = this.particlePool.removeExpiredParticles();
        
        // 全プールの自動調整
        this.multiPool.autoAdjustAllPools();
        this.particlePool.autoAdjustSize();
        
        // 統計情報をログ出力（開発時のみ）
        if (process.env.NODE_ENV === 'development' && removedCount > 0) {
            console.log(`Pool cleanup: removed ${removedCount} expired particles`);
        }
    }
    
    // 全体統計情報
    getGlobalStats() {
        return {
            multiPool: this.multiPool.getAllStats(),
            particlePool: this.particlePool.getStats(),
            timestamp: Date.now()
        };
    }
    
    // 破棄
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.particlePool.clear();
        this.multiPool.cleanup();
    }
}

// シングルトンインスタンス
export const globalPoolManager = new GlobalPoolManager();