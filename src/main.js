// main.js - メインゲームループとコントローラー

import { gameState } from './core/game-state.js';
import { GAME_CONFIG, DOM_IDS, COLORS } from './core/constants.js';
import { audioSystem } from './systems/audio-system.js';
import { particlePool, particleEffects, echoParticleManager, sonarRingManager } from './systems/particle-system.js';
import { hapticSystem } from './systems/haptic-system.js';
import { statsManager } from './ui/stats-manager.js';
import { mapGenerator } from './world/map-generator.js';
import { MathUtils, DOMUtils, DeviceUtils, TimeUtils } from './core/utils.js';

class EchoRunnerGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.animationId = null;
        this.lastFrameTime = 0;

        this.init();
    }

    async init() {
        // DOM要素の取得
        this.canvas = DOMUtils.getElementById(DOM_IDS.CANVAS);
        this.ctx = this.canvas.getContext('2d');
        this.container = DOMUtils.getElementById(DOM_IDS.CONTAINER);

        if (!this.canvas || !this.ctx || !this.container) {
            console.error('Required DOM elements not found');
            return;
        }

        // キャンバスサイズ設定
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // イベントリスナー設定
        this.setupEventListeners();

        // オーディオシステム初期化
        await audioSystem.init();

        // ゲームループ開始
        this.gameLoop();

        console.log('Echo Runner initialized successfully');
    }

    // キャンバスサイズ調整
    resizeCanvas() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
    }

    // イベントリスナー設定
    setupEventListeners() {
        // キーボードイベント
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // マウスイベント
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // モバイルコントロール
        if (DeviceUtils.isMobileDevice()) {
            this.setupMobileControls();
        }

        // UI ボタンイベント
        this.setupUIEvents();
    }

    // キーボード入力処理
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

    // マウスクリック処理
    handleCanvasClick(e) {
        if (!gameState.started || DeviceUtils.isMobileDevice()) return;
        this.fireEcho();
    }

    // エコー発射
    fireEcho() {
        if (!gameState.canFireEcho()) return;

        if (gameState.fireEcho()) {
            // 音響とエネルギーレベルに応じた周波数調整
            const energyRatio = gameState.echoEnergy / gameState.echoEnergyMax;
            const frequency = GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MIN + 
                            (energyRatio * (GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MAX - GAME_CONFIG.AUDIO.FREQUENCIES.ECHO_MIN));
            
            audioSystem.playEchoSound(frequency, 0.05);
            hapticSystem.vibrate('echoFire');

            // パーティクル効果
            particleEffects.shockwave(
                gameState.player.x, 
                gameState.player.y, 
                60, 
                { r: 0, g: 200, b: 255 }, 
                gameState.advancedParticles
            );

            // ソナーリング生成（新システム）
            sonarRingManager.createSonarRings(gameState.player.x, gameState.player.y);

            // 従来のエコー生成（維持）
            this.createEchoes();
        }
    }

    // エコー生成
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

    // モバイルコントロール設定
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

    // ジョイスティック設定
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

    // UI イベント設定
    setupUIEvents() {
        // スタートボタン
        const startButton = DOMUtils.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.startGame());
        }

        // リトライボタン
        const retryButton = DOMUtils.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', () => this.startGame());
        }

        // 統計ボタン
        const statsButton = DOMUtils.getElementById('statsButton');
        if (statsButton) {
            statsButton.addEventListener('click', () => statsManager.showStatsScreen());
        }

        // 統計画面の戻るボタン
        const backToMenuButton = DOMUtils.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', () => statsManager.hideStatsScreen());
        }

        // 統計画面からクリア画面に戻るボタン
        const backToClearButton = DOMUtils.getElementById('backToClearButton');
        if (backToClearButton) {
            backToClearButton.addEventListener('click', () => {
                statsManager.hideStatsToScreen('clearScreen');
            });
        }

        // 統計リセットボタン
        const resetStatsButton = DOMUtils.getElementById('resetStatsButton');
        if (resetStatsButton) {
            resetStatsButton.addEventListener('click', () => {
                if (confirm('統計データをすべてリセットしますか？この操作は取り消せません。')) {
                    statsManager.resetStats();
                    statsManager.updateStatsDisplay();
                }
            });
        }

        // クリア画面の統計ボタン
        const clearStatsButton = DOMUtils.getElementById('clearStatsButton');
        if (clearStatsButton) {
            clearStatsButton.addEventListener('click', () => {
                statsManager.showStatsFromClear();
            });
        }
    }

    // ゲーム開始
    startGame() {
        // 統計記録
        statsManager.recordGameStart();

        // ゲーム状態リセット
        gameState.start();

        // オーディオコンテキスト再開
        audioSystem.resumeAudioContext();

        // マップ生成
        this.generateWorld();

        // UI更新
        this.hideAllScreens();
        this.updateUI();

        console.log('Game started');
    }

    // ワールド生成
    generateWorld() {
        // キャンバスサイズ確定
        this.resizeCanvas();

        // ランダムレイアウト選択
        gameState.layoutType = MathUtils.randomInt(0, 2);

        // マップ生成
        gameState.walls = mapGenerator.generateMap(
            gameState.layoutType,
            this.canvas.width,
            this.canvas.height
        );

        // プレイヤー位置設定
        const playerPos = mapGenerator.getSafePlayerPosition(
            gameState.walls,
            this.canvas.width,
            this.canvas.height
        );
        gameState.setPlayerPosition(playerPos.x, playerPos.y);

        // アイテムとゴール生成
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

    // 画面表示制御
    hideAllScreens() {
        DOMUtils.setDisplay(DOMUtils.getElementById('startScreen'), false);
        DOMUtils.setDisplay(DOMUtils.getElementById('clearScreen'), false);
        DOMUtils.setDisplay(DOMUtils.getElementById('statsScreen'), false);
    }

    // メインゲームループ
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        this.update(deltaTime);
        this.draw();

        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    // ゲーム更新
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

        // パーティクル更新
        this.updateParticles();

        // 衝突判定
        this.checkCollisions();

        // UI更新
        this.updateUI();
    }

    // プレイヤー更新
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

    // 壁衝突チェック
    checkWallCollision(x, y, radius) {
        const circle = { x, y, radius };
        return gameState.walls.some(wall => MathUtils.circleRectCollision(circle, wall));
    }

    // エコー更新
    updateEchoes() {
        gameState.echoes = gameState.echoes.filter(echo => {
            echo.x += echo.vx;
            echo.y += echo.vy;
            echo.life--;

            // 衝突チェック
            this.checkEchoCollisions(echo);

            return echo.life > 0;
        });
    }

    // エコー衝突チェック
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

    // エコー効果生成
    createEchoEffect(x, y, collisionData) {
        // 反響音再生
        const distance = Math.sqrt((x - gameState.player.x) ** 2 + (y - gameState.player.y) ** 2);
        audioSystem.playReflectionSound(distance, collisionData.type);

        // パーティクル生成（プレイヤー位置を渡して距離計算）
        echoParticleManager.createEchoParticle(x, y, collisionData, gameState.echoParticles, 
                                              gameState.player.x, gameState.player.y);

        // 余韻効果の生成
        this.createGlowEffect(collisionData);
    }

    // 余韻効果の生成
    createGlowEffect(collisionData) {
        if (collisionData.type === 'item' && collisionData.object && !collisionData.object.collected) {
            // アイテムの余韻効果
            const existingGlow = gameState.itemGlows.find(glow => glow.item === collisionData.object);
            if (!existingGlow) {
                gameState.itemGlows.push({
                    item: collisionData.object,
                    alpha: 1.0,
                    pulsePhase: 0,
                    decay: 0.015
                });
            } else {
                // 既存のglowをリフレッシュ
                existingGlow.alpha = Math.min(1.0, existingGlow.alpha + 0.5);
            }
        } else if (collisionData.type === 'goal' && collisionData.object && collisionData.object.active) {
            // ゴールの余韻効果
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

    // パーティクル更新
    updateParticles() {
        // ソナーリング更新
        sonarRingManager.updateSonarRings();
        sonarRingManager.checkRingCollisions(gameState);

        // エコーパーティクル更新
        echoParticleManager.updateEchoParticles(gameState.echoParticles, particlePool);

        // 高度なパーティクル更新
        for (let i = gameState.advancedParticles.length - 1; i >= 0; i--) {
            const particle = gameState.advancedParticles[i];
            if (!particle.update()) {
                particlePool.returnAdvancedParticle(particle);
                gameState.advancedParticles.splice(i, 1);
            }
        }

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

        // プール調整
        particlePool.adjustPoolSize();
    }

    // 衝突判定
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
                    
                    // パーティクル効果
                    particleEffects.explosion(
                        item.x, 
                        item.y, 
                        { r: 255, g: 255, b: 0 }, 
                        1.5, 
                        gameState.advancedParticles
                    );
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

    // ゲーム完了
    gameComplete() {
        gameState.clear();
        
        // 統計記録
        const gameData = gameState.getGameData();
        statsManager.recordGameClear(gameData);

        // サウンドと触覚
        audioSystem.playGoalReachSound();
        hapticSystem.vibrate('goalReach');

        // 豪華なパーティクル効果
        particleEffects.explosion(
            gameState.goal.x, 
            gameState.goal.y, 
            { r: 0, g: 255, b: 0 }, 
            2.0, 
            gameState.advancedParticles
        );

        // クリア画面表示
        this.showClearScreen();
    }

    // クリア画面表示
    showClearScreen() {
        const clearScreen = DOMUtils.getElementById('clearScreen');
        const clearTime = DOMUtils.getElementById('clearTime');
        const clearEchoCount = DOMUtils.getElementById('clearEchoCount');
        const clearScore = DOMUtils.getElementById('clearScore');

        if (clearScreen) {
            DOMUtils.setText(clearTime, TimeUtils.formatTime(gameState.elapsedTime));
            DOMUtils.setText(clearEchoCount, gameState.echoCount.toString());
            DOMUtils.setText(clearScore, gameState.calculateScore().toString());
            DOMUtils.setDisplay(clearScreen, true);
        }
    }

    // UI更新
    updateUI() {
        // エコー状態更新
        this.updateEchoUI();

        // アイテムカウント更新
        const itemCount = DOMUtils.getElementById('itemCount');
        if (itemCount) {
            const collected = gameState.getCollectedItemCount();
            DOMUtils.setText(itemCount, `${collected}/${gameState.items.length}`);
        }

        // タイマー更新
        const timer = DOMUtils.getElementById('timer');
        if (timer && gameState.started) {
            DOMUtils.setText(timer, TimeUtils.formatTime(gameState.elapsedTime));
        }

        // ゴールメッセージ
        const goalMessage = DOMUtils.getElementById('goalMessage');
        if (goalMessage) {
            DOMUtils.setDisplay(goalMessage, gameState.isGoalActive());
        }
    }

    // エコーUI更新
    updateEchoUI() {
        const now = Date.now();
        const cooldownProgress = Math.min(1, (now - gameState.lastEchoTime) / gameState.echoCooldownMax);
        const energyProgress = gameState.echoEnergy / gameState.echoEnergyMax;
        const canEcho = cooldownProgress >= 1 && gameState.echoEnergy >= GAME_CONFIG.ECHO.ENERGY_COST;

        // クールダウンバー
        const cooldownBar = DOMUtils.getElementById('echoCooldownBar');
        if (cooldownBar) {
            const displayProgress = Math.min(energyProgress, cooldownProgress);
            cooldownBar.style.width = (displayProgress * 100) + '%';
            
            // エネルギーレベルに応じて色変更
            if (energyProgress < 0.3) {
                cooldownBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
            } else if (energyProgress < 0.7) {
                cooldownBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
            } else {
                cooldownBar.style.background = 'linear-gradient(90deg, #00ffff, #0080ff, #0040ff)';
            }
        }

        // エコー状態テキスト
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

        // エコーボタン
        const echoButton = DOMUtils.getElementById('echoButton');
        if (echoButton) {
            DOMUtils.toggleClass(echoButton, 'cooldown', !canEcho);
        }
    }

    // 描画
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!gameState.started) return;

        // ソナーリング描画（最背面）
        sonarRingManager.drawSonarRings(this.ctx);

        // 壁の描画（エコーパーティクルによる可視化）
        this.drawWalls();

        // アイテムの描画
        this.drawItems();

        // ゴールの描画
        this.drawGoal();

        // 高度なパーティクル描画
        gameState.advancedParticles.forEach(particle => {
            particle.draw(this.ctx);
        });

        // エコーパーティクル描画
        echoParticleManager.drawEchoParticles(this.ctx, gameState.echoParticles, gameState);

        // プレイヤー描画 - より豪華な効果
        if (gameState.started && !gameState.cleared) {
            const time = Date.now() / 1000;
            const pulse = Math.sin(time * 3) * 0.3 + 0.7;
            
            // Outer glow
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius + 8, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.1 * pulse})`;
            this.ctx.fill();
            
            // Main player body
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.4 * pulse})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${COLORS.PLAYER}, ${0.8 * pulse})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Inner bright core
            this.ctx.beginPath();
            this.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.PLAYER}, ${0.9 * pulse})`;
            this.ctx.fill();
        }

        // エコー描画
        this.drawEchoes();
    }

    // 壁の描画
    drawWalls() {
        gameState.walls.forEach(wall => {
            // エコーパーティクルによる可視化チェック
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

            // 一時的に全ての壁を薄く表示（デバッグ用）
            if (alpha > 0.01) {
                this.ctx.fillStyle = `rgba(${COLORS.WALL}, ${alpha})`;
                this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            } else {
                // デバッグ：壁の輪郭を薄く表示
                this.ctx.strokeStyle = `rgba(${COLORS.WALL}, 0.05)`;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
            }
        });
    }

    // アイテムの描画（余韻効果がある場合のみ表示）
    drawItems() {
        gameState.itemGlows.forEach(glow => {
            const item = glow.item;
            if (!item.collected) {
                const pulseSize = Math.sin(glow.pulsePhase) * 3;

                // 外側の光（フェードアウト）
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius + pulseSize + 10, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.1})`;
                this.ctx.fill();

                // メインのアイテム（フェードアウト）
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, item.radius + pulseSize, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.3})`;
                this.ctx.fill();
                this.ctx.strokeStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.5})`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // 中心の明るい点（フェードアウト）
                this.ctx.beginPath();
                this.ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${COLORS.ITEM}, ${glow.alpha * 0.8})`;
                this.ctx.fill();
            }
        });
    }

    // ゴールの描画（余韻効果がある場合のみ表示）
    drawGoal() {
        if (gameState.goal && gameState.goal.active && gameState.goalGlow) {
            const pulseSize = Math.sin(gameState.goalGlow.pulsePhase) * 5;

            // 外側の輪（フェードアウト）
            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, gameState.goal.radius + pulseSize + 10, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.3})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // メインの円（フェードアウト）
            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, gameState.goal.radius + pulseSize, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.2})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.6})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // 中心の明るい点（フェードアウト）
            this.ctx.beginPath();
            this.ctx.arc(gameState.goal.x, gameState.goal.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${COLORS.GOAL}, ${gameState.goalGlow.alpha * 0.8})`;
            this.ctx.fill();
        }
    }

    // エコーの描画
    drawEchoes() {
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

    // 破棄
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        audioSystem.destroy();
        hapticSystem.stopAll();
    }
}

// ゲーム開始
const game = new EchoRunnerGame();

// グローバルアクセス用（デバッグ）
window.echoRunner = {
    game,
    gameState,
    audioSystem,
    particlePool,
    sonarRingManager,
    hapticSystem,
    statsManager
};