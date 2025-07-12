// map-generator.js - マップ生成システム

import { GAME_CONFIG } from '../core/constants.js';
import { MathUtils } from '../core/utils.js';

export class MapGenerator {
    constructor() {
        this.wallThickness = GAME_CONFIG.GAME.WALL_THICKNESS;
        this.itemCount = GAME_CONFIG.GAME.ITEM_COUNT;
    }

    // メインのマップ生成関数
    generateMap(layoutType, canvasWidth, canvasHeight) {
        const walls = [];
        
        switch (layoutType) {
            case GAME_CONFIG.LAYOUT_TYPES.SCATTERED:
                this.generateScatteredLayout(walls, canvasWidth, canvasHeight);
                break;
            case GAME_CONFIG.LAYOUT_TYPES.MAZE:
                this.generateMazeLayout(walls, canvasWidth, canvasHeight);
                break;
            case GAME_CONFIG.LAYOUT_TYPES.ROOM_BASED:
                this.generateRoomBasedLayout(walls, canvasWidth, canvasHeight);
                break;
            default:
                this.generateScatteredLayout(walls, canvasWidth, canvasHeight);
        }

        return walls;
    }

    // 散在型レイアウト
    generateScatteredLayout(walls, canvasWidth, canvasHeight) {
        const wallCount = MathUtils.randomInt(8, 15);
        const minWallSize = 40;
        const maxWallSize = 120;
        const margin = 100;

        // 外周の壁
        this.addBorderWalls(walls, canvasWidth, canvasHeight);

        // ランダムな内部の壁
        for (let i = 0; i < wallCount; i++) {
            const width = MathUtils.randomRange(minWallSize, maxWallSize);
            const height = MathUtils.randomRange(minWallSize, maxWallSize);
            
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                x = MathUtils.randomRange(margin, canvasWidth - width - margin);
                y = MathUtils.randomRange(margin, canvasHeight - height - margin);
                attempts++;
            } while (attempts < maxAttempts && this.isOverlapping(x, y, width, height, walls));

            if (attempts < maxAttempts) {
                walls.push({ x, y, width, height });
            }
        }
    }

    // 迷路型レイアウト
    generateMazeLayout(walls, canvasWidth, canvasHeight) {
        const cellSize = 60;
        const cols = Math.floor(canvasWidth / cellSize);
        const rows = Math.floor(canvasHeight / cellSize);
        
        // グリッドベースの迷路生成
        const maze = this.generateMazeGrid(cols, rows);
        
        // 外周の壁
        this.addBorderWalls(walls, canvasWidth, canvasHeight);

        // 迷路の壁をゲーム座標に変換
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (maze[row] && maze[row][col] === 1) {
                    walls.push({
                        x: col * cellSize,
                        y: row * cellSize,
                        width: cellSize,
                        height: cellSize
                    });
                }
            }
        }
    }

    // 部屋型レイアウト
    generateRoomBasedLayout(walls, canvasWidth, canvasHeight) {
        const roomCount = MathUtils.randomInt(3, 6);
        const minRoomSize = 80;
        const maxRoomSize = 150;
        const corridorWidth = 40;

        // 外周の壁
        this.addBorderWalls(walls, canvasWidth, canvasHeight);

        const rooms = [];

        // 部屋の生成
        for (let i = 0; i < roomCount; i++) {
            const roomWidth = MathUtils.randomRange(minRoomSize, maxRoomSize);
            const roomHeight = MathUtils.randomRange(minRoomSize, maxRoomSize);
            
            let roomX, roomY;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                roomX = MathUtils.randomRange(50, canvasWidth - roomWidth - 50);
                roomY = MathUtils.randomRange(50, canvasHeight - roomHeight - 50);
                attempts++;
            } while (attempts < maxAttempts && this.isRoomOverlapping(roomX, roomY, roomWidth, roomHeight, rooms, corridorWidth));

            if (attempts < maxAttempts) {
                rooms.push({ x: roomX, y: roomY, width: roomWidth, height: roomHeight });
                this.addRoomWalls(walls, roomX, roomY, roomWidth, roomHeight);
            }
        }

        // 部屋を接続する通路の生成
        this.connectRooms(walls, rooms, corridorWidth, canvasWidth, canvasHeight);
    }

    // 部屋の壁を追加
    addRoomWalls(walls, x, y, width, height) {
        const thickness = this.wallThickness;
        
        // 上の壁
        walls.push({ x: x - thickness, y: y - thickness, width: width + thickness * 2, height: thickness });
        // 下の壁
        walls.push({ x: x - thickness, y: y + height, width: width + thickness * 2, height: thickness });
        // 左の壁
        walls.push({ x: x - thickness, y: y, width: thickness, height: height });
        // 右の壁
        walls.push({ x: x + width, y: y, width: thickness, height: height });
    }

    // 部屋を接続
    connectRooms(walls, rooms, corridorWidth, canvasWidth, canvasHeight) {
        for (let i = 0; i < rooms.length - 1; i++) {
            const roomA = rooms[i];
            const roomB = rooms[i + 1];
            
            this.createCorridor(walls, roomA, roomB, corridorWidth);
        }

        // 最初と最後の部屋も接続してループを作る
        if (rooms.length > 2) {
            this.createCorridor(walls, rooms[rooms.length - 1], rooms[0], corridorWidth);
        }
    }

    // 通路の作成
    createCorridor(walls, roomA, roomB, corridorWidth) {
        const centerAX = roomA.x + roomA.width / 2;
        const centerAY = roomA.y + roomA.height / 2;
        const centerBX = roomB.x + roomB.width / 2;
        const centerBY = roomB.y + roomB.height / 2;

        // L字型の通路を作成
        const thickness = this.wallThickness;
        const halfWidth = corridorWidth / 2;

        // 水平方向の通路
        const horizontalY = centerAY - halfWidth;
        const horizontalX = Math.min(centerAX, centerBX);
        const horizontalWidth = Math.abs(centerBX - centerAX);

        // 垂直方向の通路
        const verticalX = centerBX - halfWidth;
        const verticalY = Math.min(centerAY, centerBY);
        const verticalHeight = Math.abs(centerBY - centerAY);

        // 通路部分の壁を削除（実際には壁を分割して通路部分を避ける）
        this.removeWallsInArea(walls, horizontalX, horizontalY, horizontalWidth, corridorWidth);
        this.removeWallsInArea(walls, verticalX, verticalY, corridorWidth, verticalHeight);
    }

    // 指定領域の壁を削除
    removeWallsInArea(walls, areaX, areaY, areaWidth, areaHeight) {
        for (let i = walls.length - 1; i >= 0; i--) {
            const wall = walls[i];
            if (MathUtils.rectCollision(
                { x: areaX, y: areaY, width: areaWidth, height: areaHeight },
                wall
            )) {
                walls.splice(i, 1);
            }
        }
    }

    // 迷路グリッドの生成（再帰的バックトラッキング）
    generateMazeGrid(cols, rows) {
        const maze = Array(rows).fill().map(() => Array(cols).fill(1));
        const stack = [];
        const startCol = 1;
        const startRow = 1;

        maze[startRow][startCol] = 0;
        stack.push({ col: startCol, row: startRow });

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(maze, current.col, current.row, cols, rows);

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // 現在のセルと次のセルの間の壁を除去
                const wallCol = current.col + (next.col - current.col) / 2;
                const wallRow = current.row + (next.row - current.row) / 2;
                maze[wallRow][wallCol] = 0;
                maze[next.row][next.col] = 0;
                
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        return maze;
    }

    // 未訪問の隣接セルを取得
    getUnvisitedNeighbors(maze, col, row, cols, rows) {
        const neighbors = [];
        const directions = [
            { col: 0, row: -2 }, // 上
            { col: 2, row: 0 },  // 右
            { col: 0, row: 2 },  // 下
            { col: -2, row: 0 }  // 左
        ];

        directions.forEach(dir => {
            const newCol = col + dir.col;
            const newRow = row + dir.row;

            if (newCol >= 1 && newCol < cols - 1 && 
                newRow >= 1 && newRow < rows - 1 && 
                maze[newRow][newCol] === 1) {
                neighbors.push({ col: newCol, row: newRow });
            }
        });

        return neighbors;
    }

    // 外周の壁を追加
    addBorderWalls(walls, canvasWidth, canvasHeight) {
        const thickness = this.wallThickness;
        
        // 上の壁
        walls.push({ x: 0, y: 0, width: canvasWidth, height: thickness });
        // 下の壁
        walls.push({ x: 0, y: canvasHeight - thickness, width: canvasWidth, height: thickness });
        // 左の壁
        walls.push({ x: 0, y: 0, width: thickness, height: canvasHeight });
        // 右の壁
        walls.push({ x: canvasWidth - thickness, y: 0, width: thickness, height: canvasHeight });
    }

    // 重複チェック
    isOverlapping(x, y, width, height, existingWalls) {
        const margin = 20;
        const checkRect = {
            x: x - margin,
            y: y - margin,
            width: width + margin * 2,
            height: height + margin * 2
        };

        return existingWalls.some(wall => MathUtils.rectCollision(checkRect, wall));
    }

    // 部屋の重複チェック
    isRoomOverlapping(x, y, width, height, existingRooms, margin) {
        const checkRect = {
            x: x - margin,
            y: y - margin,
            width: width + margin * 2,
            height: height + margin * 2
        };

        return existingRooms.some(room => MathUtils.rectCollision(checkRect, room));
    }

    // アイテムとゴールの配置
    generateItemsAndGoal(walls, canvasWidth, canvasHeight, playerX, playerY) {
        const items = [];
        const minDistanceFromPlayer = 100;
        const minDistanceBetweenItems = 60;
        const maxAttempts = 100;

        // アイテムの配置
        for (let i = 0; i < this.itemCount; i++) {
            let attempts = 0;
            let placed = false;

            while (attempts < maxAttempts && !placed) {
                const x = MathUtils.randomRange(50, canvasWidth - 50);
                const y = MathUtils.randomRange(50, canvasHeight - 50);

                if (this.isValidItemPosition(x, y, walls, items, playerX, playerY, minDistanceFromPlayer, minDistanceBetweenItems)) {
                    items.push({
                        x: x,
                        y: y,
                        radius: 6,
                        collected: false,
                        pulsePhase: Math.random() * Math.PI * 2
                    });
                    placed = true;
                }
                attempts++;
            }
        }

        // ゴールの配置
        let goal = null;
        let attempts = 0;
        while (attempts < maxAttempts && !goal) {
            const x = MathUtils.randomRange(80, canvasWidth - 80);
            const y = MathUtils.randomRange(80, canvasHeight - 80);

            if (this.isValidGoalPosition(x, y, walls, items, playerX, playerY, 150)) {
                goal = {
                    x: x,
                    y: y,
                    radius: 15,
                    active: false,
                    pulsePhase: 0
                };
            }
            attempts++;
        }

        return { items, goal };
    }

    // アイテム位置の有効性チェック
    isValidItemPosition(x, y, walls, existingItems, playerX, playerY, minPlayerDist, minItemDist) {
        // プレイヤーとの距離チェック
        const playerDistance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
        if (playerDistance < minPlayerDist) return false;

        // 他のアイテムとの距離チェック
        for (const item of existingItems) {
            const itemDistance = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
            if (itemDistance < minItemDist) return false;
        }

        // 壁との衝突チェック
        const itemRect = { x: x - 10, y: y - 10, width: 20, height: 20 };
        return !walls.some(wall => MathUtils.rectCollision(itemRect, wall));
    }

    // ゴール位置の有効性チェック
    isValidGoalPosition(x, y, walls, items, playerX, playerY, minDistance) {
        // プレイヤーとの距離チェック
        const playerDistance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
        if (playerDistance < minDistance) return false;

        // アイテムとの距離チェック
        for (const item of items) {
            const itemDistance = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
            if (itemDistance < 80) return false;
        }

        // 壁との衝突チェック
        const goalRect = { x: x - 20, y: y - 20, width: 40, height: 40 };
        return !walls.some(wall => MathUtils.rectCollision(goalRect, wall));
    }

    // 安全なプレイヤー位置を取得
    getSafePlayerPosition(walls, canvasWidth, canvasHeight) {
        const maxAttempts = 100;
        const playerRadius = GAME_CONFIG.PLAYER.RADIUS;
        const margin = 50;

        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const x = MathUtils.randomRange(margin, canvasWidth - margin);
            const y = MathUtils.randomRange(margin, canvasHeight - margin);

            const playerCircle = { x, y, radius: playerRadius };
            const collides = walls.some(wall => MathUtils.circleRectCollision(playerCircle, wall));

            if (!collides) {
                return { x, y };
            }
        }

        // フォールバック位置（中央）
        return { x: canvasWidth / 2, y: canvasHeight / 2 };
    }
}

// シングルトンインスタンス
export const mapGenerator = new MapGenerator();