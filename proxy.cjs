const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 8642;
const PROXY_PORT = 3001;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('  Headers:', JSON.stringify(req.headers, null, 2));
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('  -> OPTIONS preflight');
    res.writeHead(200);
    res.end();
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

  console.log('  -> Proxying to:', `${API_HOST}:${API_PORT}${req.url}`);
  console.log('  -> Forwarded headers:', JSON.stringify(headers, null, 2));

  const proxyReq = http.request(options, (proxyRes) => {
    console.log('  <- Response:', proxyRes.statusCode);
    console.log('  <- Response headers:', JSON.stringify(proxyRes.headers, null, 2));
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('  !! Proxy error:', err.message);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, () => {
  console.log(`Proxy server running on http://localhost:${PROXY_PORT}`);
  console.log(`Forwarding to http://${API_HOST}:${API_PORT}`);
});
