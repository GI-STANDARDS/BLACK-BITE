(function() {
  'use strict';

  let currentCaseId = null;
  let cases = [];
  let timeline = [];
  let graph = null;
  let pollInterval = null;
  let currentNode = null;
  let mdAutoSave = null;

  // Toast
  function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // Render the full app shell
  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="syslog-bar">
        <span class="syslog-label">&#x25B6; SYSTEM LOG</span>
        <div class="syslog-scroll">
          <div class="syslog-items" id="syslogItems"></div>
        </div>
      </div>
      <div class="topbar">
        <div class="logo">&#x25C6; GRAPH <span>SYSTEM</span></div>
        <div class="topbar-divider"></div>
        <div class="case-selector">
          <select id="caseSelect"><option value="">-- SELECT CASE --</option></select>
          <button class="toggle-btn" id="btnNewCase" title="New Case">+</button>
        </div>
        <div class="topbar-divider"></div>
        <div class="search-box">
          <span class="icon">&#x2315;</span>
          <input type="text" id="globalSearch" placeholder="Search nodes...">
        </div>
        <div class="topbar-divider"></div>
        <div class="filter-group">
          <label>Types</label>
          <button class="toggle-btn active" data-type="person">P</button>
          <button class="toggle-btn active" data-type="event">E</button>
          <button class="toggle-btn active" data-type="evidence">X</button>
          <button class="toggle-btn active" data-type="location">L</button>
        </div>
        <div class="topbar-divider"></div>
        <div class="filter-group">
          <label>Weak links</label>
          <button class="toggle-btn active" id="toggleWeakLinks">ON</button>
        </div>
        <div class="topbar-divider"></div>
        <div class="time-slider-wrap">
          <span class="time-label" id="timeLabel">ALL</span>
          <input type="range" id="timeSlider" min="0" max="100" value="100">
        </div>
        <div class="topbar-divider"></div>
        <button class="btn-export" id="exportJSON">JSON</button>
        <button class="btn-export" id="exportCSV">CSV</button>
        <div class="topbar-divider"></div>
        <button class="toggle-btn" id="themeToggle">DAY</button>
      </div>

      <div class="main-layout">
        <div class="timeline-panel" id="timelinePanel">
          <div class="timeline-panel-header">
            CASE TIMELINE <span class="count" id="tlCount"></span>
          </div>
          <div class="timeline-thread" id="timelineThread">
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">Select a case</div>
          </div>
          <div class="tl-inspector" id="tlInspector"></div>
        </div>

        <div class="canvas-container" id="canvasContainer">
          <canvas id="graphCanvas"></canvas>
          <div class="canvas-tooltip" id="tooltip"></div>
          <div class="node-legend" id="nodeLegend">
            <div class="node-legend-item"><span class="node-legend-dot" style="background:var(--cyan)"></span>Person</div>
            <div class="node-legend-item"><span class="node-legend-dot" style="background:var(--amber)"></span>Event</div>
            <div class="node-legend-item"><span class="node-legend-dot" style="background:var(--red)"></span>Evidence</div>
            <div class="node-legend-item"><span class="node-legend-dot" style="background:var(--green)"></span>Location</div>
            <div class="node-legend-item" style="margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">
              <span style="display:flex;gap:4px;align-items:center;"><span style="width:12px;height:2px;background:var(--cyan);display:inline-block;"></span> verified</span>
              <span style="display:flex;gap:4px;align-items:center;"><span style="width:12px;height:1px;background:var(--text-muted);border-top:1px dashed var(--text-muted);display:inline-block;"></span> unverified</span>
              <span style="display:flex;gap:4px;align-items:center;"><span style="width:12px;height:2px;background:var(--red);display:inline-block;"></span> critical</span>
            </div>
          </div>
          <div class="add-node-menu">
            <button class="add-node-btn person" data-type="person">+ Person</button>
            <button class="add-node-btn event" data-type="event">+ Event</button>
            <button class="add-node-btn evidence" data-type="evidence">+ Evidence</button>
            <button class="add-node-btn location" data-type="location">+ Location</button>
          </div>
          <button id="focusBackBtn" style="display:none;">&#x2190; BACK</button>
          <div class="canvas-controls">
            <button id="zoomIn" title="Zoom In">+</button>
            <button id="zoomOut" title="Zoom Out">-</button>
            <button id="resetView" title="Reset View">&#x25A3;</button>
          </div>
        </div>

        <div class="md-panel hidden" id="mdPanel">
          <div class="md-panel-header">
            <span id="mdPanelTitle">MARKDOWN NOTES</span>
            <div class="md-mode-toggle">
              <button class="md-mode-btn" data-md-mode="edit">EDIT</button>
              <button class="md-mode-btn active" data-md-mode="preview">VIEW</button>
            </div>
          </div>
          <div class="md-body">
            <textarea id="mdEditor" placeholder="Write markdown for this entity..."></textarea>
            <div class="md-preview" id="mdPreview"></div>
          </div>
        </div>
      </div>

    `;

    // Inspector is already in index.html
  }

  // ---- Case Management ----
  async function loadCases() {
    try {
      cases = await API.getCases();
      const sel = document.getElementById('caseSelect');
      sel.innerHTML = '<option value="">-- SELECT CASE --</option>';
      cases.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        sel.appendChild(opt);
      });
      if (currentCaseId) sel.value = currentCaseId;
    } catch { toast('Failed to load cases', 'error'); }
  }

  async function selectCase(caseId) {
    currentCaseId = caseId;
    if (!caseId) {
      document.querySelector('.timeline-thread').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">Select a case</div>';
      document.getElementById('tlCount').textContent = '';
      document.getElementById('syslogItems').innerHTML = '';
      return;
    }
    try {
      const data = await API.getGraph(caseId);
      graph.setData(data.nodes, data.connections);
      startPolling(caseId);
      loadTimeline(caseId);
      loadSystemLog(caseId);
      updateTimeSlider(caseId);
      toast(`Loaded: ${cases.find(c => c.id === caseId)?.title}`, 'success');
    } catch { toast('Failed to load graph', 'error'); }
  }

  // ---- Timeline ----
  async function loadTimeline(caseId) {
    try {
      timeline = await API.getTimeline(caseId);
      renderTimeline();
    } catch {}
  }

  function renderTimeline() {
    const thread = document.querySelector('.timeline-thread');
    const count = document.getElementById('tlCount');
    if (!thread) return;
    count.textContent = `(${timeline.length})`;
    if (!timeline.length) {
      thread.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">No timeline events</div>';
      return;
    }
    thread.innerHTML = timeline.map(t => {
      const ts = new Date(t.timestamp);
      const timeStr = ts.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="timeline-item" data-node-id="${t.node_id}" data-tl-id="${t.id}">
        <div class="tl-time">${timeStr}</div>
        <div class="tl-type ${t.type}">${t.type}</div>
        <div class="tl-desc">${t.description}</div>
      </div>`;
    }).join('');

    thread.querySelectorAll('.timeline-item').forEach(el => {
      el.addEventListener('click', () => {
        thread.querySelectorAll('.timeline-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        const nodeId = el.dataset.nodeId;
        if (nodeId && graph) graph.highlightNodeById(nodeId);
      });
    });
  }

  // ---- System Log ----
  async function loadSystemLog(caseId) {
    try {
      const log = await API.getSystemLog(caseId);
      const items = document.getElementById('syslogItems');
      if (!items) return;
      const html = log.map(l => {
        const ts = new Date(l.timestamp);
        const t = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<span class="syslog-item"><span class="sl-time">[${t}]</span> <span class="sl-action">${l.action}</span> ${l.detail}</span>`;
      }).join('');
      // Duplicate for seamless scroll
      items.innerHTML = html + html;
    } catch {}
  }

  // ---- Polling ----
  function startPolling(caseId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!currentCaseId) return;
      try {
        const data = await API.getGraph(currentCaseId);
        graph.setData(data.nodes, data.connections);
        loadTimeline(currentCaseId);
        loadSystemLog(currentCaseId);
      } catch {}
    }, 5000);
  }

  // ---- Time Slider ----
  function updateTimeSlider(caseId) {
    const slider = document.getElementById('timeSlider');
    const label = document.getElementById('timeLabel');
    const nodes = graph ? graph.nodes : [];
    if (!nodes.length) { slider.value = 100; label.textContent = 'ALL'; return; }
    const times = nodes.map(n => new Date(n.timestamp || 0).getTime()).filter(t => t > 0);
    if (!times.length) { slider.value = 100; label.textContent = 'ALL'; return; }
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const range = maxT - minT || 1;

    slider.oninput = function() {
      const pct = parseInt(this.value);
      const limit = minT + (range * pct) / 100;
      if (pct >= 100) {
        graph.setTimeRange(0, Infinity);
        label.textContent = 'ALL';
      } else {
        graph.setTimeRange(0, limit);
        const d = new Date(limit);
        label.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };
  }

  // ---- Markdown Renderer ----
  function renderMarkdown(md) {
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  function loadMdPanel(node) {
    const editor = document.getElementById('mdEditor');
    const preview = document.getElementById('mdPreview');
    const title = document.getElementById('mdPanelTitle');
    const panel = document.getElementById('mdPanel');
    if (node) {
      panel.classList.remove('hidden');
      title.textContent = 'MD: ' + node.label;
      editor.value = node.md || '';
    } else {
      panel.classList.add('hidden');
    }
    preview.innerHTML = renderMarkdown(editor.value);
  }

  function saveCurrentMd() {
    if (!currentNode) return;
    const md = document.getElementById('mdEditor').value;
    currentNode.md = md;
    API.updateNode(currentNode.id, { md });
  }

  // ---- Left Inspector ----
  function renderInspector(node) {
    currentNode = node;
    const el = document.getElementById('tlInspector');
    if (!node) { el.classList.remove('open'); loadMdPanel(null); return; }
    el.classList.add('open');
    loadMdPanel(node);
    const conns = graph.getConnectionsForNode(node.id);
    const connHtml = conns.map(c => {
      const otherId = c.source_id === node.id ? c.target_id : c.source_id;
      const other = graph.getNodeById(otherId);
      return `<div class="tl-inspector-conn" data-conn-id="${c.id}" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        <select class="tl-conn-type-select" data-conn-id="${c.id}" style="font-family:var(--font-mono);font-size:0.55rem;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary);border-radius:2px;padding:1px 2px;">
          <option value="verified" ${c.type === 'verified' ? 'selected' : ''}>V</option>
          <option value="unverified" ${c.type === 'unverified' ? 'selected' : ''}>U</option>
          <option value="critical" ${c.type === 'critical' ? 'selected' : ''}>C</option>
        </select>
        <span class="conn-dot ${c.type}"></span>
        <input class="tl-conn-label" data-conn-id="${c.id}" value="${(c.label || '').replace(/"/g,'&quot;')}" style="flex:1;min-width:50px;background:var(--bg-surface);border:1px solid transparent;color:var(--text-primary);font-size:0.65rem;padding:1px 4px;border-radius:2px;outline:none;font-family:var(--font-mono);">
        <button class="tl-conn-del" data-conn-id="${c.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.7rem;padding:0 2px;">\u2715</button>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="tl-inspector-title">ENTITY INSPECTOR</div>
      <div class="tl-inspector-type ${node.type}">${node.type.toUpperCase()}</div>
      <div class="tl-inspector-id">${node.id}</div>
      <div class="tl-inspector-title" style="margin-top:8px;">DESCRIPTION</div>
      <textarea class="tl-inspector-note" id="tlDescEdit" style="min-height:50px;" placeholder="Edit description...">${node.description || ''}</textarea>
      <div class="tl-inspector-title" style="margin-top:8px;">TAGS</div>
      <div class="tl-inspector-tags" id="tlTagsWrap">
        ${(node.tags || []).map(t => `<span class="tl-inspector-tag" data-tag="${t}" style="cursor:pointer;">${t} \u00d7</span>`).join('')}
      </div>
      <div class="tl-inspector-add-tag">
        <input type="text" id="tlTagInput" placeholder="add tag..." maxlength="30">
        <button id="tlAddTagBtn">+</button>
      </div>
      <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">CONNECTIONS (${conns.length})</div>
      <div class="tl-inspector-conns">${connHtml || '<div style="color:var(--text-muted);font-size:0.65rem;">None</div>'}</div>
      <div class="tl-inspector-add-tag" style="margin-top:6px;">
        <select id="tlNewConnTarget" style="flex:1;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary);font-family:var(--font-mono);font-size:0.6rem;border-radius:3px;padding:4px 6px;outline:none;">
          <option value="">-- connect to --</option>
          ${graph.nodes.filter(n => n.id !== node.id).map(n => `<option value="${n.id}">${n.label} (${n.type})</option>`).join('')}
        </select>
        <select id="tlNewConnType" style="width:60px;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary);font-family:var(--font-mono);font-size:0.6rem;border-radius:3px;padding:4px 6px;outline:none;">
          <option value="verified">V</option>
          <option value="unverified">U</option>
          <option value="critical">C</option>
        </select>
        <button id="tlAddConnBtn" style="padding:4px 8px;font-family:var(--font-mono);font-size:0.6rem;background:var(--cyan-dim);border:1px solid var(--cyan);border-radius:3px;color:var(--cyan);cursor:pointer;">+</button>
      </div>
      <div class="tl-inspector-actions">
        <button class="tl-inspector-btn pin ${node.pinned ? 'active' : ''}" id="tlPinBtn">${node.pinned ? 'UNPIN' : 'PIN'}</button>
        <button class="tl-inspector-btn flag ${node.flagged ? 'active' : ''}" id="tlFlagBtn">${node.flagged ? 'UNFLAG' : 'FLAG'}</button>
      </div>
      <div class="tl-inspector-title" style="margin-top:8px;">MARKDOWN</div>
      <div class="tl-inspector-note" id="tlNodeMdPreview" style="min-height:60px;font-size:0.7rem;line-height:1.6;white-space:pre-wrap;overflow-y:auto;max-height:200px;">${node.md || 'No markdown yet...'}</div>
    `;
    // Description auto-save
    document.getElementById('tlDescEdit').addEventListener('blur', async () => {
      const desc = document.getElementById('tlDescEdit').value;
      await API.updateNode(node.id, { description: desc });
      node.description = desc;
    });
    // Tag add
    document.getElementById('tlAddTagBtn').addEventListener('click', async () => {
      const input = document.getElementById('tlTagInput');
      const tag = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!tag) return;
      const tags = [...(node.tags || [])];
      if (tags.includes(tag)) return;
      tags.push(tag);
      await API.updateNode(node.id, { tags });
      node.tags = tags;
      renderInspector(node);
      toast('Tag added', 'success');
    });
    // Pin
    document.getElementById('tlPinBtn').addEventListener('click', async () => {
      node.pinned = !node.pinned;
      await API.updateNode(node.id, { pinned: node.pinned });
      renderInspector(node);
      toast(node.pinned ? 'Node pinned' : 'Node unpinned', 'info');
    });
    // Flag
    document.getElementById('tlFlagBtn').addEventListener('click', async () => {
      node.flagged = !node.flagged;
      await API.updateNode(node.id, { flagged: node.flagged });
      renderInspector(node);
      toast(node.flagged ? 'Node flagged' : 'Unflagged', node.flagged ? 'error' : 'info');
    });

    // ---- Event delegation for connections ----
    el.addEventListener('click', async (e) => {
      // Tag remove
      const tagEl = e.target.closest('#tlTagsWrap .tl-inspector-tag');
      if (tagEl) {
        const tag = tagEl.dataset.tag;
        let tags = [...(node.tags || [])];
        tags = tags.filter(t => t !== tag);
        await API.updateNode(node.id, { tags });
        node.tags = tags;
        renderInspector(node);
        toast('Tag removed', 'info');
        return;
      }
      // Connection delete
      const delBtn = e.target.closest('.tl-conn-del');
      if (delBtn) {
        const connId = delBtn.dataset.connId;
        await API.deleteConnection(connId);
        const data = await API.getGraph(currentCaseId);
        graph.setData(data.nodes, data.connections);
        renderInspector(graph.getNodeById(currentNode.id));
        toast('Connection deleted', 'info');
        return;
      }
      // New connection
      if (e.target.id === 'tlAddConnBtn') {
        const targetId = document.getElementById('tlNewConnTarget').value;
        if (!targetId) { toast('Select a target node', 'error'); return; }
        const type = document.getElementById('tlNewConnType').value;
        await API.createConnection({ source_id: node.id, target_id: targetId, case_id: currentCaseId, type });
        const data = await API.getGraph(currentCaseId);
        graph.setData(data.nodes, data.connections);
        renderInspector(graph.getNodeById(currentNode.id));
        toast('Connection created', 'success');
        return;
      }
    });
    el.addEventListener('change', async (e) => {
      // Connection type change
      if (e.target.classList.contains('tl-conn-type-select')) {
        const connId = e.target.dataset.connId;
        const newType = e.target.value;
        const conn = graph.connections.find(c => c.id === connId);
        if (!conn) return;
        conn.type = newType;
        await API.updateConnection(connId, { type: newType });
        toast('Connection updated', 'info');
        return;
      }
    });
    el.addEventListener('blur', async (e) => {
      // Connection label edit
      if (e.target.classList.contains('tl-conn-label')) {
        const connId = e.target.dataset.connId;
        const label = e.target.value.trim();
        const conn = graph.connections.find(c => c.id === connId);
        if (conn) conn.label = label;
        await API.updateConnection(connId, { label });
        toast('Connection label updated', 'info');
        return;
      }
    }, true);
  }

  // ---- Init ----
  function init() {
    renderShell();

    // Create graph
    const tooltip = document.getElementById('tooltip');
    graph = new InvestigationGraph('graphCanvas', { tooltipEl: tooltip });
    graph._backBtn = document.getElementById('focusBackBtn');

    // Node selection
    document.addEventListener('nodeSelect', (e) => {
      const node = e.detail.node;
      if (node) {
        // Highlight in timeline
        document.querySelectorAll('.timeline-item').forEach(el => {
          el.classList.toggle('active', el.dataset.nodeId === node.id);
        });
      }
      renderInspector(node);
    });

    // Case selector
    document.getElementById('caseSelect').addEventListener('change', (e) => {
      selectCase(e.target.value);
    });

    // New case
    document.getElementById('btnNewCase').addEventListener('click', async () => {
      const title = prompt('Enter case title:');
      if (!title) return;
      try {
        const c = await API.createCase({ title });
        await loadCases();
        document.getElementById('caseSelect').value = c.id;
        selectCase(c.id);
        toast('New case created', 'success');
      } catch { toast('Failed to create case', 'error'); }
    });

    // Search
    let searchTimeout;
    document.getElementById('globalSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        if (!q || !graph) {
          graph.highlightedNodes.clear();
          return;
        }
        const match = graph.nodes.find(n =>
          n.label.toLowerCase().includes(q) ||
          (n.tags || []).some(t => t.toLowerCase().includes(q)) ||
          (n.description || '').toLowerCase().includes(q)
        );
        if (match) graph.highlightNodeById(match.id);
      }, 300);
    });

    // Type toggles
    document.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const visible = btn.classList.contains('active');
        if (graph) graph.setNodeTypeFilter(btn.dataset.type, visible);
      });
    });

    // Weak links toggle
    document.getElementById('toggleWeakLinks').addEventListener('click', function() {
      this.classList.toggle('active');
      // We handle this via connection filtering in render (graph handles opacity)
      // Trigger re-render by reapplying filters
      if (graph) graph.applyFilters({});
    });

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => graph && graph.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => graph && graph.zoomOut());
    document.getElementById('resetView').addEventListener('click', () => graph && graph.resetView());
    document.getElementById('focusBackBtn').addEventListener('click', () => graph && graph.exitFocusMode());

    // Add node buttons
    document.querySelectorAll('.add-node-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!currentCaseId) { toast('Select a case first', 'error'); return; }
        const type = btn.dataset.type;
        const label = prompt(`Enter ${type} label:`);
        if (!label) return;
        const rect = document.getElementById('canvasContainer').getBoundingClientRect();
        const cx = rect.width / 2 / (graph.zoom || 1) - graph.viewX / (graph.zoom || 1);
        const cy = rect.height / 2 / (graph.zoom || 1) - graph.viewY / (graph.zoom || 1);
        try {
          const node = await API.createNode({
            case_id: currentCaseId,
            type,
            label,
            x: cx || 400,
            y: cy || 300,
          });
          // Reload graph
          const data = await API.getGraph(currentCaseId);
          graph.setData(data.nodes, data.connections);
          toast(`${type} node added`, 'success');
        } catch { toast('Failed to add node', 'error'); }
      });
    });

    // Export
    document.getElementById('exportJSON').addEventListener('click', () => {
      if (!currentCaseId) { toast('Select a case', 'error'); return; }
      API.exportData(currentCaseId, 'json');
    });
    document.getElementById('exportCSV').addEventListener('click', () => {
      if (!currentCaseId) { toast('Select a case', 'error'); return; }
      API.exportData(currentCaseId, 'csv');
    });

    // Markdown mode toggle
    const mdEditor = document.getElementById('mdEditor');
    const mdPreview = document.getElementById('mdPreview');
    function updateMdPreview() { mdPreview.innerHTML = renderMarkdown(mdEditor.value); }
    mdEditor.addEventListener('input', () => {
      updateMdPreview();
      if (mdAutoSave) clearTimeout(mdAutoSave);
      mdAutoSave = setTimeout(saveCurrentMd, 600);
    });
    function setMdMode(mode) {
      mdEditor.classList.toggle('hide', mode === 'preview');
      mdPreview.classList.toggle('show', mode === 'preview');
    }
    document.querySelectorAll('[data-md-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-md-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setMdMode(btn.dataset.mdMode);
      });
    });
    setMdMode('preview');

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light-mode');
      themeToggle.textContent = 'NIGHT';
    }
    themeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      themeToggle.textContent = isLight ? 'NIGHT' : 'DAY';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // Load cases
    loadCases();

    // Select first case automatically
    setTimeout(() => {
      if (cases.length > 0) {
        document.getElementById('caseSelect').value = cases[0].id;
        selectCase(cases[0].id);
      }
    }, 200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
