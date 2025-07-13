// performance-monitor.js - 包括的パフォーマンス監視システム

export class ComprehensivePerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            historySize: options.historySize || 300, // 5秒分（60FPS）
            alertThresholds: {
                frameTime: options.frameTimeThreshold || 25, // 25ms = 40FPS
                memory: options.memoryThreshold || 100, // 100MB
                cpu: options.cpuThreshold || 80, // 80%
                ...options.alertThresholds
            },
            enabledMetrics: {
                fps: true,
                frameTime: true,
                memory: true,
                render: true,
                audio: true,
                input: true,
                network: false,
                ...options.enabledMetrics
            }
        };

        // メトリクス収集
        this.metrics = {
            frame: new FrameMetrics(this.options.historySize),
            memory: new MemoryMetrics(),
            render: new RenderMetrics(),
            audio: new AudioMetrics(),
            input: new InputMetrics(),
            system: new SystemMetrics()
        };

        // アラートシステム
        this.alertManager = new AlertManager(this.options.alertThresholds);
        
        // データエクスポート
        this.dataExporter = new PerformanceDataExporter();
        
        // 自動収集
        this.autoCollectionEnabled = options.autoCollection !== false;
        this.collectionInterval = null;
        this.collectionFrequency = options.collectionFrequency || 1000; // 1秒
        
        // 統計情報
        this.sessionStats = {
            startTime: Date.now(),
            totalFrames: 0,
            alerts: [],
            peaks: {
                maxFrameTime: 0,
                maxMemoryUsage: 0,
                minFPS: Infinity
            }
        };

        if (this.autoCollectionEnabled) {
            this.startAutoCollection();
        }
    }

    startAutoCollection() {
        this.collectionInterval = setInterval(() => {
            this.collectAllMetrics();
        }, this.collectionFrequency);
    }

    stopAutoCollection() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    }

    // フレーム記録（メインレンダリングループから呼び出し）
    recordFrame(frameTime, renderTime, currentTime) {
        this.sessionStats.totalFrames++;
        
        if (this.options.enabledMetrics.fps || this.options.enabledMetrics.frameTime) {
            this.metrics.frame.recordFrame(frameTime, currentTime);
        }
        
        if (this.options.enabledMetrics.render && renderTime !== undefined) {
            this.metrics.render.recordRenderTime(renderTime);
        }

        // ピーク値の更新
        this.updatePeaks(frameTime);
        
        // アラートチェック
        this.checkAlerts();
    }

    collectAllMetrics() {
        const timestamp = Date.now();
        
        if (this.options.enabledMetrics.memory) {
            this.metrics.memory.collect(timestamp);
        }
        
        if (this.options.enabledMetrics.audio) {
            this.metrics.audio.collect(timestamp);
        }
        
        if (this.options.enabledMetrics.input) {
            this.metrics.input.collect(timestamp);
        }
        
        this.metrics.system.collect(timestamp);
    }

    updatePeaks(frameTime) {
        const currentFPS = 1000 / frameTime;
        
        this.sessionStats.peaks.maxFrameTime = Math.max(
            this.sessionStats.peaks.maxFrameTime, 
            frameTime
        );
        
        this.sessionStats.peaks.minFPS = Math.min(
            this.sessionStats.peaks.minFPS, 
            currentFPS
        );
        
        if (this.metrics.memory.currentUsage) {
            this.sessionStats.peaks.maxMemoryUsage = Math.max(
                this.sessionStats.peaks.maxMemoryUsage,
                this.metrics.memory.currentUsage
            );
        }
    }

    checkAlerts() {
        const currentStats = this.getCurrentStats();
        const alerts = this.alertManager.checkThresholds(currentStats);
        
        alerts.forEach(alert => {
            this.sessionStats.alerts.push({
                ...alert,
                timestamp: Date.now(),
                sessionFrame: this.sessionStats.totalFrames
            });
            
            console.warn(`Performance Alert: ${alert.type} - ${alert.message}`, alert);
        });
    }

    // リアルタイム統計取得
    getCurrentStats() {
        const frameStats = this.metrics.frame.getCurrentStats();
        const memoryStats = this.metrics.memory.getCurrentStats();
        const renderStats = this.metrics.render.getCurrentStats();
        
        return {
            timestamp: Date.now(),
            frame: frameStats,
            memory: memoryStats,
            render: renderStats,
            audio: this.metrics.audio.getCurrentStats(),
            input: this.metrics.input.getCurrentStats(),
            system: this.metrics.system.getCurrentStats()
        };
    }

    // 詳細なパフォーマンスレポート生成
    generateReport(timeRange = 'session') {
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                sessionDuration: Date.now() - this.sessionStats.startTime,
                totalFrames: this.sessionStats.totalFrames,
                timeRange: timeRange
            },
            summary: this.generateSummary(),
            metrics: this.generateMetricsReport(),
            alerts: this.getAlertsReport(),
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateSummary() {
        const frameStats = this.metrics.frame.getSummaryStats();
        const memoryStats = this.metrics.memory.getSummaryStats();
        
        return {
            averageFPS: frameStats.averageFPS,
            averageFrameTime: frameStats.averageFrameTime,
            memoryUsage: memoryStats.averageUsage,
            performanceGrade: this.calculatePerformanceGrade(),
            stability: this.calculateStability(),
            efficiency: this.calculateEfficiency()
        };
    }

    generateMetricsReport() {
        return {
            frame: this.metrics.frame.getDetailedReport(),
            memory: this.metrics.memory.getDetailedReport(),
            render: this.metrics.render.getDetailedReport(),
            audio: this.metrics.audio.getDetailedReport(),
            input: this.metrics.input.getDetailedReport(),
            system: this.metrics.system.getDetailedReport()
        };
    }

    getAlertsReport() {
        const alertsByType = {};
        
        this.sessionStats.alerts.forEach(alert => {
            if (!alertsByType[alert.type]) {
                alertsByType[alert.type] = [];
            }
            alertsByType[alert.type].push(alert);
        });

        return {
            total: this.sessionStats.alerts.length,
            byType: alertsByType,
            recent: this.sessionStats.alerts.slice(-10), // 最新10件
            severity: this.calculateAlertSeverity()
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();
        
        if (summary.averageFPS < 45) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'フレームレートが低下しています。品質設定を下げることを検討してください。',
                actions: ['qualityReduction', 'particleCountReduction', 'effectDisable']
            });
        }
        
        if (summary.memoryUsage > 80) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                message: 'メモリ使用量が高くなっています。',
                actions: ['garbageCollection', 'assetOptimization', 'cacheCleanup']
            });
        }
        
        if (summary.stability < 0.7) {
            recommendations.push({
                type: 'stability',
                priority: 'medium',
                message: 'パフォーマンスが不安定です。',
                actions: ['vsyncEnable', 'frameRateLimit', 'taskOptimization']
            });
        }

        return recommendations;
    }

    calculatePerformanceGrade() {
        const frameStats = this.metrics.frame.getCurrentStats();
        const fps = frameStats.averageFPS || 60;
        const stability = this.calculateStability();
        
        const score = (fps / 60) * 0.7 + stability * 0.3;
        
        if (score >= 0.9) return 'A';
        if (score >= 0.8) return 'B';
        if (score >= 0.7) return 'C';
        if (score >= 0.6) return 'D';
        return 'F';
    }

    calculateStability() {
        const frameStats = this.metrics.frame.getCurrentStats();
        return frameStats.stability || 1.0;
    }

    calculateEfficiency() {
        const renderStats = this.metrics.render.getCurrentStats();
        const frameStats = this.metrics.frame.getCurrentStats();
        
        if (!renderStats.averageRenderTime || !frameStats.averageFrameTime) {
            return 1.0;
        }
        
        return Math.min(1.0, renderStats.averageRenderTime / frameStats.averageFrameTime);
    }

    calculateAlertSeverity() {
        const recentAlerts = this.sessionStats.alerts.slice(-50); // 最新50件
        const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
        
        const totalSeverity = recentAlerts.reduce((sum, alert) => {
            return sum + (severityMap[alert.severity] || 1);
        }, 0);
        
        const averageSeverity = totalSeverity / Math.max(1, recentAlerts.length);
        
        if (averageSeverity >= 3) return 'critical';
        if (averageSeverity >= 2.5) return 'high';
        if (averageSeverity >= 1.5) return 'medium';
        return 'low';
    }

    // データエクスポート
    exportData(format = 'json', options = {}) {
        const report = this.generateReport();
        return this.dataExporter.export(report, format, options);
    }

    // パフォーマンステスト実行
    async runPerformanceTest(duration = 10000) {
        const testResults = {
            startTime: Date.now(),
            duration: duration,
            samples: []
        };

        console.log(`Starting ${duration/1000}s performance test...`);
        
        const interval = setInterval(() => {
            testResults.samples.push(this.getCurrentStats());
        }, 100); // 100ms間隔

        return new Promise(resolve => {
            setTimeout(() => {
                clearInterval(interval);
                testResults.endTime = Date.now();
                testResults.summary = this.analyzeTestResults(testResults);
                
                console.log('Performance test completed:', testResults.summary);
                resolve(testResults);
            }, duration);
        });
    }

    analyzeTestResults(testResults) {
        const frameData = testResults.samples.map(s => s.frame);
        const memoryData = testResults.samples.map(s => s.memory);
        
        return {
            averageFPS: this.calculateAverage(frameData.map(f => f.averageFPS)),
            fpsStability: this.calculateStandardDeviation(frameData.map(f => f.averageFPS)),
            memoryGrowth: this.calculateMemoryGrowth(memoryData),
            performanceScore: this.calculateTestScore(frameData, memoryData)
        };
    }

    calculateAverage(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    calculateStandardDeviation(values) {
        const avg = this.calculateAverage(values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    calculateMemoryGrowth(memoryData) {
        if (memoryData.length < 2) return 0;
        
        const first = memoryData[0].currentUsage || 0;
        const last = memoryData[memoryData.length - 1].currentUsage || 0;
        
        return last - first;
    }

    calculateTestScore(frameData, memoryData) {
        const avgFPS = this.calculateAverage(frameData.map(f => f.averageFPS));
        const fpsStability = 1 / (1 + this.calculateStandardDeviation(frameData.map(f => f.averageFPS)) / 10);
        const memoryEfficiency = Math.max(0, 1 - (this.calculateMemoryGrowth(memoryData) / 50));
        
        return (avgFPS / 60) * 0.5 + fpsStability * 0.3 + memoryEfficiency * 0.2;
    }

    // 設定変更
    updateConfiguration(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        if (newOptions.alertThresholds) {
            this.alertManager.updateThresholds(newOptions.alertThresholds);
        }
        
        if (newOptions.autoCollection !== undefined) {
            if (newOptions.autoCollection && !this.collectionInterval) {
                this.startAutoCollection();
            } else if (!newOptions.autoCollection && this.collectionInterval) {
                this.stopAutoCollection();
            }
        }
    }

    // リセット
    reset() {
        this.sessionStats = {
            startTime: Date.now(),
            totalFrames: 0,
            alerts: [],
            peaks: {
                maxFrameTime: 0,
                maxMemoryUsage: 0,
                minFPS: Infinity
            }
        };

        Object.values(this.metrics).forEach(metric => {
            if (metric.reset) metric.reset();
        });

        this.alertManager.reset();
    }

    // 破棄
    destroy() {
        this.stopAutoCollection();
        
        Object.values(this.metrics).forEach(metric => {
            if (metric.destroy) metric.destroy();
        });
    }
}

// フレームメトリクス
class FrameMetrics {
    constructor(historySize = 300) {
        this.historySize = historySize;
        this.frameTimes = [];
        this.timestamps = [];
        this.frameCount = 0;
    }

    recordFrame(frameTime, timestamp) {
        this.frameTimes.push(frameTime);
        this.timestamps.push(timestamp);
        this.frameCount++;

        if (this.frameTimes.length > this.historySize) {
            this.frameTimes.shift();
            this.timestamps.shift();
        }
    }

    getCurrentStats() {
        if (this.frameTimes.length === 0) {
            return { averageFPS: 60, averageFrameTime: 16.67, stability: 1.0 };
        }

        const recent = this.frameTimes.slice(-60); // 最新60フレーム
        const average = recent.reduce((a, b) => a + b) / recent.length;
        const fps = 1000 / average;
        
        // 安定性計算（変動係数の逆数）
        const variance = recent.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / recent.length;
        const stability = Math.max(0, 1 - (Math.sqrt(variance) / average));

        return {
            averageFPS: fps,
            averageFrameTime: average,
            stability: stability,
            sampleCount: recent.length
        };
    }

    getSummaryStats() {
        if (this.frameTimes.length === 0) {
            return { averageFPS: 60, averageFrameTime: 16.67 };
        }

        const average = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
        return {
            averageFPS: 1000 / average,
            averageFrameTime: average,
            totalFrames: this.frameCount,
            minFrameTime: Math.min(...this.frameTimes),
            maxFrameTime: Math.max(...this.frameTimes)
        };
    }

    getDetailedReport() {
        return {
            summary: this.getSummaryStats(),
            current: this.getCurrentStats(),
            histogram: this.generateFrameTimeHistogram(),
            trends: this.analyzeTrends()
        };
    }

    generateFrameTimeHistogram() {
        const buckets = { '0-16': 0, '16-20': 0, '20-33': 0, '33-50': 0, '50+': 0 };
        
        this.frameTimes.forEach(time => {
            if (time <= 16) buckets['0-16']++;
            else if (time <= 20) buckets['16-20']++;
            else if (time <= 33) buckets['20-33']++;
            else if (time <= 50) buckets['33-50']++;
            else buckets['50+']++;
        });

        return buckets;
    }

    analyzeTrends() {
        if (this.frameTimes.length < 60) return null;

        const firstHalf = this.frameTimes.slice(0, Math.floor(this.frameTimes.length / 2));
        const secondHalf = this.frameTimes.slice(Math.floor(this.frameTimes.length / 2));

        const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

        return {
            trend: secondAvg > firstAvg ? 'deteriorating' : 'improving',
            change: Math.abs(secondAvg - firstAvg),
            changePercent: Math.abs((secondAvg - firstAvg) / firstAvg) * 100
        };
    }

    reset() {
        this.frameTimes = [];
        this.timestamps = [];
        this.frameCount = 0;
    }
}

// メモリメトリクス
class MemoryMetrics {
    constructor() {
        this.samples = [];
        this.currentUsage = 0;
        this.peakUsage = 0;
        this.gcEvents = [];
    }

    collect(timestamp) {
        if (performance.memory) {
            const usage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            const total = performance.memory.totalJSHeapSize / 1024 / 1024;
            const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;

            // GC検出
            if (this.currentUsage > 0 && usage < this.currentUsage * 0.9) {
                this.gcEvents.push({
                    timestamp: timestamp,
                    before: this.currentUsage,
                    after: usage,
                    collected: this.currentUsage - usage
                });
            }

            this.currentUsage = usage;
            this.peakUsage = Math.max(this.peakUsage, usage);

            this.samples.push({
                timestamp: timestamp,
                used: usage,
                total: total,
                limit: limit
            });

            if (this.samples.length > 300) {
                this.samples.shift();
            }
        }
    }

    getCurrentStats() {
        return {
            currentUsage: this.currentUsage,
            peakUsage: this.peakUsage,
            availableMemory: performance.memory ? 
                (performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize) / 1024 / 1024 : null,
            recentGCCount: this.gcEvents.filter(gc => Date.now() - gc.timestamp < 60000).length
        };
    }

    getSummaryStats() {
        if (this.samples.length === 0) {
            return { averageUsage: 0, peakUsage: 0 };
        }

        const averageUsage = this.samples.reduce((sum, sample) => sum + sample.used, 0) / this.samples.length;
        
        return {
            averageUsage: averageUsage,
            peakUsage: this.peakUsage,
            totalGCEvents: this.gcEvents.length
        };
    }

    getDetailedReport() {
        return {
            summary: this.getSummaryStats(),
            current: this.getCurrentStats(),
            gcHistory: this.gcEvents.slice(-10), // 最新10回のGC
            memoryTrend: this.analyzeMemoryTrend()
        };
    }

    analyzeMemoryTrend() {
        if (this.samples.length < 10) return null;

        const recent = this.samples.slice(-10);
        const slope = this.calculateLinearTrend(recent.map(s => s.used));

        return {
            trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
            rate: slope, // MB/sample
            projection: this.currentUsage + slope * 60 // 60サンプル先の予測
        };
    }

    calculateLinearTrend(values) {
        const n = values.length;
        const x = values.map((_, i) => i);
        const y = values;

        const sumX = x.reduce((a, b) => a + b);
        const sumY = y.reduce((a, b) => a + b);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    reset() {
        this.samples = [];
        this.gcEvents = [];
        this.peakUsage = 0;
    }
}

// レンダリングメトリクス
class RenderMetrics {
    constructor() {
        this.renderTimes = [];
        this.drawCalls = [];
        this.particleCounts = [];
    }

    recordRenderTime(renderTime) {
        this.renderTimes.push(renderTime);
        if (this.renderTimes.length > 300) {
            this.renderTimes.shift();
        }
    }

    recordDrawCalls(count) {
        this.drawCalls.push(count);
        if (this.drawCalls.length > 300) {
            this.drawCalls.shift();
        }
    }

    recordParticleCount(count) {
        this.particleCounts.push(count);
        if (this.particleCounts.length > 300) {
            this.particleCounts.shift();
        }
    }

    getCurrentStats() {
        return {
            averageRenderTime: this.calculateAverage(this.renderTimes),
            averageDrawCalls: this.calculateAverage(this.drawCalls),
            averageParticleCount: this.calculateAverage(this.particleCounts)
        };
    }

    getSummaryStats() {
        return this.getCurrentStats();
    }

    getDetailedReport() {
        return {
            summary: this.getSummaryStats(),
            renderTimeDistribution: this.analyzeRenderTimeDistribution(),
            efficiency: this.calculateRenderingEfficiency()
        };
    }

    analyzeRenderTimeDistribution() {
        if (this.renderTimes.length === 0) return null;

        const sorted = [...this.renderTimes].sort((a, b) => a - b);
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)]
        };
    }

    calculateRenderingEfficiency() {
        if (this.renderTimes.length === 0 || this.particleCounts.length === 0) return null;

        const avgRenderTime = this.calculateAverage(this.renderTimes);
        const avgParticleCount = this.calculateAverage(this.particleCounts);

        return {
            timePerParticle: avgParticleCount > 0 ? avgRenderTime / avgParticleCount : 0,
            particlesPerMs: avgRenderTime > 0 ? avgParticleCount / avgRenderTime : 0
        };
    }

    calculateAverage(array) {
        return array.length > 0 ? array.reduce((a, b) => a + b) / array.length : 0;
    }

    reset() {
        this.renderTimes = [];
        this.drawCalls = [];
        this.particleCounts = [];
    }
}

// その他のメトリクスクラス（簡略版）
class AudioMetrics {
    constructor() {
        this.audioLatency = [];
        this.activeSources = 0;
    }

    collect(timestamp) {
        // 音響システムからメトリクス収集
    }

    getCurrentStats() {
        return {
            activeSources: this.activeSources,
            averageLatency: this.calculateAverage(this.audioLatency)
        };
    }

    getSummaryStats() { return this.getCurrentStats(); }
    getDetailedReport() { return { summary: this.getSummaryStats() }; }
    calculateAverage(array) { return array.length > 0 ? array.reduce((a, b) => a + b) / array.length : 0; }
    reset() { this.audioLatency = []; this.activeSources = 0; }
}

class InputMetrics {
    constructor() {
        this.inputLatency = [];
        this.eventCounts = { mouse: 0, keyboard: 0, touch: 0 };
    }

    collect(timestamp) {
        // 入力システムからメトリクス収集
    }

    getCurrentStats() {
        return {
            averageLatency: this.calculateAverage(this.inputLatency),
            eventCounts: { ...this.eventCounts }
        };
    }

    getSummaryStats() { return this.getCurrentStats(); }
    getDetailedReport() { return { summary: this.getSummaryStats() }; }
    calculateAverage(array) { return array.length > 0 ? array.reduce((a, b) => a + b) / array.length : 0; }
    reset() { this.inputLatency = []; this.eventCounts = { mouse: 0, keyboard: 0, touch: 0 }; }
}

class SystemMetrics {
    constructor() {
        this.cpuUsage = 0;
        this.batteryLevel = null;
        this.connectionType = 'unknown';
    }

    collect(timestamp) {
        // システム情報収集
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                this.batteryLevel = battery.level;
            });
        }

        if (navigator.connection) {
            this.connectionType = navigator.connection.effectiveType;
        }
    }

    getCurrentStats() {
        return {
            cpuUsage: this.cpuUsage,
            batteryLevel: this.batteryLevel,
            connectionType: this.connectionType,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        };
    }

    getSummaryStats() { return this.getCurrentStats(); }
    getDetailedReport() { return { summary: this.getSummaryStats() }; }
    reset() { this.cpuUsage = 0; }
}

// アラート管理
class AlertManager {
    constructor(thresholds) {
        this.thresholds = thresholds;
        this.recentAlerts = [];
        this.alertCooldowns = new Map();
        this.cooldownDuration = 5000; // 5秒
    }

    checkThresholds(stats) {
        const alerts = [];
        const now = Date.now();

        // フレーム時間チェック
        if (stats.frame.averageFrameTime > this.thresholds.frameTime) {
            const alertKey = 'frameTime';
            if (!this.isInCooldown(alertKey)) {
                alerts.push({
                    type: 'frameTime',
                    severity: stats.frame.averageFrameTime > this.thresholds.frameTime * 2 ? 'critical' : 'high',
                    message: `Frame time is ${stats.frame.averageFrameTime.toFixed(2)}ms (threshold: ${this.thresholds.frameTime}ms)`,
                    value: stats.frame.averageFrameTime,
                    threshold: this.thresholds.frameTime
                });
                this.alertCooldowns.set(alertKey, now);
            }
        }

        // メモリ使用量チェック
        if (stats.memory.currentUsage > this.thresholds.memory) {
            const alertKey = 'memory';
            if (!this.isInCooldown(alertKey)) {
                alerts.push({
                    type: 'memory',
                    severity: stats.memory.currentUsage > this.thresholds.memory * 1.5 ? 'critical' : 'medium',
                    message: `Memory usage is ${stats.memory.currentUsage.toFixed(1)}MB (threshold: ${this.thresholds.memory}MB)`,
                    value: stats.memory.currentUsage,
                    threshold: this.thresholds.memory
                });
                this.alertCooldowns.set(alertKey, now);
            }
        }

        return alerts;
    }

    isInCooldown(alertKey) {
        const lastAlert = this.alertCooldowns.get(alertKey);
        return lastAlert && (Date.now() - lastAlert) < this.cooldownDuration;
    }

    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }

    reset() {
        this.recentAlerts = [];
        this.alertCooldowns.clear();
    }
}

// データエクスポート
class PerformanceDataExporter {
    export(data, format = 'json', options = {}) {
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'summary':
                return this.generateTextSummary(data);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    convertToCSV(data) {
        // CSV変換の実装（簡略版）
        const lines = [];
        lines.push('Metric,Value,Unit');
        lines.push(`Average FPS,${data.summary.averageFPS},fps`);
        lines.push(`Average Frame Time,${data.summary.averageFrameTime},ms`);
        lines.push(`Memory Usage,${data.summary.memoryUsage},MB`);
        lines.push(`Performance Grade,${data.summary.performanceGrade},grade`);
        
        return lines.join('\n');
    }

    generateTextSummary(data) {
        return `
Performance Report Summary
Generated: ${data.metadata.generatedAt}
Session Duration: ${(data.metadata.sessionDuration / 1000).toFixed(1)}s
Total Frames: ${data.metadata.totalFrames}

Performance Metrics:
- Average FPS: ${data.summary.averageFPS.toFixed(1)}
- Average Frame Time: ${data.summary.averageFrameTime.toFixed(2)}ms
- Memory Usage: ${data.summary.memoryUsage.toFixed(1)}MB
- Performance Grade: ${data.summary.performanceGrade}
- Stability: ${(data.summary.stability * 100).toFixed(1)}%

Total Alerts: ${data.alerts.total}
Recommendations: ${data.recommendations.length}
        `.trim();
    }
}

// グローバルパフォーマンスモニター
export const globalPerformanceMonitor = new ComprehensivePerformanceMonitor({
    autoCollection: true,
    enabledMetrics: {
        fps: true,
        frameTime: true,
        memory: true,
        render: true,
        audio: true,
        input: true
    },
    alertThresholds: {
        frameTime: 25,
        memory: 100,
        cpu: 80
    }
});