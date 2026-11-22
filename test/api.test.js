/**
 * Step 2 validation: simulate real POST requests against api/chat.js.
 * Runs with and without GEMINI_API_KEY for 8 required queries.
 * Prints exact response for each and asserts none return the welcome string.
 *
 * Usage: node test/api.test.js
 */
const http = require('http');

const WELCOME = 'I can answer questions about SVIT — Admissions, Courses, Fees';
const QUERIES = [
  'courses',
  'fees',
  'How were 2026 placements at SVIT?',
  'What are the KCET & COMEDK codes?',
  'Do you offer M.Tech or MCA?',
  'Tell me about hostel & college bus facilities',
  'What are the major events & clubs?',
  "What is today's canteen menu?"
];

function makeReqRes(bodyObj) {
  const EventEmitter = require('events');
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = { 'content-type': 'application/json' };
  req.body = undefined;

  let statusCode = 200;
  const headers = {};
  let out = '';
  const res = {
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    end(chunk) { if (chunk) out += String(chunk); res._ended = true; res._resolve({ statusCode, headers, body: out }); }
  };
  res._ended = false;
  res._promise = new Promise((resolve) => { res._resolve = resolve; });

  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(bodyObj)));
    req.emit('end');
  });

  return { req, res };
}

function makeReqResParsed(bodyObj) {
  let statusCode = 200;
  const headers = {};
  let out = '';
  const req = { method: 'POST', headers: { 'content-type': 'application/json' }, body: bodyObj };
  const res = {
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    end(chunk) { if (chunk) out += String(chunk); res._ended = true; }
  };
  return { req, res, getResult: () => ({ statusCode, headers, body: out }) };
}

async function callHandler(handler, message, mode) {
  if (mode === 'parsed') {
    const { req, res, getResult } = makeReqResParsed({ message });
    await handler(req, res);
    return getResult();
  }
  const { req, res } = makeReqRes({ message });
  const p = res._promise;
  await handler(req, res);
  return p;
}

function loadApiFresh() {
  for (const k of Object.keys(require.cache)) {
    const key = String(k).toLowerCase();
    if (key.includes('chat-core.js') || key.includes('api\\chat.js') || key.includes('api/chat.js')) {
      delete require.cache[k];
    }
  }
  return require('../api/chat.js');
}

function hasWelcome(text) {
  return String(text || '').includes(WELCOME);
}

function extractAnswer(body) {
  let parsed;
  try { parsed = JSON.parse(body); } catch (e) { return { parsed: null, answer: String(body) }; }
  const answer = parsed && (parsed.reply || parsed.answer || parsed.response || '');
  return { parsed, answer: String(answer) };
}

async function runSuite(label, envValue) {
  const prev = process.env.GEMINI_API_KEY;
  if (envValue === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = envValue;

  const handler = loadApiFresh();
  const results = [];
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SUITE: ${label}`);
  console.log(`GEMINI_API_KEY set: ${!!process.env.GEMINI_API_KEY}`);
  console.log('='.repeat(70));

  for (const q of QUERIES) {
    const r = await callHandler(handler, q, 'parsed');
    const { parsed, answer } = extractAnswer(r.body);
    const welcome = hasWelcome(answer);
    const hasKeys = !!(parsed && typeof parsed.reply === 'string' && typeof parsed.answer === 'string' && typeof parsed.response === 'string');
    const pass = !welcome && r.statusCode === 200 && hasKeys && answer.trim().length > 0;
    results.push({ q, pass, welcome, statusCode: r.statusCode, hasKeys, answer, parsed });
    console.log(`\n--- Query: ${q}`);
    console.log(`HTTP: ${r.statusCode} | has reply/answer/response: ${hasKeys} | welcome: ${welcome} | PASS: ${pass}`);
    console.log(`Exact response: ${answer}`);
  }

  if (prev === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = prev;

  return results;
}

async function main() {
  const noKey = await runSuite('WITHOUT GEMINI_API_KEY', undefined);
  const withKey = await runSuite('WITH GEMINI_API_KEY (dummy, should fall back to local)', 'dummy-test-key');

  const all = [...noKey.map(r => ({ ...r, suite: 'no-key' })), ...withKey.map(r => ({ ...r, suite: 'with-key' }))];
  const failed = all.filter(r => !r.pass);

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`No-key:   ${noKey.filter(r => r.pass).length}/${noKey.length} passed`);
  console.log(`With-key: ${withKey.filter(r => r.pass).length}/${withKey.length} passed`);
  console.log(`Total:    ${all.filter(r => r.pass).length}/${all.length} passed`);

  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) {
      console.log(`- [${f.suite}] ${f.q} | welcome=${f.welcome} | status=${f.statusCode} | hasKeys=${f.hasKeys}`);
    }
    process.exit(1);
  }
  console.log('\nALL 8 QUERIES PASSED IN BOTH MODES (no welcome string returned).');
  process.exit(0);
}

main().catch((e) => {
  console.error('TEST RUNNER ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
});
