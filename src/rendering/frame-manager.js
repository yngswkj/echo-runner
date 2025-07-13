// frame-manager.js - 高度なフレーム管理と最適化システム

export class FrameManager {
    constructor(options = {}) {
        // 基本設定
        this.targetFPS = options.targetFPS || 60;
        this.minFPS = options.minFPS || 30;
        this.maxFPS = options.maxFPS || 120;
        this.adaptiveFPS = options.adaptiveFPS !== false;
        
        // フレームタイミング
        this.frameInterval = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.deltaTime = 0;
        this.accumulator = 0;
        
        // パフォーマンス監視
        this.performanceMonitor = new PerformanceMonitor();
        this.performanceHistory = [];
        this.maxHistorySize = 300; // 5秒分（60FPS）
        
        // フレームスキップ機能
        this.frameSkipEnabled = options.frameSkip !== false;
        this.maxFrameSkip = options.maxFrameSkip || 2;
        this.currentSkipCount = 0;
        
        // 動的品質調整
        this.qualityManager = new DynamicQualityManager();
        
        // フレーム分割実行
        this.taskScheduler = new FrameTaskScheduler();
        
        // VSync検出
        this.vsyncDetector = new VSyncDetector();
        
        // 統計情報
        this.stats = {
            framesRendered: 0,
            framesSkipped: 0,
            averageFPS: 60,
            averageFrameTime: 16.67,
            minFrameTime: 16.67,
            maxFrameTime: 16.67,
            qualityLevel: 1.0,
            lastUpdateTime: Date.now()
        };
        
        this.initialize();
    }
    
    initialize() {
        this.vsyncDetector.detect().then(vsyncRate => {
            console.log(`Detected display refresh rate: ${vsyncRate}Hz`);
            if (this.adaptiveFPS) {
                this.adjustToDisplayRate(vsyncRate);
            }
        });
    }
    
    adjustToDisplayRate(displayHz) {
        // ディスプレイのリフレッシュレートに合わせて調整
        if (displayHz >= 120 && this.maxFPS >= 120) {
            this.targetFPS = 120;
        } else if (displayHz >= 90 && this.maxFPS >= 90) {
            this.targetFPS = 90;
        } else if (displayHz >= 75 && this.maxFPS >= 75) {
            this.targetFPS = 75;
        } else {
            this.targetFPS = 60;
        }
        
        this.frameInterval = 1000 / this.targetFPS;
        console.log(`Frame rate adjusted to ${this.targetFPS}FPS`);
    }
    
    // メインのフレーム制御ループ
    requestFrame(callback) {
        return requestAnimationFrame((currentTime) => {
            this.processFrame(currentTime, callback);
        });
    }
    
    processFrame(currentTime, callback) {
        // デルタタイム計算
        this.deltaTime = currentTime - this.lastFrameTime;
        
        // フレームレート制御
        if (this.shouldRenderFrame(currentTime)) {
            const frameStart = performance.now();
            
            try {
                // タスクスケジューラーの実行
                this.taskScheduler.executeFrameTasks(this.deltaTime);
                
                // メインレンダリングコールバック
                const renderResult = callback(currentTime, this.deltaTime);
                
                // フレーム完了処理
                this.completeFrame(frameStart, currentTime, renderResult);
                
            } catch (error) {
                console.error('Frame processing error:', error);
                this.handleFrameError(error);
            }
            
        } else {
            // フレームスキップ
            this.handleFrameSkip();
        }
        
        // 次のフレームをリクエスト
        this.requestFrame(callback);
    }
    
    shouldRenderFrame(currentTime) {
        const timeSinceLastFrame = currentTime - this.lastFrameTime;
        
        // 基本的なフレームレート制御
        if (timeSinceLastFrame < this.frameInterval) {
            return false;
        }
        
        // パフォーマンスベースの動的制御
        if (this.adaptiveFPS) {
            const performance = this.performanceMonitor.getCurrentPerformance();
            
            if (performance.frameTime > (this.frameInterval * 1.5)) {
                // フレーム時間が長すぎる場合はスキップを検討
                if (this.frameSkipEnabled && this.currentSkipCount < this.maxFrameSkip) {
                    this.currentSkipCount++;
                    return false;
                }
            }
        }
        
        this.currentSkipCount = 0;
        return true;
    }
    
    completeFrame(frameStart, currentTime, renderResult) {
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        
        // パフォーマンス記録
        this.performanceMonitor.recordFrame(frameTime, currentTime);
        this.addToHistory(frameTime);
        
        // 統計更新
        this.updateStats(frameTime, currentTime);
        
        // 品質レベル調整
        this.qualityManager.updateQuality(frameTime, this.frameInterval);
        
        // フレーム完了
        this.lastFrameTime = currentTime;
        this.frameCount++;
        this.stats.framesRendered++;
        
        // 定期的な最適化実行
        if (this.frameCount % 60 === 0) {
            this.performOptimization();
        }
    }
    
    handleFrameSkip() {
        this.stats.framesSkipped++;
        
        // 軽量な更新処理のみ実行
        this.taskScheduler.executeLightweightTasks();
    }
    
    handleFrameError(error) {
        console.error('Frame error, attempting recovery:', error);
        
        // エラー回復処理
        this.qualityManager.emergencyQualityReduction();
        this.taskScheduler.clearErrorTasks();
    }
    
    addToHistory(frameTime) {
        this.performanceHistory.push(frameTime);
        if (this.performanceHistory.length > this.maxHistorySize) {
            this.performanceHistory.shift();
        }
    }
    
    updateStats(frameTime, currentTime) {
        // FPS計算
        const currentFPS = 1000 / this.deltaTime;
        this.stats.averageFPS = this.calculateMovingAverage('fps', currentFPS);
        
        // フレーム時間統計
        this.stats.averageFrameTime = this.calculateMovingAverage('frameTime', frameTime);
        this.stats.minFrameTime = Math.min(this.stats.minFrameTime, frameTime);
        this.stats.maxFrameTime = Math.max(this.stats.maxFrameTime, frameTime);
        
        // 品質レベル
        this.stats.qualityLevel = this.qualityManager.getCurrentQuality();
        this.stats.lastUpdateTime = currentTime;
    }
    
    calculateMovingAverage(type, newValue) {
        const historyKey = `${type}History`;
        if (!this[historyKey]) {
            this[historyKey] = [];
        }
        
        this[historyKey].push(newValue);
        if (this[historyKey].length > 60) { // 60フレーム平均
            this[historyKey].shift();
        }
        
        return this[historyKey].reduce((a, b) => a + b) / this[historyKey].length;
    }
    
    performOptimization() {
        if (!this.adaptiveFPS) return;
        
        const avgFrameTime = this.stats.averageFrameTime;
        const targetFrameTime = this.frameInterval;
        
        // フレームレート調整
        if (avgFrameTime > targetFrameTime * 1.3) {
            // パフォーマンスが悪い場合
            this.reduceFrameRate();
        } else if (avgFrameTime < targetFrameTime * 0.7) {
            // パフォーマンスに余裕がある場合
            this.increaseFrameRate();
        }
        
        // 品質調整
        this.qualityManager.performOptimization();
        
        // タスクスケジューラー最適化
        this.taskScheduler.optimize();
    }
    
    reduceFrameRate() {
        const newFPS = Math.max(this.minFPS, this.targetFPS - 5);
        if (newFPS !== this.targetFPS) {
            this.targetFPS = newFPS;
            this.frameInterval = 1000 / this.targetFPS;
            console.log(`Frame rate reduced to ${this.targetFPS}FPS`);
        }
    }
    
    increaseFrameRate() {
        const newFPS = Math.min(this.maxFPS, this.targetFPS + 5);
        if (newFPS !== this.targetFPS) {
            this.targetFPS = newFPS;
            this.frameInterval = 1000 / this.targetFPS;
            console.log(`Frame rate increased to ${this.targetFPS}FPS`);
        }
    }
    
    // タスクスケジューリング
    scheduleTask(task, priority = 'normal') {
        this.taskScheduler.addTask(task, priority);
    }
    
    // フレーム時間予算管理
    getFrameBudget() {
        return {
            totalBudget: this.frameInterval,
            remaining: Math.max(0, this.frameInterval - this.stats.averageFrameTime),
            qualityLevel: this.stats.qualityLevel,
            canSkipFrame: this.frameSkipEnabled && this.currentSkipCount < this.maxFrameSkip
        };
    }
    
    // 統計情報の取得
    getStats() {
        return {
            ...this.stats,
            performance: this.performanceMonitor.getDetailedStats(),
            quality: this.qualityManager.getQualityStats(),
            scheduler: this.taskScheduler.getStats()
        };
    }
    
    // 設定の動的変更
    updateSettings(newSettings) {
        if (newSettings.targetFPS !== undefined) {
            this.targetFPS = Math.max(this.minFPS, Math.min(this.maxFPS, newSettings.targetFPS));
            this.frameInterval = 1000 / this.targetFPS;
        }
        
        if (newSettings.adaptiveFPS !== undefined) {
            this.adaptiveFPS = newSettings.adaptiveFPS;
        }
        
        if (newSettings.frameSkip !== undefined) {
            this.frameSkipEnabled = newSettings.frameSkip;
        }
        
        if (newSettings.maxFrameSkip !== undefined) {
            this.maxFrameSkip = newSettings.maxFrameSkip;
        }
    }
    
    // リセット機能
    reset() {
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.currentSkipCount = 0;
        this.performanceHistory = [];
        
        this.stats = {
            framesRendered: 0,
            framesSkipped: 0,
            averageFPS: this.targetFPS,
            averageFrameTime: this.frameInterval,
            minFrameTime: this.frameInterval,
            maxFrameTime: this.frameInterval,
            qualityLevel: 1.0,
            lastUpdateTime: Date.now()
        };
        
        this.performanceMonitor.reset();
        this.qualityManager.reset();
        this.taskScheduler.reset();
    }
}

// パフォーマンス監視クラス
class PerformanceMonitor {
    constructor(sampleSize = 120) { // 2秒分（60FPS）
        this.sampleSize = sampleSize;
        this.frameTimes = [];
        this.timestamps = [];
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.lastGCTime = 0;
    }
    
    recordFrame(frameTime, timestamp) {
        this.frameTimes.push(frameTime);
        this.timestamps.push(timestamp);
        
        if (this.frameTimes.length > this.sampleSize) {
            this.frameTimes.shift();
            this.timestamps.shift();
        }
        
        // メモリ使用量の監視（利用可能な場合）
        if (performance.memory) {
            this.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            
            // GC検出
            if (performance.memory.usedJSHeapSize < this.lastGCTime * 0.9) {
                console.log('Garbage collection detected');
            }
            this.lastGCTime = performance.memory.usedJSHeapSize;
        }
    }
    
    getCurrentPerformance() {
        if (this.frameTimes.length === 0) {
            return { frameTime: 16.67, fps: 60, stability: 1.0 };
        }
        
        const recent = this.frameTimes.slice(-10); // 最新10フレーム
        const average = recent.reduce((a, b) => a + b) / recent.length;
        const fps = 1000 / average;
        
        // フレームタイムの安定性（標準偏差）
        const variance = recent.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / recent.length;
        const stability = Math.max(0, 1 - (Math.sqrt(variance) / average));
        
        return { frameTime: average, fps, stability };
    }
    
    getDetailedStats() {
        if (this.frameTimes.length === 0) {
            return null;
        }
        
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const average = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
        
        return {
            average: average,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            fps: 1000 / average,
            memoryUsage: this.memoryUsage,
            sampleCount: this.frameTimes.length
        };
    }
    
    getPerformanceGrade() {
        const current = this.getCurrentPerformance();
        
        if (current.fps >= 55 && current.stability >= 0.8) return 'excellent';
        if (current.fps >= 45 && current.stability >= 0.6) return 'good';
        if (current.fps >= 30 && current.stability >= 0.4) return 'fair';
        return 'poor';
    }
    
    reset() {
        this.frameTimes = [];
        this.timestamps = [];
        this.memoryUsage = 0;
    }
}

// 動的品質管理クラス
class DynamicQualityManager {
    constructor() {
        this.currentQuality = 1.0;
        this.targetQuality = 1.0;
        this.qualityHistory = [];
        this.adjustmentRate = 0.05;
        this.emergencyThreshold = 50; // 50ms
        this.recoveryThreshold = 20;  // 20ms
        
        this.qualityLevels = {
            'ultra': 1.0,
            'high': 0.8,
            'medium': 0.6,
            'low': 0.4,
            'minimal': 0.2
        };
        
        this.lastAdjustmentTime = 0;
        this.adjustmentCooldown = 1000; // 1秒
    }
    
    updateQuality(frameTime, targetFrameTime) {
        const now = Date.now();
        if (now - this.lastAdjustmentTime < this.adjustmentCooldown) {
            return;
        }
        
        const performanceRatio = targetFrameTime / frameTime;
        
        if (frameTime > this.emergencyThreshold) {
            // 緊急品質削減
            this.targetQuality = Math.max(0.2, this.currentQuality - 0.2);
        } else if (frameTime > targetFrameTime * 1.5) {
            // 品質削減
            this.targetQuality = Math.max(0.2, this.currentQuality - 0.1);
        } else if (frameTime < targetFrameTime * 0.7 && this.currentQuality < 1.0) {
            // 品質向上
            this.targetQuality = Math.min(1.0, this.currentQuality + 0.1);
        }
        
        // スムーズな品質変更
        if (this.currentQuality !== this.targetQuality) {
            const diff = this.targetQuality - this.currentQuality;
            this.currentQuality += diff * this.adjustmentRate;
            this.lastAdjustmentTime = now;
        }
        
        this.qualityHistory.push(this.currentQuality);
        if (this.qualityHistory.length > 60) {
            this.qualityHistory.shift();
        }
    }
    
    emergencyQualityReduction() {
        this.currentQuality = Math.max(0.2, this.currentQuality * 0.5);
        this.targetQuality = this.currentQuality;
        console.warn('Emergency quality reduction applied');
    }
    
    getCurrentQuality() {
        return this.currentQuality;
    }
    
    getQualityLevel() {
        if (this.currentQuality >= 0.9) return 'ultra';
        if (this.currentQuality >= 0.7) return 'high';
        if (this.currentQuality >= 0.5) return 'medium';
        if (this.currentQuality >= 0.3) return 'low';
        return 'minimal';
    }
    
    getQualityStats() {
        const avgQuality = this.qualityHistory.length > 0 
            ? this.qualityHistory.reduce((a, b) => a + b) / this.qualityHistory.length 
            : this.currentQuality;
            
        return {
            current: this.currentQuality,
            target: this.targetQuality,
            level: this.getQualityLevel(),
            average: avgQuality,
            adjustmentRate: this.adjustmentRate
        };
    }
    
    performOptimization() {
        // 品質調整の最適化ロジック
        const avgQuality = this.qualityHistory.length > 0 
            ? this.qualityHistory.reduce((a, b) => a + b) / this.qualityHistory.length 
            : this.currentQuality;
            
        if (avgQuality < 0.5) {
            // 長期間低品質の場合は調整レートを下げる
            this.adjustmentRate = Math.max(0.02, this.adjustmentRate * 0.9);
        } else if (avgQuality > 0.8) {
            // 高品質を維持できている場合は調整レートを上げる
            this.adjustmentRate = Math.min(0.1, this.adjustmentRate * 1.1);
        }
    }
    
    reset() {
        this.currentQuality = 1.0;
        this.targetQuality = 1.0;
        this.qualityHistory = [];
        this.adjustmentRate = 0.05;
        this.lastAdjustmentTime = 0;
    }
}

// フレームタスクスケジューラー
class FrameTaskScheduler {
    constructor() {
        this.taskQueues = {
            critical: [],
            normal: [],
            low: [],
            background: []
        };
        
        this.maxExecutionTime = 5; // フレームあたり5msまで
        this.executionBudget = this.maxExecutionTime;
        
        this.stats = {
            tasksExecuted: 0,
            tasksSkipped: 0,
            totalExecutionTime: 0
        };
    }
    
    addTask(task, priority = 'normal') {
        if (!this.taskQueues[priority]) {
            console.warn(`Unknown priority: ${priority}, using normal`);
            priority = 'normal';
        }
        
        this.taskQueues[priority].push({
            id: Date.now() + Math.random(),
            task: task,
            priority: priority,
            addedTime: performance.now()
        });
    }
    
    executeFrameTasks(deltaTime) {
        const startTime = performance.now();
        this.executionBudget = this.maxExecutionTime;
        
        // 優先度順にタスクを実行
        const priorities = ['critical', 'normal', 'low', 'background'];
        
        for (const priority of priorities) {
            if (this.executionBudget <= 0) break;
            
            this.executeTasksInQueue(priority);
        }
        
        const totalTime = performance.now() - startTime;
        this.stats.totalExecutionTime += totalTime;
    }
    
    executeTasksInQueue(priority) {
        const queue = this.taskQueues[priority];
        
        while (queue.length > 0 && this.executionBudget > 0) {
            const taskItem = queue.shift();
            const taskStart = performance.now();
            
            try {
                taskItem.task();
                this.stats.tasksExecuted++;
            } catch (error) {
                console.error(`Task execution error (${priority}):`, error);
            }
            
            const taskTime = performance.now() - taskStart;
            this.executionBudget -= taskTime;
        }
    }
    
    executeLightweightTasks() {
        // フレームスキップ時に実行する軽量タスク
        const lightweightBudget = 1; // 1msまで
        let budget = lightweightBudget;
        
        const queue = this.taskQueues.critical;
        
        while (queue.length > 0 && budget > 0) {
            const taskItem = queue.shift();
            const taskStart = performance.now();
            
            try {
                taskItem.task();
            } catch (error) {
                console.error('Lightweight task error:', error);
            }
            
            budget -= (performance.now() - taskStart);
        }
    }
    
    clearErrorTasks() {
        // エラー時にタスクキューをクリア
        Object.keys(this.taskQueues).forEach(priority => {
            this.taskQueues[priority] = [];
        });
    }
    
    optimize() {
        // 古いタスクの削除
        const maxAge = 5000; // 5秒
        const now = performance.now();
        
        Object.keys(this.taskQueues).forEach(priority => {
            this.taskQueues[priority] = this.taskQueues[priority].filter(
                taskItem => now - taskItem.addedTime < maxAge
            );
        });
        
        // 実行時間予算の調整
        const efficiency = this.stats.tasksExecuted / (this.stats.tasksExecuted + this.stats.tasksSkipped);
        
        if (efficiency < 0.8) {
            this.maxExecutionTime = Math.max(2, this.maxExecutionTime - 0.5);
        } else if (efficiency > 0.95) {
            this.maxExecutionTime = Math.min(10, this.maxExecutionTime + 0.5);
        }
    }
    
    getStats() {
        const totalTasks = Object.values(this.taskQueues).reduce((sum, queue) => sum + queue.length, 0);
        
        return {
            ...this.stats,
            pendingTasks: totalTasks,
            executionBudget: this.maxExecutionTime,
            queueLengths: Object.fromEntries(
                Object.entries(this.taskQueues).map(([priority, queue]) => [priority, queue.length])
            )
        };
    }
    
    reset() {
        Object.keys(this.taskQueues).forEach(priority => {
            this.taskQueues[priority] = [];
        });
        
        this.stats = {
            tasksExecuted: 0,
            tasksSkipped: 0,
            totalExecutionTime: 0
        };
        
        this.maxExecutionTime = 5;
    }
}

// VSync検出クラス
class VSyncDetector {
    constructor() {
        this.samples = [];
        this.sampleCount = 60;
        this.detecting = false;
    }
    
    async detect() {
        if (this.detecting) {
            return 60; // デフォルト値
        }
        
        this.detecting = true;
        this.samples = [];
        
        return new Promise((resolve) => {
            let lastTime = performance.now();
            let count = 0;
            
            const measureFrame = (currentTime) => {
                const delta = currentTime - lastTime;
                if (delta > 0) {
                    this.samples.push(delta);
                }
                lastTime = currentTime;
                count++;
                
                if (count < this.sampleCount) {
                    requestAnimationFrame(measureFrame);
                } else {
                    const rate = this.calculateRefreshRate();
                    this.detecting = false;
                    resolve(rate);
                }
            };
            
            requestAnimationFrame(measureFrame);
        });
    }
    
    calculateRefreshRate() {
        if (this.samples.length === 0) return 60;
        
        // 外れ値を除去
        const sorted = this.samples.sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        
        const filtered = sorted.filter(sample => sample >= lower && sample <= upper);
        
        // 平均フレーム間隔を計算
        const avgInterval = filtered.reduce((sum, delta) => sum + delta, 0) / filtered.length;
        const refreshRate = Math.round(1000 / avgInterval);
        
        // 一般的なリフレッシュレートに丸める
        const commonRates = [30, 60, 75, 90, 120, 144, 165, 240];
        const closest = commonRates.reduce((prev, curr) => 
            Math.abs(curr - refreshRate) < Math.abs(prev - refreshRate) ? curr : prev
        );
        
        return closest;
    }
}

// グローバルフレームマネージャーインスタンス
export const globalFrameManager = new FrameManager({
    targetFPS: 60,
    adaptiveFPS: true,
    frameSkip: true,
    maxFrameSkip: 2
});