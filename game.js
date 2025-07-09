const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');

// ゲーム状態
const game = {
    player: {
        x: 400,
        y: 300,
        radius: 8, // 半径を少し小さくして通りやすくする
        speed: 3,
        vx: 0,
        vy: 0,
        // 慣性用の変数
        actualVx: 0,
        actualVy: 0,
        friction: 0.85,
        acceleration: 0.4
    },
    echoes: [],
    echoParticles: [],
    walls: [],
    items: [],
    itemGlows: [], // アイテムの余韻効果
    goal: null,
    goalGlow: null, // ゴールの余韻効果
    layoutType: 0, // レイアウトタイプ（0:散在型、1:迷路型、2:部屋型）
    echoCooldown: 0,
    echoCooldownMax: 2000, // 2秒
    lastEchoTime: 0,
    echoCount: 0, // エコー使用回数
    startTime: 0,
    elapsedTime: 0,
    keys: {},
    started: false,
    cleared: false,
    mobileControlsInitialized: false,
    joystick: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    }
};

// キャンバスサイズ設定
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 音響システム
let audioContext;
let masterGain;
try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // マスターゲインノードを作成して音量を制御
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0.3; // 全体音量を下げて音割れを防止
} catch (e) {
    console.error('Web Audio API is not supported in this browser');
}

function playEchoSound(frequency = 800, duration = 0.1) {
    if (!audioContext) return;

    try {
        // Create multiple oscillators for a richer sound
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filterNode = audioContext.createBiquadFilter();
        const delayNode = audioContext.createDelay();
        const feedbackGain = audioContext.createGain();

        // Configure the filter for a more interesting sound
        filterNode.type = 'bandpass';
        filterNode.frequency.value = frequency;
        filterNode.Q.value = 5;

        // Configure delay for echo effect
        delayNode.delayTime.value = 0.08;
        feedbackGain.gain.value = 0.15; // Reduced feedback to prevent distortion

        // Connect oscillators
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(filterNode);
        filterNode.connect(delayNode);
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        filterNode.connect(masterGain);
        delayNode.connect(masterGain);

        // Configure oscillators
        oscillator1.frequency.value = frequency;
        oscillator1.type = 'sine';
        oscillator2.frequency.value = frequency * 1.5;
        oscillator2.type = 'triangle';

        // Envelope - reduced volume to prevent distortion
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        // Frequency modulation for more dynamic sound
        oscillator1.frequency.exponentialRampToValueAtTime(frequency * 0.8, audioContext.currentTime + duration);

        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + duration);
        oscillator2.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.error('Error playing sound:', e);
    }
}

// 壁の生成（ランダム配置）
function generateWalls() {
    const w = canvas.width;
    const h = canvas.height;

    game.walls = [];

    // 外壁（固定）
    game.walls.push(
        { x: 0, y: 0, width: w, height: 20 },
        { x: 0, y: h - 20, width: w, height: 20 },
        { x: 0, y: 0, width: 20, height: h },
        { x: w - 20, y: 0, width: 20, height: h }
    );

    // レイアウトパターンをランダムに選択
    game.layoutType = Math.floor(Math.random() * 3);

    // デバッグ用：レイアウトタイプを確認
    const layoutNames = ['散在型', '迷路型', '部屋型'];
    console.log('生成されたレイアウト:', layoutNames[game.layoutType]);

    switch (game.layoutType) {
        case 0: // 散在型
            generateScatteredWalls(w, h);
            break;
        case 1: // 迷路型
            generateMazeWalls(w, h);
            break;
        case 2: // 部屋型
            generateRoomWalls(w, h);
            break;
    }

    console.log(`壁の数: ${game.walls.length - 4}個（外壁を除く）`);
}

// 散在型の壁生成
function generateScatteredWalls(w, h) {
    const wallCount = 6 + Math.floor(Math.random() * 4); // 6-9個に減らす

    for (let i = 0; i < wallCount; i++) {
        let wall;
        let attempts = 0;
        let validWall = false;

        while (!validWall && attempts < 50) {
            const isHorizontal = Math.random() < 0.5;

            if (isHorizontal) {
                wall = {
                    x: Math.random() * w * 0.6 + w * 0.2,
                    y: Math.random() * h * 0.6 + h * 0.2,
                    width: w * (0.08 + Math.random() * 0.15), // 幅を狭める
                    height: 20
                };
            } else {
                wall = {
                    x: Math.random() * w * 0.6 + w * 0.2,
                    y: Math.random() * h * 0.6 + h * 0.2,
                    width: 20,
                    height: h * (0.08 + Math.random() * 0.15) // 高さを狭める
                };
            }

            wall.x = Math.max(40, Math.min(wall.x, w - wall.width - 40));
            wall.y = Math.max(40, Math.min(wall.y, h - wall.height - 40));

            validWall = true;
            // 他の壁との間隔を広げる（50ピクセル以上）
            for (const existingWall of game.walls) {
                if (wall.x < existingWall.x + existingWall.width + 50 &&
                    wall.x + wall.width + 50 > existingWall.x &&
                    wall.y < existingWall.y + existingWall.height + 50 &&
                    wall.y + wall.height + 50 > existingWall.y) {
                    validWall = false;
                    break;
                }
            }

            attempts++;
        }

        if (validWall) {
            game.walls.push(wall);
        }
    }
}

// 迷路型の壁生成
function generateMazeWalls(w, h) {
    // シンプルな十字路型の迷路
    const centerX = w / 2;
    const centerY = h / 2;
    const gapSize = 100; // 通路の幅

    // 縦の壁（中央に通路）
    // 上部
    game.walls.push({
        x: centerX - 10,
        y: 20,
        width: 20,
        height: centerY - gapSize / 2 - 20
    });

    // 下部
    game.walls.push({
        x: centerX - 10,
        y: centerY + gapSize / 2,
        width: 20,
        height: h - centerY - gapSize / 2 - 20
    });

    // 横の壁（中央に通路）
    // 左部
    game.walls.push({
        x: 20,
        y: centerY - 10,
        width: centerX - gapSize / 2 - 20,
        height: 20
    });

    // 右部
    game.walls.push({
        x: centerX + gapSize / 2,
        y: centerY - 10,
        width: w - centerX - gapSize / 2 - 20,
        height: 20
    });

    // 四隅に小さな壁を追加（オプション）
    const cornerWalls = [
        { x: w * 0.25, y: h * 0.25, width: 50, height: 20 },
        { x: w * 0.75 - 50, y: h * 0.25, width: 50, height: 20 },
        { x: w * 0.25, y: h * 0.75, width: 50, height: 20 },
        { x: w * 0.75 - 50, y: h * 0.75, width: 50, height: 20 }
    ];

    // ランダムに2-3個の角の壁を追加
    const numCornerWalls = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numCornerWalls && i < cornerWalls.length; i++) {
        const randomIndex = Math.floor(Math.random() * cornerWalls.length);
        const wall = cornerWalls.splice(randomIndex, 1)[0];
        game.walls.push(wall);
    }
}

// 部屋型の壁生成
function generateRoomWalls(w, h) {
    // 中央の部屋（少し小さめに）
    const roomX = w * 0.35;
    const roomY = h * 0.35;
    const roomW = w * 0.3;
    const roomH = h * 0.3;

    // 部屋の壁（出入り口付き）
    const doorSize = 80; // ドアを広げる

    // 上壁（ドア付き）
    const topDoorX = roomX + Math.random() * (roomW - doorSize);
    if (topDoorX - roomX > 30) {
        game.walls.push({
            x: roomX,
            y: roomY,
            width: topDoorX - roomX,
            height: 20
        });
    }
    if (roomX + roomW - (topDoorX + doorSize) > 30) {
        game.walls.push({
            x: topDoorX + doorSize,
            y: roomY,
            width: roomX + roomW - (topDoorX + doorSize),
            height: 20
        });
    }

    // 下壁（ドア付き）
    const bottomDoorX = roomX + Math.random() * (roomW - doorSize);
    if (bottomDoorX - roomX > 30) {
        game.walls.push({
            x: roomX,
            y: roomY + roomH,
            width: bottomDoorX - roomX,
            height: 20
        });
    }
    if (roomX + roomW - (bottomDoorX + doorSize) > 30) {
        game.walls.push({
            x: bottomDoorX + doorSize,
            y: roomY + roomH,
            width: roomX + roomW - (bottomDoorX + doorSize),
            height: 20
        });
    }

    // 左壁（ドア付き）
    const leftDoorY = roomY + Math.random() * (roomH - doorSize);
    if (leftDoorY - roomY > 30) {
        game.walls.push({
            x: roomX,
            y: roomY,
            width: 20,
            height: leftDoorY - roomY
        });
    }
    if (roomY + roomH - (leftDoorY + doorSize) > 30) {
        game.walls.push({
            x: roomX,
            y: leftDoorY + doorSize,
            width: 20,
            height: roomY + roomH - (leftDoorY + doorSize)
        });
    }

    // 右壁（ドア付き）
    const rightDoorY = roomY + Math.random() * (roomH - doorSize);
    if (rightDoorY - roomY > 30) {
        game.walls.push({
            x: roomX + roomW,
            y: roomY,
            width: 20,
            height: rightDoorY - roomY
        });
    }
    if (roomY + roomH - (rightDoorY + doorSize) > 30) {
        game.walls.push({
            x: roomX + roomW,
            y: rightDoorY + doorSize,
            width: 20,
            height: roomY + roomH - (rightDoorY + doorSize)
        });
    }

    // 追加の小さな壁（数を減らす）
    for (let i = 0; i < 2; i++) {
        const smallWall = {
            x: Math.random() * w * 0.7 + w * 0.15,
            y: Math.random() * h * 0.7 + h * 0.15,
            width: Math.random() < 0.5 ? w * 0.06 : 20,
            height: Math.random() < 0.5 ? 20 : h * 0.06
        };

        // 部屋の中に壁を作らない（マージンを広げる）
        if (smallWall.x < roomX - 40 || smallWall.x > roomX + roomW + 40 ||
            smallWall.y < roomY - 40 || smallWall.y > roomY + roomH + 40) {
            game.walls.push(smallWall);
        }
    }
}

// アイテムとゴールの生成（ランダム配置）
function generateItemsAndGoal() {
    const w = canvas.width;
    const h = canvas.height;

    game.items = [];

    // 5つのアイテムをランダムに配置
    for (let i = 0; i < 5; i++) {
        let item = null;
        let attempts = 0;

        while (!item && attempts < 100) {
            const testX = Math.random() * (w - 100) + 50;
            const testY = Math.random() * (h - 100) + 50;

            // 壁との衝突チェック（緩い条件）
            let validPosition = true;
            for (const wall of game.walls) {
                if (testX >= wall.x - 30 && testX <= wall.x + wall.width + 30 &&
                    testY >= wall.y - 30 && testY <= wall.y + wall.height + 30) {
                    validPosition = false;
                    break;
                }
            }

            // 他のアイテムとの距離チェック（近すぎないように）
            if (validPosition) {
                for (const existingItem of game.items) {
                    const dx = testX - existingItem.x;
                    const dy = testY - existingItem.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 60) {
                        validPosition = false;
                        break;
                    }
                }
            }

            // プレイヤーの初期位置から離す
            if (validPosition) {
                const dx = testX - game.player.x;
                const dy = testY - game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 80) {
                    validPosition = false;
                }
            }

            if (validPosition) {
                item = {
                    id: i,
                    x: testX,
                    y: testY,
                    radius: 15,
                    collected: false
                };
            }

            attempts++;
        }

        if (item) {
            game.items.push(item);
        }
    }

    // ゴールの位置をランダムに設定
    let goalPlaced = false;
    let attempts = 0;

    while (!goalPlaced && attempts < 100) {
        const testX = Math.random() * (w - 100) + 50;
        const testY = Math.random() * (h - 100) + 50;

        // 壁との衝突チェック
        let validPosition = true;
        for (const wall of game.walls) {
            if (testX >= wall.x - 35 && testX <= wall.x + wall.width + 35 &&
                testY >= wall.y - 35 && testY <= wall.y + wall.height + 35) {
                validPosition = false;
                break;
            }
        }

        // プレイヤーの初期位置から離す（ゴールは遠くに）
        if (validPosition) {
            const dx = testX - game.player.x;
            const dy = testY - game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // 画面サイズの25%以上離れていればOK（条件を緩和）
            if (distance < Math.min(w, h) * 0.25) {
                validPosition = false;
            }
        }

        if (validPosition) {
            game.goal = {
                x: testX,
                y: testY,
                radius: 25,
                active: false
            };
            goalPlaced = true;
        }

        attempts++;
    }

    // フォールバック（配置に失敗した場合）
    if (!goalPlaced) {
        // プレイヤーから最も遠い角に配置
        const corners = [
            { x: 50, y: 50 },
            { x: w - 50, y: 50 },
            { x: 50, y: h - 50 },
            { x: w - 50, y: h - 50 }
        ];

        let maxDistance = 0;
        let bestCorner = corners[0];

        for (const corner of corners) {
            const dx = corner.x - game.player.x;
            const dy = corner.y - game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxDistance) {
                maxDistance = distance;
                bestCorner = corner;
            }
        }

        game.goal = {
            x: bestCorner.x,
            y: bestCorner.y,
            radius: 25,
            active: false
        };
    }
}

// プレイヤーの初期位置を安全な場所に設定（ランダム）
function setSafePlayerPosition() {
    const w = canvas.width;
    const h = canvas.height;
    let placed = false;
    let attempts = 0;

    // ランダムな位置を試す
    while (!placed && attempts < 200) {
        const testX = Math.random() * (w - 100) + 50;
        const testY = Math.random() * (h - 100) + 50;

        // 壁との衝突チェック（余裕を持たせる）
        if (!checkPlayerWallCollision(testX, testY, 20)) {
            game.player.x = testX;
            game.player.y = testY;
            placed = true;
        }

        attempts++;
    }

    // フォールバック（配置に失敗した場合）
    if (!placed) {
        // グリッド上の位置を順番に試す
        for (let y = 60; y < h - 60; y += 30) {
            for (let x = 60; x < w - 60; x += 30) {
                if (!checkPlayerWallCollision(x, y, 10)) {
                    game.player.x = x;
                    game.player.y = y;
                    return;
                }
            }
        }

        // それでもダメなら最低限の衝突チェックで配置
        game.player.x = 50;
        game.player.y = 50;
    }
}

// Echo発射
function fireEcho(x, y) {
    if (game.cleared) return;

    const now = Date.now();
    if (now - game.lastEchoTime < game.echoCooldownMax) return;

    game.lastEchoTime = now;
    game.echoCount++; // エコー使用回数をカウント
    playEchoSound(1000, 0.05);

    // 全方向にエコーを発射
    const echoCount = 36;
    for (let i = 0; i < echoCount; i++) {
        const angle = (Math.PI * 2 * i) / echoCount;
        game.echoes.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: 100,
            maxLife: 100
        });
    }
}

// エコーパーティクルの生成
function createEchoParticle(x, y, collisionData) {
    // 反響音の再生
    const distance = Math.sqrt(
        Math.pow(game.player.x - x, 2) +
        Math.pow(game.player.y - y, 2)
    );
    const volume = Math.max(0.1, 1 - distance / 500);

    if (audioContext) {
        try {
            const gainNode = audioContext.createGain();
            
            // Create multiple oscillators for richer echo sounds
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const filterNode = audioContext.createBiquadFilter();
            const delayNode = audioContext.createDelay();
            const feedbackGain = audioContext.createGain();

            // Configure based on collision type
            let frequency = 600;
            let filterFreq = 1000;
            let delayTime = 0.1;
            
            if (collisionData.type === 'item') {
                frequency = 1200 + Math.random() * 400; // アイテムは高い音でランダム性
                filterFreq = 2000;
                delayTime = 0.05;
                oscillator1.type = 'triangle';
                oscillator2.type = 'sine';
            } else if (collisionData.type === 'goal') {
                frequency = 300 + Math.random() * 200; // ゴールは低い音でランダム性
                filterFreq = 800;
                delayTime = 0.15;
                oscillator1.type = 'sawtooth';
                oscillator2.type = 'triangle';
            } else {
                frequency = 600 + (distance / 2) + Math.random() * 100;
                filterFreq = 1000;
                delayTime = 0.1;
                oscillator1.type = 'sine';
                oscillator2.type = 'square';
            }

            // Configure filter
            filterNode.type = 'lowpass';
            filterNode.frequency.value = filterFreq;
            filterNode.Q.value = 3;

            // Configure delay
            delayNode.delayTime.value = delayTime;
            feedbackGain.gain.value = 0.2; // Reduced feedback to prevent distortion

            // Connect nodes
            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(filterNode);
            filterNode.connect(delayNode);
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            filterNode.connect(audioContext.destination);
            delayNode.connect(audioContext.destination);

            // Configure oscillators
            oscillator1.frequency.value = frequency;
            oscillator2.frequency.value = frequency * 0.75;

            // Dynamic envelope - reduced volume to prevent distortion
            gainNode.gain.setValueAtTime(volume * 0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            // Frequency modulation for more interesting sound
            oscillator1.frequency.exponentialRampToValueAtTime(frequency * 0.7, audioContext.currentTime + 0.3);

            oscillator1.start(audioContext.currentTime);
            oscillator2.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.3);
            oscillator2.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.error('Error creating echo particle sound:', e);
        }
    }

    // 視覚エフェクト - より豪華なパーティクル
    const particleCount = collisionData.type === 'wall' ? 8 : 12;
    for (let i = 0; i < particleCount; i++) {
        let color = '0, 255, 255'; // 壁は水色
        let secondaryColor = '0, 200, 255';
        
        if (collisionData.type === 'item') {
            color = '255, 255, 0'; // アイテムは黄色
            secondaryColor = '255, 200, 0';
        } else if (collisionData.type === 'goal') {
            color = '0, 255, 0'; // ゴールは緑
            secondaryColor = '0, 200, 100';
        }

        // Main particles
        game.echoParticles.push({
            x: x,
            y: y,
            radius: 0,
            maxRadius: 40 + i * 15,
            alpha: 0.6 - i * 0.05,
            growthSpeed: 2.5,
            color: color,
            type: collisionData.type,
            shimmer: Math.random() * 0.3 + 0.7
        });

        // Secondary sparkle particles
        if (collisionData.type === 'item' || collisionData.type === 'goal') {
            for (let j = 0; j < 3; j++) {
                game.echoParticles.push({
                    x: x + (Math.random() - 0.5) * 20,
                    y: y + (Math.random() - 0.5) * 20,
                    radius: 0,
                    maxRadius: 15 + j * 5,
                    alpha: 0.8,
                    growthSpeed: 1.5,
                    color: secondaryColor,
                    type: collisionData.type + '_sparkle',
                    shimmer: Math.random() * 0.4 + 0.8
                });
            }
        }
    }

    // アイテムの場合、余韻効果を追加（重複チェック付き）
    if (collisionData.type === 'item' && collisionData.object && !collisionData.object.collected) {
        // 既に余韻効果があるかチェック
        const existingGlow = game.itemGlows.find(glow => glow.item === collisionData.object);
        if (existingGlow) {
            // 既存の余韻をリフレッシュ
            existingGlow.alpha = Math.min(1.0, existingGlow.alpha + 0.5);
        } else {
            // 新しい余韻効果を追加
            game.itemGlows.push({
                item: collisionData.object,
                alpha: 1.0,
                fadeSpeed: 0.008, // ゆっくりフェードアウト
                pulsePhase: 0
            });
        }
    }

    // ゴールの場合も余韻効果を追加
    if (collisionData.type === 'goal' && collisionData.object && game.goal.active) {
        if (game.goalGlow) {
            // 既存の余韻をリフレッシュ
            game.goalGlow.alpha = Math.min(1.0, game.goalGlow.alpha + 0.5);
        } else {
            // 新しい余韻効果を追加
            game.goalGlow = {
                alpha: 1.0,
                fadeSpeed: 0.005, // ゴールはさらにゆっくりフェードアウト
                pulsePhase: 0
            };
        }
    }
}

// 衝突判定
function checkWallCollision(echo) {
    for (const wall of game.walls) {
        if (echo.x >= wall.x && echo.x <= wall.x + wall.width &&
            echo.y >= wall.y && echo.y <= wall.y + wall.height) {
            return { type: 'wall', object: wall };
        }
    }

    // アイテムとの衝突判定
    for (const item of game.items) {
        if (!item.collected) {
            const dx = echo.x - item.x;
            const dy = echo.y - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= item.radius) {
                return { type: 'item', object: item };
            }
        }
    }

    // ゴールとの衝突判定
    if (game.goal && game.goal.active) {
        const dx = echo.x - game.goal.x;
        const dy = echo.y - game.goal.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= game.goal.radius) {
            return { type: 'goal', object: game.goal };
        }
    }

    return null;
}

// プレイヤーと壁の衝突判定（余裕を持たせる）
function checkPlayerWallCollision(x, y, margin = 0) {
    const radius = game.player.radius + margin;
    for (const wall of game.walls) {
        if (x + radius > wall.x &&
            x - radius < wall.x + wall.width &&
            y + radius > wall.y &&
            y - radius < wall.y + wall.height) {
            return true;
        }
    }
    return false;
}

// 更新処理
function update() {
    if (!game.started || game.cleared) return;

    // 経過時間の更新
    if (game.startTime > 0) {
        game.elapsedTime = Date.now() - game.startTime;
    }

    // プレイヤーの移動（慣性システム）
    let targetVx = 0;
    let targetVy = 0;

    // キーボード入力
    if (game.keys['ArrowUp'] || game.keys['w'] || game.keys['W']) targetVy = -game.player.speed;
    if (game.keys['ArrowDown'] || game.keys['s'] || game.keys['S']) targetVy = game.player.speed;
    if (game.keys['ArrowLeft'] || game.keys['a'] || game.keys['A']) targetVx = -game.player.speed;
    if (game.keys['ArrowRight'] || game.keys['d'] || game.keys['D']) targetVx = game.player.speed;

    // ジョイスティック入力
    if (game.joystick.active) {
        const dx = game.joystick.currentX - game.joystick.startX;
        const dy = game.joystick.currentY - game.joystick.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 40;

        if (distance > 5) {
            const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;
            const angle = Math.atan2(dy, dx);
            targetVx = Math.cos(angle) * game.player.speed * normalizedDistance;
            targetVy = Math.sin(angle) * game.player.speed * normalizedDistance;
        }
    }

    // 斜め移動の速度調整
    if (targetVx !== 0 && targetVy !== 0) {
        targetVx *= 0.707;
        targetVy *= 0.707;
    }

    // 慣性を適用して滑らかな移動
    game.player.actualVx += (targetVx - game.player.actualVx) * game.player.acceleration;
    game.player.actualVy += (targetVy - game.player.actualVy) * game.player.acceleration;

    // 停止時の摩擦
    if (targetVx === 0) game.player.actualVx *= game.player.friction;
    if (targetVy === 0) game.player.actualVy *= game.player.friction;

    // 非常に小さな値は0にする
    if (Math.abs(game.player.actualVx) < 0.01) game.player.actualVx = 0;
    if (Math.abs(game.player.actualVy) < 0.01) game.player.actualVy = 0;

    // 衝突判定を考慮した移動
    const newX = game.player.x + game.player.actualVx;
    const newY = game.player.y + game.player.actualVy;

    // X方向とY方向を別々にチェック（狭い通路でも通りやすくする）
    if (!checkPlayerWallCollision(newX, game.player.y)) {
        game.player.x = newX;
    } else {
        game.player.actualVx = 0; // 壁に当たったら慣性をリセット
    }
    if (!checkPlayerWallCollision(game.player.x, newY)) {
        game.player.y = newY;
    } else {
        game.player.actualVy = 0; // 壁に当たったら慣性をリセット
    }

    // アイテムとの衝突判定
    for (const item of game.items) {
        if (!item.collected) {
            const dx = game.player.x - item.x;
            const dy = game.player.y - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= game.player.radius + item.radius) {
                item.collected = true;

                // アイテム収集音（きらきら音）
                if (audioContext) {
                    try {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();

                        oscillator.connect(gainNode);
                        gainNode.connect(masterGain);

                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
                        oscillator.frequency.exponentialRampToValueAtTime(2500, audioContext.currentTime + 0.2);

                        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.3);
                    } catch (e) {
                        console.error('Error playing item sound:', e);
                    }
                }

                // すべてのアイテムを集めたらゴールを表示
                const collectedCount = game.items.filter(i => i.collected).length;
                if (collectedCount === game.items.length && !game.goal.active) {
                    game.goal.active = true;

                    // ゴール出現音（和音）
                    if (audioContext) {
                        try {
                            const notes = [523.25, 659.25, 783.99]; // C, E, G
                            notes.forEach((freq, index) => {
                                const oscillator = audioContext.createOscillator();
                                const gainNode = audioContext.createGain();

                                oscillator.connect(gainNode);
                                gainNode.connect(masterGain);

                                oscillator.frequency.value = freq;
                                oscillator.type = 'triangle';

                                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + index * 0.1);
                                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

                                oscillator.start(audioContext.currentTime + index * 0.1);
                                oscillator.stop(audioContext.currentTime + 1);
                            });
                        } catch (e) {
                            console.error('Error playing goal sound:', e);
                        }
                    }

                    const goalMessage = document.getElementById('goalMessage');
                    if (goalMessage) goalMessage.style.display = 'block';
                }
            }
        }
    }

    // ゴールとの衝突判定
    if (game.goal && game.goal.active) {
        const dx = game.player.x - game.goal.x;
        const dy = game.player.y - game.goal.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= game.player.radius + game.goal.radius) {
            gameClear();
        }
    }

    // エコーの更新
    game.echoes = game.echoes.filter(echo => {
        echo.x += echo.vx;
        echo.y += echo.vy;
        echo.life--;

        // 衝突判定
        const collision = checkWallCollision(echo);
        if (collision) {
            createEchoParticle(echo.x, echo.y, collision);
            return false;
        }

        // 画面外チェック
        if (echo.x < 0 || echo.x > canvas.width ||
            echo.y < 0 || echo.y > canvas.height) {
            return false;
        }

        return echo.life > 0;
    });

    // エコーパーティクルの更新
    game.echoParticles = game.echoParticles.filter(particle => {
        particle.radius += particle.growthSpeed;
        particle.alpha *= 0.95;
        
        // シマー効果の更新
        if (particle.shimmer) {
            particle.shimmer = 0.6 + Math.sin(Date.now() / 200 + particle.radius) * 0.4;
        }
        
        return particle.radius < particle.maxRadius && particle.alpha > 0.01;
    });

    // アイテムの余韻効果の更新
    game.itemGlows = game.itemGlows.filter(glow => {
        glow.alpha -= glow.fadeSpeed;
        glow.pulsePhase += 0.1;

        // 既に収集されたアイテムの余韻は削除
        if (glow.item.collected) {
            return false;
        }

        return glow.alpha > 0;
    });

    // ゴールの余韻効果の更新
    if (game.goalGlow) {
        game.goalGlow.alpha -= game.goalGlow.fadeSpeed;
        game.goalGlow.pulsePhase += 0.05;

        if (game.goalGlow.alpha <= 0) {
            game.goalGlow = null;
        }
    }

    // クールダウンの更新
    const now = Date.now();
    const cooldownProgress = Math.min(1, (now - game.lastEchoTime) / game.echoCooldownMax);
    const cooldownBar = document.getElementById('echoCooldownBar');
    const echoStatus = document.getElementById('echoStatus');
    const echoButton = document.getElementById('echoButton');

    if (cooldownBar) cooldownBar.style.width = (cooldownProgress * 100) + '%';
    if (echoStatus) echoStatus.textContent = cooldownProgress >= 1 ? 'Ready' : 'Cooling...';

    if (echoButton) {
        if (cooldownProgress >= 1) {
            echoButton.classList.remove('cooldown');
        } else {
            echoButton.classList.add('cooldown');
        }
    }

    // UI更新
    updateUI();
}

// 描画処理
function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // エコーパーティクルの描画 - より豪華な効果
    game.echoParticles.forEach(particle => {
        const shimmerAlpha = particle.alpha * (particle.shimmer || 1);
        
        // Main particle ring
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${particle.color || '0, 255, 255'}, ${shimmerAlpha})`;
        ctx.lineWidth = particle.type && particle.type.includes('sparkle') ? 1 : 3;
        ctx.stroke();

        // Inner glow effect
        if (particle.radius > 5) {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${particle.color || '0, 255, 255'}, ${shimmerAlpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Sparkle effect for special particles
        if (particle.type && particle.type.includes('sparkle')) {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particle.color || '0, 255, 255'}, ${shimmerAlpha * 0.8})`;
            ctx.fill();
        }

        // 壁の輪郭を一時的に表示（壁のパーティクルのみ）
        if (particle.type === 'wall' || !particle.type) {
            const wallAlpha = particle.alpha * 0.3;
            ctx.strokeStyle = `rgba(100, 150, 255, ${wallAlpha})`;
            ctx.lineWidth = 1;

            game.walls.forEach(wall => {
                const dx = particle.x - (wall.x + wall.width / 2);
                const dy = particle.y - (wall.y + wall.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < particle.radius + 50) {
                    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
                }
            });
        }

        // アイテムの輪郭を表示
        if (particle.type === 'item') {
            game.items.forEach(item => {
                if (!item.collected) {
                    const dx = particle.x - item.x;
                    const dy = particle.y - item.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < particle.radius + 30) {
                        ctx.beginPath();
                        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(255, 255, 0, ${particle.alpha})`;
                        ctx.stroke();
                    }
                }
            });
        }

        // ゴールの輪郭を表示
        if (particle.type === 'goal' && game.goal.active) {
            const dx = particle.x - game.goal.x;
            const dy = particle.y - game.goal.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < particle.radius + 40) {
                ctx.beginPath();
                ctx.arc(game.goal.x, game.goal.y, game.goal.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 0, ${particle.alpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
    });

    // アイテムの描画（余韻効果がある場合のみ表示）
    game.itemGlows.forEach(glow => {
        const item = glow.item;
        if (!item.collected) {
            const pulseSize = Math.sin(glow.pulsePhase) * 3;

            // 外側の光（フェードアウト）
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius + pulseSize + 10, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 0, ${glow.alpha * 0.1})`;
            ctx.fill();

            // メインのアイテム（フェードアウト）
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius + pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 0, ${glow.alpha * 0.3})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 0, ${glow.alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 中心の明るい点（フェードアウト）
            ctx.beginPath();
            ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 0, ${glow.alpha * 0.8})`;
            ctx.fill();
        }
    });

    // ゴールの描画（余韻効果がある場合のみ表示）
    if (game.goal && game.goal.active && game.goalGlow) {
        const time = Date.now() / 1000;
        const pulseSize = Math.sin(game.goalGlow.pulsePhase) * 5;

        // 外側の輪（フェードアウト）
        ctx.beginPath();
        ctx.arc(game.goal.x, game.goal.y, game.goal.radius + pulseSize + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 0, ${game.goalGlow.alpha * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // メインの円（フェードアウト）
        ctx.beginPath();
        ctx.arc(game.goal.x, game.goal.y, game.goal.radius + pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 0, ${game.goalGlow.alpha * 0.2})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 255, 0, ${game.goalGlow.alpha * 0.6})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 中心の明るい点（フェードアウト）
        ctx.beginPath();
        ctx.arc(game.goal.x, game.goal.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 0, ${game.goalGlow.alpha * 0.8})`;
        ctx.fill();
    }

    // エコーの描画
    game.echoes.forEach(echo => {
        const alpha = echo.life / echo.maxLife;
        ctx.beginPath();
        ctx.arc(echo.x, echo.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
        ctx.fill();
    });

    // プレイヤーの描画 - より豪華な効果
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.3 + 0.7;
    
    // Outer glow
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 255, ${0.1 * pulse})`;
    ctx.fill();
    
    // Main player body
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * pulse})`;
    ctx.fill();
    
    // Player ring
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.player.radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // プレイヤーの中心に小さな点
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 255, ${pulse})`;
    ctx.fill();
    
    // Center sparkle
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.fill();
}

// UI更新
function updateUI() {
    const itemCount = document.getElementById('itemCount');
    const timer = document.getElementById('timer');

    if (itemCount) {
        const collected = game.items.filter(i => i.collected).length;
        const total = game.items.length;
        itemCount.textContent = `${collected}/${total}`;

        // 全部集めた時の色変更
        if (collected === total && total > 0) {
            itemCount.style.color = '#0f0';
        } else {
            itemCount.style.color = '#fff';
        }

        // アイテムが5個未満の場合は警告色
        if (total < 5 && total > 0) {
            itemCount.style.color = '#ff0';
        }
    }

    if (timer) {
        const seconds = Math.floor(game.elapsedTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timer.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// ゲームクリア処理
function gameClear() {
    game.cleared = true;

    // クリアサウンド
    if (audioContext) {
        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(masterGain);

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.error('Error playing clear sound:', e);
        }
    }

    // スコア計算
    const baseScore = 1000;
    const timeSeconds = Math.floor(game.elapsedTime / 1000);
    const timePenalty = Math.min(timeSeconds * 2, 500); // 最大500点減点
    const echoPenalty = Math.min(game.echoCount * 10, 300); // 最大300点減点
    const score = Math.max(0, baseScore - timePenalty - echoPenalty);

    // クリア画面表示
    const clearScreen = document.getElementById('clearScreen');
    const clearTime = document.getElementById('clearTime');
    const clearEchoCount = document.getElementById('clearEchoCount');
    const clearScore = document.getElementById('clearScore');

    if (clearScreen) {
        const seconds = Math.floor(game.elapsedTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (clearTime) clearTime.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        if (clearEchoCount) clearEchoCount.textContent = game.echoCount;
        if (clearScore) clearScore.textContent = score;

        clearScreen.style.display = 'flex';
    }
}

// ゲームループ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// モバイルかどうかをチェック
function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches ||
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(hover: none)').matches;
}

// イベントリスナー
// PCでのクリック処理
canvas.addEventListener('click', (e) => {
    if (!game.started) return;

    // モバイルUIが表示されている場合は、キャンバスクリックを無効化
    if (isMobileDevice()) return;

    fireEcho(game.player.x, game.player.y);
});

window.addEventListener('keydown', (e) => {
    game.keys[e.key] = true;
    
    // スペースバーでエコー発射
    if (e.key === ' ' && game.started) {
        e.preventDefault();
        fireEcho(game.player.x, game.player.y);
    }
});

window.addEventListener('keyup', (e) => {
    game.keys[e.key] = false;
});

// モバイルコントロールの初期化
function initializeMobileControls() {
    if (game.mobileControlsInitialized) return;
    game.mobileControlsInitialized = true;

    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystickKnob');

    if (!joystick || !joystickKnob) return;

    function handleJoystickStart(e) {
        if (!game.started) return;
        e.preventDefault();
        game.joystick.active = true;
        const touch = e.touches ? e.touches[0] : e;
        const rect = joystick.getBoundingClientRect();
        game.joystick.startX = rect.left + rect.width / 2;
        game.joystick.startY = rect.top + rect.height / 2;
        handleJoystickMove(e);
    }

    function handleJoystickMove(e) {
        if (!game.joystick.active) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        game.joystick.currentX = touch.clientX;
        game.joystick.currentY = touch.clientY;

        // ジョイスティックノブの位置更新
        const dx = game.joystick.currentX - game.joystick.startX;
        const dy = game.joystick.currentY - game.joystick.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 40;

        if (distance <= maxDistance) {
            joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else {
            const angle = Math.atan2(dy, dx);
            const limitedX = Math.cos(angle) * maxDistance;
            const limitedY = Math.sin(angle) * maxDistance;
            joystickKnob.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
        }
    }

    function handleJoystickEnd(e) {
        e.preventDefault();
        game.joystick.active = false;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
    }

    joystick.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystick.addEventListener('mousedown', handleJoystickStart);
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('mousemove', handleJoystickMove);
    window.addEventListener('touchend', handleJoystickEnd, { passive: false });
    window.addEventListener('mouseup', handleJoystickEnd);

    // ECHOボタン
    const echoButton = document.getElementById('echoButton');
    if (echoButton) {
        echoButton.addEventListener('touchstart', (e) => {
            if (!game.started) return;
            e.preventDefault();
            e.stopPropagation();
            fireEcho(game.player.x, game.player.y);
        }, { passive: false });

        echoButton.addEventListener('click', (e) => {
            if (!game.started) return;
            e.preventDefault();
            e.stopPropagation();
            fireEcho(game.player.x, game.player.y);
        });
    }

    // タッチイベントの重複を防ぐ
    canvas.addEventListener('touchstart', (e) => {
        if (!game.started) return;

        // ジョイスティックやECHOボタンの上でない場合のみ、キャンバスタップでEcho発射
        const touch = e.touches[0];
        const joystickRect = joystick.getBoundingClientRect();
        const echoButtonRect = echoButton ? echoButton.getBoundingClientRect() : null;

        const isOnJoystick = touch.clientX >= joystickRect.left &&
            touch.clientX <= joystickRect.right &&
            touch.clientY >= joystickRect.top &&
            touch.clientY <= joystickRect.bottom;

        const isOnEchoButton = echoButtonRect &&
            touch.clientX >= echoButtonRect.left &&
            touch.clientX <= echoButtonRect.right &&
            touch.clientY >= echoButtonRect.top &&
            touch.clientY <= echoButtonRect.bottom;

        if (!isOnJoystick && !isOnEchoButton) {
            e.preventDefault();
            fireEcho(game.player.x, game.player.y);
        }
    }, { passive: false });
}

// スタートボタンのイベント処理
const startButton = document.getElementById('startButton');
let gameStarted = false;

// タッチイベントとクリックイベントの両方に対応
function startGame() {
    if (gameStarted && !game.cleared) return;
    gameStarted = true;

    // ゲーム状態をリセット
    game.started = true;
    game.cleared = false;
    game.echoCount = 0;
    game.startTime = Date.now();
    game.elapsedTime = 0;
    game.echoes = [];
    game.echoParticles = [];
    game.itemGlows = [];
    game.goalGlow = null;
    game.lastEchoTime = 0;

    const startScreen = document.getElementById('startScreen');
    const clearScreen = document.getElementById('clearScreen');
    const goalMessage = document.getElementById('goalMessage');
    const itemCount = document.getElementById('itemCount');
    if (startScreen) startScreen.style.display = 'none';
    if (clearScreen) clearScreen.style.display = 'none';
    if (goalMessage) goalMessage.style.display = 'none';
    if (itemCount) itemCount.style.color = '#fff';

    // キャンバスサイズを確定してから壁を生成
    resizeCanvas();

    // ランダムなレイアウトを生成
    generateWalls();

    // プレイヤーの初期位置を安全な場所に設定
    setSafePlayerPosition();

    // プレイヤーの位置が決まってからアイテムとゴールを配置
    generateItemsAndGoal();

    // 初回のオーディオコンテキスト開始
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error('Audio context resume failed:', e));
    }

    // モバイルコントロールの初期化
    if (isMobileDevice() && !game.mobileControlsInitialized) {
        setTimeout(() => {
            initializeMobileControls();
        }, 100);
    }

    // 初期UI更新
    updateUI();

    // マップ生成の結果を確認
    if (game.items.length < 5) {
        console.warn(`注意: アイテムが${game.items.length}個しか配置できませんでした。`);
    }
}

if (startButton) {
    startButton.addEventListener('click', startGame);
    startButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        startGame();
    });
}

// リトライボタン
const retryButton = document.getElementById('retryButton');
if (retryButton) {
    retryButton.addEventListener('click', () => {
        gameStarted = false;
        startGame();
    });
    retryButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        gameStarted = false;
        startGame();
    });
}

// エラーハンドリング
window.addEventListener('error', (e) => {
    console.error('Runtime error:', e.error);
});

// ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    if (audioContext) {
        audioContext.close();
    }
});

// ゲーム開始
gameLoop();