/**
 * 18-query automated validation for SVIT chatbot.
 * Runs with and without GEMINI_API_KEY against api/chat.js.
 * Usage: node test/api.test.js
 */
const WELCOME = 'I can answer questions about SVIT — Admissions, Courses, Fees';

const TESTS = [
  { q: 'hi', checks: (a) => { const issues=[]; if(!/welcome to sai vidya institute of technology|hello/i.test(a)) issues.push('missing welcome'); return issues; }, allowWelcome: true },
  { q: 'courses', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/B\.?Tech/i.test(a)||!/BBA/i.test(a)||!/MBA/i.test(a)) i.push('missing programs'); if(!/M\.?Tech.*not offered|not offered.*M\.?Tech|MCA.*not offered/i.test(a)) i.push('missing M.Tech/MCA not offered'); return i; } },
  { q: 'fees', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/1,30,000/.test(a)||!/40,000/.test(a)||!/76,000/.test(a)) i.push('missing fees'); return i; } },
  { q: 'Do you offer M.Tech or MCA?', checks: (a) => { const i=[]; if(!/not offered|do not offer|does not offer/i.test(a)) i.push('missing no'); if(!/MBA/i.test(a)) i.push('missing MBA'); return i; } },
  { q: 'compare kcet and comedk rank?', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/E173/.test(a)||!/E113/.test(a)) i.push('missing codes'); if(!/KCET/i.test(a)||!/COMEDK/i.test(a)) i.push('missing exam names'); return i; } },
  { q: 'what is the kcEt cutoff for cse ai ml?', checks: (a) => { const i=[]; if(!/76,426/.test(a)||!/60,373/.test(a)||!/71,959/.test(a)) i.push('missing AI&ML ranks'); return i; } },
  { q: 'How were 2026 placements at SVIT?', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/413/.test(a)) i.push('missing 413'); if(!/33\s*LPA/i.test(a)) i.push('missing 33 LPA'); if(!/Prof\.?\s*Anand Kumar/i.test(a)) i.push('missing Prof. Anand Kumar'); return i; } },
  { q: 'tell me about stipend internships', checks: (a) => { const i=[]; if(!/284/.test(a)) i.push('missing 284'); if(!/357/.test(a)) i.push('missing 357'); return i; } },
  { q: 'what are the major events and fests?', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/HackFest/i.test(a)||!/TechVidya/i.test(a)||!/SKU/i.test(a)) i.push('missing events'); return i; } },
  { q: 'list technical clubs in SVIT', checks: (a) => { const i=[]; if(!/\|/.test(a)) i.push('missing table'); if(!/CSE|ISE|Civil|Mechanical|AI/i.test(a)) i.push('missing departments'); return i; } },
  { q: 'tell me about hostel facilities and warden numbers', checks: (a) => { const i=[]; if(!/Boys/i.test(a)||!/Girls/i.test(a)) i.push('missing hostels'); if(!/9900034082|8105148994|8317440756/.test(a)) i.push('missing warden numbers'); return i; } },
  { q: 'do you have college bus transport?', checks: (a) => { const i=[]; if(!/8+?/.test(a)||!/bus/i.test(a)) i.push('missing bus info'); if(!/Bengaluru|routes|R1/i.test(a)) i.push('missing routes/city'); return i; } },
  { q: 'who is the principal and is svit autonomous?', checks: (a) => { const i=[]; if(!/Dr\.?\s*Manjunath T N/i.test(a)) i.push('missing principal'); if(!/Autonomous/i.test(a)||!/VTU/i.test(a)) i.push('missing autonomous/VTU'); if(!/NAAC/i.test(a)||!/'?A'?/.test(a)) i.push('missing NAAC A'); return i; } },
  { q: 'what documents are needed for admission and what scholarships exist?', checks: (a) => { const i=[]; if(!/Marks Cards|Transfer Certificate|Aadhaar|passport-size|Study Certificate/i.test(a)) i.push('missing documents'); if(!/SSP/i.test(a)||!/NSP/i.test(a)) i.push('missing scholarships'); return i; } },
  { q: 'college address and contact email', checks: (a) => { const i=[]; if(!/Rajanukunte/i.test(a)||!/560064/.test(a)) i.push('missing address'); if(!/info@saividya\.ac\.in/i.test(a)) i.push('missing email'); if(!/\+91\s*8028468191|8028468191/.test(a)) i.push('missing phone'); return i; } },
  { q: 'btech fees and highest package', checks: (a) => { const i=[]; if(!/1,30,000/.test(a)) i.push('missing fee'); if(!/33\s*LPA/i.test(a)) i.push('missing 33 LPA'); return i; } },
  { q: "what is today's canteen menu?", checks: (a) => { const i=[]; if(/pizza|idli|dosa|rice|sambar/i.test(a) && !/don't have verified|official website/i.test(a)) i.push('guessed menu'); if(!/https:\/\/saividya\.ac\.in\//i.test(a)) i.push('missing website'); if(!/8028468191/.test(a)) i.push('missing helpline'); return i; } },
  { q: 'exact management quota donation amount for CSE', checks: (a) => { const i=[]; if(/\b\d{1,3}(,\d{2,3})+\b/.test(a) && /donation|lakh/i.test(a) && !/don't have verified|won't guess/i.test(a)) i.push('guessed amount'); if(!/admission@saividya\.ac\.in/i.test(a)) i.push('missing admission email'); if(!/8028468191|9108575191/.test(a)) i.push('missing helpline'); return i; } },
];

function makeReqResParsed(bodyObj) {
  let statusCode = 200; const headers = {}; let out = '';
  const req = { method: 'POST', headers: { 'content-type': 'application/json' }, body: bodyObj };
  const res = { setHeader(k,v){headers[String(k).toLowerCase()]=v;}, get statusCode(){return statusCode;}, set statusCode(v){statusCode=v;}, end(chunk){ if(chunk) out+=String(chunk); res._ended=true; } };
  return { req, res, getResult: () => ({ statusCode, headers, body: out }) };
}

function loadApiFresh() {
  for (const k of Object.keys(require.cache)) {
    const key = String(k).toLowerCase();
    if (key.includes('chat-core.js') || key.includes('api\\chat.js') || key.includes('api/chat.js')) delete require.cache[k];
  }
  return require('../api/chat.js');
}

function extractAnswer(body) {
  let parsed; try { parsed = JSON.parse(body); } catch (e) { return { parsed: null, answer: String(body) }; }
  return { parsed, answer: String((parsed && (parsed.reply || parsed.answer || parsed.response)) || '') };
}

async function runSuite(label, envValue) {
  const prev = process.env.GEMINI_API_KEY;
  if (envValue === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = envValue;
  const handler = loadApiFresh();
  const results = [];
  console.log('\n' + '='.repeat(80));
  console.log('SUITE: ' + label + ' | GEMINI_API_KEY set: ' + !!process.env.GEMINI_API_KEY);
  console.log('='.repeat(80));
  for (const t of TESTS) {
    const { req, res, getResult } = makeReqResParsed({ message: t.q });
    await handler(req, res);
    const r = getResult();
    const { parsed, answer } = extractAnswer(r.body);
    const issues = [];
    if (r.statusCode !== 200) issues.push('HTTP ' + r.statusCode);
    if (!(parsed && typeof parsed.reply === 'string' && typeof parsed.answer === 'string' && typeof parsed.response === 'string')) issues.push('missing keys');
    if (/\\n/.test(answer)) issues.push('literal \\n');
    if (!t.allowWelcome && answer.includes(WELCOME)) issues.push('welcome string returned');
    issues.push(...t.checks(answer));
    const pass = issues.length === 0;
    results.push({ q: t.q, pass, issues, answer, source: parsed && parsed.source });
    console.log((pass ? 'PASS' : 'FAIL') + ' | ' + t.q);
    console.log('  source=' + (parsed && parsed.source) + ' len=' + answer.length + (issues.length ? ' issues=' + issues.join('; ') : ''));
    console.log('  answer: ' + answer.replace(/\n/g, ' | '));
  }
  if (prev === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prev;
  return results;
}

async function main() {
  const noKey = await runSuite('WITHOUT GEMINI_API_KEY', undefined);
  const withKey = await runSuite('WITH GEMINI_API_KEY (dummy, should fall back to local)', 'dummy-test-key');
  const all = [...noKey.map(r=>({...r,suite:'no-key'})), ...withKey.map(r=>({...r,suite:'with-key'}))];
  const failed = all.filter(r=>!r.pass);
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY TABLE');
  console.log('No-key:   ' + noKey.filter(r=>r.pass).length + '/' + noKey.length + ' passed');
  console.log('With-key: ' + withKey.filter(r=>r.pass).length + '/' + withKey.length + ' passed');
  console.log('Total:    ' + all.filter(r=>r.pass).length + '/' + all.length + ' passed');
  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) console.log('- ['+f.suite+'] '+f.q+' :: '+f.issues.join('; '));
    process.exit(1);
  }
  console.log('\nALL 18 TESTS PASSED IN BOTH MODES.');
  process.exit(0);
}

main().catch(e=>{ console.error(e && e.stack || e); process.exit(1); });
