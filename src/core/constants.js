// constants.js - ゲーム定数定義

export const GAME_CONFIG = {
    // キャンバス設定
    CANVAS: {
        DEFAULT_WIDTH: 800,
        DEFAULT_HEIGHT: 600
    },

    // プレイヤー設定
    PLAYER: {
        RADIUS: 8,
        SPEED: 3,
        FRICTION: 0.85,
        ACCELERATION: 0.4
    },

    // エコーシステム設定
    ECHO: {
        COOLDOWN_MAX: 800, // 0.8秒
        ENERGY_MAX: 100,
        ENERGY_COST: 20,
        ENERGY_REGEN_RATE: 15, // 1秒あたり
        COUNT: 36, // エコー方向数
        SPEED: 5,
        LIFE: 100
    },

    // 音響設定
    AUDIO: {
        FREQUENCIES: {
            ECHO_MIN: 800,
            ECHO_MAX: 1200,
            ITEM_MIN: 1200,
            ITEM_MAX: 1600,
            GOAL_MIN: 300,
            GOAL_MAX: 500,
            WALL_MIN: 500,
            WALL_MAX: 650
        },
        MASTER_VOLUME: 0.7,
        MAX_CONCURRENT_SOUNDS: 8,
        MAX_ECHOES_PER_SECOND: 30
    },

    // パーティクル設定
    PARTICLES: {
        POOL_SIZE: 100,
        MAX_POOL_SIZE: 200,
        ECHO_GROWTH_SPEED: 2.5,
        ADVANCED_DECAY: 0.02
    },

    // ゲーム設定
    GAME: {
        ITEM_COUNT: 5,
        WALL_THICKNESS: 10,
        BASE_SCORE: 1000,
        TIME_PENALTY_RATE: 2,
        ECHO_PENALTY_RATE: 10,
        MAX_TIME_PENALTY: 500,
        MAX_ECHO_PENALTY: 300
    },

    // 触覚フィードバック設定
    HAPTICS: {
        INTENSITY: 1.0,
        MIN_INTERVAL: 100, // ms
        PATTERNS: {
            ECHO_FIRE: [50],
            WALL_HIT: [100],
            ITEM_COLLECT: [30, 20, 30],
            GOAL_REACH: [200, 100, 200, 100, 200]
        }
    },

    // レイアウトタイプ
    LAYOUT_TYPES: {
        SCATTERED: 0,
        MAZE: 1,
        ROOM_BASED: 2
    }
};

export const COLORS = {
    ECHO: '0, 255, 255',
    ITEM: '255, 255, 0',
    GOAL: '0, 255, 0',
    WALL: '255, 255, 255',
    PLAYER: '255, 255, 255',
    UI_PRIMARY: '#00ffff',
    UI_SECONDARY: '#ffffff',
    ENERGY_LOW: '#ff4444',
    ENERGY_MEDIUM: '#ffaa00',
    ENERGY_HIGH: '#00ffff'
};

export const DOM_IDS = {
    CANVAS: 'gameCanvas',
    CONTAINER: 'gameContainer',
    START_SCREEN: 'startScreen',
    CLEAR_SCREEN: 'clearScreen',
    STATS_SCREEN: 'statsScreen',
    ECHO_STATUS: 'echoStatus',
    ECHO_COOLDOWN_BAR: 'echoCooldownBar',
    ECHO_BUTTON: 'echoButton',
    JOYSTICK: 'joystick',
    JOYSTICK_KNOB: 'joystickKnob'
};