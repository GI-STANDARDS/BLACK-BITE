const API = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    if (ct.includes('text/csv')) return res.text();
    return res.text();
  },

  // Cases
  getCases() { return this.request('GET', '/api/cases'); },
  createCase(data) { return this.request('POST', '/api/cases', data); },
  updateCase(id, data) { return this.request('PUT', `/api/cases/${id}`, data); },
  deleteCase(id) { return this.request('DELETE', `/api/cases/${id}`); },

  // Graph (bundled nodes + connections)
  getGraph(caseId) { return this.request('GET', `/api/graph?case_id=${caseId}`); },

  // Nodes
  createNode(data) { return this.request('POST', '/api/nodes', data); },
  updateNode(id, data) { return this.request('PUT', `/api/nodes/${id}`, data); },
  deleteNode(id) { return this.request('DELETE', `/api/nodes/${id}`); },

  // Connections
  createConnection(data) { return this.request('POST', '/api/connections', data); },
  updateConnection(id, data) { return this.request('PUT', `/api/connections/${id}`, data); },
  deleteConnection(id) { return this.request('DELETE', `/api/connections/${id}`); },

  // Timeline
  getTimeline(caseId) { return this.request('GET', `/api/timeline?case_id=${caseId}`); },

  // System log
  getSystemLog(caseId) { return this.request('GET', `/api/systemlog?case_id=${caseId}`); },

  // Export
  exportData(caseId, format) {
    window.location.href = `/api/export?case_id=${caseId}&format=${format}&_t=${Date.now()}`;
  }
};
