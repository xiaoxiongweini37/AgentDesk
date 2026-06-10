const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_HOST = 'localhost';
const API_PORT = 8642;
const PROXY_PORT = 3001;

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

// Dashboard data endpoint - 从会话文件读取结构化数据
function getDashboardData() {
  const currentSessionId = getCurrentSessionId();
  
  const agents = [
    { id: 'commander', name: '总指挥', role: '协调·监控·读图', tmux: null, sessionId: currentSessionId },
    { id: 'worker', name: 'A号', role: '速度型编码', tmux: 'worker', profile: 'worker' },
    { id: 'coder-b', name: 'B号', role: '严谨型编码', tmux: 'coder-b', profile: 'coder-b' },
    { id: 'coder-c', name: 'C号', role: '测试评估', tmux: 'coder-c', profile: 'coder-c' },
    { id: 'claude-code', name: 'Claude', role: 'Claude Code CLI', tmux: 'claude-code' },
  ];
  
  return agents.map(agent => {
    // Hermes 实例（总指挥）：从主 sessions 目录读取
    if (agent.sessionId) {
      const messages = getMessagesFromSession(agent.sessionId, 100);
      const lastMsg = messages[messages.length - 1];
      const task = lastMsg ? (lastMsg.role === 'user' ? '等待回复...' : '工作中') : '空闲';
      
      return {
        ...agent,
        online: true,
        task,
        messages,
        output: null,
      };
    }
    
    // Hermes worker（有 profile）：从 profile sessions 目录读取
    if (agent.profile) {
      const online = isSessionActive(agent.tmux);
      if (!online) {
        return {
          ...agent,
          online: false,
          task: '离线',
          messages: [],
          output: '离线',
        };
      }
      
      const messages = getMessagesFromProfile(agent.profile, 100);
      const lastMsg = messages[messages.length - 1];
      const task = lastMsg ? (lastMsg.role === 'user' ? '等待回复...' : '工作中') : '空闲';
      
      return {
        ...agent,
        online: true,
        task,
        messages,
        output: null,
      };
    }
    
    // 非 Hermes CLI（Claude Code 等）：从 tmux 读取
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

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hermes-Session-Id');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
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
