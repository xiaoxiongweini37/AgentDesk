const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_HOST = 'localhost';
const API_PORT = 8642;
const PROXY_PORT = 3001;

// 会话搜索（调用 Python 脚本）
function searchSessionsFromDb(query, limit = 10) {
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'session_search_api.py');
    const result = execSync(`python3 ${scriptPath} "${query.replace(/"/g, '\\"')}" ${limit}`, {
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
    const result = execSync(`python3 ${scriptPath} "${sessionId}"`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Python summary error:', err.message);
    return null;
  }
}
