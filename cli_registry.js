/**
 * CLI Registry - 支持的 CLI 工具注册表
 *
 * 定义各种 CLI 工具的启动配置，支持动态扩展
 */

const CLI_REGISTRY = {
  hermes: {
    name: "Hermes Agent",
    icon: "🤖",
    description: "Hermes 智能体框架",
    defaultCommand: "hermes-agent",
    defaultArgs: ["--session-id", "{session_id}", "--name", "{agent_name}"],
    defaultEnv: {
      HERMES_API_KEY: "{api_key}",
      HERMES_BASE_URL: "{base_url}",
    },
    configFields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "留空使用默认配置" },
      { key: "base_url", label: "Base URL", type: "text", placeholder: "如: https://api.example.com/v1" },
      { key: "model", label: "模型名称", type: "text", placeholder: "如: mimo-v2.5-pro" },
    ],
    supportsStreaming: true,
    supportsTools: true,
  },

  claude: {
    name: "Claude CLI",
    icon: "🧠",
    description: "Anthropic Claude CLI",
    defaultCommand: "claude",
    defaultArgs: ["--session-id", "{session_id}"],
    defaultEnv: {
      ANTHROPIC_API_KEY: "{api_key}",
    },
    configFields: [
      { key: "api_key", label: "Anthropic API Key", type: "password", placeholder: "sk-ant-..." },
    ],
    supportsStreaming: true,
    supportsTools: true,
  },

  opencode: {
    name: "OpenCode",
    icon: "💻",
    description: "OpenAI Codex CLI",
    defaultCommand: "opencode",
    defaultArgs: ["--session", "{session_id}"],
    defaultEnv: {
      OPENAI_API_KEY: "{api_key}",
    },
    configFields: [
      { key: "api_key", label: "OpenAI API Key", type: "password", placeholder: "sk-..." },
      { key: "model", label: "模型名称", type: "text", placeholder: "如: gpt-4" },
    ],
    supportsStreaming: true,
    supportsTools: true,
  },

  cursor: {
    name: "Cursor Agent",
    icon: "📝",
    description: "Cursor IDE Agent",
    defaultCommand: "cursor",
    defaultArgs: ["--agent", "{session_id}"],
    defaultEnv: {},
    configFields: [],
    supportsStreaming: false,
    supportsTools: true,
  },

  continue: {
    name: "Continue",
    icon: "🔄",
    description: "Continue IDE 扩展",
    defaultCommand: "continue",
    defaultArgs: ["--session", "{session_id}"],
    defaultEnv: {},
    configFields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "可选" },
    ],
    supportsStreaming: true,
    supportsTools: true,
  },

  aider: {
    name: "Aider",
    icon: "🤝",
    description: "Aider AI 编程助手",
    defaultCommand: "aider",
    defaultArgs: ["--session-id", "{session_id}"],
    defaultEnv: {
      OPENAI_API_KEY: "{api_key}",
    },
    configFields: [
      { key: "api_key", label: "OpenAI API Key", type: "password", placeholder: "sk-..." },
      { key: "model", label: "模型名称", type: "text", placeholder: "如: gpt-4" },
    ],
    supportsStreaming: true,
    supportsTools: false,
  },

  custom: {
    name: "自定义",
    icon: "⚙️",
    description: "自定义 CLI 工具",
    defaultCommand: "",
    defaultArgs: [],
    defaultEnv: {},
    configFields: [
      { key: "command", label: "命令", type: "text", placeholder: "如: my-agent" },
      { key: "args", label: "参数（每行一个）", type: "textarea", placeholder: "--session-id {session_id}\n--name {agent_name}" },
      { key: "env", label: "环境变量（KEY=VALUE，每行一个）", type: "textarea", placeholder: "API_KEY={api_key}\nBASE_URL={base_url}" },
    ],
    supportsStreaming: false,
    supportsTools: false,
  },
};

/**
 * 获取所有可用的 CLI 类型
 * @returns {Array} CLI 类型列表
 */
function getAvailableCliTypes() {
  return Object.entries(CLI_REGISTRY).map(([key, config]) => ({
    id: key,
    name: config.name,
    icon: config.icon,
    description: config.description,
  }));
}

/**
 * 获取指定 CLI 类型的配置
 * @param {string} cliType - CLI 类型
 * @returns {Object} CLI 配置
 */
function getCliConfig(cliType) {
  return CLI_REGISTRY[cliType] || CLI_REGISTRY.custom;
}

/**
 * 构建启动命令
 * @param {Object} agent - Agent 配置
 * @param {string} sessionId - 会话 ID
 * @returns {Object} 启动命令和环境变量
 */
function buildStartCommand(agent, sessionId) {
  const cliType = agent.cli_type || 'hermes';
  const cliConfig = getCliConfig(cliType);
  const agentCliConfig = agent.cli_config || {};

  // 构建命令
  const command = agentCliConfig.command || cliConfig.defaultCommand;
  const args = (agentCliConfig.args || cliConfig.defaultArgs).map(arg =>
    arg.replace('{session_id}', sessionId)
       .replace('{agent_name}', agent.name || 'agent')
  );

  // 构建环境变量
  const env = { ...process.env };
  const envTemplate = { ...cliConfig.defaultEnv, ...agentCliConfig.env };
  for (const [key, value] of Object.entries(envTemplate)) {
    env[key] = value
      .replace('{api_key}', agent.api_key || '')
      .replace('{base_url}', agent.base_url || '')
      .replace('{model}', agent.model || '');
  }

  return {
    command,
    args,
    env,
    fullCommand: `${command} ${args.join(' ')}`,
    cliType,
    cliName: cliConfig.name,
    cliIcon: cliConfig.icon,
  };
}

/**
 * 验证 CLI 是否可用
 * @param {string} cliType - CLI 类型
 * @returns {boolean} 是否可用
 */
function isCliAvailable(cliType) {
  const cliConfig = getCliConfig(cliType);
  if (!cliConfig.defaultCommand) return false;

  try {
    const { execSync } = require('child_process');
    const checkCommand = process.platform === 'win32'
      ? `where ${cliConfig.defaultCommand}`
      : `which ${cliConfig.defaultCommand}`;
    execSync(checkCommand, { timeout: 3000, stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  CLI_REGISTRY,
  getAvailableCliTypes,
  getCliConfig,
  buildStartCommand,
  isCliAvailable,
};
