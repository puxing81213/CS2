/* ============================================
   CS2 战术板 - 主交互逻辑
   ============================================ */

const App = {
  // 页面切换
  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Toast 提示
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;
    
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    const existingIcon = toast.querySelector('svg, i');
    if (existingIcon) {
      const i = document.createElement('i');
      i.setAttribute('data-lucide', iconName);
      existingIcon.replaceWith(i);
    }
    
    msgEl.textContent = message;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  // 弹窗控制
  openModal(modalId) {
    document.getElementById(`modal-${modalId}`).classList.add('active');
  },

  closeModal(modalId) {
    document.getElementById(`modal-${modalId}`).classList.remove('active');
  },

  /* ==================== 地图选择页 ==================== */

  initMapSelectPage() {
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    
    MAPS.forEach(map => {
      const stats = Storage.getTacticCount(map.id);
      const difficultyClass = map.difficulty === '入门' ? 'easy' : map.difficulty === '中等' ? 'medium' : 'hard';
      
      const card = document.createElement('div');
      card.className = 'map-card';
      card.dataset.mapId = map.id;
      card.innerHTML = `
        <div class="corner-decoration tl"></div>
        <div class="corner-decoration tr"></div>
        <div class="corner-decoration bl"></div>
        <div class="corner-decoration br"></div>
        <div class="map-card-image">
          <img src="assets/map-${map.id}.jpg" alt="${map.name}">
          <span class="map-difficulty-tag ${difficultyClass}">${map.difficulty}</span>
          <span class="map-popularity-tag">
            <i data-lucide="trending-up"></i>
            ${map.popularity}%
          </span>
        </div>
        <div class="map-card-content">
          <div class="map-card-name">${map.name}</div>
          <div class="map-tactics-info">
            <div class="tactic-count-item">
              <div class="tactic-count-label attack">
                <i data-lucide="swords"></i>
                进攻战术
              </div>
              <div class="tactic-count-value attack">${stats.attack} / 10</div>
              <div class="cs2-progress">
                <div class="cs2-progress-bar t" style="width: ${stats.attack * 10}%"></div>
              </div>
            </div>
            <div class="tactic-count-item">
              <div class="tactic-count-label defend">
                <i data-lucide="shield"></i>
                防守战术
              </div>
              <div class="tactic-count-value defend">${stats.defend} / 10</div>
              <div class="cs2-progress">
                <div class="cs2-progress-bar ct" style="width: ${stats.defend * 10}%"></div>
              </div>
            </div>
          </div>
          <div class="map-card-footer">
            <span class="map-card-footer-text">点击进入战术板</span>
            <i data-lucide="arrow-right" class="map-card-arrow"></i>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => this.openTacticsBoard(map.id));
      grid.appendChild(card);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* ==================== 战术板主界面 ==================== */

  openTacticsBoard(mapId) {
    AppState.currentMap = mapId;
    const map = MAPS.find(m => m.id === mapId);
    
    // 更新地图名
    document.getElementById('board-map-name').textContent = map.name;
    document.getElementById('info-map').textContent = map.name;
    
    // 更新地图图片
    const mapImg = document.getElementById('map-image');
    mapImg.src = `assets/map-${mapId}.jpg`;
    
    // 初始化玩家
    PlayerManager.initPlayers();
    
    // 重置时间线
    AppState.timeline.currentTime = 0;
    AppState.timeline.isPlaying = false;
    AppState.timeline.keyframes = [];
    
    // 初始化绘制
    AppState.drawings = [];
    AppState.grenades = [];
    
    // 渲染所有UI
    this.renderPlayerTools();
    this.renderGrenadeTools();
    this.renderMapPlayers();
    this.renderLineup();
    this.renderTimeline();
    this.updateTeamGrenadeInfo();
    
    // 切换页面
    this.showPage('page-tactics-board');
    
    // 初始化canvas
    this.initDrawingCanvas();
  },

  // 重新渲染所有内容（应用关键帧状态后调用）
  renderAll() {
    this.renderMapPlayers();
    this.renderPlayerTools();
    this.renderLineup();
    this.renderGrenadeMarkers();
    this.renderAnnotations();
    if (this._ctx && this._canvas) {
      this.redrawCanvas(this._ctx, this._canvas);
    }
    // 更新选中玩家面板
    if (AppState.selectedPlayerId) {
      const player = PlayerManager.getPlayer(AppState.selectedPlayerId);
      if (player) {
        this.showPlayerProperties(player);
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // 渲染玩家工具按钮
  renderPlayerTools() {
    const tContainer = document.getElementById('t-player-tools');
    const ctContainer = document.getElementById('ct-player-tools');
    
    tContainer.innerHTML = '';
    ctContainer.innerHTML = '';
    
    AppState.players.t.forEach(player => {
      const btn = this.createPlayerToolBtn(player);
      tContainer.appendChild(btn);
    });
    
    AppState.players.ct.forEach(player => {
      const btn = this.createPlayerToolBtn(player);
      ctContainer.appendChild(btn);
    });
  },

  createPlayerToolBtn(player) {
    const totalGrenades = Object.values(player.grenades).reduce((a, b) => a + b, 0);
    const btn = document.createElement('button');
    btn.className = `player-tool-btn ${player.side}`;
    btn.dataset.playerId = player.id;
    btn.innerHTML = `
      ${player.number}
      <span class="grenade-count">${totalGrenades}</span>
    `;
    
    btn.addEventListener('click', () => {
      this.selectPlayer(player.id);
    });
    
    return btn;
  },

  // 渲染道具工具
  renderGrenadeTools() {
    const container = document.getElementById('grenade-tools');
    container.innerHTML = '';
    
    Object.entries(GRENADES).forEach(([key, grenade]) => {
      const btn = document.createElement('button');
      btn.className = 'grenade-tool-btn cs2-tooltip';
      btn.dataset.grenade = key;
      const extra = key === 'smoke' ? '，爆开半径约144单位' : '';
      btn.setAttribute('data-tooltip', `${grenade.name} (每队最多${grenade.maxTeam}个${extra})`);
      btn.innerHTML = `
        <i data-lucide="${grenade.icon}" style="color: ${grenade.color}"></i>
        <span>${grenade.name}</span>
        <span class="grenade-max">x${grenade.maxPerPlayer}</span>
      `;
      
      btn.addEventListener('click', () => this.selectGrenadeTool(key));
      container.appendChild(btn);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // 渲染地图上的玩家
  renderMapPlayers() {
    const layer = document.getElementById('map-players-layer');
    layer.innerHTML = '';
    
    const positions = this.getDefaultPlayerPositions();
    
    [...AppState.players.ct, ...AppState.players.t].forEach(player => {
      if (player.position.x === 0 && player.position.y === 0) {
        const pos = positions[player.id];
        if (pos) {
          player.position = { ...pos };
        }
      }
      
      const el = document.createElement('div');
      el.className = `map-player ${player.side}`;
      el.dataset.playerId = player.id;
      el.style.left = `${player.position.x}%`;
      el.style.top = `${player.position.y}%`;
      el.innerHTML = `
        ${player.number}
        <span class="player-label">${player.name}</span>
      `;
      
      // 拖拽
      this.makeDraggable(el, player);
      
      // 点击选中
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectPlayer(player.id);
      });
      
      layer.appendChild(el);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  getDefaultPlayerPositions() {
    // 默认位置（百分比）
    return {
      t_1: { x: 12, y: 75 },
      t_2: { x: 18, y: 80 },
      t_3: { x: 15, y: 85 },
      t_4: { x: 8, y: 82 },
      t_5: { x: 22, y: 78 },
      ct_1: { x: 78, y: 22 },
      ct_2: { x: 85, y: 18 },
      ct_3: { x: 80, y: 28 },
      ct_4: { x: 72, y: 25 },
      ct_5: { x: 88, y: 30 }
    };
  },

  makeDraggable(element, player) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const container = document.getElementById('map-container');
    
    element.addEventListener('mousedown', (e) => {
      if (AppState.activeTool !== 'select') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      startLeft = (rect.left - containerRect.left + rect.width / 2) / containerRect.width * 100;
      startTop = (rect.top - containerRect.top + rect.height / 2) / containerRect.height * 100;
      
      element.style.zIndex = 100;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const containerRect = container.getBoundingClientRect();
      const dx = (e.clientX - startX) / containerRect.width * 100;
      const dy = (e.clientY - startY) / containerRect.height * 100;
      
      let newX = Math.max(2, Math.min(98, startLeft + dx));
      let newY = Math.max(2, Math.min(98, startTop + dy));
      
      element.style.left = `${newX}%`;
      element.style.top = `${newY}%`;
      
      player.position = { x: newX, y: newY };
      this.updatePlayerPropPosition(player);
      this.renderThrowTrajectories();
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.zIndex = '';
      }
    });
  },

  // 选中玩家
  selectPlayer(playerId) {
    AppState.selectedPlayerId = playerId;
    const player = PlayerManager.getPlayer(playerId);
    
    // 更新工具按钮状态
    document.querySelectorAll('.player-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.playerId === playerId);
    });
    
    // 更新地图上玩家状态
    document.querySelectorAll('.map-player').forEach(el => {
      el.classList.toggle('selected', el.dataset.playerId === playerId);
    });
    
    // 更新阵容列表选中
    document.querySelectorAll('.lineup-player').forEach(el => {
      el.classList.toggle('selected', el.dataset.playerId === playerId);
    });
    
    // 显示属性面板
    if (player) {
      this.showPlayerProperties(player);
    }
    
    AppState.activeTool = 'select';
    this.updateDrawToolActive();
  },

  showPlayerProperties(player) {
    document.getElementById('no-selection-state').style.display = 'none';
    document.getElementById('player-properties').style.display = 'block';
    
    document.getElementById('prop-side').textContent = player.side.toUpperCase();
    document.getElementById('prop-number').textContent = player.number;
    document.getElementById('prop-name-input').value = player.name;
    document.getElementById('prop-position').textContent = 
      `${player.position.x.toFixed(1)}%, ${player.position.y.toFixed(1)}%`;
    
    // 更新道具总数徽章
    const total = Object.keys(GRENADES).reduce((sum, key) => sum + (player.grenades[key] || 0), 0);
    const badge = document.getElementById('grenade-total-badge');
    badge.textContent = `${total} / ${MAX_GRENADES_PER_PLAYER}`;
    badge.style.color = total >= MAX_GRENADES_PER_PLAYER ? 'var(--cs2-error)' : 'var(--cs2-primary)';
    badge.style.borderColor = total >= MAX_GRENADES_PER_PLAYER ? 'var(--cs2-error)' : 'var(--cs2-primary)';
    
    // 渲染道具列表
    const list = document.getElementById('player-grenade-list');
    list.innerHTML = '';
    
    Object.entries(GRENADES).forEach(([key, grenade]) => {
      const count = player.grenades[key] || 0;
      const item = document.createElement('div');
      item.className = 'grenade-prop-item';
      item.innerHTML = `
        <div class="grenade-prop-info">
          <div class="grenade-prop-icon" style="background: ${grenade.color}">
            <i data-lucide="${grenade.icon}"></i>
          </div>
          <span class="grenade-prop-name">${grenade.name}</span>
        </div>
        <div class="grenade-prop-count">
          <button class="grenade-count-btn" data-action="decrease" data-grenade="${key}">-</button>
          <span class="grenade-count-value">${count}</span>
          <button class="grenade-count-btn" data-action="increase" data-grenade="${key}">+</button>
        </div>
      `;
      
      item.querySelectorAll('.grenade-count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const gType = btn.dataset.grenade;
          let newCount = player.grenades[gType] || 0;
          
          if (action === 'increase') {
            // 检查单玩家上限
            if (newCount >= GRENADES[gType].maxPerPlayer) {
              this.showToast(`${GRENADES[gType].name}每人最多${GRENADES[gType].maxPerPlayer}个`, 'error');
              return;
            }
            // 检查玩家道具总数上限（4个）
            const playerTotal = Object.keys(GRENADES).reduce((sum, key) => sum + (player.grenades[key] || 0), 0);
            if (playerTotal >= MAX_GRENADES_PER_PLAYER) {
              this.showToast(`每人最多携带${MAX_GRENADES_PER_PLAYER}个道具`, 'error');
              return;
            }
            // 检查队伍上限
            const teamCount = PlayerManager.getTeamGrenadeCount(player.side, gType);
            if (teamCount < GRENADES[gType].maxTeam) {
              newCount++;
            } else {
              this.showToast(`${GRENADES[gType].name}每队最多${GRENADES[gType].maxTeam}个`, 'error');
            }
          } else {
            newCount = Math.max(0, newCount - 1);
          }
          
          player.grenades[gType] = newCount;
          this.showPlayerProperties(player);
          this.renderPlayerTools();
          this.renderLineup();
          this.updateTeamGrenadeInfo();
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });
      
      list.appendChild(item);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  updatePlayerPropPosition(player) {
    if (AppState.selectedPlayerId === player.id) {
      document.getElementById('prop-position').textContent = 
        `${player.position.x.toFixed(1)}%, ${player.position.y.toFixed(1)}%`;
    }
  },

  // 渲染阵容列表
  renderLineup() {
    const side = AppState.currentSide;
    const players = AppState.players[side];
    const title = document.getElementById('lineup-title');
    title.textContent = `${side.toUpperCase()} 方阵容`;
    
    const list = document.getElementById('lineup-list');
    list.innerHTML = '';
    
    players.forEach(player => {
      const totalGrenades = Object.values(player.grenades).reduce((a, b) => a + b, 0);
      const el = document.createElement('div');
      el.className = `lineup-player ${player.side}`;
      el.dataset.playerId = player.id;
      
      if (player.id === AppState.selectedPlayerId) {
        el.classList.add('selected');
      }
      
      // 道具小图标
      let grenadeIcons = '';
      Object.entries(player.grenades).forEach(([key, count]) => {
        if (count > 0) {
          grenadeIcons += `<div class="lineup-grenade-icon" style="background: ${GRENADES[key].color}" title="${GRENADES[key].name} x${count}"></div>`;
        }
      });
      
      el.innerHTML = `
        <div class="lineup-player-dot">${player.number}</div>
        <div class="lineup-player-info">
          <div class="lineup-player-name">${player.name}</div>
          <div class="lineup-player-grenades">${grenadeIcons}</div>
        </div>
        <span style="font-size:11px;color:var(--cs2-text-tertiary);font-family:var(--cs2-font-mono)">${totalGrenades}</span>
      `;
      
      el.addEventListener('click', () => this.selectPlayer(player.id));
      list.appendChild(el);
    });
    
    // 阵容统计
    const stats = document.getElementById('lineup-stats');
    const totalSmoke = PlayerManager.getTeamGrenadeCount(side, 'smoke');
    const totalHE = PlayerManager.getTeamGrenadeCount(side, 'he');
    const totalFlash = PlayerManager.getTeamGrenadeCount(side, 'flash');
    
    stats.innerHTML = `
      <div class="lineup-stat-item">
        <div class="lineup-stat-value">${totalSmoke}</div>
        <div class="lineup-stat-label">烟雾</div>
      </div>
      <div class="lineup-stat-item">
        <div class="lineup-stat-value">${totalHE}</div>
        <div class="lineup-stat-label">手雷</div>
      </div>
      <div class="lineup-stat-item">
        <div class="lineup-stat-value">${totalFlash}</div>
        <div class="lineup-stat-label">闪光</div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  updateTeamGrenadeInfo() {
    const side = AppState.currentSide;
    const info = document.getElementById('team-grenade-info');
    let html = '<div style="font-weight:600;margin-bottom:4px;color:var(--cs2-text-secondary)">队伍道具总数</div>';
    
    Object.entries(GRENADES).forEach(([key, grenade]) => {
      const count = PlayerManager.getTeamGrenadeCount(side, key);
      html += `
        <div class="team-grenade-row">
          <span class="grenade-name">
            <i data-lucide="${grenade.icon}" style="width:12px;height:12px;color:${grenade.color}"></i>
            ${grenade.name}
          </span>
          <span class="grenade-count">${count} / ${grenade.maxTeam}</span>
        </div>
      `;
    });
    
    info.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // 道具工具选择
  selectGrenadeTool(grenadeType) {
    AppState.activeTool = 'grenade';
    AppState.activeGrenade = grenadeType;
    
    document.querySelectorAll('.grenade-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.grenade === grenadeType);
    });
    
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) canvas.style.cursor = 'crosshair';
    
    this.updateDrawToolActive();
  },

  // 绘制工具选择
  selectDrawTool(tool) {
    AppState.activeTool = tool;
    this.updateDrawToolActive();
  },

  updateDrawToolActive() {
    document.querySelectorAll('.draw-tool-btn').forEach(btn => {
      btn.classList.toggle('active', 
        AppState.activeTool === btn.dataset.tool || 
        (btn.dataset.tool === 'select' && AppState.activeTool === 'select') ||
        (btn.dataset.tool === 'text' && AppState.activeTool === 'text')
      );
    });
  },

  /* ==================== Canvas 绘制 ==================== */

  initDrawingCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    const container = document.getElementById('map-container');
    
    // 设置canvas尺寸
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let startX, startY;
    let currentPath = [];
    let throwDrag = null;
    let currentColor = 'var(--cs2-primary)';
    let lineWidth = 3;
    
    // 获取实际颜色值
    function getColor(cssVar) {
      if (cssVar.startsWith('var(')) {
        const varName = cssVar.slice(4, -1);
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#ff7a1a';
      }
      return cssVar;
    }
    
    // 颜色选择器
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        currentColor = opt.dataset.color;
      });
    });
    
    // 绘制工具按钮
    document.querySelectorAll('.draw-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        
        if (tool === 'clearAll') {
          // 清空所有绘制
          if (confirm('确定要清空所有绘制内容吗？')) {
            AppState.drawings = [];
            AppState.annotations = [];
            this.redrawCanvas(ctx, canvas);
            this.renderAnnotations();
          }
          return;
        }
        
        this.selectDrawTool(tool);
        
        if (tool === 'text') {
          canvas.style.cursor = 'text';
        } else if (tool === 'select') {
          canvas.style.cursor = 'default';
        } else if (tool === 'eraser') {
          canvas.style.cursor = 'cell';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      });
    });
    
    // 鼠标按下
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (AppState.activeTool === 'text') {
        // 文字注释
        const text = prompt('请输入注释文字：', '注释');
        if (text) {
          this.addAnnotation(x / canvas.width * 100, y / canvas.height * 100, text);
        }
        return;
      }
      
      if (AppState.activeTool === 'eraser') {
        // 橡皮擦：点击删除最近的绘制元素
        this.eraseAtPoint(x, y, canvas, ctx);
        return;
      }
      
      if (AppState.activeTool === 'grenade' && AppState.activeGrenade) {
        // 投掷：已选中玩家则从该玩家拖出投掷轨迹，否则直接放置落点
        const thrower = AppState.selectedPlayerId
          ? PlayerManager.getPlayer(AppState.selectedPlayerId)
          : null;
        if (thrower) {
          throwDrag = {
            thrower: thrower,
            targetX: x / canvas.width * 100,
            targetY: y / canvas.height * 100
          };
        } else {
          this.throwGrenade(
            x / canvas.width * 100,
            y / canvas.height * 100,
            AppState.activeGrenade,
            null
          );
        }
        return;
      }
      
      if (['arrow', 'line', 'circle', 'rect', 'freehand'].includes(AppState.activeTool)) {
        isDrawing = true;
        startX = x;
        startY = y;
        currentPath = [{ x, y }];
      }
    });
    
    // 鼠标移动
    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // 清除并重绘已有图形
      this.redrawCanvas(ctx, canvas);
      
      ctx.strokeStyle = getColor(currentColor);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (AppState.activeTool === 'freehand') {
        currentPath.push({ x, y });
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        ctx.stroke();
      } else if (AppState.activeTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (AppState.activeTool === 'arrow') {
        this.drawArrow(ctx, startX, startY, x, y, getColor(currentColor), lineWidth);
      } else if (AppState.activeTool === 'circle') {
        const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (AppState.activeTool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY);
      }
    });
    
    // 鼠标释放
    canvas.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (['arrow', 'line', 'circle', 'rect', 'freehand'].includes(AppState.activeTool)) {
        AppState.drawings.push({
          type: AppState.activeTool,
          startX: startX / canvas.width * 100,
          startY: startY / canvas.height * 100,
          endX: x / canvas.width * 100,
          endY: y / canvas.height * 100,
          path: AppState.activeTool === 'freehand' ? currentPath.map(p => ({
            x: p.x / canvas.width * 100,
            y: p.y / canvas.height * 100
          })) : null,
          color: currentColor,
          lineWidth: lineWidth
        });
      }
      
      this.redrawCanvas(ctx, canvas);
    });
    
    // 投掷拖拽：在 window 上监听，鼠标移出画布也不会丢失
    window.addEventListener('mousemove', (e) => {
      if (!throwDrag) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
      throwDrag.targetX = x / rect.width * 100;
      throwDrag.targetY = y / rect.height * 100;
      
      // 预览虚线
      this.redrawCanvas(ctx, canvas);
      const sx = throwDrag.thrower.position.x / 100 * canvas.width;
      const sy = throwDrag.thrower.position.y / 100 * canvas.height;
      const tx = throwDrag.targetX / 100 * canvas.width;
      const ty = throwDrag.targetY / 100 * canvas.height;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    });
    
    window.addEventListener('mouseup', () => {
      if (!throwDrag) return;
      this.throwGrenade(
        throwDrag.targetX,
        throwDrag.targetY,
        AppState.activeGrenade,
        throwDrag.thrower.id
      );
      throwDrag = null;
      this.redrawCanvas(ctx, canvas);
    });
    
    // 保存canvas引用
    this._canvas = canvas;
    this._ctx = ctx;
  },

  drawArrow(ctx, fromX, fromY, toX, toY, color, lineWidth) {
    const headLength = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    
    // 主线
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // 箭头
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  },

  redrawCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    function getColor(cssVar) {
      if (cssVar.startsWith('var(')) {
        const varName = cssVar.slice(4, -1);
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#ff7a1a';
      }
      return cssVar;
    }
    
    AppState.drawings.forEach(drawing => {
      const color = getColor(drawing.color);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = drawing.lineWidth || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const sx = drawing.startX / 100 * canvas.width;
      const sy = drawing.startY / 100 * canvas.height;
      const ex = drawing.endX / 100 * canvas.width;
      const ey = drawing.endY / 100 * canvas.height;
      
      if (drawing.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else if (drawing.type === 'arrow') {
        this.drawArrow(ctx, sx, sy, ex, ey, color, drawing.lineWidth || 3);
      } else if (drawing.type === 'circle') {
        const radius = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (drawing.type === 'rect') {
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      } else if (drawing.type === 'freehand' && drawing.path) {
        ctx.beginPath();
        const points = drawing.path;
        if (points.length > 0) {
          ctx.moveTo(points[0].x / 100 * canvas.width, points[0].y / 100 * canvas.height);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x / 100 * canvas.width, points[i].y / 100 * canvas.height);
          }
          ctx.stroke();
        }
      }
    });
  },

  // 橡皮擦：点击点附近的绘制元素
  eraseAtPoint(px, py, canvas, ctx) {
    const threshold = 8; // 点击容差（像素）
    let erased = false;
    
    // 从后往前检查（最新绘制的优先删除）
    for (let i = AppState.drawings.length - 1; i >= 0; i--) {
      const d = AppState.drawings[i];
      const sx = d.startX / 100 * canvas.width;
      const sy = d.startY / 100 * canvas.height;
      const ex = d.endX / 100 * canvas.width;
      const ey = d.endY / 100 * canvas.height;
      
      let hit = false;
      
      if (d.type === 'line' || d.type === 'arrow') {
        hit = this.pointToLineDistance(px, py, sx, sy, ex, ey) <= threshold;
      } else if (d.type === 'circle') {
        const radius = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
        hit = Math.abs(dist - radius) <= threshold;
      } else if (d.type === 'rect') {
        // 检查是否在矩形边框附近
        const left = Math.min(sx, ex);
        const right = Math.max(sx, ex);
        const top = Math.min(sy, ey);
        const bottom = Math.max(sy, ey);
        const onLeftEdge = Math.abs(px - left) <= threshold && py >= top - threshold && py <= bottom + threshold;
        const onRightEdge = Math.abs(px - right) <= threshold && py >= top - threshold && py <= bottom + threshold;
        const onTopEdge = Math.abs(py - top) <= threshold && px >= left - threshold && px <= right + threshold;
        const onBottomEdge = Math.abs(py - bottom) <= threshold && px >= left - threshold && px <= right + threshold;
        hit = onLeftEdge || onRightEdge || onTopEdge || onBottomEdge;
      } else if (d.type === 'freehand' && d.path) {
        for (let j = 0; j < d.path.length - 1; j++) {
          const p1x = d.path[j].x / 100 * canvas.width;
          const p1y = d.path[j].y / 100 * canvas.height;
          const p2x = d.path[j + 1].x / 100 * canvas.width;
          const p2y = d.path[j + 1].y / 100 * canvas.height;
          if (this.pointToLineDistance(px, py, p1x, p1y, p2x, p2y) <= threshold) {
            hit = true;
            break;
          }
        }
      }
      
      if (hit) {
        AppState.drawings.splice(i, 1);
        erased = true;
        break;
      }
    }
    
    // 如果没擦到绘制，尝试擦除文字注释
    if (!erased) {
      for (let i = AppState.annotations.length - 1; i >= 0; i--) {
        const a = AppState.annotations[i];
        const ax = a.x / 100 * canvas.width;
        const ay = a.y / 100 * canvas.height;
        // 估算文字区域（约 80x24 px）
        if (Math.abs(px - ax) <= 50 && Math.abs(py - ay) <= 15) {
          AppState.annotations.splice(i, 1);
          this.renderAnnotations();
          erased = true;
          break;
        }
      }
    }
    
    if (erased) {
      this.redrawCanvas(ctx, canvas);
    }
  },

  // 点到线段的距离
  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // 投掷道具（throwerId 为空则直接放置落点）
  throwGrenade(x, y, type, throwerId) {
    const thrower = throwerId ? PlayerManager.getPlayer(throwerId) : null;
    const side = thrower ? thrower.side : AppState.currentSide;

    let fromX = null;
    let fromY = null;
    if (thrower) {
      fromX = thrower.position.x;
      fromY = thrower.position.y;
    }

    const marker = {
      id: 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      side: side,
      x: x,
      y: y,
      throwerId: thrower ? thrower.id : null,
      fromX: fromX,
      fromY: fromY,
      radius: type === 'smoke' ? this.getSmokeRadius() : null,
      // 时间线：投掷时间与烟雾持续时长（15 秒后消散）
      thrownAt: AppState.timeline ? AppState.timeline.currentTime : 0,
      life: 15
    };

    AppState.grenades.push(marker);
    this.renderGrenadeMarkers();

    const who = thrower ? `${thrower.name} 投掷` : '放置';
    this.showToast(`${who}${GRENADES[type].name}`);
    return marker;
  },

  // 获取当前地图的烟雾爆开半径（百分比）
  getSmokeRadius() {
    return SMOKE_COVERAGE[AppState.currentMap] || 3.3;
  },

  // 判断道具在当前时间线时刻是否仍然存在（烟雾弹 15 秒后消散）
  isGrenadeVisible(grenade, time) {
    if (grenade.type !== 'smoke') return true;
    if (grenade.thrownAt === undefined || grenade.thrownAt === null) return true;
    const now = time !== undefined ? time : AppState.timeline.currentTime;
    const life = grenade.life || 15;
    return now >= grenade.thrownAt && now < grenade.thrownAt + life;
  },

  // 根据时间线更新烟雾可见性（播放/拖动时间轴时调用，不重建元素）
  updateGrenadeVisibility() {
    const time = AppState.timeline.currentTime;
    AppState.grenades.forEach(grenade => {
      const visible = this.isGrenadeVisible(grenade, time);
      const cloud = document.querySelector(`.smoke-effect[data-grenade-id="${grenade.id}"]`);
      if (cloud) cloud.classList.toggle('inactive', !visible);
      const marker = document.querySelector(`.map-grenade-marker[data-grenade-id="${grenade.id}"]`);
      if (marker) marker.classList.toggle('inactive', !visible);
      const line = document.querySelector(`.throw-line[data-grenade-id="${grenade.id}"]`);
      if (line) line.style.display = visible ? '' : 'none';
    });
  },

  // 兼容旧调用
  addGrenadeMarker(x, y, type) {
    this.throwGrenade(x, y, type, null);
  },

  renderGrenadeMarkers() {
    const layer = document.getElementById('map-grenades-layer');
    layer.innerHTML = '';

    AppState.grenades.forEach(grenade => {
      const visible = this.isGrenadeVisible(grenade);

      // 烟雾弹爆开覆盖范围
      if (grenade.type === 'smoke') {
        const radius = grenade.radius || this.getSmokeRadius();
        const cloud = document.createElement('div');
        cloud.className = `smoke-effect${visible ? '' : ' inactive'}`;
        cloud.dataset.grenadeId = grenade.id;
        cloud.style.left = `${grenade.x}%`;
        cloud.style.top = `${grenade.y}%`;
        cloud.style.width = `${radius * 2}%`;
        cloud.innerHTML = `
          <div class="smoke-cloud"></div>
          <div class="smoke-ring"></div>
          <span class="smoke-tag">烟雾 144u</span>
        `;
        layer.appendChild(cloud);
      }

      const el = document.createElement('div');
      el.className = `map-grenade-marker ${grenade.type}${visible ? '' : ' inactive'}`;
      el.dataset.grenadeId = grenade.id;
      el.style.left = `${grenade.x}%`;
      el.style.top = `${grenade.y}%`;
      el.innerHTML = `<i data-lucide="${GRENADES[grenade.type].icon}"></i>`;

      // 可拖拽
      this.makeGrenadeDraggable(el, grenade);

      layer.appendChild(el);
    });

    this.renderThrowTrajectories();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // 渲染投掷轨迹（虚线，从投掷者到落点）
  renderThrowTrajectories() {
    const svg = document.getElementById('map-effects-layer');
    if (!svg) return;
    svg.innerHTML = '';

    AppState.grenades.forEach(grenade => {
      if (!this.isGrenadeVisible(grenade)) return;
      const thrower = grenade.throwerId ? PlayerManager.getPlayer(grenade.throwerId) : null;
      if (!thrower) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', thrower.position.x.toFixed(3));
      line.setAttribute('y1', thrower.position.y.toFixed(3));
      line.setAttribute('x2', grenade.x.toFixed(3));
      line.setAttribute('y2', grenade.y.toFixed(3));
      line.setAttribute('class', `throw-line ${grenade.type}`);
      line.dataset.grenadeId = grenade.id;
      svg.appendChild(line);
    });
  },

  // 拖拽中的落点更新
  updateGrenadeVisual(grenade) {
    const layer = document.getElementById('map-grenades-layer');
    const cloud = layer.querySelector(`.smoke-effect[data-grenade-id="${grenade.id}"]`);
    if (cloud) {
      cloud.style.left = `${grenade.x}%`;
      cloud.style.top = `${grenade.y}%`;
    }
    this.renderThrowTrajectories();
  },

  makeGrenadeDraggable(element, grenade) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const container = document.getElementById('map-container');
    
    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      startLeft = (rect.left - containerRect.left + rect.width / 2) / containerRect.width * 100;
      startTop = (rect.top - containerRect.top + rect.height / 2) / containerRect.height * 100;
      e.preventDefault();
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const containerRect = container.getBoundingClientRect();
      const dx = (e.clientX - startX) / containerRect.width * 100;
      const dy = (e.clientY - startY) / containerRect.height * 100;
      
      let newX = Math.max(2, Math.min(98, startLeft + dx));
      let newY = Math.max(2, Math.min(98, startTop + dy));
      
      element.style.left = `${newX}%`;
      element.style.top = `${newY}%`;
      grenade.x = newX;
      grenade.y = newY;
      this.updateGrenadeVisual(grenade);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // 右键删除
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      AppState.grenades = AppState.grenades.filter(g => g.id !== grenade.id);
      this.renderGrenadeMarkers();
    });
  },

  // 添加文字注释
  addAnnotation(x, y, text) {
    const annotation = {
      id: 'a_' + Date.now(),
      text: text,
      x: x,
      y: y
    };
    
    AppState.drawings.push({
      type: 'annotation',
      ...annotation
    });
    
    this.renderAnnotations();
  },

  renderAnnotations() {
    const layer = document.getElementById('map-annotations-layer');
    layer.innerHTML = '';
    
    AppState.drawings.filter(d => d.type === 'annotation').forEach(ann => {
      const el = document.createElement('div');
      el.className = 'map-annotation';
      el.style.left = `${ann.x}%`;
      el.style.top = `${ann.y}%`;
      el.textContent = ann.text;
      
      // 可拖拽
      this.makeAnnotationDraggable(el, ann);
      
      layer.appendChild(el);
    });
  },

  makeAnnotationDraggable(element, annotation) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const container = document.getElementById('map-container');
    
    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      startLeft = (rect.left - containerRect.left + rect.width / 2) / containerRect.width * 100;
      startTop = (rect.top - containerRect.top + rect.height / 2) / containerRect.height * 100;
      e.preventDefault();
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const containerRect = container.getBoundingClientRect();
      const dx = (e.clientX - startX) / containerRect.width * 100;
      const dy = (e.clientY - startY) / containerRect.height * 100;
      
      let newX = Math.max(5, Math.min(95, startLeft + dx));
      let newY = Math.max(5, Math.min(95, startTop + dy));
      
      element.style.left = `${newX}%`;
      element.style.top = `${newY}%`;
      annotation.x = newX;
      annotation.y = newY;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // 双击编辑
    element.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const newText = prompt('编辑注释：', annotation.text);
      if (newText !== null) {
        annotation.text = newText;
        element.textContent = newText;
      }
    });
    
    // 右键删除
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('删除此注释？')) {
        AppState.drawings = AppState.drawings.filter(d => d.id !== annotation.id);
        this.renderAnnotations();
      }
    });
  },

  /* ==================== 时间线 ==================== */

  renderTimeline() {
    const keyframesContainer = document.getElementById('timeline-keyframes');
    keyframesContainer.innerHTML = '';
    
    AppState.timeline.keyframes.forEach((kf, index) => {
      const el = document.createElement('div');
      const isSelected = AppState.timeline.selectedKeyframeId === kf.id;
      el.className = `timeline-keyframe ${isSelected ? 'selected' : ''}`;
      el.style.left = `${(kf.time / AppState.timeline.duration) * 100}%`;
      el.title = `${kf.label || '关键帧'} - ${this.formatTime(kf.time)}${isSelected ? ' (已选中)' : ''}`;
      el.dataset.kfId = kf.id;
      
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectKeyframeById(kf.id);
      });
      
      keyframesContainer.appendChild(el);
    });
    
    // 更新保存/删除按钮状态
    this.updateKeyframeButtons();
    
    this.updateTimelineProgress();
  },

  updateKeyframeButtons() {
    const hasSelection = !!AppState.timeline.selectedKeyframeId;
    const saveBtn = document.getElementById('btn-save-keyframe');
    const deleteBtn = document.getElementById('btn-delete-keyframe');
    
    if (saveBtn) saveBtn.disabled = !hasSelection;
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
  },

  selectKeyframeById(kfId) {
    TimelineManager.selectKeyframe(kfId);
    this.renderAll();
    this.renderTimeline();
    this.showToast(`已跳转到 ${this.formatTime(AppState.timeline.currentTime)} 的关键帧`, 'info');
  },

  updateTimelineProgress() {
    const progress = (AppState.timeline.currentTime / AppState.timeline.duration) * 100;
    document.getElementById('timeline-progress').style.width = `${progress}%`;
    document.getElementById('timeline-playhead').style.left = `${progress}%`;
    document.getElementById('time-display').textContent = 
      `${this.formatTime(AppState.timeline.currentTime)} / ${this.formatTime(AppState.timeline.duration)}`;
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  togglePlayback() {
    if (AppState.timeline.isPlaying) {
      TimelineManager.pause();
      document.getElementById('play-icon').setAttribute('data-lucide', 'play');
    } else {
      TimelineManager.play();
      document.getElementById('play-icon').setAttribute('data-lucide', 'pause');
      this.startPlayback();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  startPlayback() {
    if (!AppState.timeline.isPlaying) return;
    
    let lastAppliedKfId = null;
    
    const step = () => {
      if (!AppState.timeline.isPlaying) return;
      
      AppState.timeline.currentTime += 0.1;
      if (AppState.timeline.currentTime >= AppState.timeline.duration) {
        AppState.timeline.currentTime = AppState.timeline.duration;
        TimelineManager.pause();
        document.getElementById('play-icon').setAttribute('data-lucide', 'play');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
      
      // 阶梯式插值：检查当前时间点对应的关键帧是否变化
      const activeKf = TimelineManager.getActiveKeyframeAtTime(AppState.timeline.currentTime);
      const activeKfId = activeKf ? activeKf.id : null;
      if (activeKfId !== lastAppliedKfId) {
        lastAppliedKfId = activeKfId;
        if (activeKf) {
          TimelineManager.applyState(activeKf.state);
          this.renderAll();
        }
        // 更新选中状态（高亮当前播放到的关键帧）
        AppState.timeline.selectedKeyframeId = activeKfId;
        this.renderTimeline();
      }
      
      // 烟雾弹到时消散：按时间线刷新可见性
      this.updateGrenadeVisibility();
      
      this.updateTimelineProgress();
      
      if (AppState.timeline.isPlaying) {
        requestAnimationFrame(() => setTimeout(step, 100));
      }
    };
    
    step();
  },

  addKeyframe() {
    const time = AppState.timeline.currentTime;
    const label = `关键帧 ${AppState.timeline.keyframes.length + 1}`;
    const keyframe = TimelineManager.addKeyframe(time, label);
    // 自动选中新添加的关键帧
    AppState.timeline.selectedKeyframeId = keyframe.id;
    this.renderTimeline();
    this.showToast(`已添加 ${label} (${this.formatTime(time)})`);
  },

  // 保存当前状态到选中的关键帧
  saveCurrentToKeyframe() {
    if (!AppState.timeline.selectedKeyframeId) {
      this.showToast('请先选择一个关键帧', 'error');
      return;
    }
    const success = TimelineManager.updateKeyframe(AppState.timeline.selectedKeyframeId);
    if (success) {
      this.showToast('关键帧已更新');
    }
  },

  // 删除选中的关键帧
  deleteSelectedKeyframe() {
    if (!AppState.timeline.selectedKeyframeId) {
      this.showToast('请先选择一个关键帧', 'error');
      return;
    }
    const kf = TimelineManager.getKeyframe(AppState.timeline.selectedKeyframeId);
    const label = kf ? kf.label : '该关键帧';
    if (confirm(`确定要删除 ${label} 吗？`)) {
      TimelineManager.removeKeyframe(AppState.timeline.selectedKeyframeId);
      this.renderTimeline();
      this.showToast('关键帧已删除');
    }
  },

  /* ==================== 战术库 ==================== */

  openTacticsLibrary() {
    const map = MAPS.find(m => m.id === AppState.currentMap);
    document.getElementById('library-map-name').textContent = map.name;
    
    // 默认显示进攻战术
    this.renderTacticsSlots('attack');
    this.openModal('tactics-library');
  },

  renderTacticsSlots(type) {
    const grid = document.getElementById('tactics-slots-grid');
    grid.innerHTML = '';
    
    const tactics = Storage.getTactics(AppState.currentMap, type);
    const count = tactics.filter(t => t).length;
    
    // 更新计数
    if (type === 'attack') {
      document.getElementById('attack-count').textContent = `${count}/10`;
    } else {
      document.getElementById('defend-count').textContent = `${count}/10`;
    }
    
    for (let i = 0; i < 10; i++) {
      const tactic = tactics[i];
      const slot = document.createElement('div');
      slot.className = `tactic-slot ${tactic ? 'filled' : ''}`;
      slot.dataset.slot = i;
      
      if (tactic) {
        slot.innerHTML = `
          <div class="slot-thumbnail" style="background-image: url('assets/map-${AppState.currentMap}.jpg')"></div>
          <div class="slot-actions">
            <button class="slot-action-btn delete-btn" title="删除">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
          <div class="slot-info">
            <div class="slot-name">${tactic.name || `战术 ${i + 1}`}</div>
            <div class="slot-date">${new Date(tactic.updatedAt).toLocaleDateString('zh-CN')}</div>
          </div>
        `;
        
        slot.addEventListener('click', (e) => {
          if (e.target.closest('.delete-btn')) return;
          this.loadTacticFromSlot(type, i);
        });
        
        slot.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('确定删除这个战术？')) {
            Storage.deleteTactic(AppState.currentMap, type, i);
            this.renderTacticsSlots(type);
            this.showToast('战术已删除');
          }
        });
      } else {
        slot.innerHTML = `
          <i data-lucide="plus" class="slot-empty-icon"></i>
          <span class="slot-empty-text">槽位 ${i + 1}</span>
        `;
        
        slot.addEventListener('click', () => {
          this.saveTacticToSlot(type, i);
        });
      }
      
      grid.appendChild(slot);
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  async saveTacticToSlot(type, slotIndex) {
    const tacticName = document.getElementById('tactic-name-input').value;
    const tacticDesc = document.getElementById('tactic-desc').value;
    
    const tacticData = {
      name: tacticName,
      description: tacticDesc,
      mapId: AppState.currentMap,
      type: type,
      side: AppState.currentSide,
      players: JSON.parse(JSON.stringify(AppState.players)),
      drawings: JSON.parse(JSON.stringify(AppState.drawings)),
      grenades: JSON.parse(JSON.stringify(AppState.grenades)),
      timeline: JSON.parse(JSON.stringify(AppState.timeline))
    };
    
    // 保存时同步生成对应战术种子，便于随时分享/导入
    try {
      tacticData.seed = await SeedManager.generate(tacticData);
    } catch (e) {
      tacticData.seed = null;
    }
    
    Storage.saveTactic(AppState.currentMap, type, slotIndex, tacticData);
    this.renderTacticsSlots(type);
    this.showToast(`战术已保存到槽位 ${slotIndex + 1}，种子已生成`);
  },

  loadTacticFromSlot(type, slotIndex) {
    const tactic = Storage.loadTactic(AppState.currentMap, type, slotIndex);
    if (!tactic) return;
    
    AppState.currentSide = tactic.side || 'ct';
    AppState.players = tactic.players || PlayerManager.initPlayers();
    AppState.drawings = tactic.drawings || [];
    AppState.grenades = tactic.grenades || [];
    AppState.timeline = tactic.timeline || { duration: 90, currentTime: 0, isPlaying: false, keyframes: [], selectedKeyframeId: null };
    if (!AppState.timeline.selectedKeyframeId) AppState.timeline.selectedKeyframeId = null;
    
    // 更新UI
    document.getElementById('tactic-name-input').value = tactic.name || '新战术';
    document.getElementById('info-name').textContent = tactic.name || '新战术';
    document.getElementById('tactic-desc').value = tactic.description || '';
    
    // 更新阵营切换
    document.querySelectorAll('#board-faction-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.side === AppState.currentSide);
    });
    
    // 渲染
    this.renderPlayerTools();
    this.renderMapPlayers();
    this.renderLineup();
    this.renderGrenadeMarkers();
    this.renderAnnotations();
    this.renderTimeline();
    this.updateTeamGrenadeInfo();
    
    // 重绘canvas
    if (this._ctx && this._canvas) {
      this.redrawCanvas(this._ctx, this._canvas);
    }
    
    this.closeModal('tactics-library');
    this.showToast('战术加载成功');
  },

  /* ==================== 战术种子 ==================== */

  buildSeedPayload() {
    return {
      name: document.getElementById('tactic-name-input').value || '新战术',
      description: document.getElementById('tactic-desc').value || '',
      mapId: AppState.currentMap,
      type: AppState.currentTacticType,
      side: AppState.currentSide,
      players: JSON.parse(JSON.stringify(AppState.players)),
      drawings: JSON.parse(JSON.stringify(AppState.drawings)),
      grenades: JSON.parse(JSON.stringify(AppState.grenades)),
      timeline: JSON.parse(JSON.stringify(AppState.timeline))
    };
  },

  openSeedModal() {
    this.openModal('seed');
    this.generateSeed();
  },

  async generateSeed() {
    const output = document.getElementById('seed-output');
    const copyBtn = document.getElementById('btn-copy-seed');
    if (!output) return;
    
    output.value = '正在生成...';
    copyBtn.disabled = true;
    
    try {
      const seed = await SeedManager.generate(this.buildSeedPayload());
      output.value = seed;
      copyBtn.disabled = false;
    } catch (err) {
      output.value = '';
      this.showToast(`种子生成失败：${err.message}`, 'error');
    }
  },

  copySeed() {
    const text = document.getElementById('seed-output').value.trim();
    if (!text || text === '正在生成...') {
      this.showToast('请先生成战术种子', 'error');
      return;
    }
    
    const done = () => this.showToast('战术种子已复制，发给队友即可导入');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        this._fallbackCopy(text);
        done();
      });
    } else {
      this._fallbackCopy(text);
      done();
    }
  },

  _fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  },

  async importSeed() {
    const input = document.getElementById('seed-input');
    const raw = input ? input.value.trim() : '';
    if (!raw) {
      this.showToast('请粘贴战术种子', 'error');
      return;
    }
    
    try {
      const data = await SeedManager.parse(raw);
      if (!data || !MAPS.some(m => m.id === data.mapId)) {
        throw new Error('种子中的地图无效');
      }
      
      this.closeModal('seed');
      this.applyImportedTactic(data);
      if (input) input.value = '';
      this.showToast(`种子导入成功：${data.name || '未命名战术'}`);
    } catch (err) {
      this.showToast(`种子导入失败：${err.message}`, 'error');
    }
  },

  applyImportedTactic(tactic) {
    this.openTacticsBoard(tactic.mapId);
    
    AppState.currentTacticType = tactic.type === 'defense' ? 'defense' : 'attack';
    AppState.currentSide = tactic.side === 't' ? 't' : 'ct';
    AppState.players = (tactic.players && tactic.players.t && tactic.players.ct)
      ? JSON.parse(JSON.stringify(tactic.players))
      : PlayerManager.initPlayers();
    AppState.drawings = JSON.parse(JSON.stringify(tactic.drawings || []));
    AppState.grenades = JSON.parse(JSON.stringify(tactic.grenades || []));
    AppState.timeline = Object.assign(
      { duration: 90, currentTime: 0, isPlaying: false, keyframes: [], selectedKeyframeId: null },
      JSON.parse(JSON.stringify(tactic.timeline || {}))
    );
    AppState.timeline.isPlaying = false;
    AppState.timeline.selectedKeyframeId = null;
    
    document.getElementById('tactic-name-input').value = tactic.name || '新战术';
    document.getElementById('info-name').textContent = tactic.name || '新战术';
    document.getElementById('tactic-desc').value = tactic.description || '';
    
    document.querySelectorAll('#board-faction-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.side === AppState.currentSide);
    });
    document.querySelectorAll('#tactic-type-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === AppState.currentTacticType);
    });
    
    this.renderPlayerTools();
    this.renderMapPlayers();
    this.renderLineup();
    this.renderGrenadeMarkers();
    this.renderAnnotations();
    this.updateTeamGrenadeInfo();
    this.renderTimeline();
    
    if (this._ctx && this._canvas) {
      this.redrawCanvas(this._ctx, this._canvas);
    }
  },

  /* ==================== 微信分享 ==================== */

  openShareModal() {
    const tacticName = document.getElementById('tactic-name-input').value;
    const map = MAPS.find(m => m.id === AppState.currentMap);
    const tacticType = AppState.currentTacticType === 'attack' ? '进攻战术' : '防守战术';
    const desc = document.getElementById('tactic-desc').value;
    
    document.getElementById('share-preview-title').textContent = tacticName;
    document.getElementById('share-preview-map-name').textContent = map.name;
    document.getElementById('share-type-badge').textContent = tacticType;
    document.getElementById('share-preview-desc').textContent = desc || '暂无描述';
    document.getElementById('share-map-thumb').src = `assets/map-${AppState.currentMap}.jpg`;
    
    // 生成简化的二维码（用文字模拟）
    this.generateQRCode();
    
    this.openModal('share');
  },

  generateQRCode() {
    const qrContainer = document.getElementById('qr-code');
    const tacticData = {
      mapId: AppState.currentMap,
      type: AppState.currentTacticType,
      name: document.getElementById('tactic-name-input').value,
      timestamp: Date.now()
    };
    
    // 模拟二维码 - 生成一个简单的点阵图案
    const size = 21;
    let qrHtml = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">';
    
    // 生成伪随机的二维码图案
    const seed = JSON.stringify(tacticData).length;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // 三个定位角
        if ((i < 7 && j < 7) || (i < 7 && j >= size - 7) || (i >= size - 7 && j < 7)) {
          const isOuter = i === 0 || i === 6 || j === 0 || j === 6 || 
                          (i < 7 && j < 7 && (i === 0 || i === 6 || j === 0 || j === 6)) ||
                          (i < 7 && j >= size - 7 && (i === 0 || i === 6 || j === size - 7 || j === size - 1)) ||
                          (i >= size - 7 && j < 7 && (i === size - 7 || i === size - 1 || j === 0 || j === 6));
          const isInner = (i >= 2 && i <= 4 && j >= 2 && j <= 4) ||
                          (i >= 2 && i <= 4 && j >= size - 5 && j <= size - 3) ||
                          (i >= size - 5 && i <= size - 3 && j >= 2 && j <= 4);
          if (isOuter || isInner) {
            qrHtml += `<rect x="${j * (100/size)}" y="${i * (100/size)}" width="${100/size}" height="${100/size}" fill="#000"/>`;
          }
        } else {
          // 伪随机数据点
          const hash = ((i * 31 + j * 17 + seed) % 7) < 3;
          if (hash) {
            qrHtml += `<rect x="${j * (100/size)}" y="${i * (100/size)}" width="${100/size}" height="${100/size}" fill="#000"/>`;
          }
        }
      }
    }
    
    qrHtml += '</svg>';
    qrContainer.innerHTML = qrHtml;
  },

  copyShareLink() {
    const tacticData = {
      mapId: AppState.currentMap,
      type: AppState.currentTacticType,
      name: document.getElementById('tactic-name-input').value,
      description: document.getElementById('tactic-desc').value,
      players: AppState.players,
      drawings: AppState.drawings,
      grenades: AppState.grenades,
      timeline: AppState.timeline
    };
    
    const encoded = btoa(encodeURIComponent(JSON.stringify(tacticData)));
    const shareUrl = `${window.location.origin}${window.location.pathname}?tactic=${encoded}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.showToast('分享链接已复制到剪贴板');
    }).catch(() => {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('分享链接已复制');
    });
  },

  exportTacticFile() {
    const tacticData = {
      mapId: AppState.currentMap,
      type: AppState.currentTacticType,
      name: document.getElementById('tactic-name-input').value,
      description: document.getElementById('tactic-desc').value,
      players: AppState.players,
      drawings: AppState.drawings,
      grenades: AppState.grenades,
      timeline: AppState.timeline,
      exportedAt: Date.now(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(tacticData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tacticData.name}_${AppState.currentMap}.cs2tactic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('战术文件已导出');
  },

  /* ==================== 缩放控制 ==================== */

  initZoomControls() {
    let zoom = 1;
    const container = document.getElementById('map-container');
    const zoomLevel = document.getElementById('zoom-level');
    
    const updateZoom = () => {
      container.style.transform = `scale(${zoom})`;
      zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    };
    
    document.getElementById('zoom-in').addEventListener('click', () => {
      zoom = Math.min(2, zoom + 0.1);
      updateZoom();
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
      zoom = Math.max(0.5, zoom - 0.1);
      updateZoom();
    });
    
    document.getElementById('zoom-reset').addEventListener('click', () => {
      zoom = 1;
      updateZoom();
    });
  },

  /* ==================== 阵营切换 ==================== */

  toggleFaction(side) {
    AppState.currentSide = side;
    
    // 更新所有CT/T切换按钮
    document.querySelectorAll('.cs2-segmented.ct-t button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.side === side);
    });
    
    // 更新阵容
    this.renderLineup();
    this.updateTeamGrenadeInfo();
  },

  toggleTacticType(type) {
    AppState.currentTacticType = type;
    
    document.querySelectorAll('#tactic-type-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    const typeLabel = type === 'attack' ? '进攻战术' : '防守战术';
    document.getElementById('info-type').textContent = typeLabel;
  },

  /* ==================== 初始化 ==================== */

  init() {
    // 初始化存储
    Storage.load();
    
    // 初始化地图选择页
    this.initMapSelectPage();
    
    // 返回按钮
    document.getElementById('btn-back-to-maps').addEventListener('click', () => {
      this.showPage('page-map-select');
      this.initMapSelectPage(); // 刷新统计
    });
    
    // 阵营切换（首页）
    document.querySelectorAll('#faction-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.side;
        AppState.currentSide = side;
        document.querySelectorAll('#faction-toggle button').forEach(b => b.classList.toggle('active', b.dataset.side === side));
      });
    });
    
    // 阵营切换（战术板）
    document.querySelectorAll('#board-faction-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toggleFaction(btn.dataset.side);
      });
    });
    
    // 战术类型切换
    document.querySelectorAll('#tactic-type-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toggleTacticType(btn.dataset.type);
      });
    });
    
    // 保存按钮
    document.getElementById('btn-save-tactic').addEventListener('click', () => {
      this.openTacticsLibrary();
    });
    
    // 战术库按钮
    document.getElementById('btn-tactics-library').addEventListener('click', () => {
      this.openTacticsLibrary();
    });
    
    // 分享按钮
    document.getElementById('btn-share').addEventListener('click', () => {
      this.openShareModal();
    });
    
    // 战术种子按钮
    document.getElementById('btn-seed').addEventListener('click', () => {
      this.openSeedModal();
    });
    
    // 生成 / 复制 / 导入种子
    document.getElementById('btn-generate-seed').addEventListener('click', () => {
      this.generateSeed();
    });
    
    document.getElementById('btn-copy-seed').addEventListener('click', () => {
      this.copySeed();
    });
    
    document.getElementById('btn-import-seed').addEventListener('click', () => {
      this.importSeed();
    });
    
    // 弹窗关闭按钮
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        this.closeModal(modalId);
      });
    });
    
    // 点击遮罩关闭弹窗
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
    
    // 战术库标签切换
    document.querySelectorAll('.library-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTacticsSlots(type);
      });
    });
    
    // 复制分享链接
    document.getElementById('btn-copy-link').addEventListener('click', () => {
      this.copyShareLink();
    });
    
    // 导出战术
    document.getElementById('btn-export-json').addEventListener('click', () => {
      this.exportTacticFile();
    });
    
    // 时间线播放控制
    document.getElementById('btn-playback').addEventListener('click', () => {
      this.togglePlayback();
    });
    
    document.getElementById('btn-prev-frame').addEventListener('click', () => {
      TimelineManager.prevFrame();
      this.renderAll();
      this.renderTimeline();
    });
    
    document.getElementById('btn-next-frame').addEventListener('click', () => {
      TimelineManager.nextFrame();
      this.renderAll();
      this.renderTimeline();
    });
    
    document.getElementById('btn-stop').addEventListener('click', () => {
      TimelineManager.stop();
      this.renderAll();
      this.renderTimeline();
      document.getElementById('play-icon').setAttribute('data-lucide', 'play');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    
    // 时间线点击跳转
    document.getElementById('timeline-track').addEventListener('click', (e) => {
      // 如果点击的是关键帧标记，让关键帧自己的click处理
      if (e.target.closest('.timeline-keyframe')) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const time = percent * AppState.timeline.duration;
      TimelineManager.setCurrentTime(time);
      
      // 应用当前时间点之前的最后一个关键帧状态（阶梯式）
      const activeKf = TimelineManager.getActiveKeyframeAtTime(time);
      if (activeKf) {
        TimelineManager.applyState(activeKf.state);
        AppState.timeline.selectedKeyframeId = activeKf.id;
        this.renderAll();
      } else {
        AppState.timeline.selectedKeyframeId = null;
      }
      
      this.updateGrenadeVisibility();
      this.updateTimelineProgress();
      this.renderTimeline();
    });
    
    // 添加关键帧
    document.getElementById('btn-add-keyframe').addEventListener('click', () => {
      this.addKeyframe();
    });
    
    // 保存关键帧
    const saveKfBtn = document.getElementById('btn-save-keyframe');
    if (saveKfBtn) {
      saveKfBtn.addEventListener('click', () => {
        this.saveCurrentToKeyframe();
      });
    }
    
    // 删除关键帧
    const deleteKfBtn = document.getElementById('btn-delete-keyframe');
    if (deleteKfBtn) {
      deleteKfBtn.addEventListener('click', () => {
        this.deleteSelectedKeyframe();
      });
    }
    
    // 战术名称同步
    document.getElementById('tactic-name-input').addEventListener('input', (e) => {
      document.getElementById('info-name').textContent = e.target.value;
    });
    
    // 缩放控制
    this.initZoomControls();
    
    // 检查URL中是否有分享的战术
    this.checkSharedTactic();
    
    // 初始化图标
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  checkSharedTactic() {
    const params = new URLSearchParams(window.location.search);
    const tacticParam = params.get('tactic');
    
    if (tacticParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(tacticParam)));
        if (decoded.mapId && MAPS.find(m => m.id === decoded.mapId)) {
          // 打开对应地图
          setTimeout(() => {
            this.openTacticsBoard(decoded.mapId);
            
            // 加载战术数据
            if (decoded.players) AppState.players = decoded.players;
            if (decoded.drawings) AppState.drawings = decoded.drawings;
            if (decoded.grenades) AppState.grenades = decoded.grenades;
            if (decoded.timeline) AppState.timeline = decoded.timeline;
            if (decoded.name) {
              document.getElementById('tactic-name-input').value = decoded.name;
              document.getElementById('info-name').textContent = decoded.name;
            }
            if (decoded.description) {
              document.getElementById('tactic-desc').value = decoded.description;
            }
            if (decoded.type) {
              this.toggleTacticType(decoded.type);
            }
            if (decoded.side) {
              this.toggleFaction(decoded.side);
            }
            
            // 重新渲染
            this.renderMapPlayers();
            this.renderGrenadeMarkers();
            this.renderAnnotations();
            this.renderTimeline();
            this.renderPlayerTools();
            this.renderLineup();
            this.updateTeamGrenadeInfo();
            
            if (this._ctx && this._canvas) {
              setTimeout(() => this.redrawCanvas(this._ctx, this._canvas), 100);
            }
            
            this.showToast('已加载分享的战术');
          }, 500);
        }
      } catch (e) {
        console.error('解析分享战术失败:', e);
      }
    }
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 窗口大小变化时重绘canvas
window.addEventListener('resize', () => {
  if (App._canvas && App._ctx) {
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    App._canvas.width = rect.width;
    App._canvas.height = rect.height;
    App.redrawCanvas(App._ctx, App._canvas);
  }
});
