/* ============================================
   CS2 战术板 - 核心应用数据与配置
   ============================================ */

// 现役竞技地图池 (2026 Season 5 Active Duty)
const MAPS = [
  { id: 'dust2', name: 'Dust II', difficulty: '入门', popularity: 95, theme: 'desert' },
  { id: 'mirage', name: 'Mirage', difficulty: '中等', popularity: 92, theme: 'morocco' },
  { id: 'inferno', name: 'Inferno', difficulty: '中等', popularity: 88, theme: 'italian' },
  { id: 'nuke', name: 'Nuke', difficulty: '困难', popularity: 75, theme: 'industrial' },
  { id: 'ancient', name: 'Ancient', difficulty: '困难', popularity: 70, theme: 'jungle' },
  { id: 'anubis', name: 'Anubis', difficulty: '中等', popularity: 72, theme: 'egyptian' },
  { id: 'cache', name: 'Cache', difficulty: '中等', popularity: 85, theme: 'industrial' }
];

// 道具配置（符合真实比赛数量限制）
// 每玩家最多携带4个道具，闪光弹最多2个，其余各最多1个
const GRENADES = {
  smoke: { name: '烟雾弹', icon: 'cloud', color: 'var(--cs2-smoke)', maxPerPlayer: 1, maxTeam: 5 },
  he: { name: '高爆手雷', icon: 'bomb', color: 'var(--cs2-he)', maxPerPlayer: 1, maxTeam: 5 },
  flash: { name: '闪光弹', icon: 'zap', color: 'var(--cs2-flash)', maxPerPlayer: 2, maxTeam: 5 },
  molotov: { name: '燃烧弹', icon: 'flame', color: 'var(--cs2-molotov)', maxPerPlayer: 1, maxTeam: 5 },
  decoy: { name: '诱饵弹', icon: 'radio', color: 'var(--cs2-decoy)', maxPerPlayer: 1, maxTeam: 5 },
  zeus: { name: '电击枪', icon: 'zap', color: 'var(--cs2-zeus)', maxPerPlayer: 1, maxTeam: 1 }
};

const MAX_GRENADES_PER_PLAYER = 4;

// 烟雾弹爆开覆盖半径（占地图宽度的百分比）
// CS2 烟雾弹爆开半径为 144 游戏单位（直径 288 单位），按各地图雷达比例折算标定
const SMOKE_COVERAGE = {
  dust2: 3.0,
  mirage: 3.4,
  inferno: 3.5,
  nuke: 3.2,
  ancient: 3.3,
  anubis: 3.3,
  cache: 3.2
};

// 默认玩家配置（T方进攻起始装备 - 共4个）
const DEFAULT_T_LOADOUT = {
  smoke: 1,
  he: 1,
  flash: 2,
  molotov: 0,
  decoy: 0,
  zeus: 0
};

// 默认CT方防守起始装备 - 共4个
const DEFAULT_CT_LOADOUT = {
  smoke: 1,
  he: 1,
  flash: 2,
  molotov: 0,
  decoy: 0,
  zeus: 0
};

// 战术类型
const TACTIC_TYPES = {
  attack: { label: '进攻', side: 't', color: 'var(--cs2-t)' },
  defend: { label: '防守', side: 'ct', color: 'var(--cs2-ct)' }
};

// 绘制工具
const DRAW_TOOLS = {
  select: { name: '选择', icon: 'mouse-pointer-2' },
  arrow: { name: '箭头', icon: 'arrow-up-right' },
  line: { name: '直线', icon: 'minus' },
  circle: { name: '圆形', icon: 'circle' },
  rect: { name: '矩形', icon: 'square' },
  freehand: { name: '自由绘制', icon: 'pencil' },
  text: { name: '文字注释', icon: 'type' }
};

// 应用状态
const AppState = {
  currentMap: 'mirage',
  currentSide: 'ct', // ct or t
  currentTacticType: 'attack', // attack or defend
  currentTacticId: null,
  tacticName: '新战术',
  tacticDescription: '',
  
  // 玩家数据
  players: {
    ct: [],
    t: []
  },
  
  // 绘制元素
  drawings: [],
  
  // 道具落点
  grenades: [],
  
  // 时间线
  timeline: {
    duration: 90, // 秒
    currentTime: 0,
    isPlaying: false,
    keyframes: [],
    selectedKeyframeId: null
  },
  
  // 工具状态
  activeTool: 'select',
  selectedPlayerId: null,
  selectedDrawingId: null,
  
  // 战术库
  tacticsLibrary: {}
};

/* ============================================
   本地存储管理
   ============================================ */

const Storage = {
  KEY: 'cs2_tactics_board_data',
  
  save() {
    const data = {
      tacticsLibrary: AppState.tacticsLibrary,
      version: '1.0'
    };
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },
  
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.tacticsLibrary) {
          AppState.tacticsLibrary = data.tacticsLibrary;
        }
        return true;
      }
    } catch (e) {
      console.error('加载存档失败:', e);
    }
    return false;
  },
  
  // 获取某地图某类型的战术列表
  getTactics(mapId, type) {
    if (!AppState.tacticsLibrary[mapId]) {
      AppState.tacticsLibrary[mapId] = { attack: [], defend: [] };
    }
    if (!AppState.tacticsLibrary[mapId][type]) {
      AppState.tacticsLibrary[mapId][type] = [];
    }
    return AppState.tacticsLibrary[mapId][type];
  },
  
  // 保存战术到指定槽位
  saveTactic(mapId, type, slotIndex, tacticData) {
    const tactics = this.getTactics(mapId, type);
    tactics[slotIndex] = {
      ...tacticData,
      id: `${mapId}_${type}_${slotIndex}`,
      slot: slotIndex,
      updatedAt: Date.now()
    };
    this.save();
  },
  
  // 加载战术
  loadTactic(mapId, type, slotIndex) {
    const tactics = this.getTactics(mapId, type);
    return tactics[slotIndex] || null;
  },
  
  // 删除战术
  deleteTactic(mapId, type, slotIndex) {
    const tactics = this.getTactics(mapId, type);
    tactics[slotIndex] = null;
    this.save();
  },
  
  // 获取战术数量统计
  getTacticCount(mapId) {
    const attack = this.getTactics(mapId, 'attack').filter(t => t).length;
    const defend = this.getTactics(mapId, 'defend').filter(t => t).length;
    return { attack, defend };
  },
  
  // 导出战术为JSON（用于分享）
  exportTactic(mapId, type, slotIndex) {
    const tactic = this.loadTactic(mapId, type, slotIndex);
    if (!tactic) return null;
    return JSON.stringify(tactic);
  },
  
  // 导入战术
  importTactic(jsonString) {
    try {
      const tactic = JSON.parse(jsonString);
      if (!tactic.mapId || !tactic.type || tactic.slot === undefined) {
        return false;
      }
      this.saveTactic(tactic.mapId, tactic.type, tactic.slot, tactic);
      return true;
    } catch (e) {
      console.error('导入战术失败:', e);
      return false;
    }
  }
};

/* ============================================
   玩家管理
   ============================================ */

const PlayerManager = {
  // 初始化玩家
  initPlayers() {
    AppState.players.ct = this.createDefaultPlayers('ct');
    AppState.players.t = this.createDefaultPlayers('t');
  },
  
  createDefaultPlayers(side) {
    const players = [];
    const loadout = side === 'ct' ? { ...DEFAULT_CT_LOADOUT } : { ...DEFAULT_T_LOADOUT };
    
    for (let i = 1; i <= 5; i++) {
      players.push({
        id: `${side}_${i}`,
        number: i,
        side: side,
        name: `${side.toUpperCase()} ${i}`,
        position: { x: 0, y: 0 },
        grenades: { ...loadout },
        path: [], // 移动路径点
        visible: true
      });
    }
    return players;
  },
  
  getPlayer(playerId) {
    const side = playerId.startsWith('ct_') ? 'ct' : 't';
    return AppState.players[side].find(p => p.id === playerId);
  },
  
  updatePlayerPosition(playerId, x, y) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.position = { x, y };
    }
  },
  
  updatePlayerGrenade(playerId, grenadeType, count) {
    const player = this.getPlayer(playerId);
    if (player) {
      const typeMax = GRENADES[grenadeType].maxPerPlayer;
      const newCount = Math.max(0, Math.min(typeMax, count));
      
      // 计算其他道具的总数
      const otherTotal = Object.keys(player.grenades).reduce((sum, type) => {
        if (type === grenadeType) return sum;
        return sum + (player.grenades[type] || 0);
      }, 0);
      
      // 确保总数不超过 MAX_GRENADES_PER_PLAYER
      const maxAllowed = MAX_GRENADES_PER_PLAYER - otherTotal;
      player.grenades[grenadeType] = Math.max(0, Math.min(newCount, maxAllowed));
    }
  },
  
  // 获取玩家道具总数
  getPlayerTotalGrenades(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return 0;
    return Object.values(player.grenades).reduce((sum, count) => sum + (count || 0), 0);
  },
  
  // 获取队伍道具总数
  getTeamGrenadeCount(side, grenadeType) {
    return AppState.players[side].reduce((sum, p) => sum + (p.grenades[grenadeType] || 0), 0);
  }
};

/* ============================================
   时间线管理
   ============================================ */

const TimelineManager = {
  // 捕获当前完整状态快照
  captureState() {
    return {
      players: {
        ct: JSON.parse(JSON.stringify(AppState.players.ct)),
        t: JSON.parse(JSON.stringify(AppState.players.t))
      },
      drawings: JSON.parse(JSON.stringify(AppState.drawings)),
      grenades: JSON.parse(JSON.stringify(AppState.grenades))
    };
  },

  // 应用状态快照到当前
  applyState(state) {
    if (!state) return;
    if (state.players) {
      AppState.players.ct = JSON.parse(JSON.stringify(state.players.ct || []));
      AppState.players.t = JSON.parse(JSON.stringify(state.players.t || []));
    }
    if (state.drawings) {
      AppState.drawings = JSON.parse(JSON.stringify(state.drawings));
    }
    if (state.grenades) {
      AppState.grenades = JSON.parse(JSON.stringify(state.grenades));
    }
  },

  // 添加关键帧（保存当前完整状态）
  addKeyframe(time, label) {
    const keyframe = {
      id: 'kf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      time: time,
      label: label || `关键帧 ${AppState.timeline.keyframes.length + 1}`,
      state: this.captureState()
    };
    AppState.timeline.keyframes.push(keyframe);
    AppState.timeline.keyframes.sort((a, b) => a.time - b.time);
    return keyframe;
  },

  // 更新选中的关键帧（用当前状态覆盖）
  updateKeyframe(keyframeId) {
    const kf = AppState.timeline.keyframes.find(k => k.id === keyframeId);
    if (kf) {
      kf.state = this.captureState();
      return true;
    }
    return false;
  },
  
  // 删除关键帧
  removeKeyframe(keyframeId) {
    AppState.timeline.keyframes = AppState.timeline.keyframes.filter(k => k.id !== keyframeId);
    if (AppState.timeline.selectedKeyframeId === keyframeId) {
      AppState.timeline.selectedKeyframeId = null;
    }
  },

  // 选中关键帧
  selectKeyframe(keyframeId) {
    AppState.timeline.selectedKeyframeId = keyframeId;
    const kf = this.getKeyframe(keyframeId);
    if (kf) {
      // 跳转到该关键帧时间点
      this.setCurrentTime(kf.time);
      // 应用该关键帧的状态
      this.applyState(kf.state);
    }
  },

  // 获取关键帧
  getKeyframe(keyframeId) {
    return AppState.timeline.keyframes.find(k => k.id === keyframeId);
  },

  // 获取指定时间点之前的最后一个关键帧（阶梯式插值）
  getActiveKeyframeAtTime(time) {
    const kfs = AppState.timeline.keyframes.filter(k => k.time <= time);
    if (kfs.length === 0) return null;
    return kfs[kfs.length - 1];
  },
  
  setCurrentTime(time) {
    AppState.timeline.currentTime = Math.max(0, Math.min(AppState.timeline.duration, time));
  },
  
  // 播放控制
  play() {
    AppState.timeline.isPlaying = true;
  },
  
  pause() {
    AppState.timeline.isPlaying = false;
  },
  
  stop() {
    AppState.timeline.isPlaying = false;
    AppState.timeline.currentTime = 0;
    AppState.timeline.selectedKeyframeId = null;
    // 跳回第一个关键帧或初始状态
    const firstKf = AppState.timeline.keyframes[0];
    if (firstKf) {
      this.applyState(firstKf.state);
    }
  },
  
  nextFrame() {
    const nextKf = AppState.timeline.keyframes.find(k => k.time > AppState.timeline.currentTime);
    if (nextKf) {
      this.selectKeyframe(nextKf.id);
    }
  },
  
  prevFrame() {
    const prevKfs = AppState.timeline.keyframes.filter(k => k.time < AppState.timeline.currentTime - 0.1);
    if (prevKfs.length > 0) {
      this.selectKeyframe(prevKfs[prevKfs.length - 1].id);
    }
  }
};

/* ============================================
   战术种子：把完整战术编码成可粘贴的种子字符串
   无需后端——种子本身包含全部战术数据（deflate 压缩 + Base64URL）
   ============================================ */

const SeedManager = {
  PREFIX: 'CS2',
  RAW_PREFIX: 'CS2U',

  bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  base64UrlToBytes(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const bin = atob(s + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  },

  async deflate(bytes) {
    const cs = new CompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  async inflate(bytes) {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  // 格式：CS2-abc123.def456.gh7890（用「.」分组，避免与 Base64URL 自带的「-」冲突）
  formatSeed(prefix, b64) {
    const groups = b64.match(/.{1,6}/g) || [];
    return `${prefix}-${groups.join('.')}`;
  },

  // 生成种子
  async generate(tactic) {
    const json = JSON.stringify(tactic);
    const bytes = new TextEncoder().encode(json);
    let payload = bytes;
    let prefix = this.RAW_PREFIX;

    if (typeof CompressionStream !== 'undefined') {
      try {
        payload = await this.deflate(bytes);
        prefix = this.PREFIX;
      } catch (e) {
        payload = bytes;
      }
    }

    return this.formatSeed(prefix, this.bytesToBase64Url(payload));
  },

  // 解析种子，返回战术对象
  async parse(seed) {
    if (!seed) throw new Error('种子为空');

    const cleaned = seed.trim().replace(/\s+/g, '');
    const match = cleaned.match(/^(CS2U|CS2)-(.+)$/i);
    if (!match) {
      throw new Error('不是有效的战术种子（应以 CS2- 开头）');
    }

    const prefix = match[1].toUpperCase();
    // 去掉分组用的「.」与换行，仅保留 Base64URL 字符
    const b64 = match[2].replace(/[^A-Za-z0-9_-]/g, '');
    if (!b64) throw new Error('种子内容为空或已损坏');

    const bytes = this.base64UrlToBytes(b64);
    let json;

    if (prefix === this.PREFIX) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('当前浏览器不支持解压该种子');
      }
      const raw = await this.inflate(bytes);
      json = new TextDecoder().decode(raw);
    } else {
      json = new TextDecoder().decode(bytes);
    }

    return JSON.parse(json);
  }
};

// 初始化
Storage.load();
