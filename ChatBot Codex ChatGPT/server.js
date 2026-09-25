const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
function loadEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv();

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const systemPrompt = `You are Wrench, an AI assistant for a mechanic workshop management app called Northside Auto. Be concise, practical, and clear. Help with repair jobs, booking schedules, inventory, customer messages, estimates, and day-to-day workshop operations. The shop dashboard currently contains sample data: 8 bookings today; Mia Chen at 09:30 (2018 Toyota RAV4, oil change), Andre Wilson at 10:15 (2021 Ford F-150, brake inspection), Priya Patel at 11:00 (2017 Honda Accord, diagnostic), Sam Rivera at 13:30 (2020 Subaru Outback, tire rotation); 12 active jobs; job #2841 is a 2019 Honda Civic for Taylor Brooks, awaiting approval for front brake pads and rotor replacement, estimate $486.20, waiting 2h 14m; low stock includes oil filter OF-204 (2), 5W-30 synthetic oil (3), front brake pads BP-118 (1 set), and cabin air filter CAF-022 (2). These are sample records, not live workshop data. Never claim to have sent a message, placed an order, or changed a record. You may draft messages or suggest actions, and clearly say when an action needs review or a connected system.`;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 50000) { reject(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (!process.env.GROQ_API_KEY) return send(res, 503, { error: 'GROQ_API_KEY is missing from the local .env file.' });
    try {
      const body = await readBody(req);
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return send(res, 400, { error: 'Send between 1 and 40 chat messages.' });
      const messages = body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
      if (messages.length !== body.messages.length) return send(res, 400, { error: 'One or more messages have an invalid format.' });
      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages: [{ role: 'system', content: systemPrompt }, ...messages], temperature: 0.5, max_completion_tokens: 700 }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const message = upstream.status === 401 ? 'Groq rejected the API key. Check GROQ_API_KEY in .env.' : (data.error?.message || `Groq request failed (${upstream.status}).`);
        return send(res, upstream.status >= 500 ? 502 : upstream.status, { error: message });
      }
      return send(res, 200, { reply: data.choices?.[0]?.message?.content || 'I could not generate a response. Please try again.' });
    } catch (error) {
      const status = error.message === 'Invalid JSON' ? 400 : 500;
      return send(res, status, { error: error.name === 'TimeoutError' ? 'The AI request timed out. Please try again.' : error.message });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const target = path.resolve(root, `.${requested}`);
  if (!target.startsWith(root + path.sep) || target === path.join(root, '.env') || target.startsWith(path.join(root, 'node_modules') + path.sep)) return send(res, 404, { error: 'Not found.' });
  fs.readFile(target, (error, content) => {
    if (error) return send(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '127.0.0.1', () => console.log(`Wrench local app running at http://127.0.0.1:${port}`));
