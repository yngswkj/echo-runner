// stats-manager.js - 統計管理システム

import { GAME_CONFIG } from '../core/constants.js';
import { TimeUtils, DOMUtils } from '../core/utils.js';

export class StatsManager {
    constructor() {
        this.defaultStats = {
            totalPlayTime: 0,
            totalGames: 0,
            totalClears: 0,
            bestScore: 0,
            bestTime: 0,
            bestEchoCount: 0,
            totalScore: 0,
            achievements: {
                firstClear: false,
                speedRunner: false,
                echoMaster: false,
                streakRunner: false
            },
            currentStreak: 0,
            lastPlayDate: null
        };

        this.achievements = {
            firstClear: {
                name: '初回クリア',
                description: 'ゲームを初めてクリアする',
                check: (stats, gameData) => stats.totalClears === 1
            },
            speedRunner: {
                name: 'スピードランナー',
                description: '60秒以内でクリアする',
                check: (stats, gameData) => gameData.elapsedTime <= 60000
            },
            echoMaster: {
                name: 'エコーマスター',
                description: '10回以内のエコーでクリアする',
                check: (stats, gameData) => gameData.echoCount <= 10
            },
            streakRunner: {
                name: '連続クリア',
                description: '3回連続でクリアする',
                check: (stats, gameData) => stats.currentStreak >= 3
            }
        };

        this.initializeEventListeners();
    }

    // 統計データの読み込み
    loadStats() {
        try {
            const saved = localStorage.getItem('echoRunner_stats');
            if (saved) {
                const stats = JSON.parse(saved);
                // 新しいフィールドがある場合はマージ
                return { ...this.defaultStats, ...stats };
            }
        } catch (error) {
            console.error('統計データの読み込みエラー:', error);
        }
        return { ...this.defaultStats };
    }

    // 統計データの保存
    saveStats(stats) {
        try {
            localStorage.setItem('echoRunner_stats', JSON.stringify(stats));
        } catch (error) {
            console.error('統計データの保存エラー:', error);
        }
    }

    // ゲーム開始時の記録
    recordGameStart() {
        const stats = this.loadStats();
        stats.totalGames++;
        stats.lastPlayDate = new Date().toISOString();
        this.saveStats(stats);
        return stats;
    }

    // ゲームクリア時の記録
    recordGameClear(gameData) {
        const stats = this.loadStats();
        const { elapsedTime, echoCount, score } = gameData;
        
        stats.totalClears++;
        stats.totalScore += score;
        stats.currentStreak++;
        
        // ベストスコア更新
        if (score > stats.bestScore) {
            stats.bestScore = score;
        }
        
        // ベストタイム更新（初回または更新時）
        if (stats.bestTime === 0 || elapsedTime < stats.bestTime) {
            stats.bestTime = elapsedTime;
        }
        
        // ベストエコー数更新（初回または更新時）
        if (stats.bestEchoCount === 0 || echoCount < stats.bestEchoCount) {
            stats.bestEchoCount = echoCount;
        }
        
        // 実績チェック
        this.checkAchievements(stats, gameData);
        
        this.saveStats(stats);
        return stats;
    }

    // ゲーム失敗時の記録
    recordGameFail() {
        const stats = this.loadStats();
        stats.currentStreak = 0;
        this.saveStats(stats);
        return stats;
    }

    // プレイ時間の記録
    recordPlayTime(playTime) {
        const stats = this.loadStats();
        stats.totalPlayTime += playTime;
        this.saveStats(stats);
        return stats;
    }

    // 実績チェック
    checkAchievements(stats, gameData) {
        Object.keys(this.achievements).forEach(key => {
            if (!stats.achievements[key]) {
                const achievement = this.achievements[key];
                if (achievement.check(stats, gameData)) {
                    stats.achievements[key] = true;
                    this.showAchievementNotification(achievement.name, achievement.description);
                }
            }
        });
    }

    // 実績通知表示
    showAchievementNotification(name, description) {
        // シンプルな通知（必要に応じてより高度なUIに変更可能）
        if (window.Notification && Notification.permission === 'granted') {
            new Notification(`実績解除: ${name}`, {
                body: description,
                icon: '/favicon.ico'
            });
        } else {
            console.log(`🏆 実績解除: ${name} - ${description}`);
        }
    }

    // 統計データのリセット
    resetStats() {
        this.saveStats({ ...this.defaultStats });
    }

    // 統計表示の更新
    updateStatsDisplay() {
        const stats = this.loadStats();
        
        // 基本統計
        this.updateBasicStats(stats);
        this.updateBestScores(stats);
        this.updateAchievements(stats.achievements);
    }

    // 基本統計の更新
    updateBasicStats(stats) {
        const totalPlayTimeElement = DOMUtils.getElementById('totalPlayTime');
        const totalGamesElement = DOMUtils.getElementById('totalGames');
        const totalClearsElement = DOMUtils.getElementById('totalClears');
        const clearRateElement = DOMUtils.getElementById('clearRate');
        
        if (totalPlayTimeElement) {
            const minutes = Math.floor(stats.totalPlayTime / 60000);
            DOMUtils.setText(totalPlayTimeElement, `${minutes}分`);
        }
        
        if (totalGamesElement) {
            DOMUtils.setText(totalGamesElement, `${stats.totalGames}回`);
        }
        
        if (totalClearsElement) {
            DOMUtils.setText(totalClearsElement, `${stats.totalClears}回`);
        }
        
        if (clearRateElement) {
            const rate = stats.totalGames > 0 ? Math.round((stats.totalClears / stats.totalGames) * 100) : 0;
            DOMUtils.setText(clearRateElement, `${rate}%`);
        }
    }

    // ベストスコアの更新
    updateBestScores(stats) {
        const bestScoreElement = DOMUtils.getElementById('bestScore');
        const bestTimeElement = DOMUtils.getElementById('bestTime');
        const bestEchoElement = DOMUtils.getElementById('bestEcho');
        const avgScoreElement = DOMUtils.getElementById('avgScore');
        
        if (bestScoreElement) {
            DOMUtils.setText(bestScoreElement, `${stats.bestScore}点`);
        }
        
        if (bestTimeElement) {
            if (stats.bestTime > 0) {
                const seconds = Math.floor(stats.bestTime / 1000);
                DOMUtils.setText(bestTimeElement, `${seconds}秒`);
            } else {
                DOMUtils.setText(bestTimeElement, '-');
            }
        }
        
        if (bestEchoElement) {
            if (stats.bestEchoCount > 0) {
                DOMUtils.setText(bestEchoElement, `${stats.bestEchoCount}回`);
            } else {
                DOMUtils.setText(bestEchoElement, '-');
            }
        }
        
        if (avgScoreElement) {
            const avgScore = stats.totalClears > 0 ? Math.round(stats.totalScore / stats.totalClears) : 0;
            DOMUtils.setText(avgScoreElement, `${avgScore}点`);
        }
    }

    // 実績表示の更新
    updateAchievements(achievements) {
        Object.keys(achievements).forEach(key => {
            const element = DOMUtils.getElementById(`achievement-${key}`);
            if (element) {
                if (achievements[key]) {
                    DOMUtils.setText(element, '達成');
                    DOMUtils.toggleClass(element, 'achieved', true);
                } else {
                    DOMUtils.setText(element, '未達成');
                    DOMUtils.toggleClass(element, 'achieved', false);
                }
            }
        });
    }

    // 統計画面の表示/非表示
    showStatsScreen() {
        const statsScreen = DOMUtils.getElementById('statsScreen');
        const startScreen = DOMUtils.getElementById('startScreen');
        
        if (statsScreen && startScreen) {
            this.updateStatsDisplay();
            DOMUtils.setDisplay(startScreen, false);
            DOMUtils.setDisplay(statsScreen, true);
        }
    }

    hideStatsScreen() {
        const statsScreen = DOMUtils.getElementById('statsScreen');
        const startScreen = DOMUtils.getElementById('startScreen');
        
        if (statsScreen && startScreen) {
            DOMUtils.setDisplay(statsScreen, false);
            DOMUtils.setDisplay(startScreen, true);
        }
    }

    // 統計データのエクスポート（デバッグ・バックアップ用）
    exportStats() {
        const stats = this.loadStats();
        const dataStr = JSON.stringify(stats, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `echo-runner-stats-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    // 統計データのインポート
    importStats(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const stats = JSON.parse(e.target.result);
                    // データの検証
                    if (this.validateStatsData(stats)) {
                        this.saveStats(stats);
                        this.updateStatsDisplay();
                        resolve(stats);
                    } else {
                        reject(new Error('無効な統計データファイルです'));
                    }
                } catch (error) {
                    reject(new Error('ファイルの読み込みに失敗しました'));
                }
            };
            reader.readAsText(file);
        });
    }

    // 統計データの検証
    validateStatsData(stats) {
        const requiredFields = ['totalPlayTime', 'totalGames', 'totalClears', 'bestScore'];
        return requiredFields.every(field => typeof stats[field] === 'number');
    }

    // イベントリスナーの初期化
    initializeEventListeners() {
        // 統計画面のイベントリスナーは動的に設定される可能性があるため、
        // 実際の初期化はメインゲームから呼び出される
    }

    // 統計サマリーの取得（デバッグ用）
    getStatsSummary() {
        const stats = this.loadStats();
        return {
            games: stats.totalGames,
            clears: stats.totalClears,
            clearRate: stats.totalGames > 0 ? ((stats.totalClears / stats.totalGames) * 100).toFixed(1) : '0.0',
            bestScore: stats.bestScore,
            playTime: Math.floor(stats.totalPlayTime / 60000),
            achievementsCount: Object.values(stats.achievements).filter(Boolean).length
        };
    }

    // 実績の進捗取得
    getAchievementProgress() {
        const stats = this.loadStats();
        const achievements = Object.keys(this.achievements);
        const completed = achievements.filter(key => stats.achievements[key]);
        
        return {
            total: achievements.length,
            completed: completed.length,
            percentage: Math.round((completed.length / achievements.length) * 100),
            remaining: achievements.filter(key => !stats.achievements[key])
        };
    }
}

// シングルトンインスタンス
export const statsManager = new StatsManager();