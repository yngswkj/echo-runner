// particle-system.js - パーティクルシステム

import { GAME_CONFIG, COLORS } from '../core/constants.js';
import { MathUtils, ColorUtils } from '../core/utils.js';

// 高度なパーティクルクラス
export class AdvancedParticle {
    constructor(x = 0, y = 0, options = {}) {
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
        this.decay = options.decay || GAME_CONFIG.PARTICLES.ADVANCED_DECAY;
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
        // 物理演算
        this.vx += this.ax;
        this.vy += this.ay + this.gravity;
        
        // 軌跡の更新
        if (this.trail.length > 0) {
            this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        // 境界での反発
        if (this.bounce > 0) {
            const canvas = document.getElementById('gameCanvas');
            if (canvas) {
                if (this.x <= this.radius || this.x >= canvas.width - this.radius) {
                    this.vx *= -this.bounce;
                    this.x = MathUtils.clamp(this.x, this.radius, canvas.width - this.radius);
                }
                if (this.y <= this.radius || this.y >= canvas.height - this.radius) {
                    this.vy *= -this.bounce;
                    this.y = MathUtils.clamp(this.y, this.radius, canvas.height - this.radius);
                }
            }
        }
        
        // 回転と拡縮
        this.rotation += this.rotationSpeed;
        this.scale += this.scaleSpeed;
        
        // パルス効果
        if (this.pulsate) {
            const pulseFactor = 1 + Math.sin(Date.now() * this.pulsateSpeed) * this.pulsateAmount;
            this.scale = Math.max(0.1, this.scale * pulseFactor);
        }
        
        // 生存時間とアルファの減衰
        this.life--;
        this.alpha = Math.max(0, this.alpha - this.decay);
        
        return this.life > 0 && this.alpha > 0;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // グロー効果
        if (this.glow) {
            ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
            ctx.shadowBlur = this.radius * 2;
        }
        
        // 軌跡の描画
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.5})`;
            ctx.lineWidth = this.radius * 0.5;
            ctx.stroke();
        }
        
        // パーティクル本体の描画
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        
        this.drawParticle(ctx);
        
        ctx.restore();
    }

    drawParticle(ctx) {
        switch (this.type) {
            case 'circle':
                this.drawCircle(ctx);
                break;
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
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawStar(ctx) {
        const spikes = 5;
        const outerRadius = this.radius;
        const innerRadius = this.radius * 0.5;
        
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
        this.decay = GAME_CONFIG.PARTICLES.ADVANCED_DECAY;
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

// パーティクルプール（オブジェクトプーリング）
export class ParticlePool {
    constructor() {
        this.advancedParticles = [];
        this.echoParticles = [];
        this.maxPoolSize = GAME_CONFIG.PARTICLES.POOL_SIZE;
    }

    getAdvancedParticle() {
        if (this.advancedParticles.length > 0) {
            return this.advancedParticles.pop();
        }
        return new AdvancedParticle();
    }

    getEchoParticle() {
        if (this.echoParticles.length > 0) {
            return this.echoParticles.pop();
        }
        return {
            x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0,
            growthSpeed: 0, color: '', type: '', shimmer: 1
        };
    }

    returnAdvancedParticle(particle) {
        if (this.advancedParticles.length < this.maxPoolSize) {
            particle.reset();
            this.advancedParticles.push(particle);
        }
    }

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
    }

    adjustPoolSize() {
        const activeAdvanced = this.advancedParticles.length;
        const activeEcho = this.echoParticles.length;
        
        if (activeAdvanced > this.maxPoolSize * 0.8) {
            this.maxPoolSize = Math.min(this.maxPoolSize * 1.2, GAME_CONFIG.PARTICLES.MAX_POOL_SIZE);
        } else if (activeAdvanced < this.maxPoolSize * 0.2 && this.maxPoolSize > 50) {
            this.maxPoolSize = Math.max(this.maxPoolSize * 0.8, 50);
        }
    }
}

// パーティクル効果生成ヘルパー
export class ParticleEffects {
    constructor(particlePool) {
        this.particlePool = particlePool;
    }

    explosion(x, y, color = { r: 255, g: 255, b: 0 }, intensity = 1.0, particles = []) {
        const maxParticles = 10;
        const particleCount = Math.min(maxParticles, Math.floor(8 * intensity));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 3 * intensity;
            
            const particle = this.particlePool.getAdvancedParticle();
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
            
            particles.push(particle);
        }
    }

    spiral(x, y, color = { r: 0, g: 255, b: 255 }, intensity = 1.0, particles = []) {
        const maxParticles = 12;
        const particleCount = Math.min(maxParticles, Math.floor(10 * intensity));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 3 * i) / particleCount;
            const radius = i * 1.5;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            
            const particle = this.particlePool.getAdvancedParticle();
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
            
            particles.push(particle);
        }
    }

    meteor(x, y, targetX, targetY, color = { r: 255, g: 200, b: 0 }, particles = []) {
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / distance) * 8;
        const vy = (dy / distance) * 8;
        
        const particle = this.particlePool.getAdvancedParticle();
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
        
        particles.push(particle);
    }

    shockwave(x, y, maxRadius = 100, color = { r: 0, g: 255, b: 255 }, particles = []) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const particle = this.particlePool.getAdvancedParticle();
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
                
                particles.push(particle);
            }, i * 100);
        }
    }
}

// エコーパーティクル管理
export class EchoParticleManager {
    constructor(particlePool) {
        this.particlePool = particlePool;
    }

    createEchoParticle(x, y, collisionData, particles = []) {
        const distanceFromPlayer = Math.sqrt(x * x + y * y); // 簡易距離計算
        const distanceFactor = Math.max(0.3, 1 - distanceFromPlayer / 600);
        
        // 色の設定
        let color = COLORS.WALL;
        let secondaryColor = '100, 200, 255';
        
        if (collisionData.type === 'item') {
            color = COLORS.ITEM;
            secondaryColor = '255, 200, 100';
        } else if (collisionData.type === 'goal') {
            color = COLORS.GOAL;
            secondaryColor = '0, 200, 100';
        }

        // メインパーティクル作成
        const particle = this.particlePool.getEchoParticle();
        particle.x = x;
        particle.y = y;
        particle.radius = 0;
        particle.maxRadius = 40 + Math.random() * 10;
        particle.alpha = 0.6 - Math.random() * 0.05;
        particle.growthSpeed = GAME_CONFIG.PARTICLES.ECHO_GROWTH_SPEED;
        particle.color = color;
        particle.type = collisionData.type;
        particle.shimmer = Math.random() * 0.3 + 0.7;
        
        particles.push(particle);

        // セカンダリスパークルパーティクル
        if ((collisionData.type === 'item' || collisionData.type === 'goal') && distanceFromPlayer < 250) {
            const sparkleCount = Math.min(2, Math.floor(3 * distanceFactor));
            for (let j = 0; j < sparkleCount; j++) {
                const sparkle = this.particlePool.getEchoParticle();
                sparkle.x = x + (Math.random() - 0.5) * 20;
                sparkle.y = y + (Math.random() - 0.5) * 20;
                sparkle.radius = 0;
                sparkle.maxRadius = 15 + j * 5;
                sparkle.alpha = 0.8;
                sparkle.growthSpeed = 1.5;
                sparkle.color = secondaryColor;
                sparkle.type = collisionData.type + '_sparkle';
                sparkle.shimmer = Math.random() * 0.4 + 0.8;
                
                particles.push(sparkle);
            }
        }
    }

    updateEchoParticles(particles, particlePool) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            particle.radius += particle.growthSpeed;
            particle.alpha *= 0.95;
            
            // シマー効果の更新
            if (particle.shimmer) {
                particle.shimmer = 0.6 + Math.sin(Date.now() / 200 + particle.radius) * 0.4;
            }
            
            // パーティクルが非アクティブになったらプールに戻す
            if (particle.radius >= particle.maxRadius || particle.alpha <= 0.01) {
                particlePool.returnEchoParticle(particle);
                particles.splice(i, 1);
            }
        }
    }

    drawEchoParticles(ctx, particles) {
        particles.forEach(particle => {
            const shimmerAlpha = particle.alpha * (particle.shimmer || 1);
            
            // メインリング
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${particle.color}, ${shimmerAlpha})`;
            ctx.lineWidth = particle.type && particle.type.includes('sparkle') ? 1 : 3;
            ctx.stroke();
            
            // インナーグロー効果
            if (particle.type === 'item' || particle.type === 'goal') {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius * 0.7, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${particle.color}, ${shimmerAlpha * 0.3})`;
                ctx.lineWidth = 6;
                ctx.stroke();
            }
        });
    }
}

// シングルトンインスタンス
export const particlePool = new ParticlePool();
export const particleEffects = new ParticleEffects(particlePool);
export const echoParticleManager = new EchoParticleManager(particlePool);