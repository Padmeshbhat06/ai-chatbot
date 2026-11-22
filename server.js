/**
 * Local development server for the SVIT chatbot.
 * Serves the static frontend (index.html, /src/...) and the /api/chat endpoint
 * by delegating to the shared core (lib/chat-core.js).
 *
 * In production this is replaced by Vercel: static files + api/chat.js function.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('./lib/chat-core');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'text/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveStatic(safePath, res) {
    let rel = safePath.split('?')[0];
    if (rel === '/' || rel === '') rel = '/index.html';
    const filePath = path.join(ROOT, rel);

    // Security: ensure the resolved path stays inside the project root.
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // SPA-friendly fallback to index.html for unknown non-asset routes.
                fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
                    if (e2) {
                        res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
                        res.end('<h1>404 Not Found</h1>');
                    } else {
                        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
                        res.end(html, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

function createServer() {
    return http.createServer(async (req, res) => {
        const safePath = req.url.split('?')[0];

        if (safePath === '/api/chat') {
            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({ error: 'Use POST with {"message": "your question"}' }));
                return;
            }
            await core.handler(req, res);
            return;
        }

        serveStatic(safePath, res);
    });
}

function startServer(port) {
    const server = createServer();
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
    server.listen(port, () => {
        console.log('SVIT chatbot dev server started.');
        console.log(`Local link: http://localhost:${port}/`);
    });
}

startServer(DEFAULT_PORT);