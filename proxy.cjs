const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { getAvailableCliTypes, getCliConfig, buildStartCommand, isCliAvailable, CLI_REGISTRY } = require('./cli_registry.cjs');
const WebSocket = require('ws');

const API_HOST = 'localhost';
const API_PORT = 8642;
const PROXY_PORT = 3001;

// 生成 UUID v4
function generateUUID() {
  return crypto.randomUUID();
}

// ===== 会话压缩功能 =====

const COMPRESS_THRESHOLD = 80;  // 压缩阈值（百分比）
const KEEP_RECENT_MESSAGES = 20;  // 保留最近消息数
const MAX_SUMMARY_TOKENS = 1000;  // 摘要最大 token 数
const CONTEXT_LIMIT = 1000000;  // 上下文限制（1M tokens）

// Token 估算（中文 1 token ≈ 2 字符，英文 1 token ≈ 4 字符）
function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[一-龥]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

// 获取上下文使用情况
function getContextUsage(messages) {
  const totalTokens = messages.reduce((sum, msg) =>
    sum + estimateTokens(msg.content || ''), 0);
  return {
    totalTokens,
    usagePercent: (totalTokens / CONTEXT_LIMIT) * 100
  };
}

// 生成会话摘要
async function generateSummary(messages) {
  return new Promise((resolve, reject) => {
    const prompt = `请将以下对话历史压缩为简洁的摘要，保留：
1. 关键决策和结论
2. 重要的代码修改
3. 未完成的任务
4. 文件路径和配置变更

对话历史：
${JSON.stringify(messages.map(m => ({
      role: m.role,
      content: (m.content || '').substring(0, 500)
    })), null, 2)}`;

    const requestData = JSON.stringify({
      messages: [
        {
          role: 'system',
          content: '你是一个会话摘要生成器。请将对话历史压缩为简洁的摘要，保留关键信息。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: MAX_SUMMARY_TOKENS,
      temperature: 0.3
    });

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error('Invalid response format'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

// 压缩会话
async function compressSession(sessionId, messages) {
  console.log(`[压缩] 开始压缩会话 ${sessionId}，共 ${messages.length} 条消息`);

  // 1. 保留最近的消息
  const recentMessages = messages.slice(-KEEP_RECENT_MESSAGES);
  const oldMessages = messages.slice(0, -KEEP_RECENT_MESSAGES);

  if (oldMessages.length === 0) {
    console.log('[压缩] 没有需要压缩的旧消息');
    return messages;
  }

  try {
    // 2. 生成旧消息的摘要
    const summary = await generateSummary(oldMessages);
    console.log(`[压缩] 摘要生成完成，长度: ${summary.length} 字符`);

    // 3. 创建摘要消息
    const summaryMessage = {
      role: 'system',
      content: `[会话历史摘要 - 已压缩 ${oldMessages.length} 条消息]\n\n${summary}\n\n[最近消息开始]`,
      timestamp: Date.now()
    };

    // 4. 合并消息
    const compressedMessages = [summaryMessage, ...recentMessages];
    console.log(`[压缩] 压缩完成，从 ${messages.length} 条减少到 ${compressedMessages.length} 条`);

    return compressedMessages;
  } catch (err) {
    console.error('[压缩] 生成摘要失败:', err.message);
    return messages;  // 失败时返回原消息
  }
}

// 检查并压缩会话
async function checkAndCompressSession(sessionId) {
  try {
    const sessionsDir = path.join(os.homedir(), '.hermes/sessions');
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.includes(sessionId) && f.endsWith('.json') && !f.includes('request_'));

    if (files.length === 0) return null;

    const sessionFile = path.join(sessionsDir, files[0]);
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    const messages = data.messages || [];

    // 检查上下文使用率
    const { usagePercent } = getContextUsage(messages);
    console.log(`[压缩] 会话 ${sessionId} 上下文使用率: ${usagePercent.toFixed(1)}%`);

    // 如果超过阈值，触发压缩
    if (usagePercent > COMPRESS_THRESHOLD) {
      console.log(`[压缩] 使用率超过 ${COMPRESS_THRESHOLD}%，开始压缩...`);

      // 检查是否已经压缩过（避免重复压缩）
      if (data._compressed) {
        const timeSinceCompression = Date.now() - data._compressed;
        if (timeSinceCompression < 300000) {  // 5 分钟内不重复压缩
          console.log('[压缩] 最近已压缩，跳过');
          return null;
        }
      }

      // 执行压缩
      const compressedMessages = await compressSession(sessionId, messages);

      // 保存压缩后的会话
      data.messages = compressedMessages;
      data._compressed = Date.now();
      data._compressionCount = (data._compressionCount || 0) + 1;

      fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
      console.log('[压缩] 压缩后的会话已保存');

      return {
        compressed: true,
        before: messages.length,
        after: compressedMessages.length,
        usageBefore: usagePercent,
        usageAfter: getContextUsage(compressedMessages).usagePercent
      };
    }

    return null;  // 不需要压缩
  } catch (err) {
    console.error('[压缩] 检查会话失败:', err.message);
    return null;
  }
}

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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'sessions');
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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'sessions');
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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'profiles', profileName, 'sessions');
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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'sessions');
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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'sessions');
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
    const sessionsDir = path.join(os.homedir(), '.hermes', 'sessions');
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
    cli_type: config.cli_type || 'hermes',
    cli_config: config.cli_config || {},
    tmux: config.tmux || null,
    profile: config.profile || null,
    capabilities: config.capabilities || [],
    api_key: config.api_key || '',
    base_url: config.base_url || '',
    model: config.model || '',
  }));
}

// ===== Agent 进程管理器 =====
// 管理持久化的 CLI Agent 进程

const agentProcesses = new Map(); // agentId -> { process, sessionId, status, output }

// Agent 配置存储（持久化会话 ID）
const agentSessions = new Map(); // agentId -> sessionId

// 启动 Agent（记录会话 ID，不真正启动进程）
function startAgentProcess(agentId, agent) {
  // 生成或复用 session ID
  let sessionId = agentSessions.get(agentId);
  if (!sessionId) {
    sessionId = generateUUID();
    agentSessions.set(agentId, sessionId);
  }

  const startInfo = buildStartCommand(agent, sessionId);
  console.log(`[AgentManager] 注册 ${agentId}，CLI: ${startInfo.cliType}，Session: ${sessionId}`);

  const agentInfo = {
    sessionId,
    cliType: startInfo.cliType,
    cliName: startInfo.cliName,
    status: 'running',  // 直接标记为运行中
    output: [],
    lastActivity: Date.now(),
    startTime: Date.now(),
    command: startInfo.command,
    args: startInfo.args,
    env: startInfo.env,
  };

  agentProcesses.set(agentId, agentInfo);

  return agentInfo;
}

// 发送消息给运行中的 Agent（使用 exec）
function sendMessageToAgent(agentId, message) {
  return new Promise((resolve) => {
    const agentInfo = agentProcesses.get(agentId);

    if (!agentInfo) {
      resolve({ error: 'Agent 未启动' });
      return;
    }

    if (agentInfo.status !== 'running') {
      resolve({ error: `Agent 状态异常: ${agentInfo.status}` });
      return;
    }

    const { exec } = require('child_process');
    const escapedMessage = message.replace(/"/g, '\\"');

    // 使用 echo pipe 方式调用 CLI
    const fullCommand = `echo "${escapedMessage}" | ${agentInfo.command} --session-id ${agentInfo.sessionId}`;

    console.log(`[AgentManager] ${agentId} 执行: ${fullCommand.substring(0, 100)}...`);

    const childProcess = exec(fullCommand, {
      timeout: 60000,
      env: { ...process.env, ...agentInfo.env },
      encoding: 'utf-8',
    }, (error, stdout, stderr) => {
      if (error) {
        console.log(`[AgentManager] ${agentId} 错误:`, error.message);
        resolve({ error: error.message });
        return;
      }

      const output = stdout || stderr || '';
      console.log(`[AgentManager] ${agentId} 输出 (${output.length} bytes)`);

      // 记录输出
      agentInfo.output.push({
        type: 'response',
        content: output,
        timestamp: Date.now(),
        message: message,
      });

      agentInfo.lastActivity = Date.now();

      resolve({
        success: true,
        output: output,
        message: '消息已发送并收到响应',
      });
    });
  });
}

// 获取 Agent 输出
function getAgentOutput(agentId, since = 0) {
  const agentInfo = agentProcesses.get(agentId);

  if (!agentInfo) {
    return { error: 'Agent 未启动' };
  }

  const filteredOutput = agentInfo.output.filter(o => o.timestamp > since);

  return {
    status: agentInfo.status,
    sessionId: agentInfo.sessionId,
    cliType: agentInfo.cliType,
    output: filteredOutput,
    lastActivity: agentInfo.lastActivity,
    uptime: Date.now() - agentInfo.startTime,
  };
}

// 停止 Agent 进程
function stopAgentProcess(agentId) {
  const agentInfo = agentProcesses.get(agentId);

  if (!agentInfo) {
    return { error: 'Agent 未启动' };
  }

  // 清除会话 ID
  agentSessions.delete(agentId);
  agentProcesses.delete(agentId);

  return { success: true, message: 'Agent 已停止' };
}

// 获取所有 Agent 状态
function getAllAgentStatus() {
  const statuses = {};

  for (const [agentId, info] of agentProcesses) {
    statuses[agentId] = {
      status: info.status,
      sessionId: info.sessionId,
      cliType: info.cliType,
      cliName: info.cliName,
      lastActivity: info.lastActivity,
      uptime: Date.now() - info.startTime,
      outputCount: info.output.length,
    };
  }

  return statuses;
}

// 任务存储（内存中，全局共享）
const tasks = new Map()

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Debug: 测试 spawn
  if (req.url === '/api/debug/spawn-test' && req.method === 'POST') {
    const { spawn } = require('child_process');
    const sessionId = generateUUID();

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const send = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);

    send({ msg: `Spawning claude with session ${sessionId}` });

    const proc = spawn('claude', ['--session-id', sessionId], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    send({ msg: `PID: ${proc.pid}` });

    proc.stdout.on('data', (data) => {
      send({ type: 'stdout', content: data.toString() });
    });
    proc.stderr.on('data', (data) => {
      send({ type: 'stderr', content: data.toString() });
    });
    proc.on('exit', (code) => {
      send({ type: 'exit', code });
      res.end();
    });

    setTimeout(() => {
      send({ msg: 'Writing hello...' });
      proc.stdin.write('hello\n');
    }, 500);

    setTimeout(() => {
      send({ msg: 'Killing...' });
      proc.kill();
    }, 15000);

    return;
  }
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

  // ===== Agent 进程管理 API =====

  // 获取所有 Agent 运行状态
  if (req.url === '/api/agents/running' && req.method === 'GET') {
    const statuses = getAllAgentStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statuses));
    return;
  }

  // ===== 任务管理 API =====

  // 获取所有任务
  if (req.url === '/api/tasks' && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const status = url.searchParams.get('status')

    let taskList = Array.from(tasks.values())

    if (status) {
      taskList = taskList.filter(t => t.status === status)
    }

    // 按创建时间排序
    taskList.sort((a, b) => b.createdAt - a.createdAt)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(taskList))
    return
  }

  // 创建任务
  if (req.url === '/api/tasks' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const { title, description, priority, assignedTo } = JSON.parse(body)

        const task = {
          id: generateUUID(),
          title: title || '未命名任务',
          description: description || '',
          status: 'pending',
          priority: priority || 'normal',
          assignedTo: assignedTo || null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
        }

        tasks.set(task.id, task)

        console.log(`[Task] 任务已创建: ${task.id} - ${task.title}`)

        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(task))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // 更新任务
  if (req.url.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'PUT') {
    const taskId = req.url.split('/')[3]
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const task = tasks.get(taskId)
        if (!task) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '任务不存在' }))
          return
        }

        const updates = JSON.parse(body)

        if (updates.title !== undefined) task.title = updates.title
        if (updates.description !== undefined) task.description = updates.description
        if (updates.status !== undefined) {
          task.status = updates.status
          if (updates.status === 'completed') {
            task.completedAt = Date.now()
          }
        }
        if (updates.priority !== undefined) task.priority = updates.priority
        if (updates.assignedTo !== undefined) task.assignedTo = updates.assignedTo

        task.updatedAt = Date.now()

        console.log(`[Task] 任务已更新: ${taskId} - ${task.status}`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(task))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // 获取单个任务
  if (req.url.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'GET') {
    const taskId = req.url.split('/')[3]
    const task = tasks.get(taskId)

    if (!task) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: '任务不存在' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(task))
    return
  }

  // 删除任务
  if (req.url.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'DELETE') {
    const taskId = req.url.split('/')[3]

    if (!tasks.has(taskId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: '任务不存在' }))
      return
    }

    tasks.delete(taskId)

    console.log(`[Task] 任务已删除: ${taskId}`)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
    return
  }

  // 分配任务给 Agent
  if (req.url.match(/^\/api\/tasks\/[^/]+\/assign$/) && req.method === 'POST') {
    const taskId = req.url.split('/')[3]
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const task = tasks.get(taskId)
        if (!task) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '任务不存在' }))
          return
        }

        const { agentId } = JSON.parse(body)
        task.assignedTo = agentId
        task.status = 'assigned'
        task.updatedAt = Date.now()

        console.log(`[Task] 任务已分配: ${taskId} → ${agentId}`)

        // 构建任务通知消息
        const taskNotification = {
          type: 'task_assigned',
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
          },
          agentId: agentId,
          message: `新任务: ${task.title}`,
        }

        // 通过 WebSocket 通知指定 Agent
        const notified = sendToAgent(agentId, taskNotification)

        // 同时广播给所有客户端（包括前端）
        broadcastToAgents(taskNotification)

        if (notified) {
          console.log(`[WebSocket] 已通知 Agent ${agentId} 和所有客户端`)
        } else {
          console.log(`[WebSocket] Agent ${agentId} 未连接，任务已保存`)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(task))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // 获取分配给指定 Agent 的任务
  if (req.url.match(/^\/api\/agents\/[^/]+\/tasks$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3]
    const url = new URL(req.url, `http://${req.headers.host}`)
    const status = url.searchParams.get('status') || 'assigned'

    let agentTasks = Array.from(tasks.values()).filter(t => t.assignedTo === agentId)

    if (status !== 'all') {
      agentTasks = agentTasks.filter(t => t.status === status)
    }

    agentTasks.sort((a, b) => b.updatedAt - a.updatedAt)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(agentTasks))
    return
  }

  // Agent 获取下一个待处理任务
  if (req.url.match(/^\/api\/agents\/[^/]+\/tasks\/next$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3]

    // 找到分配给该 Agent 的下一个待处理任务
    const nextTask = Array.from(tasks.values())
      .filter(t => t.assignedTo === agentId && (t.status === 'assigned' || t.status === 'pending'))
      .sort((a, b) => {
        // 优先级排序
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })[0]

    if (nextTask) {
      // 自动更新状态为进行中
      nextTask.status = 'in_progress'
      nextTask.updatedAt = Date.now()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(nextTask))
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(null))
    }
    return
  }

  // Agent 报告任务完成
  if (req.url.match(/^\/api\/agents\/[^/]+\/tasks\/[^/]+\/complete$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3]
    const taskId = req.url.split('/')[5]
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const task = tasks.get(taskId)
        if (!task) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '任务不存在' }))
          return
        }

        if (task.assignedTo !== agentId) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '任务未分配给该 Agent' }))
          return
        }

        const { result } = JSON.parse(body)
        task.status = 'completed'
        task.result = result || '任务已完成'
        task.completedAt = Date.now()
        task.updatedAt = Date.now()

        console.log(`[Task] 任务已完成: ${taskId} by ${agentId}`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(task))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // Agent 报告任务失败
  if (req.url.match(/^\/api\/agents\/[^/]+\/tasks\/[^/]+\/fail$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3]
    const taskId = req.url.split('/')[5]
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const task = tasks.get(taskId)
        if (!task) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '任务不存在' }))
          return
        }

        const { error } = JSON.parse(body)
        task.status = 'failed'
        task.error = error || '任务失败'
        task.updatedAt = Date.now()

        console.log(`[Task] 任务失败: ${taskId} - ${error}`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(task))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // 发送消息给运行中的 Agent
  if (req.url.match(/^\/api\/agents\/[^/]+\/send$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);

        // 检查 Agent 是否已启动
        const agentInfo = agentProcesses.get(agentId);
        if (!agentInfo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Agent 未启动，请先启动 Agent' }));
          return;
        }

        if (agentInfo.status !== 'running') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Agent 状态: ${agentInfo.status}，无法发送消息` }));
          return;
        }

        // 设置 SSE 响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const sendEvent = (data) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: 'status', message: '正在发送消息并等待响应...' });

        // 发送消息并等待响应
        const result = await sendMessageToAgent(agentId, message);

        if (result.error) {
          sendEvent({ type: 'error', message: result.error });
        } else {
          sendEvent({ type: 'output', content: result.output });
          sendEvent({ type: 'complete', output: result.output });
        }

        res.end();

      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      }
    });
    return;
  }

  // 获取 Agent 输出
  if (req.url.match(/^\/api\/agents\/[^/]+\/output$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3];
    const url = new URL(req.url, `http://${req.headers.host}`);
    const since = parseInt(url.searchParams.get('since') || '0');

    const result = getAgentOutput(agentId, since);
    if (result.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }
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
          : os.homedir();
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

  // Handle CLI types endpoint
  if (req.url === '/api/cli-types' && req.method === 'GET') {
    const cliTypes = getAvailableCliTypes();
    // 检查每个 CLI 是否可用
    const result = cliTypes.map(cli => ({
      ...cli,
      available: isCliAvailable(cli.id),
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Test agent communication (真正的 CLI 测试)
  if (req.url === '/api/test/agent' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { agentId, message, cliType } = JSON.parse(body);

        // 获取 Agent 配置
        const agents = appConfig.agents || {};
        const agent = agents[agentId];
        if (!agent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Agent not found' }));
          return;
        }

        // 构建启动命令
        const startInfo = buildStartCommand(agent, generateUUID());
        const sessionId = startInfo.args[1];

        console.log(`[Test Agent] Agent: ${agentId}, CLI: ${startInfo.cliType}, Session: ${sessionId}`);

        // 设置 SSE 响应头
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const sendEvent = (data) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: 'status', message: `启动 ${startInfo.cliName} (${startInfo.cliType})...` });

        // 用 exec + echo pipe 方式调用（已验证可行）
        const { exec } = require('child_process');

        // 将消息写入临时文件，避免编码问题
        const tempFile = path.join(os.tmpdir(), `agent_task_${sessionId}.txt`);
        fs.writeFileSync(tempFile, message, 'utf-8');

        // 根据平台构建命令
        const isWindows = process.platform === 'win32';
        let fullCommand;

        if (startInfo.cliType === 'claude') {
          // Claude CLI: 使用文件重定向
          if (isWindows) {
            // Windows: 使用 PowerShell 执行，确保 UTF-8 编码
            fullCommand = `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path '${tempFile}' -Encoding UTF8 | ${startInfo.command} --session-id ${sessionId}"`;
          } else {
            fullCommand = `cat "${tempFile}" | ${startInfo.command} --session-id ${sessionId}`;
          }
        } else {
          // 其他 CLI: 直接执行命令
          fullCommand = `${startInfo.fullCommand}`;
        }

        console.log(`[Test Agent] 执行命令: ${fullCommand}`);

        sendEvent({ type: 'status', message: '执行中...' });

        // Windows 上设置 UTF-8 编码
        const execOptions = {
          timeout: 60000,
          env: { ...process.env, ...startInfo.env },
          encoding: 'utf-8',
        }

        if (isWindows) {
          execOptions.windowsHide = true
        }

        const childProcess = exec(fullCommand, execOptions, (error, stdout, stderr) => {
          // 清理临时文件
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            // 忽略清理错误
          }

          if (error) {
            if (error.killed) {
              sendEvent({ type: 'status', message: '执行超时' });
            } else {
              sendEvent({ type: 'error', message: error.message });
            }
          }

          if (stderr) {
            sendEvent({ type: 'output', content: stderr });
          }

          if (stdout) {
            sendEvent({ type: 'output', content: stdout });
          }

          sendEvent({
            type: 'complete',
            exitCode: error ? error.code : 0,
            output: stdout || '',
          });

          res.end();
        });

      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      }
    });
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
        if (updates.cli_type !== undefined) agent.cli_type = updates.cli_type || 'hermes';
        if (updates.cli_config !== undefined) agent.cli_config = updates.cli_config || {};
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

  // Test agent connection
  if (req.url.match(/^\/api\/agents\/[^/]+\/test$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3];
    try {
      const agents = appConfig.agents || {};
      const agent = agents[agentId];
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }

      const baseUrl = agent.base_url || 'http://localhost:8642';
      const apiKey = agent.api_key || 'hermes-secret-key-2026';

      // Test connection by calling /v1/models
      const testUrl = new URL('/v1/models', baseUrl);
      const httpModule = testUrl.protocol === 'https:' ? require('https') : require('http');

      const testReq = httpModule.request(testUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 5000,
      }, (testRes) => {
        let data = '';
        testRes.on('data', chunk => data += chunk);
        testRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: testRes.statusCode === 200,
              message: testRes.statusCode === 200 ? '连接成功' : `HTTP ${testRes.statusCode}`,
              models: result.data?.length || 0,
            }));
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '响应解析失败' }));
          }
        });
      });

      testReq.on('error', (err) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      });

      testReq.on('timeout', () => {
        testReq.destroy();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '连接超时' }));
      });

      testReq.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get agent status
  if (req.url.match(/^\/api\/agents\/[^/]+\/status$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3];
    try {
      const agents = appConfig.agents || {};
      const agent = agents[agentId];
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }

      // 多种方式检测 Agent 状态
      const isWindows = process.platform === 'win32';
      let isOnline = false;
      let uptime = null;
      let source = 'none';

      // 方式1: 检查 tmux session（仅 Linux/Mac，如果配置了）
      if (!isWindows && agent.tmux) {
        try {
          execSync(`tmux has-session -t ${agent.tmux}`, { timeout: 3000 });
          isOnline = true;
          source = 'tmux';
          const startTime = execSync(`tmux display-message -t ${agent.tmux} -p '#{session_created}'`, {
            encoding: 'utf8', timeout: 3000,
          }).trim();
          if (startTime) {
            uptime = Math.floor((Date.now() / 1000) - parseInt(startTime));
          }
        } catch (e) {
          // tmux session 不存在
        }
      }

      // 方式2: 检查是否有该 Agent 的活跃会话（最近5分钟有更新）
      if (!isOnline) {
        try {
          const sessionsDir = path.join(os.homedir(), '.hermes/sessions');
          if (fs.existsSync(sessionsDir)) {
            const files = fs.readdirSync(sessionsDir)
              .filter(f => f.includes(agentId) && f.endsWith('.json'))
              .map(f => ({
                name: f,
                mtime: fs.statSync(path.join(sessionsDir, f)).mtime,
              }))
              .sort((a, b) => b.mtime - a.mtime);

            if (files.length > 0) {
              const lastActivity = files[0].mtime.getTime();
              const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
              if (lastActivity > fiveMinutesAgo) {
                isOnline = true;
                source = 'session';
                uptime = Math.floor((Date.now() - lastActivity) / 1000);
              }
            }
          }
        } catch (e) {
          // 检查失败
        }
      }

      // 方式3: Windows 上检查启动脚本是否存在
      if (isWindows && !isOnline) {
        try {
          const scriptDir = path.join(os.homedir(), '.hermes', 'scripts');
          if (fs.existsSync(scriptDir)) {
            const scriptFiles = fs.readdirSync(scriptDir)
              .filter(f => f.startsWith(`start_${agentId}_`) && f.endsWith('.ps1'))
              .map(f => ({
                name: f,
                mtime: fs.statSync(path.join(scriptDir, f)).mtime,
              }))
              .sort((a, b) => b.mtime - a.mtime);

            if (scriptFiles.length > 0) {
              const lastScript = scriptFiles[0].mtime.getTime();
              const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
              if (lastScript > fiveMinutesAgo) {
                isOnline = true;
                source = 'script';
                uptime = Math.floor((Date.now() - lastScript) / 1000);
              }
            }
          }
        } catch (e) {
          // 检查失败
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: agentId,
        status: isOnline ? 'online' : 'offline',
        uptime,
        source, // 状态来源：tmux, session, script, none
        platform: isWindows ? 'windows' : 'unix',
        tmux: agent.tmux || null,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Start agent (create session with agent config)
  if (req.url.match(/^\/api\/agents\/[^/]+\/start$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3];
    try {
      const agents = appConfig.agents || {};
      const agent = agents[agentId];
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }

      // 检查是否已在运行
      const existingInfo = agentProcesses.get(agentId);
      if (existingInfo && (existingInfo.status === 'running' || existingInfo.status === 'starting')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'already_running',
          message: `Agent ${agentId} 已在运行`,
          sessionId: existingInfo.sessionId,
          cliType: existingInfo.cliType,
        }));
        return;
      }

      // 检查 CLI 是否可用
      const cliType = agent.cli_type || 'hermes';
      if (!isCliAvailable(cliType)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: `${cliType} CLI 未安装`,
          cliType,
        }));
        return;
      }

      // 使用进程管理器启动 Agent
      const agentInfo = startAgentProcess(agentId, agent);

      // 等待 Agent 就绪（最多 10 秒）
      const waitStart = Date.now();
      const checkReady = setInterval(() => {
        const elapsed = Date.now() - waitStart;

        if (agentInfo.status === 'running' || elapsed > 10000) {
          clearInterval(checkReady);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: agentInfo.status === 'running' ? 'started' : 'starting',
            sessionId: agentInfo.sessionId,
            cliType: agentInfo.cliType,
            cliName: agentInfo.cliName,
            message: agentInfo.status === 'running'
              ? `✅ ${agentInfo.cliName} 已启动并就绪`
              : `⏳ ${agentInfo.cliName} 正在启动中...`,
          }));
        }
      }, 500);

    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  // Stop agent
  if (req.url.match(/^\/api\/agents\/[^/]+\/stop$/) && req.method === 'POST') {
    const agentId = req.url.split('/')[3];
    try {
      const result = stopAgentProcess(agentId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...result,
        agent: agentId,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get agent logs (recent session messages)
  if (req.url.match(/^\/api\/agents\/[^/]+\/logs$/) && req.method === 'GET') {
    const agentId = req.url.split('/')[3];
    try {
      const sessionsDir = path.join(os.homedir(), '.hermes/sessions');
      const agentSessions = [];

      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir)
          .filter(f => f.includes(agentId) && f.endsWith('.json'))
          .sort((a, b) => {
            const statA = fs.statSync(path.join(sessionsDir, a));
            const statB = fs.statSync(path.join(sessionsDir, b));
            return statB.mtime - statA.mtime;
          })
          .slice(0, 5); // Get last 5 sessions

        for (const file of files) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
            const messages = (data.messages || [])
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .slice(-10) // Last 10 messages per session
              .map(m => ({
                role: m.role,
                content: (m.content || '').substring(0, 200),
                timestamp: m.timestamp,
              }));
            agentSessions.push({
              session_id: data.session_id,
              messages,
              updated_at: data.updated_at,
            });
          } catch (e) {
            // Skip invalid files
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ logs: agentSessions }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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

  // 旧的任务 API 已移除，使用新的内存存储 API（第 881 行）

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

  // 旧的任务更新 API 已移除，使用新的内存存储 API（第 940 行）

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

  // 旧的自动分配 API 已移除

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

  // Handle session compression status endpoint
  if (req.url.match(/^\/api\/sessions\/[^/]+\/compression$/)) {
    const sessionId = req.url.split('/')[3];
    try {
      const sessionsDir = path.join(os.homedir(), '.hermes/sessions');
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.includes(sessionId) && f.endsWith('.json') && !f.includes('request_'));

      if (files.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      const sessionFile = path.join(sessionsDir, files[0]);
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const messages = data.messages || [];
      const { totalTokens, usagePercent } = getContextUsage(messages);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sessionId,
        messageCount: messages.length,
        totalTokens,
        usagePercent: Math.round(usagePercent * 10) / 10,
        compressed: data._compressed || null,
        compressionCount: data._compressionCount || 0,
        threshold: COMPRESS_THRESHOLD
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Handle manual compression endpoint
  if (req.url.match(/^\/api\/sessions\/[^/]+\/compress$/) && req.method === 'POST') {
    const sessionId = req.url.split('/')[3];
    checkAndCompressSession(sessionId).then(result => {
      if (result) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ compressed: false, message: '不需要压缩' }));
      }
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Handle compression status endpoint
  if (req.url.match(/^\/api\/sessions\/[^/]+\/compression$/) && req.method === 'GET') {
    const sessionId = req.url.split('/')[3];
    try {
      const sessionsDir = path.join(os.homedir(), '.hermes/sessions');
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.includes(sessionId) && f.endsWith('.json') && !f.includes('request_'));

      if (files.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      const sessionFile = path.join(sessionsDir, files[0]);
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const messages = data.messages || [];
      const { totalTokens, usagePercent } = getContextUsage(messages);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sessionId,
        messageCount: messages.length,
        totalTokens,
        usagePercent: Math.round(usagePercent * 10) / 10,
        threshold: COMPRESS_THRESHOLD,
        compressed: data._compressed ? true : false,
        compressionCount: data._compressionCount || 0,
        lastCompressed: data._compressed || null,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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

      // 异步检查并压缩会话（不阻塞请求）
      checkAndCompressSession(currentSessionId).then(result => {
        if (result) {
          console.log(`[压缩] 会话已压缩: ${result.before} → ${result.after} 条消息`);
          console.log(`[压缩] 上下文使用率: ${result.usageBefore.toFixed(1)}% → ${result.usageAfter.toFixed(1)}%`);
        }
      }).catch(err => {
        console.error('[压缩] 压缩失败:', err.message);
      });
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

// ===== WebSocket 服务器 =====
const wss = new WebSocket.Server({ server });

// 存储 Agent 连接
const agentConnections = new Map(); // agentId -> WebSocket

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agentId');

  if (agentId) {
    // Agent 连接
    agentConnections.set(agentId, ws);
    console.log(`[WebSocket] Agent ${agentId} 已连接`);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      agentId,
      message: `欢迎 ${agentId}，等待任务...`,
    }));

    // 连接关闭时清理
    ws.on('close', () => {
      agentConnections.delete(agentId);
      console.log(`[WebSocket] Agent ${agentId} 已断开`);
    });

    // 心跳检测
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  } else {
    // 普通客户端连接
    console.log('[WebSocket] 客户端已连接');

    ws.on('close', () => {
      console.log('[WebSocket] 客户端已断开');
    });
  }
});

// 心跳检测（每 30 秒）
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// 向指定 Agent 发送消息
function sendToAgent(agentId, message) {
  const ws = agentConnections.get(agentId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

// 向所有 Agent 广播消息
function broadcastToAgents(message) {
  agentConnections.forEach((ws, agentId) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

console.log('[WebSocket] 服务器已启动');

server.listen(PROXY_PORT, () => {
  console.log(`Proxy server running on http://localhost:${PROXY_PORT}`);
});
