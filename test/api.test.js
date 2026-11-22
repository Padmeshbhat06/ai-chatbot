/**
 * SVIT chatbot verification suite.
 * Starts against a running server (default http://localhost:3000).
 * Usage: npm test   (with `npm start` running in another terminal)
 *   or: PORT=3000 node test/api.test.js
 */
const http = require('http');

const HOST = process.env.HOST || 'localhost';
const PORT = parseInt(process.env.PORT, 10) || 3000;

function post(msg) {
    return new Promise((resolve, reject) => {
        const d = JSON.stringify({ message: msg });
        const r = http.request({
            hostname: HOST, port: PORT, path: '/api/chat', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }
        }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => resolve(b)); });
        r.on('error', reject);
        r.write(d); r.end();
    });
}

// [query, [required substrings], expected source]
const tests = [
    ['What is the college name, address, and contact details?',
        ['Sai Vidya Institute of Technology', 'Rajanukunte', '560064', '+91 8028468191', '+91 9108575191', 'info@saividya.ac.in'], 'svitKnowledgeBase'],
    ['Do you offer M.Tech or MCA?',
        ['does not currently offer', 'MBA', 'B.Tech', 'BBA'], 'svitKnowledgeBase'],
    ['What are the annual fees for B.Tech, BBA, and MBA?',
        ['1,30,000', '40,000', '76,000'], 'svitKnowledgeBase'],
    ['What are the KCET and COMEDK codes and 2026 cutoffs for CSE and AI & ML?',
        ['E173', 'E113', '99,704', '71,959'], 'svitKnowledgeBase'],
    ['Tell me about 2026 placements and highest package.',
        ['413', '33 LPA', 'Prof. Anand Kumar', 'ECE'], 'svitKnowledgeBase'],
    ['What are the major events and technical clubs at SVIT?',
        ['HackFest', 'TechVidya', 'SKU', 'AIGNITE', 'Coding Club'], 'svitKnowledgeBase'],
    ['Tell me about hostel facilities, bus transport, and scholarships.',
        ['hostel', 'bus', 'SSP', 'NSP'], 'svitKnowledgeBase'],
    ['Who is the Principal and who are the department HODs?',
        ['Dr. Manjunath T N', 'HOD', 'Shashikumar'], 'svitKnowledgeBase'],
    ['What is the exact menu in the canteen today?',
        ['https://saividya.ac.in/', '+91 8028468191', '+91 9108575191', 'admission@saividya.ac.in'], 'svitKnowledgeBase'],
    ['What is the exact management quota donation amount for CSE?',
        ['https://saividya.ac.in/', '+91 8028468191', 'admission@saividya.ac.in'], 'svitKnowledgeBase'],
    // Regression coverage
    ['hi', ['Welcome to Sai Vidya'], 'svitKnowledgeBase'],
    ['kcet cutoff', ['59,336'], 'svitKnowledgeBase'],
    ['comedk cutoff', ['45,073'], 'svitKnowledgeBase'],
    ['ise clubs', ['AIGNITE', 'SAMARTHYA', 'TECHNICS FORUM'], 'svitKnowledgeBase'],
    ['clubs', ['AIGNITE', 'Coding Club'], 'svitKnowledgeBase'],
    ['fees', ['1,30,000'], 'svitKnowledgeBase'],
    ['placements', ['413'], 'svitKnowledgeBase'],
    ['scholarship', ['SSP', 'Defence Scholarship'], 'svitKnowledgeBase'],
    ['naac', ['NAAC'], 'svitKnowledgeBase'],
    ['transport', ['college bus', 'R1'], 'svitKnowledgeBase'],
    ['hostel', ['Boys Hostel', 'Girls Hostel'], 'svitKnowledgeBase'],
    ['library', ['Library'], 'svitKnowledgeBase'],
    ['timings', ['09:00 AM'], 'svitKnowledgeBase'],
    ['mtech', ['does not currently offer'], 'svitKnowledgeBase'],
    ['principal', ['Dr. Manjunath T N'], 'svitKnowledgeBase'],
    ['contact', ['8028468191'], 'svitKnowledgeBase'],
    ['autonomous', ['2008', 'VTU'], 'svitKnowledgeBase']
];

(async () => {
    let passed = 0, failed = 0;
    for (const [q, snippets, src] of tests) {
        try {
            const b = await post(q);
            const j = JSON.parse(b);
            const missing = snippets.filter(s => !(j.answer || '').includes(s));
            const srcOk = src === 'any' || j.source === src;
            if (missing.length === 0 && srcOk) {
                passed++;
            } else {
                failed++;
                console.log('FAIL |', q, '| source:', j.source, '| missing:', missing.join(' , ') || '(source mismatch)');
            }
        } catch (e) {
            failed++;
            console.log('ERROR |', q, '|', e.message);
        }
    }
    console.log('\n=== RESULTS: ' + passed + ' passed, ' + failed + ' failed, total ' + tests.length + ' ===');
    process.exit(failed ? 1 : 0);
})();