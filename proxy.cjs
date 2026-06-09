const http = require('http');
const fs = require('fs');
const path = require('path');

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
      .sort()
      .reverse();
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
      // Only return CLI sessions
      if (data.session_id && data.platform === 'cli') {
        return data.session_id;
      }
    }
  } catch (err) {
    console.error('Error reading session:', err);
  }
  return null;
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

  // Remove Origin header to avoid CORS issues
  const headers = { ...req.headers };
  delete headers.origin;
  delete headers.referer;
  headers.host = `${API_HOST}:${API_PORT}`;

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
