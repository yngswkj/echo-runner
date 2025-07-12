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
    advancedParticles: [], // 高度なパーティクル
    walls: [],
    items: [],
    itemGlows: [], // アイテムの余韻効果
    goal: null,
    goalGlow: null, // ゴールの余韻効果
    layoutType: 0, // レイアウトタイプ（0:散在型、1:迷路型、2:部屋型）
    echoCooldown: 0,
    echoCooldownMax: 800, // 0.8秒に短縮
    lastEchoTime: 0,
    echoCount: 0, // エコー使用回数
    echoEnergy: 100, // エコーエネルギー（最大100）
    echoEnergyMax: 100,
    echoEnergyRegenRate: 15, // 1秒あたりのエネルギー回復量
    startTime: 0,
    elapsedTime: 0,
    keys: {},
    started: false,
    cleared: false,
    mobileControlsInitialized: false,
    // 触覚フィードバック設定
    haptics: {
        enabled: true,
        intensity: 1.0,
        lastVibration: 0,
        minInterval: 100 // 最小振動間隔（ms）
    },
    // トランジション効果
    transitions: {
        fadeAlpha: 1.0,
        isTransitioning: false,
        transitionType: 'none' // 'fadeIn', 'fadeOut', 'none'
    },
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

// オーディオノードプール（パフォーマンス最適化）
const audioNodePool = {
    oscillators: [],
    gainNodes: [],
    filterNodes: [],
    delayNodes: [],
    maxPoolSize: 20,
    
    // オシレーターを取得
    getOscillator() {
        if (this.oscillators.length > 0) {
            return this.oscillators.pop();
        }
        return audioContext ? audioContext.createOscillator() : null;
    },
    
    // ゲインノードを取得
    getGainNode() {
        if (this.gainNodes.length > 0) {
            const node = this.gainNodes.pop();
            // リセット
            node.gain.value = 1.0;
            node.disconnect();
            return node;
        }
        return audioContext ? audioContext.createGain() : null;
    },
    
    // フィルターノードを取得
    getFilterNode() {
        if (this.filterNodes.length > 0) {
            const node = this.filterNodes.pop();
            // リセット
            node.frequency.value = 1000;
            node.Q.value = 1;
            node.type = 'lowpass';
            node.disconnect();
            return node;
        }
        return audioContext ? audioContext.createBiquadFilter() : null;
    },
    
    // ディレイノードを取得
    getDelayNode() {
        if (this.delayNodes.length > 0) {
            const node = this.delayNodes.pop();
            // リセット
            node.delayTime.value = 0;
            node.disconnect();
            return node;
        }
        return audioContext ? audioContext.createDelay() : null;
    },
    
    // ノードをプールに戻す
    returnGainNode(node) {
        if (this.gainNodes.length < this.maxPoolSize) {
            node.disconnect();
            this.gainNodes.push(node);
        }
    },
    
    returnFilterNode(node) {
        if (this.filterNodes.length < this.maxPoolSize) {
            node.disconnect();
            this.filterNodes.push(node);
        }
    },
    
    returnDelayNode(node) {
        if (this.delayNodes.length < this.maxPoolSize) {
            node.disconnect();
            this.delayNodes.push(node);
        }
    }
};

// パーティクルプール（パフォーマンス最適化）
const particlePool = {
    advancedParticles: [],
    echoParticles: [],
    maxPoolSize: 100,
    
    // AdvancedParticleを取得
    getAdvancedParticle() {
        if (this.advancedParticles.length > 0) {
            return this.advancedParticles.pop();
        }
        return new AdvancedParticle();
    },
    
    // EchoParticleを取得
    getEchoParticle() {
        if (this.echoParticles.length > 0) {
            return this.echoParticles.pop();
        }
        return {
            x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0,
            growthSpeed: 0, color: '', type: '', shimmer: 1
        };
    },
    
    // AdvancedParticleをプールに戻す
    returnAdvancedParticle(particle) {
        if (this.advancedParticles.length < this.maxPoolSize) {
            particle.reset();
            this.advancedParticles.push(particle);
        }
    },
    
    // EchoParticleをプールに戻す
    returnEchoParticle(particle) {
        if (this.echoParticles.length < this.maxPoolSize) {
            particle.x = 0;
            particle.y = 0;
            particle.radius = 0;
            particle.maxRadius = 0;
            particle.alpha = 0;
            particle.growthSpeed = 0;
            particle.color = '';
            particle.type = '';
            particle.shimmer = 1;
            this.echoParticles.push(particle);
        }
    },
    
    // プールサイズを調整
    adjustPoolSize() {
        const activeAdvanced = game.advancedParticles.length;
        const activeEcho = game.echoParticles.length;
        
        if (activeAdvanced > this.maxPoolSize * 0.8) {
            this.maxPoolSize = Math.min(this.maxPoolSize * 1.2, 200);
        } else if (activeAdvanced < this.maxPoolSize * 0.2 && this.maxPoolSize > 50) {
            this.maxPoolSize = Math.max(this.maxPoolSize * 0.8, 50);
        }
    }
};

// パフォーマンス監視（強化版）
const performanceMonitor = {
    lastEchoTime: 0,
    echoCount: 0,
    maxEchoesPerSecond: 30, // 最大エコー数/秒を削減
    currentlyPlaying: 0, // 現在再生中の音響数
    maxConcurrentSounds: 8, // 最大同時再生数
    lastCloseWallEcho: 0, // 近距離壁エコーの最終時刻
    closeWallCooldown: 100, // 近距離壁エコーのクールダウン（ms）
    
    canCreateEcho() {
        const now = Date.now();
        if (now - this.lastEchoTime > 1000) {
            this.echoCount = 0;
            this.lastEchoTime = now;
        }
        
        if (this.echoCount >= this.maxEchoesPerSecond) {
            return false;
        }
        
        if (this.currentlyPlaying >= this.maxConcurrentSounds) {
            return false;
        }
        
        this.echoCount++;
        this.currentlyPlaying++;
        return true;
    },
    
    canCreateCloseWallEcho() {
        const now = Date.now();
        if (now - this.lastCloseWallEcho < this.closeWallCooldown) {
            return false;
        }
        this.lastCloseWallEcho = now;
        return true;
    },
    
    soundFinished() {
        this.currentlyPlaying = Math.max(0, this.currentlyPlaying - 1);
    }
};

// マスターコンプレッサー（音割れ防止）
let masterCompressor;

try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // コンプレッサーを作成（音割れを防ぐ）
    masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-24, audioContext.currentTime);
    masterCompressor.knee.setValueAtTime(30, audioContext.currentTime);
    masterCompressor.ratio.setValueAtTime(12, audioContext.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, audioContext.currentTime);
    masterCompressor.release.setValueAtTime(0.25, audioContext.currentTime);
    
    // マスターゲインノードを作成して音量を制御
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.25; // 全体音量をさらに下げる
    
    // 接続: masterGain → masterCompressor → destination
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);
} catch (e) {
    console.error('Web Audio API is not supported in this browser');
}

// 触覚フィードバックシステム
const hapticFeedback = {
    // 振動パターンの定義
    patterns: {
        wallHit: [50], // 壁に当たった時
        itemCollect: [30, 20, 30], // アイテム収集時
        goalReach: [100, 50, 100, 50, 100], // ゴール到達時
        echoFire: [20], // エコー発射時
        echoHit: [15], // エコー反響時
        subtle: [10] // 微妙な振動
    },

    // 振動を実行
    vibrate(pattern, intensity = 1.0) {
        if (!game.haptics.enabled || !navigator.vibrate) return;
        
        const now = Date.now();
        if (now - game.haptics.lastVibration < game.haptics.minInterval) return;
        
        game.haptics.lastVibration = now;
        
        // 強度を適用
        const adjustedPattern = Array.isArray(pattern) 
            ? pattern.map(duration => Math.round(duration * intensity * game.haptics.intensity))
            : [Math.round(pattern * intensity * game.haptics.intensity)];
        
        try {
            navigator.vibrate(adjustedPattern);
        } catch (e) {
            console.warn('Vibration not supported:', e);
        }
    },

    // 距離に基づく振動強度
    distanceBasedVibration(distance, maxDistance = 200, basePattern = [30]) {
        const intensity = Math.max(0.1, 1 - (distance / maxDistance));
        this.vibrate(basePattern, intensity);
    },

    // 衝突の強さに基づく振動
    collisionVibration(velocity) {
        const intensity = Math.min(1.0, Math.abs(velocity) / 5);
        this.vibrate(this.patterns.wallHit, intensity);
    }
};

// 高度なパーティクルシステム
class AdvancedParticle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.ax = options.ax || 0;
        this.ay = options.ay || 0;
        this.radius = options.radius || 2;
        this.life = options.life || 60;
        this.maxLife = this.life;
        this.color = options.color || { r: 0, g: 255, b: 255 };
        this.alpha = options.alpha || 1.0;
        this.decay = options.decay || 0.02;
        this.type = options.type || 'default';
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.scale = options.scale || 1.0;
        this.scaleSpeed = options.scaleSpeed || 0;
        this.trail = options.trail || [];
        this.maxTrailLength = options.maxTrailLength || 5;
        this.gravity = options.gravity || 0;
        this.bounce = options.bounce || 0;
        this.glow = options.glow || false;
        this.pulsate = options.pulsate || false;
        this.pulsateSpeed = options.pulsateSpeed || 0.1;
        this.pulsateAmount = options.pulsateAmount || 0.3;
    }

    update() {
        // 軌跡の更新
        if (this.trail.length > 0) {
            this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }

        // 物理演算
        this.vx += this.ax;
        this.vy += this.ay + this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        // 境界での反射
        if (this.bounce > 0) {
            if (this.x <= 0 || this.x >= canvas.width) {
                this.vx *= -this.bounce;
                this.x = Math.max(0, Math.min(canvas.width, this.x));
            }
            if (this.y <= 0 || this.y >= canvas.height) {
                this.vy *= -this.bounce;
                this.y = Math.max(0, Math.min(canvas.height, this.y));
            }
        }

        // 回転と拡縮
        this.rotation += this.rotationSpeed;
        this.scale += this.scaleSpeed;

        // パルス効果
        if (this.pulsate) {
            const pulseFactor = 1 + Math.sin(Date.now() * this.pulsateSpeed) * this.pulsateAmount;
            this.radius = this.radius * pulseFactor;
        }

        // 生存時間とアルファの減衰
        this.life--;
        this.alpha -= this.decay;
        
        return this.life > 0 && this.alpha > 0;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.alpha;

        // グロー効果
        if (this.glow) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        }

        // 軌跡の描画
        if (this.trail.length > 1) {
            ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.3})`;
            ctx.lineWidth = this.radius * 0.5;
            ctx.beginPath();
            this.trail.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x - this.x, point.y - this.y);
                } else {
                    ctx.lineTo(point.x - this.x, point.y - this.y);
                }
            });
            ctx.stroke();
        }

        // パーティクル本体の描画
        this.drawParticle(ctx);

        ctx.restore();
    }

    drawParticle(ctx) {
        switch (this.type) {
            case 'spark':
                this.drawSpark(ctx);
                break;
            case 'star':
                this.drawStar(ctx);
                break;
            case 'ring':
                this.drawRing(ctx);
                break;
            case 'diamond':
                this.drawDiamond(ctx);
                break;
            default:
                this.drawCircle(ctx);
        }
    }

    drawCircle(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.fill();
    }

    drawSpark(ctx) {
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.stroke();
    }

    drawStar(ctx) {
        const spikes = 5;
        const outerRadius = this.radius;
        const innerRadius = outerRadius * 0.4;
        
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.fill();
    }

    drawRing(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawDiamond(ctx) {
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.fill();
    }

    // オブジェクトプーリング用のリセットメソッド
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.radius = 2;
        this.life = 60;
        this.maxLife = this.life;
        this.color = { r: 0, g: 255, b: 255 };
        this.alpha = 1.0;
        this.decay = 0.02;
        this.type = 'default';
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.scale = 1.0;
        this.scaleSpeed = 0;
        this.trail = [];
        this.maxTrailLength = 5;
        this.gravity = 0;
        this.bounce = 0;
        this.glow = false;
        this.pulsate = false;
        this.pulsateSpeed = 0.1;
        this.pulsateAmount = 0.3;
    }
}

// パーティクル生成ヘルパー（最適化版）
const particleEffects = {
    // 爆発効果（最適化）
    explosion(x, y, color = { r: 255, g: 255, b: 0 }, intensity = 1.0) {
        // パーティクル数を制限
        const maxParticles = 10;
        const particleCount = Math.min(maxParticles, Math.floor(8 * intensity));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 3 * intensity;
            
            const particle = particlePool.getAdvancedParticle();
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.radius = 2 + Math.random() * 2;
            particle.life = 25 + Math.random() * 20;
            particle.maxLife = particle.life;
            particle.color = color;
            particle.decay = 0.04;
            particle.type = 'spark';
            particle.glow = true;
            
            game.advancedParticles.push(particle);
        }
    },

    // 螺旋効果（最適化）
    spiral(x, y, color = { r: 0, g: 255, b: 255 }, intensity = 1.0) {
        // パーティクル数を大幅に削減
        const maxParticles = 12;
        const particleCount = Math.min(maxParticles, Math.floor(10 * intensity));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 3 * i) / particleCount; // 螺旋の巻数を減らす
            const radius = i * 1.5;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            
            const particle = particlePool.getAdvancedParticle();
            particle.x = px;
            particle.y = py;
            particle.vx = Math.cos(angle + Math.PI / 2) * 0.8;
            particle.vy = Math.sin(angle + Math.PI / 2) * 0.8;
            particle.radius = 2;
            particle.life = 45;
            particle.maxLife = particle.life;
            particle.color = color;
            particle.decay = 0.025;
            particle.type = 'ring';
            particle.rotationSpeed = 0.1;
            particle.glow = true;
            
            game.advancedParticles.push(particle);
        }
    },

    // 流星効果
    meteor(x, y, targetX, targetY, color = { r: 255, g: 200, b: 0 }) {
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / distance) * 8;
        const vy = (dy / distance) * 8;
        
        const particle = particlePool.getAdvancedParticle();
        particle.x = x;
        particle.y = y;
        particle.vx = vx;
        particle.vy = vy;
        particle.radius = 4;
        particle.life = 80;
        particle.maxLife = particle.life;
        particle.color = color;
        particle.decay = 0.015;
        particle.type = 'diamond';
        particle.trail = [];
        particle.maxTrailLength = 8;
        particle.glow = true;
        particle.pulsate = true;
        particle.pulsateSpeed = 0.2;
        
        game.advancedParticles.push(particle);
    },

    // 拡散波
    shockwave(x, y, maxRadius = 100, color = { r: 0, g: 255, b: 255 }) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const particle = particlePool.getAdvancedParticle();
                particle.x = x;
                particle.y = y;
                particle.radius = 5;
                particle.life = 60;
                particle.maxLife = particle.life;
                particle.color = color;
                particle.decay = 0.02;
                particle.type = 'ring';
                particle.scaleSpeed = maxRadius / 60;
                particle.alpha = 0.8 - i * 0.2;
                
                game.advancedParticles.push(particle);
            }, i * 100);
        }
    }
};

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
    const timeSinceLastEcho = now - game.lastEchoTime;
    
    // エネルギーシステム：エコーごとに20エネルギー消費
    const energyCost = 20;
    
    // クールダウンとエネルギーの両方をチェック
    if (timeSinceLastEcho < game.echoCooldownMax) return;
    if (game.echoEnergy < energyCost) return;
    
    // エネルギーを消費
    game.echoEnergy -= energyCost;
    game.lastEchoTime = now;
    game.echoCount++; // エコー使用回数をカウント
    
    // 音響の周波数をエネルギーレベルに応じて調整
    const energyRatio = game.echoEnergy / game.echoEnergyMax;
    const frequency = 800 + (energyRatio * 400); // 800-1200Hz
    playEchoSound(frequency, 0.05);

    // 触覚フィードバック
    hapticFeedback.vibrate(hapticFeedback.patterns.echoFire);

    // 高度なパーティクル効果 - エコー発射時の拡散波
    particleEffects.shockwave(x, y, 60, { r: 0, g: 200, b: 255 });

    // エコー発射時の螺旋効果
    particleEffects.spiral(x, y, { r: 100, g: 255, b: 255 }, 0.6);

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

    // 近距離壁の特別処理
    const isCloseWall = collisionData.type === 'wall' && distance < 80;
    
    if (isCloseWall) {
        // 近距離壁エコーの制限チェック
        if (!performanceMonitor.canCreateCloseWallEcho()) {
            return; // 近距離壁エコーのクールダウン中
        }
    } else {
        // 通常のパフォーマンス制限チェック
        if (!performanceMonitor.canCreateEcho()) {
            return; // エコー数制限に達した場合はスキップ
        }
    }

    // 距離ベースの音量計算（近距離では音量を大幅に削減）
    let baseVolume;
    if (distance < 50) {
        baseVolume = 0.1; // 非常に近い場合は最小音量
    } else if (distance < 150) {
        baseVolume = 0.2 + (distance - 50) / 100 * 0.3; // 段階的に音量増加
    } else {
        baseVolume = Math.max(0.1, 1 - distance / 500); // 通常の計算
    }

    const volume = Math.min(0.5, baseVolume); // 最大音量を制限

    // 距離が遠すぎる場合は音を再生しない
    if (distance > 600 || volume < 0.08) {
        performanceMonitor.soundFinished(); // カウンターを戻す
        return;
    }

    if (audioContext) {
        try {
            // オーディオノードプールから取得
            const gainNode = audioNodePool.getGainNode();
            const oscillator1 = audioNodePool.getOscillator();
            const oscillator2 = audioNodePool.getOscillator();
            const filterNode = audioNodePool.getFilterNode();
            const delayNode = audioNodePool.getDelayNode();
            const feedbackGain = audioNodePool.getGainNode();

            if (!gainNode || !oscillator1 || !oscillator2 || !filterNode || !delayNode || !feedbackGain) {
                console.warn('Audio node pool exhausted');
                return;
            }

            // Configure based on collision type and distance
            let frequency = 600;
            let filterFreq = 1000;
            let delayTime = 0.1;
            let soundDuration = 0.3;
            
            if (collisionData.type === 'item') {
                frequency = 1200 + Math.random() * 400; // アイテムは高い音でランダム性
                filterFreq = 2000;
                delayTime = 0.05;
                soundDuration = 0.25;
                oscillator1.type = 'triangle';
                oscillator2.type = 'sine';
            } else if (collisionData.type === 'goal') {
                frequency = 300 + Math.random() * 200; // ゴールは低い音でランダム性
                filterFreq = 800;
                delayTime = 0.15;
                soundDuration = 0.35;
                oscillator1.type = 'sawtooth';
                oscillator2.type = 'triangle';
            } else {
                // 壁の音響設定（距離に基づく調整）
                if (isCloseWall) {
                    // 近距離壁: より短く、ソフトな音
                    frequency = 500 + Math.random() * 200; // 周波数を下げる
                    filterFreq = 800; // フィルターを強くかける
                    delayTime = 0.05; // ディレイを短くする
                    soundDuration = 0.15; // 音の長さを短くする
                    oscillator1.type = 'sine';
                    oscillator2.type = 'triangle'; // よりソフトな波形
                } else {
                    frequency = 600 + (distance / 3) + Math.random() * 50; // ランダム性を減らす
                    filterFreq = 1000;
                    delayTime = 0.1;
                    soundDuration = 0.25;
                    oscillator1.type = 'sine';
                    oscillator2.type = 'square';
                }
            }

            // Configure filter
            filterNode.type = 'lowpass';
            filterNode.frequency.value = filterFreq;
            filterNode.Q.value = 3;

            // Configure delay
            delayNode.delayTime.value = delayTime;
            feedbackGain.gain.value = 0.2; // Reduced feedback to prevent distortion

            // Connect nodes - マスターゲインを通すように修正
            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(filterNode);
            filterNode.connect(delayNode);
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            filterNode.connect(masterGain); // マスターゲインを通す
            delayNode.connect(masterGain); // マスターゲインを通す

            // Configure oscillators
            oscillator1.frequency.value = frequency;
            oscillator2.frequency.value = frequency * 0.75;

            // Dynamic envelope - 距離と音量を考慮した調整
            const startVolume = volume * (isCloseWall ? 0.05 : 0.1); // 近距離壁はさらに音量削減
            const endVolume = 0.005;
            
            gainNode.gain.setValueAtTime(startVolume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(endVolume, audioContext.currentTime + soundDuration);

            // Frequency modulation - 近距離では控えめに
            const freqModAmount = isCloseWall ? 0.95 : 0.8;
            oscillator1.frequency.exponentialRampToValueAtTime(frequency * freqModAmount, audioContext.currentTime + soundDuration);

            oscillator1.start(audioContext.currentTime);
            oscillator2.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + soundDuration);
            oscillator2.stop(audioContext.currentTime + soundDuration);

            // クリーンアップを遅延実行
            setTimeout(() => {
                try {
                    // ノードをプールに返却
                    audioNodePool.returnGainNode(gainNode);
                    audioNodePool.returnFilterNode(filterNode);
                    audioNodePool.returnDelayNode(delayNode);
                    audioNodePool.returnGainNode(feedbackGain);
                    // パフォーマンス監視を更新
                    performanceMonitor.soundFinished();
                } catch (cleanupError) {
                    console.warn('Audio cleanup error:', cleanupError);
                    performanceMonitor.soundFinished(); // エラーでもカウンターを戻す
                }
            }, Math.max(400, soundDuration * 1000 + 100)); // 音の長さに応じてクリーンアップ

        } catch (e) {
            console.error('Error creating echo particle sound:', e);
        }
    }

    // 触覚フィードバック
    if (collisionData.type === 'wall') {
        const distance = Math.sqrt(
            Math.pow(game.player.x - x, 2) +
            Math.pow(game.player.y - y, 2)
        );
        hapticFeedback.distanceBasedVibration(distance, 300, hapticFeedback.patterns.echoHit);
    } else if (collisionData.type === 'item') {
        hapticFeedback.vibrate(hapticFeedback.patterns.subtle, 0.7);
    } else if (collisionData.type === 'goal') {
        hapticFeedback.vibrate(hapticFeedback.patterns.subtle, 1.0);
    }

    // 高度なパーティクル効果（パフォーマンス最適化版）
    if (collisionData.type === 'item') {
        particleEffects.explosion(x, y, { r: 255, g: 255, b: 0 }, 0.8);
        // 星型パーティクルを追加（数を減らして最適化）
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 * i) / 3;
            const distance = 20 + Math.random() * 15;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            
            game.advancedParticles.push(new AdvancedParticle(px, py, {
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                radius: 4,
                life: 40,
                color: { r: 255, g: 255, b: 0 },
                decay: 0.025,
                type: 'star',
                rotationSpeed: 0.2,
                glow: true
            }));
        }
    } else if (collisionData.type === 'goal') {
        particleEffects.explosion(x, y, { r: 0, g: 255, b: 0 }, 1.2);
        particleEffects.spiral(x, y, { r: 0, g: 255, b: 100 }, 1.0);
    } else if (collisionData.type === 'wall') {
        // 壁反射効果を軽量化（距離に基づく制限）
        const wallDistance = Math.sqrt(
            Math.pow(game.player.x - x, 2) +
            Math.pow(game.player.y - y, 2)
        );
        
        // 近くの壁のみパーティクル生成（近距離壁はさらに制限）
        if (wallDistance < 300 && !isCloseWall) {
            // 壁の材質に応じた効果（簡略化）
            const wallMaterial = Math.random();
            let particleColor = { r: 0, g: 255, b: 255 };
            let particleType = 'spark';
            
            if (wallMaterial < 0.33) {
                // 金属の壁
                particleColor = { r: 200, g: 200, b: 255 };
                particleType = 'spark';
            } else if (wallMaterial < 0.66) {
                // 石の壁
                particleColor = { r: 150, g: 150, b: 150 };
                particleType = 'diamond';
            } else {
                // 通常の壁
                particleColor = { r: 0, g: 255, b: 255 };
                particleType = 'ring';
            }
            
            // 壁反射の火花効果（数を制限）
            const particleCount = wallDistance < 150 ? 2 : 1;
            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 1.5;
                
                game.advancedParticles.push(new AdvancedParticle(x, y, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: 1.5,
                    life: 12,
                    color: particleColor,
                    decay: 0.1,
                    type: particleType,
                    gravity: 0.02,
                    bounce: 0.1
                }));
            }
        } else if (isCloseWall) {
            // 近距離壁: 最小限のパーティクル効果のみ
            game.advancedParticles.push(new AdvancedParticle(x, y, {
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: 1,
                life: 8,
                color: { r: 100, g: 200, b: 255 },
                decay: 0.15,
                type: 'spark'
            }));
        }
    }

    // 視覚エフェクト - 最適化されたパーティクル
    // 距離に基づいてパーティクル数を調整（近距離壁は特別処理）
    let baseParticleCount;
    if (collisionData.type === 'wall' && isCloseWall) {
        baseParticleCount = 3; // 近距離壁は大幅削減
    } else if (collisionData.type === 'wall') {
        baseParticleCount = 5;
    } else {
        baseParticleCount = 8;
    }
    
    const distanceFromPlayer = Math.sqrt(
        Math.pow(game.player.x - x, 2) +
        Math.pow(game.player.y - y, 2)
    );
    const distanceFactor = Math.max(0.2, 1 - distanceFromPlayer / 400);
    const particleCount = Math.floor(baseParticleCount * distanceFactor);
    
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

        // Main particles (オブジェクトプール対応)
        const particle = particlePool.getEchoParticle();
        particle.x = x;
        particle.y = y;
        particle.radius = 0;
        particle.maxRadius = 40 + i * 10; // 最大半径を小さくして軽量化
        particle.alpha = 0.6 - i * 0.05;
        particle.growthSpeed = 2.5;
        particle.color = color;
        particle.type = collisionData.type;
        particle.shimmer = Math.random() * 0.3 + 0.7;
        
        game.echoParticles.push(particle);

        // Secondary sparkle particles（条件を厳しくして数を制限）
        if ((collisionData.type === 'item' || collisionData.type === 'goal') && distanceFromPlayer < 250) {
            const sparkleCount = Math.min(2, Math.floor(3 * distanceFactor));
            for (let j = 0; j < sparkleCount; j++) {
                const sparkle = particlePool.getEchoParticle();
                sparkle.x = x + (Math.random() - 0.5) * 20;
                sparkle.y = y + (Math.random() - 0.5) * 20;
                sparkle.radius = 0;
                sparkle.maxRadius = 15 + j * 5;
                sparkle.alpha = 0.8;
                sparkle.growthSpeed = 1.5;
                sparkle.color = secondaryColor;
                sparkle.type = collisionData.type + '_sparkle';
                sparkle.shimmer = Math.random() * 0.4 + 0.8;
                
                game.echoParticles.push(sparkle);
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
        // 壁衝突時の触覚フィードバック
        const collisionVelocity = Math.abs(game.player.actualVx);
        hapticFeedback.collisionVibration(collisionVelocity);
        
        // 壁衝突パーティクル
        if (collisionVelocity > 1) {
            for (let i = 0; i < 3; i++) {
                game.advancedParticles.push(new AdvancedParticle(newX, game.player.y, {
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    radius: 2,
                    life: 15,
                    color: { r: 255, g: 100, b: 100 },
                    decay: 0.08,
                    type: 'spark'
                }));
            }
        }
    }
    if (!checkPlayerWallCollision(game.player.x, newY)) {
        game.player.y = newY;
    } else {
        game.player.actualVy = 0; // 壁に当たったら慣性をリセット
        // 壁衝突時の触覚フィードバック
        const collisionVelocity = Math.abs(game.player.actualVy);
        hapticFeedback.collisionVibration(collisionVelocity);
        
        // 壁衝突パーティクル
        if (collisionVelocity > 1) {
            for (let i = 0; i < 3; i++) {
                game.advancedParticles.push(new AdvancedParticle(game.player.x, newY, {
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    radius: 2,
                    life: 15,
                    color: { r: 255, g: 100, b: 100 },
                    decay: 0.08,
                    type: 'spark'
                }));
            }
        }
    }

    // アイテムとの衝突判定
    for (const item of game.items) {
        if (!item.collected) {
            const dx = game.player.x - item.x;
            const dy = game.player.y - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= game.player.radius + item.radius) {
                item.collected = true;

                // 触覚フィードバック - アイテム収集
                hapticFeedback.vibrate(hapticFeedback.patterns.itemCollect);

                // 豪華なパーティクル効果
                particleEffects.explosion(item.x, item.y, { r: 255, g: 255, b: 0 }, 1.5);
                particleEffects.spiral(item.x, item.y, { r: 255, g: 200, b: 0 }, 1.0);

                // 流星効果でプレイヤーに向かう（最適化）
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI * 2 * i) / 4;
                    const startX = item.x + Math.cos(angle) * 25;
                    const startY = item.y + Math.sin(angle) * 25;
                    
                    setTimeout(() => {
                        particleEffects.meteor(startX, startY, game.player.x, game.player.y, { r: 255, g: 255, b: 100 });
                    }, i * 75);
                }

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
            // ゴール到達時の触覚フィードバック
            hapticFeedback.vibrate(hapticFeedback.patterns.goalReach);
            
            // 豪華なゴール効果
            particleEffects.explosion(game.goal.x, game.goal.y, { r: 0, g: 255, b: 0 }, 2.0);
            particleEffects.shockwave(game.goal.x, game.goal.y, 200, { r: 0, g: 255, b: 0 });
            
            // 勝利の花火
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    const angle = (Math.PI * 2 * i) / 12;
                    const x = game.goal.x + Math.cos(angle) * 50;
                    const y = game.goal.y + Math.sin(angle) * 50;
                    particleEffects.explosion(x, y, { 
                        r: Math.floor(Math.random() * 256), 
                        g: Math.floor(Math.random() * 256), 
                        b: Math.floor(Math.random() * 256) 
                    }, 1.0);
                }, i * 100);
            }
            
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

    // エコーパーティクルの更新（オブジェクトプール対応）
    for (let i = game.echoParticles.length - 1; i >= 0; i--) {
        const particle = game.echoParticles[i];
        particle.radius += particle.growthSpeed;
        particle.alpha *= 0.95;
        
        // シマー効果の更新
        if (particle.shimmer) {
            particle.shimmer = 0.6 + Math.sin(Date.now() / 200 + particle.radius) * 0.4;
        }
        
        // パーティクルが非アクティブになったらプールに戻す
        if (particle.radius >= particle.maxRadius || particle.alpha <= 0.01) {
            particlePool.returnEchoParticle(particle);
            game.echoParticles.splice(i, 1);
        }
    }

    // 高度なパーティクルの更新（オブジェクトプール対応）
    for (let i = game.advancedParticles.length - 1; i >= 0; i--) {
        const particle = game.advancedParticles[i];
        if (!particle.update()) {
            particlePool.returnAdvancedParticle(particle);
            game.advancedParticles.splice(i, 1);
        }
    }

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

    // エネルギーシステムの更新
    const now = Date.now();
    const deltaTime = now - (game.lastUpdateTime || now);
    game.lastUpdateTime = now;
    
    // エネルギーの自動回復
    if (game.echoEnergy < game.echoEnergyMax) {
        game.echoEnergy += (game.echoEnergyRegenRate * deltaTime) / 1000;
        game.echoEnergy = Math.min(game.echoEnergy, game.echoEnergyMax);
    }
    
    // クールダウンの更新
    const cooldownProgress = Math.min(1, (now - game.lastEchoTime) / game.echoCooldownMax);
    const energyProgress = game.echoEnergy / game.echoEnergyMax;
    const canEcho = cooldownProgress >= 1 && game.echoEnergy >= 20;
    
    const cooldownBar = document.getElementById('echoCooldownBar');
    const echoStatus = document.getElementById('echoStatus');
    const echoButton = document.getElementById('echoButton');

    // エネルギーバーの表示（エネルギーレベルに応じて色を変更）
    if (cooldownBar) {
        const displayProgress = Math.min(energyProgress, cooldownProgress);
        cooldownBar.style.width = (displayProgress * 100) + '%';
        
        // エネルギーレベルに応じて色を変更
        if (energyProgress < 0.3) {
            cooldownBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        } else if (energyProgress < 0.7) {
            cooldownBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else {
            cooldownBar.style.background = 'linear-gradient(90deg, #00ffff, #0080ff, #0040ff)';
        }
    }
    
    if (echoStatus) {
        if (canEcho) {
            echoStatus.textContent = 'Ready';
        } else if (cooldownProgress < 1) {
            echoStatus.textContent = 'Cooling...';
        } else if (game.echoEnergy < 20) {
            echoStatus.textContent = 'Low Energy';
        } else {
            echoStatus.textContent = 'Ready';
        }
    }

    if (echoButton) {
        if (canEcho) {
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

    // 高度なパーティクルの描画
    game.advancedParticles.forEach(particle => {
        particle.draw(ctx);
    });

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

    // トランジション効果の描画
    drawTransitionEffects();
}

// トランジション効果システム
const transitionEffects = {
    // フェードイン開始
    fadeIn(duration = 1000) {
        game.transitions.isTransitioning = true;
        game.transitions.transitionType = 'fadeIn';
        game.transitions.fadeAlpha = 1.0;
        
        const startTime = Date.now();
        const fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            game.transitions.fadeAlpha = 1 - progress;
            
            if (progress >= 1) {
                game.transitions.isTransitioning = false;
                game.transitions.transitionType = 'none';
                game.transitions.fadeAlpha = 0;
                clearInterval(fadeInterval);
            }
        }, 16);
    },

    // フェードアウト開始
    fadeOut(duration = 1000, callback = null) {
        game.transitions.isTransitioning = true;
        game.transitions.transitionType = 'fadeOut';
        game.transitions.fadeAlpha = 0;
        
        const startTime = Date.now();
        const fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            game.transitions.fadeAlpha = progress;
            
            if (progress >= 1) {
                game.transitions.isTransitioning = false;
                game.transitions.transitionType = 'none';
                game.transitions.fadeAlpha = 1.0;
                clearInterval(fadeInterval);
                if (callback) callback();
            }
        }, 16);
    },

    // スライドイン効果
    slideIn(direction = 'down', duration = 800) {
        game.transitions.isTransitioning = true;
        game.transitions.transitionType = 'slideIn';
        game.transitions.slideOffset = direction === 'down' ? -canvas.height : canvas.height;
        
        const startTime = Date.now();
        const slideInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOut cubic
            
            if (direction === 'down') {
                game.transitions.slideOffset = -canvas.height * (1 - easeProgress);
            } else {
                game.transitions.slideOffset = canvas.height * (1 - easeProgress);
            }
            
            if (progress >= 1) {
                game.transitions.isTransitioning = false;
                game.transitions.transitionType = 'none';
                game.transitions.slideOffset = 0;
                clearInterval(slideInterval);
            }
        }, 16);
    }
};

// トランジション効果の描画
function drawTransitionEffects() {
    if (!game.transitions.isTransitioning && game.transitions.fadeAlpha <= 0) return;

    ctx.save();

    switch (game.transitions.transitionType) {
        case 'fadeIn':
        case 'fadeOut':
            // フェード効果
            ctx.fillStyle = `rgba(0, 0, 0, ${game.transitions.fadeAlpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;

        case 'slideIn':
            // スライド効果
            ctx.translate(0, game.transitions.slideOffset);
            break;
    }

    // グラデーション効果
    if (game.transitions.isTransitioning && game.transitions.transitionType === 'fadeIn') {
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        gradient.addColorStop(0, `rgba(0, 100, 150, ${game.transitions.fadeAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${game.transitions.fadeAlpha})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
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

    // 統計記録
    recordClearStats();

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
    game.advancedParticles = [];
    game.itemGlows = [];
    game.goalGlow = null;
    game.lastEchoTime = 0;
    game.echoEnergy = game.echoEnergyMax; // エネルギーをフル回復
    game.lastUpdateTime = Date.now();

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

    // ゲーム開始時のフェードイン効果
    transitionEffects.fadeIn(1500);
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

// 統計管理システム
const statsManager = {
    // デフォルト統計データ
    defaultStats: {
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
    },

    // 統計データの読み込み
    loadStats() {
        try {
            const saved = localStorage.getItem('echoRunner_stats');
            if (saved) {
                const stats = JSON.parse(saved);
                // 新しいフィールドがある場合はマージ
                return { ...this.defaultStats, ...stats };
            }
        } catch (e) {
            console.error('統計データの読み込みエラー:', e);
        }
        return { ...this.defaultStats };
    },

    // 統計データの保存
    saveStats(stats) {
        try {
            localStorage.setItem('echoRunner_stats', JSON.stringify(stats));
        } catch (e) {
            console.error('統計データの保存エラー:', e);
        }
    },

    // ゲーム開始時の記録
    recordGameStart() {
        const stats = this.loadStats();
        stats.totalGames++;
        stats.lastPlayDate = new Date().toISOString();
        this.saveStats(stats);
        return stats;
    },

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
    },

    // ゲーム失敗時の記録
    recordGameFail() {
        const stats = this.loadStats();
        stats.currentStreak = 0;
        this.saveStats(stats);
        return stats;
    },

    // プレイ時間の記録
    recordPlayTime(playTime) {
        const stats = this.loadStats();
        stats.totalPlayTime += playTime;
        this.saveStats(stats);
        return stats;
    },

    // 実績チェック
    checkAchievements(stats, gameData) {
        const { elapsedTime, echoCount } = gameData;
        
        // 初回クリア
        if (stats.totalClears === 1) {
            stats.achievements.firstClear = true;
        }
        
        // スピードランナー (60秒以内)
        if (elapsedTime <= 60000) {
            stats.achievements.speedRunner = true;
        }
        
        // エコーマスター (10回以内)
        if (echoCount <= 10) {
            stats.achievements.echoMaster = true;
        }
        
        // 連続クリア (3回連続)
        if (stats.currentStreak >= 3) {
            stats.achievements.streakRunner = true;
        }
    },

    // 統計データのリセット
    resetStats() {
        this.saveStats({ ...this.defaultStats });
    },

    // 統計表示の更新
    updateStatsDisplay() {
        const stats = this.loadStats();
        
        // 基本統計
        const totalPlayTimeElement = document.getElementById('totalPlayTime');
        const totalGamesElement = document.getElementById('totalGames');
        const totalClearsElement = document.getElementById('totalClears');
        const clearRateElement = document.getElementById('clearRate');
        
        if (totalPlayTimeElement) {
            const minutes = Math.floor(stats.totalPlayTime / 60000);
            totalPlayTimeElement.textContent = `${minutes}分`;
        }
        
        if (totalGamesElement) {
            totalGamesElement.textContent = `${stats.totalGames}回`;
        }
        
        if (totalClearsElement) {
            totalClearsElement.textContent = `${stats.totalClears}回`;
        }
        
        if (clearRateElement) {
            const rate = stats.totalGames > 0 ? Math.round((stats.totalClears / stats.totalGames) * 100) : 0;
            clearRateElement.textContent = `${rate}%`;
        }
        
        // ベストスコア
        const bestScoreElement = document.getElementById('bestScore');
        const bestTimeElement = document.getElementById('bestTime');
        const bestEchoElement = document.getElementById('bestEcho');
        const avgScoreElement = document.getElementById('avgScore');
        
        if (bestScoreElement) {
            bestScoreElement.textContent = `${stats.bestScore}点`;
        }
        
        if (bestTimeElement) {
            if (stats.bestTime > 0) {
                const seconds = Math.floor(stats.bestTime / 1000);
                bestTimeElement.textContent = `${seconds}秒`;
            } else {
                bestTimeElement.textContent = '-';
            }
        }
        
        if (bestEchoElement) {
            if (stats.bestEchoCount > 0) {
                bestEchoElement.textContent = `${stats.bestEchoCount}回`;
            } else {
                bestEchoElement.textContent = '-';
            }
        }
        
        if (avgScoreElement) {
            const avgScore = stats.totalClears > 0 ? Math.round(stats.totalScore / stats.totalClears) : 0;
            avgScoreElement.textContent = `${avgScore}点`;
        }
        
        // 実績
        this.updateAchievementDisplay(stats.achievements);
    },

    // 実績表示の更新
    updateAchievementDisplay(achievements) {
        const achievementElements = {
            firstClear: document.getElementById('achievement-firstClear'),
            speedRunner: document.getElementById('achievement-speedRunner'),
            echoMaster: document.getElementById('achievement-echoMaster'),
            streakRunner: document.getElementById('achievement-streakRunner')
        };
        
        Object.keys(achievements).forEach(key => {
            const element = achievementElements[key];
            if (element) {
                if (achievements[key]) {
                    element.textContent = '達成';
                    element.classList.add('achieved');
                } else {
                    element.textContent = '未達成';
                    element.classList.remove('achieved');
                }
            }
        });
    }
};

// 統計画面の制御
function showStatsScreen() {
    const statsScreen = document.getElementById('statsScreen');
    const startScreen = document.getElementById('startScreen');
    
    if (statsScreen && startScreen) {
        statsManager.updateStatsDisplay();
        startScreen.style.display = 'none';
        statsScreen.style.display = 'flex';
    }
}

function hideStatsScreen() {
    const statsScreen = document.getElementById('statsScreen');
    const startScreen = document.getElementById('startScreen');
    
    if (statsScreen && startScreen) {
        statsScreen.style.display = 'none';
        startScreen.style.display = 'flex';
    }
}

// 統計画面のイベントリスナー
const statsButton = document.getElementById('statsButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const resetStatsButton = document.getElementById('resetStatsButton');

if (statsButton) {
    statsButton.addEventListener('click', showStatsScreen);
}

if (backToMenuButton) {
    backToMenuButton.addEventListener('click', hideStatsScreen);
}

if (resetStatsButton) {
    resetStatsButton.addEventListener('click', () => {
        if (confirm('統計データをすべてリセットしますか？この操作は取り消せません。')) {
            statsManager.resetStats();
            statsManager.updateStatsDisplay();
        }
    });
}

// ゲームイベントと統計の連携
const originalStartGame = startGame;
startGame = function() {
    statsManager.recordGameStart();
    originalStartGame.call(this);
};

// クリア時の統計記録を既存のクリア処理に統合
function recordClearStats() {
    const gameData = {
        elapsedTime: game.elapsedTime,
        echoCount: game.echoCount,
        score: Math.max(0, 1000 - Math.min(Math.floor(game.elapsedTime / 1000) * 2, 500) - Math.min(game.echoCount * 10, 300))
    };
    
    statsManager.recordGameClear(gameData);
}

// ゲーム開始
gameLoop();