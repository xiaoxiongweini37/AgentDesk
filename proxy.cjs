const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const API_HOST = 'localhost';
const API_PORT = 8642;
const PROXY_PORT = 3001;

// 会话搜索（调用 Python 脚本）
function searchSessionsFromDb(query, limit = 10) {
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'session_search_api.py');
    const result = execSync(`python ${scriptPath} "${query.replace(/"/g, '\\"')}" ${limit}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Python search error:', err.message);
    return [];
  }
}

// 获取会话摘要（调用 Python 脚本）
function getSessionSummaryFromDb(sessionId) {
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'session_summary_api.py');
    const result = execSync(`python ${scriptPath} "${sessionId}"`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Python summary error:', err.message);
    return null;
  }
}

// Function to get current CLI session ID
function getCurrentSessionId() {
  try {
    const sessionsDir = '/home/jinzhong/.hermes/sessions';
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .filter(f => !f.includes('api-') && !f.includes('cron_'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(sessionsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file.name), 'utf8'));
      if (data.session_id && data.platform === 'cli') {
        return data.session_id;
      }
    }
  } catch (err) {
    console.error('Error reading session:', err);
  }
  return null;
}

// 从会话文件读取结构化消息
function getMessagesFromSession(sessionId, limit = 100) {
  try {
    const sessionsDir = '/home/jinzhong/.hermes/sessions';
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.includes(sessionId) && f.endsWith('.json'));
    
    if (files.length === 0) return [];
    
    const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8'));
    const messages = data.messages || [];
    
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content || '',
        timestamp: m.timestamp || null,
      }));
  } catch (err) {
    console.error('Error reading session messages:', err);
    return [];
  }
}

// 从 profile 的 sessions 目录读取最新会话
function getMessagesFromProfile(profileName, limit = 100) {
  try {
    const sessionsDir = `/home/jinzhong/.hermes/profiles/${profileName}/sessions`;
    if (!fs.existsSync(sessionsDir)) return [];
    
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json') && !f.includes('cron_'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(sessionsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length === 0) return [];
    
    const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, files[0].name), 'utf8'));
    const messages = data.messages || [];
    
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content || '',
        timestamp: m.timestamp || null,
      }));
  } catch (err) {
    console.error(`Error reading profile ${profileName} messages:`, err);
    return [];
  }
}

// Function to get tmux session output (备用，用于非 Hermes 的 agent)
function getTmuxOutput(sessionName, lines = 50) {
  try {
    return execSync(`tmux capture-pane -t ${sessionName} -p -S -${lines}`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (err) {
    return '';
  }
}

// Function to check if tmux session exists
function isSessionActive(sessionName) {
  try {
    execSync(`tmux has-session -t ${sessionName}`, { timeout: 3000 });
    return true;
  } catch (err) {
    return false;
  }
}

// Function to detect agent task from output
function detectTask(output) {
  if (!output) return '离线';
  
  const lines = output.split('\n').filter(l => l.trim());
  const recent = [];
  for (let i = lines.length - 1; i >= 0 && recent.length < 5; i--) {
    const line = lines[i].trim();
    if (!line || line.startsWith('─') || line.startsWith('╰') || line.startsWith('╭')) continue;
    if (line.includes('❯') && line.length < 30) continue;
    recent.push(line);
  }
  
  const text = recent.join(' ');
  if (text.includes('reading') || text.includes('📖')) return '📖 读取代码/文档中';
  if (text.includes('execute_code') || text.includes('🐍')) return '⚙️ 执行代码中';
  if (text.includes('vision_analyze') || text.includes('👁️')) return '👁️ 读图识别中';
  if (text.includes('HTTP 429')) return '⚠️ 被限流，等待重试';
  if (text.includes('error') || text.includes('Error')) return '❌ 遇到错误';
  if (text.includes('deliberating') || text.includes('💭')) return '💭 思考中';
  if (text.includes('preparing')) return '⏳ 准备中...';
  if (recent.length > 0) return `🔄 工作中: ${recent[0].substring(0, 60)}`;
  return '💤 空闲';
}

// 获取会话列表
function getSessionList(limit = 20) {
  try {
    const sessionsDir = '/home/jinzhong/.hermes/sessions';
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .filter(f => !f.includes('api-') && !f.includes('cron_'))
      .map(f => {
        const stat = fs.statSync(path.join(sessionsDir, f));
        return { name: f, mtime: stat.mtime, size: stat.size };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit);
    
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f.name), 'utf8'));
      const messages = data.messages || [];
      const userMsgs = messages.filter(m => m.role === 'user');
      const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.content);
      
      let title = '未命名会话';
      for (let i = userMsgs.length - 1; i >= 0; i--) {
        const content = userMsgs[i].content || '';
        if (content.length > 5 && !content.startsWith('Review the conversation') && !content.startsWith('[IMPORTANT')) {
          title = content.substring(0, 40) + (content.length > 40 ? '...' : '');
          break;
        }
      }
      
      if (title === '未命名会话') {
        const sessionId = data.session_id || f.name;
        title = `会话 ${sessionId.slice(-6)}`;
      }
      
      return {
        id: data.session_id || f.name.replace('session_', '').replace('.json', ''),
        title,
        messageCount: messages.length,
        userCount: userMsgs.length,
        assistantCount: assistantMsgs.length,
        time: f.mtime.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        platform: data.platform || 'unknown',
      };
    });
  } catch (err) {
    console.error('Error reading sessions:', err);
    return [];
  }
}

// 搜索会话（文件回退），支持按 Agent 筛选
function searchSessions(query, agentId = null) {
  try {
    const sessionsDir = '/home/jinzhong/.hermes/sessions';
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .filter(f => !f.includes('api-') && !f.includes('cron_'));
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf8'));
      
      // Agent 筛选
      if (agentId && data.agent_id !== agentId) continue;
      
      const messages = data.messages || [];
      const userMsgs = messages.filter(m => m.role === 'user');
      
      let title = '未命名会话';
      for (let i = userMsgs.length - 1; i >= 0; i--) {
        const content = userMsgs[i].content || '';
        if (content.length > 5 && !content.startsWith('Review the conversation') && !content.startsWith('[IMPORTANT')) {
          title = content.substring(0, 40) + (content.length > 40 ? '...' : '');
          break;
        }
      }
      
      let matched = false;
      let matchPreview = '';
      
      if (title.toLowerCase().includes(queryLower)) {
        matched = true;
        matchPreview = title;
      } else {
        for (const msg of messages) {
          const content = msg.content || '';
          if (content.toLowerCase().includes(queryLower)) {
            matched = true;
            const idx = content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx - 30);
            const end = Math.min(content.length, idx + query.length + 30);
            matchPreview = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
            break;
          }
        }
      }
      
      if (matched) {
        const stat = fs.statSync(path.join(sessionsDir, f));
        results.push({
          id: data.session_id || f.replace('session_', '').replace('.json', ''),
          title,
          matchPreview,
          messageCount: messages.length,
          agentId: data.agent_id || 'commander',
          time: stat.mtime.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        });
      }
    }
    
    return results.slice(0, 20);
  } catch (err) {
    console.error('Error searching sessions:', err);
    return [];
  }
}

// 获取完整会话（包括所有消息）
function getFullSession(sessionId) {
  try {
    const sessionsDir = '/home/jinzhong/.hermes/sessions';
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.includes(sessionId) && f.endsWith('.json'));
    
    if (files.length === 0) return null;
    
    const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, files[0]), 'utf8'));
    const messages = data.messages || [];
    
    const filteredMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role,
        content: m.content || '',
        timestamp: m.timestamp || null,
      }));
    
    return {
      id: data.session_id || sessionId,
      messages: filteredMessages,
      totalMessages: messages.length,
      userCount: messages.filter(m => m.role === 'user').length,
      assistantCount: messages.filter(m => m.role === 'assistant').length,
      agentId: data.agent_id || 'commander',
    };
  } catch (err) {
    console.error('Error reading full session:', err);
    return null;
  }
}

// 获取指定 Agent 的最近会话
function getAgentSessions(agentId, limit = 10) {
  try {
    // 使用独立的 Python 脚本获取 Agent 会话
    const scriptPath = process.env.HOME + '/.hermes/scripts/agent_sessions.py';
    const result = execSync(`python ${scriptPath} ${agentId} null ${limit}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Error getting agent sessions:', err);
    return [];
  }
}

// 获取Agent消息
function getAgentMessages(agentId) {
  try {
    const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py';
    const result = execSync(`python ${scriptPath} get ${agentId}`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    return JSON.parse(result);
  } catch (err) {
    return [];
  }
}

// 获取Agent任务
function getAgentTasks(agentId) {
  try {
    const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py';
    const result = execSync(`python ${scriptPath} list null ${agentId}`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    return JSON.parse(result);
  } catch (err) {
    return [];
  }
}

// Dashboard data endpoint - 从配置读取Agent列表
function getDashboardData() {
  const currentSessionId = getCurrentSessionId();
  
  // 从配置读取Agent列表
  const agents = getAgentList().map(agent => {
    if (agent.id === 'commander') {
      return { ...agent, tmux: null, sessionId: currentSessionId };
    }
    return agent;
  });
  
    return agents.map(agent => {
      // 获取消息和任务
      const agentMsgs = agent.profile ? getAgentMessages(agent.id) : [];
      const agentTasks = agent.profile ? getAgentTasks(agent.id) : [];
      
      if (agent.sessionId) {
        const sessionMessages = getMessagesFromSession(agent.sessionId, 100);
        const lastMsg = sessionMessages[sessionMessages.length - 1];
        const task = lastMsg ? (lastMsg.role === 'user' ? '等待回复...' : '工作中') : '空闲';
        
        return {
          ...agent,
          online: true,
          task,
          messages: sessionMessages,
          agentMessages: agentMsgs,
          agentTasks: agentTasks,
          output: null,
        };
      }
    
    if (agent.profile) {
      const online = isSessionActive(agent.tmux);
      if (!online) {
        return {
          ...agent,
          online: false,
          task: '离线',
          messages: [],
          agentMessages: agentMsgs,
          agentTasks: agentTasks,
          output: '离线',
        };
      }
      
      const profileMessages = getMessagesFromProfile(agent.profile, 100);
      const lastMsg = profileMessages[profileMessages.length - 1];
      const task = lastMsg ? (lastMsg.role === 'user' ? '等待回复...' : '工作中') : '空闲';
      
      return {
        ...agent,
        online: true,
        task,
        messages: profileMessages,
        agentMessages: agentMsgs,
        agentTasks: agentTasks,
        output: null,
      };
    }
    
    const online = isSessionActive(agent.tmux);
    const output = online ? getTmuxOutput(agent.tmux, 100) : '';
    const task = detectTask(output);
    
    return {
      ...agent,
      online,
      task,
      messages: [],
      output: output || '离线',
    };
  });
}

const yaml = require('yaml');

// 加载配置
function loadConfig() {
  const configPath = path.join(process.env.HOME, '.hermes/agent-orchestrator/config.yaml');
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return yaml.parse(content) || {};
    }
  } catch (err) {
    console.error('Failed to load config:', err.message);
  }
  return {};
}

const appConfig = loadConfig();

// 获取Agent列表
function getAgentList() {
  const agents = appConfig.agents || {};
  return Object.entries(agents).map(([id, config]) => ({
    id,
    name: config.name || id,
    role: config.role || '',
    tmux: config.tmux || null,
    profile: config.profile || null,
    capabilities: config.capabilities || [],
    api_key: config.api_key || '',
    base_url: config.base_url || '',
    model: config.model || '',
  }));
}

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hermes-Session-Id');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle health endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', platform: 'hermes-agent' }));
    return;
  }
  // Handle file upload (read content)
  if (req.url === '/api/files/read' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { path: filePath } = JSON.parse(body);
        const expandedPath = filePath.replace(/^~/, os.homedir());
        
        if (!fs.existsSync(expandedPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '文件不存在' }));
          return;
        }
        
        const stat = fs.statSync(expandedPath);
        const ext = path.extname(expandedPath).toLowerCase();
        
        // 图片文件返回base64
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        if (imageExts.includes(ext)) {
          const data = fs.readFileSync(expandedPath);
          const base64 = data.toString('base64');
          const mime = ext === '.png' ? 'image/png' : 
                      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                      ext === '.gif' ? 'image/gif' :
                      ext === '.webp' ? 'image/webp' : 'image/bmp';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            type: 'image', 
            mime,
            base64,
            name: path.basename(expandedPath),
            size: stat.size,
          }));
          return;
        }
        
        // 文本文件返回内容
        const textExts = ['.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.json',
                          '.yaml', '.yml', '.toml', '.cfg', '.ini', '.conf',
                          '.html', '.css', '.sh', '.bash', '.c', '.cpp', '.h',
                          '.java', '.go', '.rs', '.sql', '.xml', '.csv', '.log'];
        
        if (textExts.includes(ext)) {
          const content = fs.readFileSync(expandedPath, 'utf8').substring(0, 50000);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            type: 'text', 
            content,
            name: path.basename(expandedPath),
            size: stat.size,
          }));
          return;
        }
        
        // 其他文件返回元信息
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          type: 'binary', 
          name: path.basename(expandedPath),
          size: stat.size,
          message: `[二进制文件: ${path.basename(expandedPath)} (${stat.size} bytes)]`,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle file browser endpoint
  if (req.url.match(/^\/api\/files\/browse/) && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const dirPath = url.searchParams.get('path') || os.homedir();
    try {
      const expandedPath = dirPath.replace(/^~/, os.homedir());
      const items = [];
      const entries = fs.readdirSync(expandedPath, { withFileTypes: true });
      
      // 跳过的目录
      const skipDirs = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', '.next', 'dist', '.cache']);
      
      for (const entry of entries) {
        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.') && !entry.name.startsWith('..')) continue
        if (skipDirs.has(entry.name)) continue
        
        try {
          const fullPath = path.join(expandedPath, entry.name);
          const stat = fs.statSync(fullPath);
          items.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            modified: stat.mtime,
          });
        } catch (e) {
          // 跳过无法访问的文件
        }
      }
      
      // 排序：文件夹在前，然后按名称
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: expandedPath, items }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle get mount context (must be before /api/mounts GET)
  if (req.url.match(/^\/api\/mounts\/context/) && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session') || 'default';
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/mount_manager.py';
      const result = execSync(`python ${scriptPath} context ${sessionId}`, {
        encoding: 'utf8', timeout: 10000,
      });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(result);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
    }
    return;
  }

  // Handle mounts list endpoint
  if (req.url.match(/^\/api\/mounts/) && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session') || 'default';
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/mount_manager.py';
      const result = execSync(`python ${scriptPath} list ${sessionId}`, {
        encoding: 'utf8', timeout: 5000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Handle add mount endpoint
  if (req.url === '/api/mounts' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { session_id, path } = JSON.parse(body);
        const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/mount_manager.py';
        const result = execSync(`python ${scriptPath} add ${session_id} "${path}"`, {
          encoding: 'utf8', timeout: 5000,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle remove mount endpoint
  if (req.url === '/api/mounts' && req.method === 'DELETE') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { session_id, mount_id } = JSON.parse(body);
        const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/mount_manager.py';
        const result = execSync(`python ${scriptPath} remove ${session_id} ${mount_id}`, {
          encoding: 'utf8', timeout: 5000,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle working directory - GET
  if (req.url.match(/^\/api\/workdir/) && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session') || 'default';
    try {
      const workdirFile = path.join(process.env.HOME, '.hermes/mounts', `${sessionId}_workdir.json`);
      if (fs.existsSync(workdirFile)) {
        const data = JSON.parse(fs.readFileSync(workdirFile, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } else {
        // 默认工作目录
        const defaultDir = process.platform === 'win32'
          ? `C:/Users/${process.env.USERNAME}`
          : `/home/${process.env.USER}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ path: defaultDir }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle working directory - POST (set)
  if (req.url === '/api/workdir' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { session_id, path: workdirPath } = JSON.parse(body);
        const absPath = require('path').resolve(workdirPath);

        // 验证目录是否存在
        if (!fs.existsSync(absPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '目录不存在' }));
          return;
        }

        // 验证是否是目录
        if (!fs.statSync(absPath).isDirectory()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '不是目录' }));
          return;
        }

        const mountsDir = path.join(process.env.HOME, '.hermes/mounts');
        if (!fs.existsSync(mountsDir)) fs.mkdirSync(mountsDir, { recursive: true });

        const workdirFile = path.join(mountsDir, `${session_id}_workdir.json`);
        const data = { path: absPath, updated_at: Date.now() };
        fs.writeFileSync(workdirFile, JSON.stringify(data, null, 2));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle agents list endpoint
  if (req.url === '/api/agents' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getAgentList()));
    return;
  }
  // Handle update agent config
  if (req.url.match(/^\/api\/agents\/[^/]+$/) && req.method === 'PUT') {
    const agentId = req.url.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const configPath = path.join(process.env.HOME, '.hermes/agent-orchestrator/config.yaml');
        
        // 读取现有配置
        let config = {};
        if (fs.existsSync(configPath)) {
          config = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};
        }
        
        // 更新Agent配置
        if (!config.agents) config.agents = {};
        if (!config.agents[agentId]) config.agents[agentId] = {};
        
        const agent = config.agents[agentId];
        if (updates.name) agent.name = updates.name;
        if (updates.role) agent.role = updates.role;
        if (updates.tmux !== undefined) agent.tmux = updates.tmux || null;
        if (updates.profile !== undefined) agent.profile = updates.profile || null;
        if (updates.capabilities) agent.capabilities = updates.capabilities;
        if (updates.api_key !== undefined) agent.api_key = updates.api_key || undefined;
        if (updates.base_url !== undefined) agent.base_url = updates.base_url || undefined;
        if (updates.model !== undefined) agent.model = updates.model || undefined;
        
        // 写回配置
        fs.writeFileSync(configPath, yaml.stringify(config, { lineWidth: -1 }), 'utf8');
        
        // 重新加载配置
        Object.assign(appConfig, loadConfig());
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, agent: config.agents[agentId] }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle session ID endpoint
  if (req.url === '/api/session-id') {
    const sessionId = getCurrentSessionId();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session_id: sessionId }));
    return;
  }
  
  // Handle dashboard endpoint
  if (req.url === '/api/dashboard') {
    const data = getDashboardData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Handle sessions list endpoint
  if (req.url === '/api/sessions') {
    const data = getSessionList();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Handle session search endpoint (Python 脚本)
  if (req.url.startsWith('/api/sessions/search')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.searchParams.get('q') || '';
    const agentId = url.searchParams.get('agent') || null;
    
    if (agentId) {
      // 按 Agent 筛选：使用独立的 Python 脚本
      const scriptPath = process.env.HOME + '/.hermes/scripts/agent_sessions.py';
      const escapedQuery = query.replace(/"/g, '\\"');
      const cmd = `python ${scriptPath} ${agentId} "${escapedQuery}" 20`;
      const result = execSync(cmd, {
        encoding: 'utf8',
        timeout: 10000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } else {
      // 全部搜索：使用原有的搜索逻辑
      const dbResults = searchSessionsFromDb(query);
      if (dbResults.length > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dbResults));
      } else {
        const fallbackResults = searchSessions(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fallbackResults));
      }
    }
    return;
  }

  // Handle session summary endpoint (Python 脚本)
  if (req.url.match(/^\/api\/sessions\/[^/]+\/summary$/)) {
    const sessionId = req.url.split('/')[3];
    const summary = getSessionSummaryFromDb(sessionId);
    if (summary) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
    }
    return;
  }

  // Handle messages endpoint
  if (req.url === '/api/messages' && req.method === 'GET') {
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py';
      const result = execSync(`python ${scriptPath} all`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Handle agent messages endpoint
  if (req.url.match(/^\/api\/messages\/[^/]+$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3];
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py';
      const result = execSync(`python ${scriptPath} get ${agentId}`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Handle send message endpoint
  if (req.url === '/api/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py';
        const escapedContent = msg.content.replace(/"/g, '\\"');
        const result = execSync(`python ${scriptPath} send ${msg.from} ${msg.to} ${msg.type} "${escapedContent}"`, {
          encoding: 'utf8',
          timeout: 10000,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle tasks endpoint
  if (req.url === '/api/tasks' && req.method === 'GET') {
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py';
      const result = execSync(`python ${scriptPath} list`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Handle create task endpoint
  if (req.url === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const task = JSON.parse(body);
        const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py';
        const assigned = task.assigned_to || '';
        const priority = task.priority || 'normal';
        const escapedTitle = task.title.replace(/"/g, '\\"');
        const escapedDesc = (task.description || '').replace(/"/g, '\\"');
        const result = execSync(`python ${scriptPath} create "${escapedTitle}" "${escapedDesc}" ${assigned} ${priority}`, {
          encoding: 'utf8',
          timeout: 10000,
        });
        
        // 如果任务已分配，发送消息通知Agent
        const taskResult = JSON.parse(result);
        if (taskResult.assigned_to) {
          const msgPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py';
          const msgContent = `新任务: ${task.title}\n${task.description || ''}`;
          try {
            execSync(`python ${msgPath} send commander ${taskResult.assigned_to} task "${msgContent.replace(/"/g, '\\"')}" ${priority}`, {
              encoding: 'utf8', timeout: 5000,
            });
          } catch (e) {
            console.error('Failed to send task notification:', e.message);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle queue summary endpoint
  if (req.url.match(/^\/api\/messages\/queue\/[^/]+$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[4]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py'
      const result = execSync(`python ${scriptPath} summary ${agentId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agent: agentId, total: 0, high: 0, normal: 0, low: 0, next: null }))
    }
    return
  }

  // Handle get next from queue
  if (req.url.match(/^\/api\/messages\/queue\/[^/]+\/next$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[4]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py'
      const result = execSync(`python ${scriptPath} next ${agentId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('null')
    }
    return
  }

  // Handle mark message as processed
  if (req.url.match(/^\/api\/messages\/queue\/[^/]+\/[^/]+\/process$/) && req.method === 'POST') {
    const parts = req.url.split('/')
    const agentId = parts[4]
    const msgId = parts[5]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py'
      execSync(`python ${scriptPath} process ${agentId} ${msgId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // Handle mark message as read
  if (req.url.match(/^\/api\/messages\/[^/]+\/[^/]+\/read$/) && req.method === 'POST') {
    const parts = req.url.split('/')
    const agentId = parts[3]
    const msgId = parts[4]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/message_bus.py'
      execSync(`python ${scriptPath} mark-read ${agentId} ${msgId}`, { encoding: 'utf8', timeout: 5000 })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // Handle update task status
  if (req.url.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'PUT') {
    const taskId = req.url.split('/')[3]
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const update = JSON.parse(body)
        const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py'
        // 先获取任务，再更新状态
        if (update.status === 'cancelled') {
          // cancelled 直接标记为 completed（简单处理）
          execSync(`python ${scriptPath} complete ${taskId} "cancelled"`, { encoding: 'utf8', timeout: 5000 })
        } else if (update.status === 'assigned') {
          execSync(`python ${scriptPath} assign ${taskId} worker`, { encoding: 'utf8', timeout: 5000 })
        } else if (update.status === 'in_progress') {
          execSync(`python ${scriptPath} start ${taskId}`, { encoding: 'utf8', timeout: 5000 })
        } else if (update.status === 'completed') {
          execSync(`python ${scriptPath} complete ${taskId}`, { encoding: 'utf8', timeout: 5000 })
        } else if (update.status === 'failed') {
          execSync(`python ${scriptPath} complete ${taskId} "failed"`, { encoding: 'utf8', timeout: 5000 })
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // Handle agent status endpoint
  if (req.url === '/api/agents/status' && req.method === 'GET') {
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/status_manager.py'
      const result = execSync(`python ${scriptPath} refresh`, {
        encoding: 'utf8', timeout: 10000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
    }
    return
  }

  // Handle single agent status endpoint
  if (req.url.match(/^\/api\/agents\/[^/]+\/status$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/status_manager.py'
      const result = execSync(`python ${scriptPath} get ${agentId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('null')
    }
    return
  }

  // Handle agent report endpoint
  if (req.url === '/api/agents/report' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const report = JSON.parse(body);
        const scriptPath = process.env.HOME + '/.hermes/scripts/agent_report.py';
        let cmd = `python ${scriptPath} ${report.agent} ${report.type}`;
        
        if (report.type === 'result') {
          cmd += ` ${report.task_id || 'null'} "${(report.result || '').replace(/"/g, '\\"')}" ${report.status || 'success'}`;
        } else if (report.type === 'error') {
          cmd += ` "${(report.error || '').replace(/"/g, '\\"')}" "${(report.context || '').replace(/"/g, '\\"')}"`;
        } else if (report.type === 'status') {
          cmd += ` "${(report.status || '').replace(/"/g, '\\"')}" ${report.progress || ''}`;
        }
        
        const result = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle agent task queue endpoint
  if (req.url.match(/^\/api\/tasks\/queue\/[^/]+$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[4]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py'
      const result = execSync(`python ${scriptPath} queue ${agentId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    }
    return
  }

  // Handle get next task for agent
  if (req.url.match(/^\/api\/tasks\/queue\/[^/]+\/next$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[4]
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py'
      const result = execSync(`python ${scriptPath} next ${agentId}`, {
        encoding: 'utf8', timeout: 5000,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(result)
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('null')
    }
    return
  }

  // Handle auto-assign tasks endpoint
  if (req.url === '/api/tasks/auto-assign' && req.method === 'POST') {
    try {
      const scriptPath = process.env.HOME + '/.hermes/agent-orchestrator/task_manager.py';
      const result = execSync(`python ${scriptPath} auto-assign`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle agent sessions endpoint
  if (req.url.match(/^\/api\/agents\/[^/]+\/sessions/)) {
    const agentId = req.url.split('/')[3];
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sessions = getAgentSessions(agentId, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // Handle full session endpoint
  if (req.url.match(/^\/api\/sessions\/[^/]+\/full$/)) {
    const sessionId = req.url.split('/')[3];
    const session = getFullSession(sessionId);
    if (session) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
    }
    return;
  }

  // Handle single session messages endpoint
  if (req.url.startsWith('/api/sessions/') && req.url.endsWith('/messages')) {
    const sessionId = req.url.split('/')[3];
    const messages = getMessagesFromSession(sessionId, 200);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(messages));
    return;
  }

  // Remove Origin header to avoid CORS issues
  const headers = { ...req.headers };
  delete headers.origin;
  delete headers.referer;
  headers.host = `${API_HOST}:${API_PORT}`;

  // 对于聊天请求，强制注入正确的 CLI session ID
  if (req.url === '/v1/chat/completions') {
    const currentSessionId = getCurrentSessionId();
    if (currentSessionId) {
      headers['x-hermes-session-id'] = currentSessionId;
    }
  }

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, () => {
  console.log(`Proxy server running on http://localhost:${PROXY_PORT}`);
});
