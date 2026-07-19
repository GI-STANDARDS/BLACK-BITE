const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function initStorage() {
  const files = ['cases.json', 'nodes.json', 'connections.json', 'timeline.json', 'system_log.json'];
  files.forEach(f => {
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(f === 'cases.json' ? [] : [], null, 2));
  });

  // Seed data if empty
  const casesPath = path.join(DATA_DIR, 'cases.json');
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
  if (cases.length === 0) {
    const now = new Date();
    const caseId = uuidv4();
    const defaultCase = {
      id: caseId,
      title: 'Operation Chimera',
      description: 'Massive corporate espionage ring investigation spanning 14 countries, 3 shell companies, and organized cybercrime syndicate.',
      created_at: new Date(now - 86400000 * 90).toISOString(),
      updated_at: now.toISOString()
    };
    cases.push(defaultCase);
    fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2));

    // ---- Generate 1000 nodes ----
    const nodes = [];
    const idx = { p: 0, e: 0, x: 0, l: 0 };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const firstNames = ['James','Maria','Wei','Fatima','Dmitri','Amara','Kenji','Priya','Carlos','Aisha','Hiroshi','Yuki','Mohammed','Elena','Olga','Ravi','Mei','Ahmed','Sofia','Ivan','Liam','Noah','Emma','Olivia','Ava','Lucas','Mia','Zara','Kai','Nala','Elijah','Aria','Logan','Lily','Ethan','Zoe','Mason','Chloe','Oliver','Riley','Aiden','Avery','Carter','Ella','Sebastian','Scarlett','Grayson','Grace','Wyatt','Layla','Adrian','Rebecca','Jaxon','Hannah','Mateo','Lila','Caleb','Nora','Owen','Ellie','Ryan','Stella','Nathan','Aurora','Dylan','Savannah','Luke','Hazel','Gabriel','Penelope','Anthony','Bella','Isaac','Evelyn','Isaiah','Camila','Andrew','Levi','Henry','Parker','Leo','Harper','Jack','Jade','Julian','Ruby','Eli','Skylar','Aaron','Kinsley','Josiah','Naomi','Charles','Jordyn','Thomas','Morgan','Blake','Kennedy','Eliot','Madison','Dante','Valentina','Orion','Selene'];
    const lastNames = ['Johnson','Martinez','Zhang','Patel','Volkov','Okafor','Tanaka','Sharma','Garcia','Okonkwo','Sato','Singh','Al-Rashid','Petrova','Ivanova','Kumar','Liu','Hassan','Fernandez','Popov','Williams','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Green','Baker','Hill','Nelson','Adams','Campbell','Mitchell','Roberts','Turner','Phillips','Evans','Edwards','Collins','Stewart','Morris','Nguyen','Murphy','Rivera','Cook','Morgan','Cooper','Reed','Bailey','Bell','Cox','Ward','Torres','Peterson','Gray','Ramirez','James','Watson','Brooks','Sanders','Price'];
    const companies = ['Apex Dynamics','Vertex Systems','NexGen Corp','Pinnacle Inc','Omni Data','Cyphra Labs','Atlas Global','Meridian Group','StratoTech','Quantum Industries','Echo Dynamics','FusionPoint','IronClad Systems','NovaPath','Pulse Networks','Ridgeback Corp','Sage Technologies','Titan Group','Umbra Solutions','Vector Industries','Zenith Global','ArcLight Systems','CoreBridge','DeltaForce Tech','Ember Innovations','Firewall Dynamics','Glacier Technologies','Helix Systems','InfraWorks','Jade Networks','Krypton Security','LumenData','Magna Corp','NeonByte','Orion Systems','Phoenix Group','Quasar Tech','Raptor Industries','Solstice Corp','Typhon Enterprises','Vanguard Systems','WolfTech','Xenon Labs','Yara Technologies','Zephyr Networks'];
    const cities = ['Shanghai','Moscow','Dubai','London','Singapore','Tokyo','New York','Zurich','Hong Kong','Sydney','Berlin','Toronto','Mumbai','São Paulo','Seoul','Amsterdam','Stockholm','Vienna','Oslo','Luxembourg','San Francisco','Chicago','Los Angeles','Boston','Seattle','Austin','Dallas','Miami','Denver','Portland','Atlanta','Phoenix','Minneapolis','Detroit','Philadelphia','Baltimore','Houston','Tampa','Orlando','Raleigh','Sacramento','San Diego','San Jose','Nashville','Memphis','Kansas City','St. Louis','Cleveland','Pittsburgh','New Orleans'];
    const posSession = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet','Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'];
    const ipPrefixes = ['10.0.1.','192.168.1.','172.16.0.','10.10.0.','192.168.100.','10.20.30.','172.31.0.','10.0.0.'];

    const personTags = [['suspect'],['witness'],['person-of-interest'],['executive'],['contractor'],['victim'],['expert'],['insider'],['associate'],['whistleblower']];
    const eventTags = [['breach'],['meeting'],['transfer'],['alert'],['transaction'],['communication'],['incident'],['audit'],['deadline'],['milestone']];
    const evidenceTags = [['document'],['log'],['device'],['recording'],['email'],['financial'],['digital'],['physical'],['photograph'],['report']];
    const locTags = [['office'],['datacenter'],['city'],['building'],['facility'],['warehouse'],['headquarters'],['branch'],['secure-room'],['remote-site']];
    const connLabels = ['communicated with','authorized','reported to','transferred funds to','located at','owned by','linked to','contracted with','audited by','monitored','accessed','visited','employed by','associated with','investigated','approved','signed','requested','notified','delegated to','reviewed','processed','submitted','managed','coordinated with','verified by','witnessed','led to','originated from','copied to','registered at','deposited to','withdrew from','logged into','configured','installed','removed','transported to','stored at','analyzed','encrypted','decrypted','forwarded','archived','retrieved','flagged','escalated'];

    function rng(seed) { let s = seed + 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
    function seededShuffle(arr, seed) { const r = rng(seed); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

    const fns = seededShuffle([...firstNames], 42);
    const lns = seededShuffle([...lastNames], 99);
    const cos = seededShuffle([...companies], 17);
    const cts = seededShuffle([...cities], 33);
    const sessions = seededShuffle([...posSession], 7);

    function ts(daysAgo) { return new Date(now - 86400000 * daysAgo - Math.random() * 86400000).toISOString(); }

    // -- 250 Persons --
    const persons = ['CEO','CFO','CTO','COO','Security Director','IT Manager','Lead Developer','Network Engineer','Database Admin','HR Director','Legal Counsel','Financial Analyst','Compliance Officer','Internal Auditor','Forensic Analyst','SOC Analyst','Penetration Tester','DevOps Engineer','System Admin','Helpdesk Lead','Project Manager','Product Owner','Scrum Master','Business Analyst','Research Scientist','Data Scientist','Marketing Director','Sales VP','Accountant','Payroll Specialist'];
    for (let i = 0; i < 250; i++) {
      const role = persons[i % persons.length];
      const fn = fns[i % fns.length];
      const ln = lns[i % lns.length];
      const company = cos[i % cos.length];
      nodes.push({ id: uuidv4(), case_id: caseId, type: 'person', label: `${fn} ${ln}`, description: `${role} at ${company}${i < 30 ? ' - key suspect' : i < 80 ? ' - person of interest' : ''}`, tags: personTags[i % personTags.length], timestamp: ts(80 + Math.random() * 10), x: 0, y: 0 });
      idx.p++;
    }

    // -- 300 Events --
    const eventTypes = ['Data Breach Alert','Executive Meeting','Wire Transfer','Phishing Campaign','System Outage','Audit Trigger','Compliance Review','Contract Signing','Merger Announcement','Quarterly Report','Board Meeting','Shareholder Call','Press Release','Security Patch','Network Scan','Penetration Test','Vulnerability Assessment','Incident Response Drill','Policy Update','Regulatory Filing','Server Migration','Cloud Deployment','Database Replication','Backup Verification','Password Reset','Access Revocation','New Hire Onboarding','Vendor Assessment','Risk Analysis','Budget Approval'];
    for (let i = 0; i < 300; i++) {
      const et = eventTypes[i % eventTypes.length];
      const comp = cos[i % cos.length];
      nodes.push({ id: uuidv4(), case_id: caseId, type: 'event', label: `${et} - ${comp}`, description: `${et} involving ${comp}. Session ${sessions[i % sessions.length]}. Reference #CH-${1000 + i}.`, tags: eventTags[i % eventTags.length], timestamp: ts(70 + Math.random() * 20), x: 0, y: 0 });
      idx.e++;
    }

    // -- 250 Evidence --
    const evidenceTypes = ['Email Thread','Server Log','Phone Recording','Bank Statement','CCTV Footage','Access Log','Network Capture','Contract Document','Financial Report','Hard Drive Image','Chat Transcript','Meeting Minutes','Expense Report','IP Log','DNS Query Log','Firewall Log','VPN Log','Database Export','Source Code Commit','Binary Artifact','Memory Dump','Packet Capture','SSL Certificate','API Log','Configuration File'];
    for (let i = 0; i < 250; i++) {
      const ev = evidenceTypes[i % evidenceTypes.length];
      const comp = cos[i % cos.length];
      nodes.push({ id: uuidv4(), case_id: caseId, type: 'evidence', label: `${ev} #${10000 + i}`, description: `${ev} collected from ${comp}. Chain-of-custody ID: CH-EV-${(10000 + i).toString(16).toUpperCase()}.`, tags: evidenceTags[i % evidenceTags.length], timestamp: ts(60 + Math.random() * 30), x: 0, y: 0 });
      idx.x++;
    }

    // -- 200 Locations --
    for (let i = 0; i < 200; i++) {
      const ci = cts[i % cts.length];
      const co = cos[(i * 3) % cos.length];
      if (i < 60) {
        nodes.push({ id: uuidv4(), case_id: caseId, type: 'location', label: `${co} HQ - ${ci}`, description: `Headquarters office of ${co} located in ${ci}. ${i < 20 ? 'Primary investigation site.' : 'Secondary site.'}`, tags: locTags[i % locTags.length], timestamp: ts(50 + Math.random() * 40), x: 0, y: 0 });
      } else if (i < 120) {
        const ip = pick(ipPrefixes) + (10 + i % 240);
        nodes.push({ id: uuidv4(), case_id: caseId, type: 'location', label: `Server ${sessions[i % sessions.length]} (${ip})`, description: `Server node at ${ip}. Hosted by ${co}. Rack ${Math.floor(i/12)}U.`, tags: locTags[i % locTags.length], timestamp: ts(50 + Math.random() * 40), x: 0, y: 0 });
      } else {
        nodes.push({ id: uuidv4(), case_id: caseId, type: 'location', label: `Office ${sessions[(i * 7) % sessions.length]} - ${ci}`, description: `${co} branch office in ${ci}. Floor ${(i % 20) + 1}, Suite ${(i % 100) + 100}.`, tags: locTags[i % locTags.length], timestamp: ts(50 + Math.random() * 40), x: 0, y: 0 });
      }
      idx.l++;
    }

    // ---- Generate ~3000 connections ----
    const connections = [];
    const personsList = nodes.filter(n => n.type === 'person');
    const eventsList = nodes.filter(n => n.type === 'event');
    const evidenceList = nodes.filter(n => n.type === 'evidence');
    const locsList = nodes.filter(n => n.type === 'location');

    for (let i = 0; i < personsList.length; i++) {
      const p = personsList[i];
      if (i < eventsList.length) connections.push({ id: uuidv4(), case_id: caseId, source_id: p.id, target_id: eventsList[i].id, type: pick(['verified','unverified','critical']), label: pick(connLabels), timestamp: ts(40 + Math.random() * 50) });
      if (i < evidenceList.length) connections.push({ id: uuidv4(), case_id: caseId, source_id: p.id, target_id: evidenceList[i].id, type: pick(['verified','unverified','critical']), label: pick(connLabels), timestamp: ts(40 + Math.random() * 50) });
      if (i < locsList.length) connections.push({ id: uuidv4(), case_id: caseId, source_id: p.id, target_id: locsList[i].id, type: pick(['verified','unverified','critical']), label: pick(connLabels), timestamp: ts(40 + Math.random() * 50) });
      if (i < personsList.length - 1) connections.push({ id: uuidv4(), case_id: caseId, source_id: p.id, target_id: personsList[i + 1].id, type: pick(['verified','unverified']), label: pick(connLabels), timestamp: ts(40 + Math.random() * 50) });
    }
    for (let i = 0; i < Math.min(eventsList.length, evidenceList.length); i++) {
      connections.push({ id: uuidv4(), case_id: caseId, source_id: eventsList[i].id, target_id: evidenceList[i % evidenceList.length].id, type: pick(['verified','unverified','critical']), label: pick(connLabels), timestamp: ts(35 + Math.random() * 55) });
    }
    for (let i = 0; i < Math.min(eventsList.length, locsList.length); i++) {
      connections.push({ id: uuidv4(), case_id: caseId, source_id: eventsList[i].id, target_id: locsList[i % locsList.length].id, type: pick(['verified','unverified']), label: pick(connLabels), timestamp: ts(35 + Math.random() * 55) });
    }
    for (let i = 0; i < Math.min(evidenceList.length, locsList.length); i++) {
      connections.push({ id: uuidv4(), case_id: caseId, source_id: evidenceList[i].id, target_id: locsList[i % locsList.length].id, type: pick(['verified','unverified']), label: pick(connLabels), timestamp: ts(30 + Math.random() * 60) });
    }

    // ---- Pentagon Nest layout (server-side) ----
    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    // Big pentagon: 5 cluster centers at vertices
    const CX = 700, CY = 450, R = 400;
    const pentagonCenters = [];
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      pentagonCenters.push({ x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) });
    }

    // Assign each node to a cluster (200 per cluster)
    const clusters = [[], [], [], [], []];
    nodes.forEach((n, i) => {
      const ci = Math.floor(i / 200) % 5;
      clusters[ci].push(n);
    });

    // For each cluster: place nodes in a pentagon-star pattern (5 axes from center)
    clusters.forEach((group, ci) => {
      const pc = pentagonCenters[ci];
      group.forEach((n, i) => {
        const axis = i % 5;
        const depth = Math.floor(i / 5);
        const angle = (Math.PI * 2 * axis) / 5 - Math.PI / 2 + (Math.random() - 0.5) * 0.18;
        const radius = 8 + depth * 11 + (Math.random() - 0.5) * 5;
        n.x = pc.x + Math.cos(angle) * radius;
        n.y = pc.y + Math.sin(angle) * radius;
      });
    });

    // Gentle relaxation to remove overlaps while keeping pentagon structure
    nodes.forEach(n => { n.vx = 0; n.vy = 0; });
    for (let iter = 0; iter < 30; iter++) {
      nodes.forEach(n => { n.fx = 0; n.fy = 0; });
      // Mild repulsion between nearby nodes (skip O(n^2) — sample)
      for (let ci = 0; ci < 5; ci++) {
        const group = clusters[ci];
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i], b = group[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let dist = Math.max(Math.sqrt(dx * dx + dy * dy), 2);
            if (dist > 80) continue; // skip distant pairs
            let force = 1200 / (dist + 10);
            let fx = (dx / dist) * force, fy = (dy / dist) * force;
            a.fx += fx; a.fy += fy;
            b.fx -= fx; b.fy -= fy;
          }
        }
      }
      // Apply with damping
      nodes.forEach(n => {
        n.vx = (n.vx + n.fx) * 0.5;
        n.vy = (n.vy + n.fy) * 0.5;
        n.x += n.vx;
        n.y += n.vy;
      });
    }

    nodes.forEach(n => { delete n.fx; delete n.fy; delete n.vx; delete n.vy; });

    fs.writeFileSync(path.join(DATA_DIR, 'nodes.json'), JSON.stringify(nodes, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'connections.json'), JSON.stringify(connections, null, 2));

    // ---- Timeline entries ----
    const timeline = [];
    for (let i = 0; i < 120; i++) {
      const n = nodes[i % nodes.length];
      timeline.push({ id: uuidv4(), case_id: caseId, node_id: n.id, type: pick(['system','event','evidence','message']), description: `${n.label}: ${pick(['Logged','Flagged','Updated','Reviewed','Escalated','Archived','Verified','Cross-referenced','Indexed','Processed'])}`, timestamp: ts(i * 0.7 + 5) });
    }
    fs.writeFileSync(path.join(DATA_DIR, 'timeline.json'), JSON.stringify(timeline, null, 2));

    // ---- System log entries ----
    const syslog = [];
    for (let i = 0; i < 100; i++) {
      const n = nodes[i % nodes.length];
      syslog.push({ id: uuidv4(), case_id: caseId, action: pick(['case created','node added','connection detected','case updated','evidence logged','alert triggered','report generated','flag raised','system check','data export']), detail: `${n.label} - ${pick(['processed','analyzed','queued','completed','pending','failed','approved','rejected','flagged','reviewed'])}`, timestamp: ts(i * 0.9) });
    }
    fs.writeFileSync(path.join(DATA_DIR, 'system_log.json'), JSON.stringify(syslog, null, 2));
  }
}
initStorage();

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  if (!fs.existsSync(filePath)) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
}

function getParam(url, name) {
  const u = new URL(url, 'http://localhost');
  return u.searchParams.get(name) || '';
}

function logSystem(caseId, action, detail) {
  const log = readJSON('system_log.json');
  log.unshift({ id: uuidv4(), case_id: caseId, action, detail, timestamp: new Date().toISOString() });
  writeJSON('system_log.json', log.slice(0, 200));
}

function addTimeline(caseId, nodeId, type, description) {
  const tl = readJSON('timeline.json');
  tl.unshift({ id: uuidv4(), case_id: caseId, node_id: nodeId, type, description, timestamp: new Date().toISOString() });
  writeJSON('timeline.json', tl);
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const url = req.url;
  const pathname = new URL(url, 'http://localhost').pathname;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // --- API ROUTES ---

  // GET /api/cases
  if (method === 'GET' && pathname === '/api/cases') {
    sendJSON(res, 200, readJSON('cases.json'));
    return;
  }

  // POST /api/cases
  if (method === 'POST' && pathname === '/api/cases') {
    const body = await parseBody(req);
    if (!body.title) { sendJSON(res, 400, { error: 'Title required' }); return; }
    const cases = readJSON('cases.json');
    const c = { id: uuidv4(), title: body.title, description: body.description || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    cases.unshift(c);
    writeJSON('cases.json', cases);
    logSystem(c.id, 'case created', `${c.title} initialized`);
    sendJSON(res, 201, c);
    return;
  }

  // PUT /api/cases/:id
  if (method === 'PUT' && pathname.startsWith('/api/cases/')) {
    const id = pathname.split('/').pop();
    const body = await parseBody(req);
    const cases = readJSON('cases.json');
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) { sendJSON(res, 404, { error: 'Not found' }); return; }
    cases[idx] = { ...cases[idx], ...body, id: cases[idx].id, updated_at: new Date().toISOString() };
    writeJSON('cases.json', cases);
    logSystem(id, 'case updated', `Case ${cases[idx].title} modified`);
    sendJSON(res, 200, cases[idx]);
    return;
  }

  // DELETE /api/cases/:id
  if (method === 'DELETE' && pathname.startsWith('/api/cases/')) {
    const id = pathname.split('/').pop();
    let cases = readJSON('cases.json');
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) { sendJSON(res, 404, { error: 'Not found' }); return; }
    const title = cases[idx].title;
    cases.splice(idx, 1);
    writeJSON('cases.json', cases);
    // Remove related data
    ['nodes.json', 'connections.json', 'timeline.json'].forEach(f => {
      let data = readJSON(f);
      data = data.filter(d => d.case_id !== id);
      writeJSON(f, data);
    });
    logSystem(id, 'case deleted', `${title} removed`);
    sendJSON(res, 200, { success: true });
    return;
  }

  // GET /api/nodes?case_id=...
  if (method === 'GET' && pathname === '/api/nodes') {
    let nodes = readJSON('nodes.json');
    const caseId = getParam(url, 'case_id');
    if (caseId) nodes = nodes.filter(n => n.case_id === caseId);
    sendJSON(res, 200, nodes);
    return;
  }

  // POST /api/nodes
  if (method === 'POST' && pathname === '/api/nodes') {
    const body = await parseBody(req);
    if (!body.label || !body.type || !body.case_id) { sendJSON(res, 400, { error: 'label, type, case_id required' }); return; }
    const validTypes = ['person', 'event', 'evidence', 'location'];
    if (!validTypes.includes(body.type)) { sendJSON(res, 400, { error: 'Invalid type. Use: ' + validTypes.join(', ') }); return; }
    const nodes = readJSON('nodes.json');
    const node = {
      id: uuidv4(),
      case_id: body.case_id,
      type: body.type,
      label: body.label,
      description: body.description || '',
      tags: body.tags || [],
      timestamp: body.timestamp || new Date().toISOString(),
      x: body.x || Math.random() * 800 + 100,
      y: body.y || Math.random() * 600 + 100,
    };
    nodes.unshift(node);
    writeJSON('nodes.json', nodes);
    addTimeline(body.case_id, node.id, 'system', `Node added: ${body.type} - ${body.label}`);
    logSystem(body.case_id, 'node added', `${body.type}: ${body.label}`);
    sendJSON(res, 201, node);
    return;
  }

  // PUT /api/nodes/:id
  if (method === 'PUT' && pathname.startsWith('/api/nodes/')) {
    const id = pathname.split('/').pop();
    const body = await parseBody(req);
    const nodes = readJSON('nodes.json');
    const idx = nodes.findIndex(n => n.id === id);
    if (idx === -1) { sendJSON(res, 404, { error: 'Not found' }); return; }
    nodes[idx] = { ...nodes[idx], ...body, id: nodes[idx].id };
    writeJSON('nodes.json', nodes);
    if (body.tags) logSystem(nodes[idx].case_id, 'node updated', `Tags modified for ${nodes[idx].label}`);
    sendJSON(res, 200, nodes[idx]);
    return;
  }

  // DELETE /api/nodes/:id
  if (method === 'DELETE' && pathname.startsWith('/api/nodes/')) {
    const id = pathname.split('/').pop();
    let nodes = readJSON('nodes.json');
    const node = nodes.find(n => n.id === id);
    if (!node) { sendJSON(res, 404, { error: 'Not found' }); return; }
    nodes = nodes.filter(n => n.id !== id);
    writeJSON('nodes.json', nodes);
    // Remove connections involving this node
    let conns = readJSON('connections.json');
    conns = conns.filter(c => c.source_id !== id && c.target_id !== id);
    writeJSON('connections.json', conns);
    logSystem(node.case_id, 'node deleted', `${node.type}: ${node.label}`);
    sendJSON(res, 200, { success: true });
    return;
  }

  // GET /api/connections?case_id=...
  if (method === 'GET' && pathname === '/api/connections') {
    let conns = readJSON('connections.json');
    const caseId = getParam(url, 'case_id');
    if (caseId) conns = conns.filter(c => c.case_id === caseId);
    sendJSON(res, 200, conns);
    return;
  }

  // POST /api/connections
  if (method === 'POST' && pathname === '/api/connections') {
    const body = await parseBody(req);
    if (!body.source_id || !body.target_id || !body.case_id) { sendJSON(res, 400, { error: 'source_id, target_id, case_id required' }); return; }
    if (!['verified', 'unverified', 'critical'].includes(body.type)) body.type = 'unverified';
    const conns = readJSON('connections.json');
    const conn = { id: uuidv4(), case_id: body.case_id, source_id: body.source_id, target_id: body.target_id, type: body.type, label: body.label || '', timestamp: new Date().toISOString() };
    conns.unshift(conn);
    writeJSON('connections.json', conns);
    addTimeline(body.case_id, body.source_id, 'system', `Connection detected: ${body.type}`);
    logSystem(body.case_id, 'connection detected', `${body.type} link established`);
    sendJSON(res, 201, conn);
    return;
  }

  // PUT /api/connections/:id
  if (method === 'PUT' && pathname.startsWith('/api/connections/')) {
    const id = pathname.split('/').pop();
    const body = await parseBody(req);
    const conns = readJSON('connections.json');
    const idx = conns.findIndex(c => c.id === id);
    if (idx === -1) { sendJSON(res, 404, { error: 'Not found' }); return; }
    conns[idx] = { ...conns[idx], ...body, id: conns[idx].id };
    writeJSON('connections.json', conns);
    sendJSON(res, 200, conns[idx]);
    return;
  }

  // DELETE /api/connections/:id
  if (method === 'DELETE' && pathname.startsWith('/api/connections/')) {
    const id = pathname.split('/').pop();
    let conns = readJSON('connections.json');
    const conn = conns.find(c => c.id === id);
    if (!conn) { sendJSON(res, 404, { error: 'Not found' }); return; }
    conns = conns.filter(c => c.id !== id);
    writeJSON('connections.json', conns);
    logSystem(conn.case_id, 'connection removed', `${conn.type} link deleted`);
    sendJSON(res, 200, { success: true });
    return;
  }

  // GET /api/timeline?case_id=...
  if (method === 'GET' && pathname === '/api/timeline') {
    let tl = readJSON('timeline.json');
    const caseId = getParam(url, 'case_id');
    if (caseId) tl = tl.filter(t => t.case_id === caseId);
    tl.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    sendJSON(res, 200, tl);
    return;
  }

  // GET /api/systemlog?case_id=...
  if (method === 'GET' && pathname === '/api/systemlog') {
    let log = readJSON('system_log.json');
    const caseId = getParam(url, 'case_id');
    if (caseId) log = log.filter(l => l.case_id === caseId);
    sendJSON(res, 200, log);
    return;
  }

  // GET /api/export?case_id=...&format=json|csv
  if (method === 'GET' && pathname === '/api/export') {
    const caseId = getParam(url, 'case_id');
    const format = getParam(url, 'format') || 'json';
    const nodes = readJSON('nodes.json').filter(n => !caseId || n.case_id === caseId);
    const connections = readJSON('connections.json').filter(c => !caseId || c.case_id === caseId);
    const timeline = readJSON('timeline.json').filter(t => !caseId || t.case_id === caseId);
    const cases = readJSON('cases.json').filter(c => !caseId || c.id === caseId);
    const exportData = { cases, nodes, connections, timeline };

    if (format === 'csv') {
      let csv = 'type,id,label,description,tags,case_id\n';
      nodes.forEach(n => csv += `node,${n.id},"${n.label}","${(n.description||'').replace(/"/g,'""')}","${(n.tags||[]).join(';')}",${n.case_id}\n`);
      csv += 'source,target,type,label\n';
      connections.forEach(c => csv += `${c.source_id},${c.target_id},${c.type},"${c.label}"\n`);
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="graph_export.csv"', 'Access-Control-Allow-Origin': '*' });
      res.end(csv);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="graph_export.json"', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(exportData, null, 2));
    }
    return;
  }

  // GET /api/graph?case_id=...  (bundled for frontend)
  if (method === 'GET' && pathname === '/api/graph') {
    const caseId = getParam(url, 'case_id');
    const nodes = readJSON('nodes.json').filter(n => !caseId || n.case_id === caseId);
    const connections = readJSON('connections.json').filter(c => !caseId || c.case_id === caseId);
    sendJSON(res, 200, { nodes, connections });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  // If the file doesn't exist and it's not an API route, serve index.html (SPA)
  if (!fs.existsSync(filePath) && !pathname.startsWith('/api/')) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }
  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`[INVESTIGATION GRAPH] Server running at http://localhost:${PORT}`);
  console.log(`[INFO] Seed data loaded with sample case "Operation Nightfall"`);
});
