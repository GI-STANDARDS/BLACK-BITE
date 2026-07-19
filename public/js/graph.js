class InvestigationGraph {
  constructor(canvasId, opts = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.container = this.canvas.parentElement;
    this.tooltip = opts.tooltipEl || null;

    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
    this.hoveredNode = null;
    this.highlightedNodes = new Set();

    // View transform
    this.viewX = 0;
    this.viewY = 0;
    this.zoom = 1;

    // Physics
    this.simulation = null;
    this.simulating = false;

    // Interaction
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.panning = false;
    this.panStart = { x: 0, y: 0 };

    // Filters
    this.filters = { types: {}, minStrength: 0, timeRange: [0, Infinity] };

    // Focus mode
    this._focusNodeId = null;
    this._focusNodeIds = null;
    this._savedView = null;
    this._backBtn = null;
    this._focusOffsets = null;

    // Node type config
    this.typeConfig = {
      person: { color: '#000000', radius: 18, icon: 'P', border: '#000000' },
      event: { color: '#ffaa00', radius: 16, icon: 'E', border: '#ffaa00' },
      evidence: { color: '#0066ff', radius: 14, icon: 'X', border: '#0066ff' },
      location: { color: '#00c8ff', radius: 16, icon: 'L', border: '#00c8ff' },
    };

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp(null));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.loop();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
  }

  setData(nodes, connections) {
    let savedFocus = null;
    if (this._focusNodeId) {
      const cur = this.getNodeById(this._focusNodeId);
      if (cur) savedFocus = { x: cur.x, y: cur.y };
    }
    this.nodes = nodes.map(n => ({
      ...n,
      vx: 0, vy: 0,
      pinned: true,
      flagged: n.flagged || false,
      note: n.note || '',
    }));
    this.connections = connections;
    if (this._focusNodeId) {
      if (savedFocus) {
        const node = this.getNodeById(this._focusNodeId);
        if (node) { node.x = savedFocus.x; node.y = savedFocus.y; }
      }
      this._applyFocusOffsets();
    }
  }

  // ---- Force-directed layout ----
  startSimulation() {
    if (this.simulating) return;
    this.simulating = true;
    let iterations = 0;
    const maxIter = 200;
    const step = () => {
      if (!this.simulating) return;
      this.simulateStep();
      iterations++;
      let energy = this.nodes.reduce((s, n) => s + Math.abs(n.vx) + Math.abs(n.vy), 0);
      if (energy < 0.5 || iterations >= maxIter) {
        this.simulating = false;
        this.nodes.forEach(n => n.pinned = true);
        return;
      }
      requestAnimationFrame(step);
    };
    step();
  }

  simulateStep() {
    const repulsion = 3000;
    const attraction = 0.008;
    const damping = 0.9;
    const minDist = 30;

    // Repulsion between all nodes
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = repulsion / (dist * dist);
        let fx = (dx / dist) * force, fy = (dy / dist) * force;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }
    }

    // Attraction along connections
    const connMap = {};
    this.connections.forEach(c => {
      if (!connMap[c.source_id]) connMap[c.source_id] = [];
      connMap[c.source_id].push(c.target_id);
      if (!connMap[c.target_id]) connMap[c.target_id] = [];
      connMap[c.target_id].push(c.source_id);
    });
    this.connections.forEach(c => {
      const a = this.nodes.find(n => n.id === c.source_id);
      const b = this.nodes.find(n => n.id === c.target_id);
      if (!a || !b) return;
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      let force = (dist - 150) * attraction;
      let fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    });

    // Center gravity
    const cx = this.width / 2, cy = this.height / 2;
    this.nodes.forEach(n => {
      if (n.pinned) return;
      n.vx += (cx - n.x) * 0.001;
      n.vy += (cy - n.y) * 0.001;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(50, Math.min(this.width - 50, n.x));
      n.y = Math.max(50, Math.min(this.height - 50, n.y));
    });
  }

  // ---- Coordinate transforms ----
  screenToGraph(sx, sy) {
    return {
      x: (sx - this.viewX) / this.zoom,
      y: (sy - this.viewY) / this.zoom,
    };
  }

  graphToScreen(gx, gy) {
    return {
      x: gx * this.zoom + this.viewX,
      y: gy * this.zoom + this.viewY,
    };
  }

  findNodeAt(sx, sy) {
    const g = this.screenToGraph(sx, sy);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (!this.isNodeVisible(n)) continue;
      if (this._focusNodeIds && !this._focusNodeIds.has(n.id)) continue;
      const dx = g.x - n.x, dy = g.y - n.y;
      const r = (this.typeConfig[n.type] || this.typeConfig.person).radius;
      if (dx * dx + dy * dy <= (r + 4) * (r + 4)) return n;
    }
    return null;
  }

  isNodeVisible(node) {
    if (this.filters.types[node.type] === false) return false;
    const t = new Date(node.timestamp || 0).getTime();
    if (t < this.filters.timeRange[0] || t > this.filters.timeRange[1]) return false;
    return true;
  }

  // ---- Highlight connected network ----
  highlightNetwork(node) {
    this.highlightedNodes.clear();
    if (!node) return;
    this.highlightedNodes.add(node.id);
    this.connections.forEach(c => {
      if (c.source_id === node.id) this.highlightedNodes.add(c.target_id);
      if (c.target_id === node.id) this.highlightedNodes.add(c.source_id);
    });
  }

  // ---- Render ----
  render() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.viewX, this.viewY);
    ctx.scale(this.zoom, this.zoom);

    // Grid
    ctx.strokeStyle = 'rgba(0,200,255,0.03)';
    ctx.lineWidth = 0.5;
    const gridSize = 80;
    for (let x = -gridSize; x < w / this.zoom + gridSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, -gridSize); ctx.lineTo(x, h / this.zoom + gridSize); ctx.stroke();
    }
    for (let y = -gridSize; y < h / this.zoom + gridSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(-gridSize, y); ctx.lineTo(w / this.zoom + gridSize, y); ctx.stroke();
    }

    // Connections
    this.connections.forEach(c => {
      const src = this.nodes.find(n => n.id === c.source_id);
      const tgt = this.nodes.find(n => n.id === c.target_id);
      if (!src || !tgt) return;
      if (!this.isNodeVisible(src) || !this.isNodeVisible(tgt)) return;
      if (this._focusNodeId && src.id !== this._focusNodeId && tgt.id !== this._focusNodeId) return;

      const highlight = this.highlightedNodes.has(src.id) && this.highlightedNodes.has(tgt.id);
      const isConnected = this.highlightedNodes.size > 0 && highlight;
      const alpha = this.highlightedNodes.size > 0 ? (isConnected ? 1 : 0.08) : 0.6;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (c.type === 'verified') {
        ctx.strokeStyle = '#00dd88';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else if (c.type === 'critical') {
        ctx.strokeStyle = '#ff2244';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = isConnected ? 8 : 0;
      } else {
        ctx.strokeStyle = '#6868a0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
      }

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.restore();


    });

    // Nodes (focus filter: only show entity + 1-hop connections)
    let visible = this.nodes.filter(n => this.isNodeVisible(n));
    if (this._focusNodeIds) {
      visible = visible.filter(n => this._focusNodeIds.has(n.id));
    }
    visible.forEach(n => {
      const cfg = this.typeConfig[n.type] || this.typeConfig.person;
      const isHover = this.hoveredNode && this.hoveredNode.id === n.id;
      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHighlighted = this.highlightedNodes.size === 0 || this.highlightedNodes.has(n.id);

      ctx.save();
      if (this.highlightedNodes.size > 0 && !isHighlighted) ctx.globalAlpha = 0.1;

      // Node shape
      const r = cfg.radius * (isHover ? 1.15 : 1);

      if (n.type === 'event') {
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
          const px = n.x + r * Math.cos(a);
          const py = n.y + r * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = (isSelected || isHover) ? cfg.color + '44' : cfg.color + '22';
        ctx.fill();
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      } else if (n.type === 'location') {
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.fillStyle = (isSelected || isHover) ? cfg.color + '44' : cfg.color + '22';
        ctx.beginPath();
        ctx.roundRect(n.x - r, n.y - r * 0.7, r * 2, r * 1.4, 4);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = (isSelected || isHover) ? cfg.color + '44' : cfg.color + '22';
        ctx.fill();
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      }

      // Label inside
      ctx.fillStyle = cfg.color;
      ctx.font = `bold ${r * 0.7}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.icon, n.x, n.y + 1);

      // Label below
      ctx.fillStyle = '#c8c8e0';
      ctx.font = `${Math.max(9, r * 0.7)}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      const label = n.label.length > 16 ? n.label.slice(0, 15) + '\u2026' : n.label;
      ctx.fillText(label, n.x, n.y + r + 4);

      // Flag indicator
      if (n.flagged) {
        ctx.fillStyle = '#ff2244';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2691', n.x + r - 2, n.y - r + 2);
      }

      ctx.restore();
    });

    // Connection labels near connected nodes on hover
    if (this.hoveredNode) {
      this.connections.forEach(c => {
        if (c.source_id !== this.hoveredNode.id && c.target_id !== this.hoveredNode.id) return;
        const otherId = c.source_id === this.hoveredNode.id ? c.target_id : c.source_id;
        const other = this.nodes.find(n => n.id === otherId);
        if (!other || !this.isNodeVisible(other)) return;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#000000';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = c.label || c.type;
        ctx.fillText(label, other.x, other.y - this.typeConfig[other.type]?.radius - 2 || -20);
        ctx.restore();
      });
    }

    ctx.restore();

    // Mini-map / status text
    ctx.fillStyle = '#383860';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`NODES: ${visible.length}  ZOOM: ${Math.round(this.zoom * 100)}%`, 10, this.height - 10);
  }

  loop() {
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  // ---- Mouse handlers ----
  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = this.findNodeAt(sx, sy);

    if (node) {
      this.dragging = node;
      const g = this.screenToGraph(sx, sy);
      this.dragOffset = { x: g.x - node.x, y: g.y - node.y };
      node.pinned = true;
      this.focusOnEntity(node.id);
    } else {
      this.selectNode(null);
      this.panning = true;
      this.panStart = { x: sx, y: sy };
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.dragging) {
      const g = this.screenToGraph(sx, sy);
      this.dragging.x = g.x - this.dragOffset.x;
      this.dragging.y = g.y - this.dragOffset.y;
      if (this._focusNodeId && this.dragging.id === this._focusNodeId) {
        this._applyFocusOffsets();
      }
      return;
    }

    if (this.panning) {
      this.viewX += sx - this.panStart.x;
      this.viewY += sy - this.panStart.y;
      this.panStart = { x: sx, y: sy };
      return;
    }

    // Hover detection
    const node = this.findNodeAt(sx, sy);
    if (node !== this.hoveredNode) {
      this.hoveredNode = node;
      this.highlightNetwork(node);
      this.canvas.style.cursor = node ? 'pointer' : 'default';
      if (this.tooltip && node) {
        this.tooltip.innerHTML = `<div class="tt-label">${node.label}</div><div class="tt-type">${node.description || node.type}</div>`;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = Math.min(sx + 16, this.width - 230) + 'px';
        this.tooltip.style.top = Math.min(sy + 16, this.height - 80) + 'px';
      } else if (this.tooltip) {
        this.tooltip.style.display = 'none';
      }
    }
  }

  onMouseUp(e) {
    if (this.dragging) {
      this.dragging = null;
    }
    this.panning = false;
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = this.screenToGraph(sx, sy);
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    this.zoom = this.zoom * delta;
    if (this.zoom < 0.01) this.zoom = 0.01;
    // Zoom toward mouse
    this.viewX = sx - g.x * this.zoom;
    this.viewY = sy - g.y * this.zoom;
  }

  onDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = this.findNodeAt(sx, sy);
    if (node) {
      // Center on node
      this.viewX = this.width / 2 - node.x * this.zoom;
      this.viewY = this.height / 2 - node.y * this.zoom;
    }
  }

  selectNode(node) {
    this.selectedNode = node;
    if (node) this.highlightNetwork(node);
    else this.highlightedNodes.clear();
    const event = new CustomEvent('nodeSelect', { detail: { node } });
    document.dispatchEvent(event);
  }

  // ---- Public API ----
  zoomIn() {
    const cx = this.width / 2, cy = this.height / 2;
    const g = this.screenToGraph(cx, cy);
    this.zoom = this.zoom * 1.3;
    this.viewX = cx - g.x * this.zoom;
    this.viewY = cy - g.y * this.zoom;
  }
  zoomOut() {
    const cx = this.width / 2, cy = this.height / 2;
    const g = this.screenToGraph(cx, cy);
    this.zoom = this.zoom / 1.3;
    if (this.zoom < 0.01) this.zoom = 0.01;
    this.viewX = cx - g.x * this.zoom;
    this.viewY = cy - g.y * this.zoom;
  }
  resetView() {
    this.viewX = 0; this.viewY = 0; this.zoom = 1;
  }

  getNodeById(id) { return this.nodes.find(n => n.id === id); }
  getConnectionsForNode(id) {
    return this.connections.filter(c => c.source_id === id || c.target_id === id);
  }

  highlightNodeById(id) {
    const node = this.nodes.find(n => n.id === id);
    if (node) {
      this.selectNode(node);
      // Center on it
      this.viewX = this.width / 2 - node.x * this.zoom;
      this.viewY = this.height / 2 - node.y * this.zoom;
    }
  }

  // ---- Focus mode: zoom into entity + connections in pentagon nest ----
  focusOnEntity(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return;

    // Already focused on this node — just center view
    if (this._focusNodeId === nodeId) {
      this.selectNode(node);
      this.viewX = this.width / 2 - node.x * this.zoom;
      this.viewY = this.height / 2 - node.y * this.zoom;
      return;
    }

    // Save view state on first focus entry
    if (!this._focusNodeId) {
      this._savedView = { viewX: this.viewX, viewY: this.viewY, zoom: this.zoom };
    }

    this._focusNodeId = nodeId;
    this._focusNodeIds = null;
    this.selectNode(node);

    // Get 1-hop connections
    const conns = this.getConnectionsForNode(nodeId);
    const connectedIds = [...new Set(conns.map(c => c.source_id === nodeId ? c.target_id : c.source_id))];
    this._focusNodeIds = new Set([nodeId, ...connectedIds]);

    // Compute pentagon offsets relative to entity position
    this._focusOffsets = [];
    connectedIds.forEach((id, i) => {
      const cn = this.getNodeById(id);
      if (!cn) return;
      const ring = Math.floor(i / 5);
      const vertex = i % 5;
      const angle = (Math.PI * 2 * vertex) / 5 - Math.PI / 2 + ring * 0.12;
      const radius = 80 + ring * 55;
      this._focusOffsets.push({
        id,
        ox: Math.cos(angle) * radius,
        oy: Math.sin(angle) * radius,
      });
    });

    this._applyFocusOffsets();

    // Center view on entity
    this.viewX = this.width / 2 - node.x * this.zoom;
    this.viewY = this.height / 2 - node.y * this.zoom;

    // Show back button
    if (this._backBtn) this._backBtn.style.display = 'flex';
  }

  _applyFocusOffsets() {
    if (!this._focusOffsets || !this._focusNodeId) return;
    const node = this.getNodeById(this._focusNodeId);
    if (!node) return;
    this._focusOffsets.forEach(({ id, ox, oy }) => {
      const cn = this.getNodeById(id);
      if (cn) {
        cn.x = node.x + ox;
        cn.y = node.y + oy;
        cn.pinned = true;
      }
    });
  }

  exitFocusMode() {
    this._focusNodeId = null;
    this._focusNodeIds = null;
    this._focusOffsets = null;
    if (this._savedView) {
      this.viewX = this._savedView.viewX;
      this.viewY = this._savedView.viewY;
      this.zoom = this._savedView.zoom;
      this._savedView = null;
    }
    this.selectNode(null);
    if (this._backBtn) this._backBtn.style.display = 'none';
  }

  applyFilters(filters) {
    this.filters = { ...this.filters, ...filters };
  }

  setNodeTypeFilter(type, visible) {
    this.filters.types[type] = visible;
  }

  setTimeRange(min, max) {
    this.filters.timeRange = [min, max];
  }
}

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
  };
}
