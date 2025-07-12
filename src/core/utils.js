// utils.js - 共通ユーティリティ関数

export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static angle(from, to) {
        return Math.atan2(to.y - from.y, to.x - from.x);
    }

    static normalize(vector) {
        const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (magnitude === 0) return { x: 0, y: 0 };
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    }
}

export const MathUtils = {
    // 線形補間
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    // 値を範囲内にクランプ
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // 度からラジアンに変換
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    },

    // ラジアンから度に変換
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    },

    // ランダムな範囲の値を取得
    randomRange(min, max) {
        return Math.random() * (max - min) + min;
    },

    // ランダムな整数を取得
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 2つの矩形の衝突判定
    rectCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    // 円と矩形の衝突判定
    circleRectCollision(circle, rect) {
        const distX = Math.abs(circle.x - rect.x - rect.width / 2);
        const distY = Math.abs(circle.y - rect.y - rect.height / 2);

        if (distX > (rect.width / 2 + circle.radius)) return false;
        if (distY > (rect.height / 2 + circle.radius)) return false;

        if (distX <= (rect.width / 2)) return true;
        if (distY <= (rect.height / 2)) return true;

        const dx = distX - rect.width / 2;
        const dy = distY - rect.height / 2;
        return (dx * dx + dy * dy <= (circle.radius * circle.radius));
    }
};

export const DeviceUtils = {
    // モバイルデバイス判定
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
               window.matchMedia('(hover: none)').matches;
    },

    // タッチデバイス判定
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // 振動サポート判定
    supportsVibration() {
        return 'vibrate' in navigator;
    }
};

export const TimeUtils = {
    // ミリ秒を "分:秒" 形式に変換
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    // デルタタイムを計算
    calculateDeltaTime(lastTime, currentTime) {
        return Math.min(currentTime - lastTime, 16.67); // 60FPS cap
    }
};

export const DOMUtils = {
    // 要素の安全な取得
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    },

    // CSSクラスの安全な操作
    toggleClass(element, className, condition) {
        if (!element) return;
        
        if (condition !== undefined) {
            element.classList.toggle(className, condition);
        } else {
            element.classList.toggle(className);
        }
    },

    // 要素の表示/非表示
    setDisplay(element, visible) {
        if (!element) return;
        element.style.display = visible ? 'flex' : 'none';
    },

    // テキストの安全な設定
    setText(element, text) {
        if (!element) return;
        element.textContent = text;
    }
};

export const ColorUtils = {
    // RGB文字列をオブジェクトに変換
    parseRGB(rgbString) {
        const values = rgbString.split(',').map(v => parseInt(v.trim()));
        return { r: values[0] || 0, g: values[1] || 0, b: values[2] || 0 };
    },

    // RGBオブジェクトを文字列に変換
    rgbToString(rgb) {
        return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    },

    // RGBA文字列を生成
    rgba(rgb, alpha = 1) {
        if (typeof rgb === 'string') {
            return `rgba(${rgb}, ${alpha})`;
        }
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
};

// デバッグ用ユーティリティ
export const DebugUtils = {
    // パフォーマンス測定
    performance: {
        timers: new Map(),
        
        start(label) {
            this.timers.set(label, performance.now());
        },
        
        end(label) {
            const start = this.timers.get(label);
            if (start !== undefined) {
                const duration = performance.now() - start;
                console.log(`${label}: ${duration.toFixed(2)}ms`);
                this.timers.delete(label);
                return duration;
            }
            return 0;
        }
    },

    // メモリ使用量の確認
    logMemoryUsage() {
        if (performance.memory) {
            console.log('Memory Usage:', {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
            });
        }
    }
};