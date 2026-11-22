/**
 * Vercel serverless function: POST /api/chat
 * Delegates to the shared core so local dev (server.js) and production stay
 * in sync. No hardcoded localhost URLs; the frontend calls the relative /api/chat.
 */
const { handler } = require('../lib/chat-core');

module.exports = handler;