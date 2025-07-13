// canvas-optimizer.js - Canvas2D描画最適化システム

import { COLORS } from '../core/constants.js';

export class Canvas2DOptimizer {
    constructor() {
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.layerCanvases = new Map();
        this.renderQueue = [];
        this.currentFrame = 0;
        this.dirtyRegions = [];
        this.lastRenderTime = 0;
    }

    initialize(width, height) {
        // メインのオフスクリーンキャンバス
        this.offscreenCanvas = new OffscreenCanvas(width, height);
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');

        // レイヤー別キャンバス
        this.createLayerCanvases(width, height);
    }

    createLayerCanvases(width, height) {
        const layers = ['background', 'walls', 'particles', 'effects', 'ui'];
        
        layers.forEach(layer => {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            
            this.layerCanvases.set(layer, {
                canvas: canvas,
                ctx: ctx,
                dirty: false,
                lastUpdate: 0
            });
        });
    }

    // レンダーキューに描画アイテムを追加
    addToRenderQueue(item) {
        this.renderQueue.push({
            ...item,
            frame: this.currentFrame,
            timestamp: performance.now()
        });
    }

    // レイヤー別にアイテムをグループ化
    groupByLayer(renderData) {
        const layers = new Map();
        
        renderData.forEach(item => {
            const layerIndex = item.layer || 'particles';
            if (!layers.has(layerIndex)) {
                layers.set(layerIndex, []);
            }
            layers.get(layerIndex).push(item);
        });

        return layers;
    }

    // 描画状態でグループ化（バッチング）
    groupByDrawState(items) {
        const groups = new Map();
        
        items.forEach(item => {
            const stateKey = this.createStateKey(item);
            
            if (!groups.has(stateKey)) {
                groups.set(stateKey, {
                    state: this.extractDrawState(item),
                    items: []
                });
            }
            
            groups.get(stateKey).items.push(item);
        });
        
        return Array.from(groups.values());
    }

    createStateKey(item) {
        return [
            item.fillStyle || 'none',
            item.strokeStyle || 'none', 
            item.lineWidth || 1,
            item.globalAlpha !== undefined ? item.globalAlpha.toFixed(2) : '1.00',
            item.blendMode || 'source-over'
        ].join('_');
    }

    extractDrawState(item) {
        return {
            fillStyle: item.fillStyle,
            strokeStyle: item.strokeStyle,
            lineWidth: item.lineWidth,
            globalAlpha: item.globalAlpha,
            globalCompositeOperation: item.blendMode || 'source-over'
        };
    }

    // 最適化された描画実行
    optimizedRender(ctx, renderData) {
        const startTime = performance.now();
        
        // レンダーキューをクリア
        this.renderQueue = [];
        
        // レイヤー別に分類
        const layers = this.groupByLayer(renderData);
        
        // 各レイヤーを順番に描画
        const layerOrder = ['background', 'walls', 'particles', 'effects', 'ui'];
        
        layerOrder.forEach(layerName => {
            const layerData = layers.get(layerName);
            if (layerData && layerData.length > 0) {
                this.renderLayer(layerName, layerData);
            }
        });
        
        // 最終合成
        this.compositeAllLayers(ctx);
        
        this.currentFrame++;
        this.lastRenderTime = performance.now() - startTime;
        
        return this.lastRenderTime;
    }

    renderLayer(layerName, items) {
        const layer = this.layerCanvases.get(layerName);
        if (!layer) return;

        const ctx = layer.ctx;
        
        // レイヤーをクリア（背景以外）
        if (layerName !== 'background') {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        // 描画状態でグループ化
        const stateGroups = this.groupByDrawState(items);
        
        stateGroups.forEach(group => {
            ctx.save();
            this.applyDrawState(ctx, group.state);
            
            // 同じ状態のアイテムをバッチ描画
            this.batchDrawItems(ctx, group.items);
            
            ctx.restore();
        });

        layer.dirty = true;
        layer.lastUpdate = this.currentFrame;
    }

    applyDrawState(ctx, state) {
        if (state.fillStyle) ctx.fillStyle = state.fillStyle;
        if (state.strokeStyle) ctx.strokeStyle = state.strokeStyle;
        if (state.lineWidth !== undefined) ctx.lineWidth = state.lineWidth;
        if (state.globalAlpha !== undefined) ctx.globalAlpha = state.globalAlpha;
        if (state.globalCompositeOperation) ctx.globalCompositeOperation = state.globalCompositeOperation;
    }

    batchDrawItems(ctx, items) {
        // アイテムタイプ別に分類
        const itemsByType = new Map();
        
        items.forEach(item => {
            const type = item.type || 'unknown';
            if (!itemsByType.has(type)) {
                itemsByType.set(type, []);
            }
            itemsByType.get(type).push(item);
        });

        // タイプ別にバッチ描画
        itemsByType.forEach((typeItems, type) => {
            switch (type) {
                case 'circle':
                    this.batchDrawCircles(ctx, typeItems);
                    break;
                case 'rectangle':
                    this.batchDrawRectangles(ctx, typeItems);
                    break;
                case 'particle':
                    this.batchDrawParticles(ctx, typeItems);
                    break;
                case 'line':
                    this.batchDrawLines(ctx, typeItems);
                    break;
                default:
                    this.drawIndividualItems(ctx, typeItems);
            }
        });
    }

    batchDrawCircles(ctx, circles) {
        // 同じ半径の円をまとめて描画
        const radiusGroups = new Map();
        
        circles.forEach(circle => {
            const radius = circle.radius || 5;
            if (!radiusGroups.has(radius)) {
                radiusGroups.set(radius, []);
            }
            radiusGroups.get(radius).push(circle);
        });

        radiusGroups.forEach((group, radius) => {
            ctx.beginPath();
            group.forEach(circle => {
                ctx.moveTo(circle.x + radius, circle.y);
                ctx.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
            });
            
            if (group[0].fill !== false) ctx.fill();
            if (group[0].stroke !== false) ctx.stroke();
        });
    }

    batchDrawRectangles(ctx, rectangles) {
        // 塗りつぶしと枠線を分けて処理
        const fillRects = rectangles.filter(r => r.fill !== false);
        const strokeRects = rectangles.filter(r => r.stroke !== false);

        // 塗りつぶしをバッチ処理
        if (fillRects.length > 0) {
            fillRects.forEach(rect => {
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            });
        }

        // 枠線をバッチ処理
        if (strokeRects.length > 0) {
            strokeRects.forEach(rect => {
                ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            });
        }
    }

    batchDrawParticles(ctx, particles) {
        // サイズ別にグループ化
        const sizeGroups = new Map();
        
        particles.forEach(particle => {
            const size = Math.round(particle.size || particle.radius || 2);
            if (!sizeGroups.has(size)) {
                sizeGroups.set(size, []);
            }
            sizeGroups.get(size).push(particle);
        });

        sizeGroups.forEach((group, size) => {
            if (size <= 1) {
                // 小さいパーティクルはピクセル単位で描画
                this.drawParticlesAsPixels(ctx, group);
            } else {
                // 通常のパーティクルは円として描画
                this.batchDrawCircles(ctx, group.map(p => ({
                    x: p.x,
                    y: p.y,
                    radius: size,
                    fill: true,
                    stroke: false
                })));
            }
        });
    }

    drawParticlesAsPixels(ctx, particles) {
        const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
        const data = imageData.data;

        particles.forEach(particle => {
            const x = Math.floor(particle.x);
            const y = Math.floor(particle.y);
            
            if (x >= 0 && x < ctx.canvas.width && y >= 0 && y < ctx.canvas.height) {
                const index = (y * ctx.canvas.width + x) * 4;
                
                const alpha = particle.alpha || 1.0;
                const color = particle.color || { r: 255, g: 255, b: 255 };
                
                // アルファブレンディング
                const invAlpha = 1 - alpha;
                data[index] = data[index] * invAlpha + color.r * alpha;
                data[index + 1] = data[index + 1] * invAlpha + color.g * alpha;
                data[index + 2] = data[index + 2] * invAlpha + color.b * alpha;
                data[index + 3] = Math.min(255, data[index + 3] + alpha * 255);
            }
        });

        ctx.putImageData(imageData, 0, 0);
    }

    batchDrawLines(ctx, lines) {
        if (lines.length === 0) return;

        ctx.beginPath();
        lines.forEach((line, index) => {
            if (index === 0) {
                ctx.moveTo(line.x1, line.y1);
            }
            ctx.lineTo(line.x2, line.y2);
            if (line.close) {
                ctx.closePath();
            }
        });
        ctx.stroke();
    }

    drawIndividualItems(ctx, items) {
        items.forEach(item => {
            this.drawSingleItem(ctx, item);
        });
    }

    drawSingleItem(ctx, item) {
        switch (item.type) {
            case 'path':
                this.drawPath(ctx, item);
                break;
            case 'text':
                this.drawText(ctx, item);
                break;
            case 'image':
                this.drawImage(ctx, item);
                break;
            default:
                console.warn('Unknown item type:', item.type);
        }
    }

    drawPath(ctx, item) {
        if (!item.path || !Array.isArray(item.path)) return;

        ctx.beginPath();
        item.path.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        if (item.close) ctx.closePath();
        if (item.fill !== false) ctx.fill();
        if (item.stroke !== false) ctx.stroke();
    }

    drawText(ctx, item) {
        if (item.font) ctx.font = item.font;
        if (item.textAlign) ctx.textAlign = item.textAlign;
        if (item.textBaseline) ctx.textBaseline = item.textBaseline;

        if (item.fill !== false) {
            ctx.fillText(item.text, item.x, item.y);
        }
        if (item.stroke === true) {
            ctx.strokeText(item.text, item.x, item.y);
        }
    }

    drawImage(ctx, item) {
        if (item.sx !== undefined) {
            // ソース矩形指定
            ctx.drawImage(
                item.image,
                item.sx, item.sy, item.sWidth, item.sHeight,
                item.x, item.y, item.width, item.height
            );
        } else {
            // 通常の描画
            ctx.drawImage(item.image, item.x, item.y, item.width, item.height);
        }
    }

    // 全レイヤーを最終キャンバスに合成
    compositeAllLayers(targetCtx) {
        const layerOrder = ['background', 'walls', 'particles', 'effects', 'ui'];
        
        // メインキャンバスをクリア
        targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
        
        layerOrder.forEach(layerName => {
            const layer = this.layerCanvases.get(layerName);
            if (layer && layer.dirty) {
                targetCtx.drawImage(layer.canvas, 0, 0);
                layer.dirty = false;
            }
        });
    }

    // パフォーマンス統計取得
    getPerformanceStats() {
        return {
            lastRenderTime: this.lastRenderTime,
            currentFrame: this.currentFrame,
            layerCount: this.layerCanvases.size,
            queueSize: this.renderQueue.length,
            averageRenderTime: this.calculateAverageRenderTime()
        };
    }

    calculateAverageRenderTime() {
        // 実装はシンプルに、実際は履歴を保持
        return this.lastRenderTime;
    }

    // メモリ使用量の最適化
    cleanup() {
        this.renderQueue = [];
        
        // レイヤーキャンバスをクリア
        this.layerCanvases.forEach(layer => {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            layer.dirty = false;
        });
    }

    // リサイズ処理
    resize(width, height) {
        // オフスクリーンキャンバスをリサイズ
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;

        // レイヤーキャンバスもリサイズ
        this.layerCanvases.forEach(layer => {
            layer.canvas.width = width;
            layer.canvas.height = height;
            layer.dirty = true;
        });
    }
}

// 使用例とヘルパー関数
export class RenderDataBuilder {
    constructor() {
        this.items = [];
    }

    addCircle(x, y, radius, options = {}) {
        this.items.push({
            type: 'circle',
            x, y, radius,
            layer: options.layer || 'particles',
            fillStyle: options.fillStyle,
            strokeStyle: options.strokeStyle,
            lineWidth: options.lineWidth,
            globalAlpha: options.alpha,
            fill: options.fill !== false,
            stroke: options.stroke === true
        });
        return this;
    }

    addRectangle(x, y, width, height, options = {}) {
        this.items.push({
            type: 'rectangle',
            x, y, width, height,
            layer: options.layer || 'effects',
            fillStyle: options.fillStyle,
            strokeStyle: options.strokeStyle,
            lineWidth: options.lineWidth,
            globalAlpha: options.alpha,
            fill: options.fill !== false,
            stroke: options.stroke === true
        });
        return this;
    }

    addParticle(x, y, size, color, alpha = 1.0, options = {}) {
        this.items.push({
            type: 'particle',
            x, y, size,
            color: color,
            alpha: alpha,
            layer: options.layer || 'particles'
        });
        return this;
    }

    addLine(x1, y1, x2, y2, options = {}) {
        this.items.push({
            type: 'line',
            x1, y1, x2, y2,
            layer: options.layer || 'effects',
            strokeStyle: options.strokeStyle,
            lineWidth: options.lineWidth,
            globalAlpha: options.alpha
        });
        return this;
    }

    addText(text, x, y, options = {}) {
        this.items.push({
            type: 'text',
            text, x, y,
            layer: options.layer || 'ui',
            fillStyle: options.fillStyle,
            strokeStyle: options.strokeStyle,
            font: options.font,
            textAlign: options.textAlign,
            textBaseline: options.textBaseline,
            fill: options.fill !== false,
            stroke: options.stroke === true
        });
        return this;
    }

    build() {
        return this.items;
    }

    clear() {
        this.items = [];
        return this;
    }
}