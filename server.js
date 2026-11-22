const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const KB_PATH = path.join(__dirname, 'src', 'data', 'svitKnowledgeBase.json');

// Load verified SVIT knowledge base once at startup (Priority 1 source)
let svitKb = null;
try {
    svitKb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
    console.log('SVIT knowledge base loaded successfully.');
} catch (err) {
    console.warn('WARNING: Could not load svitKnowledgeBase.json:', err.message);
}

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

// Gemini live web search grounding configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT = `You are an assistant for Sai Vidya Institute of Technology (SVIT), Bengaluru (official website: https://saividya.ac.in/).
The user's question was NOT covered by the verified local SVIT knowledge base, so you must use live web search (googleSearch) to answer.
Prioritize results from site:saividya.ac.in. Retrieve accurate facts only — never invent numbers, names, ranks, or cutoff figures.
If live search finds no definitive answer, say you could not verify the details and provide the official SVIT website (https://saividya.ac.in/) and the admissions helpline (+91 8028468191, +91 9108575191). Keep answers concise and helpful.`;

const LIVE_SEARCH_UNAVAILABLE = `I couldn't verify that from live search right now. For accurate SVIT information, please visit the official SVIT website: https://saividya.ac.in/ or contact the Admissions Helpline: +91 8028468191, +91 9108575191.`;

// Collect POST body as text
function collectBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => { resolve(body); });
        req.on('error', () => { resolve(body); });
    });
}

function buildContactText(kb) {
    if (!kb) return '';
    return 'SVIT Contact Details:\n• Address: ' + (kb.college && kb.college.location ? kb.college.location : 'Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka')
        + '\n• Phone: ' + (kb.college && kb.college.contactPhone ? kb.college.contactPhone : '+91 8028468191 / +91 9108575191')
        + '\n• Email: ' + (kb.college && kb.college.contactEmail ? kb.college.contactEmail : 'info@saividya.ac.in')
        + '\n• Helpdesk: ' + (kb.college && kb.college.helpdeskHours ? kb.college.helpdeskHours : 'Mon–Sat, 09:00 AM – 05:00 PM')
        + '\n• Website: https://saividya.ac.in/';
}

function buildLeadershipText(kb) {
    if (!kb) return '';
    const parts = ['SVIT Academic Leadership:'];
    if (kb.leadership && kb.leadership.academic) parts.push('• ' + kb.leadership.academic.join('\n• '));
    if (kb.leadership && kb.leadership.trustees) parts.push('\nSVIT Management & Trustees (Sri Sai Vidya Vikasa Shikshana Samithi):\n• ' + kb.leadership.trustees.join('\n• '));
    return parts.join('\n');
}

function buildAccreditationsText(kb) {
    if (!kb || !kb.accreditations) return '';
    const a = kb.accreditations;
    return 'SVIT Accreditations & Approvals:\n• Approved by ' + (a.approvedBy || 'AICTE (New Delhi)')
        + '\n• Affiliated to ' + (a.affiliatedTo || 'Visvesvaraya Technological University (VTU)')
        + '\n• Recognized by ' + (a.recognizedBy || 'Government of Karnataka')
        + '\n• NAAC Grade: ' + (a.naacGrade || 'A')
        + '\n• NBA Accredited for: ' + (a.nbaDepartments ? a.nbaDepartments.join(', ') : 'CSE, ECE, and ISE')
        + '\n• Active chapters: ' + (a.activeChapters ? a.activeChapters.join(', ') : '');
}

function buildHostelText(kb) {
    if (!kb || !kb.hostel) return '';
    return kb.hostel.summary || '';
}

function buildTransportText(kb) {
    if (!kb || !kb.transport) return '';
    return kb.transport.summary || '';
}

function buildCampusFacilitiesText(kb) {
    if (!kb || !kb.campusFacilities) return '';
    const c = kb.campusFacilities;
    const parts = ['SVIT Campus Facilities:'];
    if (c.wifi) parts.push('• Wi-Fi: ' + c.wifi);
    if (c.library) parts.push('• Library: ' + c.library);
    if (c.labs) parts.push('• Labs: ' + c.labs);
    if (c.seminarHalls) parts.push('• Seminar Halls: ' + c.seminarHalls);
    if (c.cafeteria) parts.push('• Cafeteria: ' + c.cafeteria);
    if (c.sports) parts.push('• Sports: ' + c.sports);
    if (c.gymnasium) parts.push('• Gymnasium: ' + c.gymnasium);
    return parts.join('\n');
}

/**
 * Priority 1 — Verified SVIT Knowledge Base lookup.
 * Returns an answer string when the query matches verified KB content (fees, placements,
 * KCET/COMEDK cutoffs, ISE clubs, autonomous & scholarships, events, contacts, etc.),
 * otherwise null so the live-search tier can handle it.
 */
function kbLookup(message) {
    if (!svitKb) return null;
    const m = message.toLowerCase();
    const pick = (keywords, answer) => keywords.some((kw) => m.includes(kw)) ? answer : null;

    const result =
        // Cutoffs — KCET (2024–2026)
        pick(['kcet cutoff', 'kcet cut off', 'kcet rank', 'karnataka cet cutoff', 'cet closing rank'], svitKb.kcetCutoffs && svitKb.kcetCutoffs.summary) ||
        // Cutoffs — COMEDK UGET (2024–2026)
        pick(['comedk cutoff', 'comedk cut off', 'comedk rank', 'uget cutoff', 'comedk closing rank'], svitKb.comedkCutoffs && svitKb.comedkCutoffs.summary) ||
        // Generic cutoff / rank queries → combined verified reference
        pick(['cutoff', 'cut off', 'rank', 'closing rank'], (((svitKb.kcetCutoffs && svitKb.kcetCutoffs.summary || '') + '\n\n' + (svitKb.comedkCutoffs && svitKb.comedkCutoffs.summary || '')).trim()) || null) ||
        // Clubs overview (all departments)
        pick(['club', 'clubs', 'technical club', 'student club'], svitKb.clubs && svitKb.clubs.overview) ||
        // ISE Department clubs
        pick(['ise club', 'ise clubs', 'ise department', 'department of ise', 'information science club', 'aignite', 'samarthya', 'capture the flag', 'codesphere', 'vikhas', 'technics forum', 'core tech arena', 'creative edge zone'], svitKb.iseClubs && svitKb.iseClubs.summary) ||
        // Hostel
        pick(['hostel', 'hostels', 'boys hostel', 'girls hostel', 'warden', 'accommodation', 'residential'], buildHostelText(svitKb)) ||
        // Transport / college bus
        pick(['transport', 'bus', 'college bus', 'route', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'commuting'], buildTransportText(svitKb)) ||
        // Campus facilities / infrastructure / wifi
        pick(['campus facilities', 'infrastructure', 'wifi', 'gymnasium', 'sports', 'auditorium', 'seminar hall'], buildCampusFacilitiesText(svitKb)) ||
        // Autonomous status & government scholarships
        pick(['autonomous', 'scholarship', 'scholarships', 'ssp', 'nsp', 'merit', 'fee concession', 'defence scholarship', 'national scholarship portal'], svitKb.autonomousInfo && svitKb.autonomousInfo.summary) ||
        // Fees
        pick(['fee', 'fees', 'tuition', 'cost', 'price', 'charges'], svitKb.fees && svitKb.fees.summary) ||
        // Placements
        pick(['placement', 'placements', 'package', 'lpa', 'highest package', 'ctc', 'placement offers', 'training and placement'], svitKb.placements && svitKb.placements.summary) ||
        // Events
        pick(['event', 'events', 'hackfest', 'techvidya', 'sku', 'fest', 'cultural'], svitKb.events && svitKb.events.summary) ||
        // Contacts
        pick(['contact', 'phone', 'email', 'address', 'location', 'where', 'helpdesk'], buildContactText(svitKb)) ||
        // Courses
        pick(['course', 'courses', 'btech', 'b.tech', 'bba', 'mba', 'branch', 'engineering'], svitKb.courses && svitKb.courses.summary) ||
        // M.Tech / MCA — not offered
        pick(['mtech', 'm.tech', 'mca'], svitKb.courses && svitKb.courses.notOffered) ||
        // Internships
        pick(['internship', 'internships', 'stipend'], svitKb.internships && svitKb.internships.summary) ||
        // Leadership
        pick(['leadership', 'principal', 'vice principal', 'hod', 'trustee', 'dean'], buildLeadershipText(svitKb)) ||
        // Accreditations
        pick(['naac', 'nba', 'accreditation', 'accredited', 'aicte', 'vtu', 'approved', 'affiliated', 'recognition'], buildAccreditationsText(svitKb)) ||
        // Greeting / about
        pick(['hi', 'hello', 'hey', 'greetings', 'start'], svitKb.chatbot && svitKb.chatbot.greeting) ||
        pick(['about', 'svit', 'sai vidya', 'motto', 'learn to lead', 'college name', 'institute'], svitKb.college && svitKb.college.about) ||
        null;
    return result;
}

/**
 * Priority 2 — Live Web Search Grounding via Gemini API (googleSearch tool).
 * Falls back to the official website + admissions helpline when no API key is
 * configured or the live-search call fails (never invents numbers).
 */
async function liveSearchAnswer(message) {
    if (!GEMINI_API_KEY) {
        console.warn('Live search skipped: GEMINI_API_KEY is not configured.');
        return { answer: LIVE_SEARCH_UNAVAILABLE, source: 'fallback' };
    }
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: message }] }],
                tools: [{ googleSearch: {} }]
            })
        });
        if (!res.ok) {
            console.warn('Gemini API error:', res.status, await res.text().catch(() => ''));
            return { answer: LIVE_SEARCH_UNAVAILABLE, source: 'fallback' };
        }
        const data = await res.json();
        const text = data.candidates
            && data.candidates[0]
            && data.candidates[0].content
            && data.candidates[0].content.parts
            && data.candidates[0].content.parts[0]
            ? data.candidates[0].content.parts[0].text
            : '';
        return { answer: text || LIVE_SEARCH_UNAVAILABLE, source: text ? 'liveSearch' : 'fallback' };
    } catch (err) {
        console.warn('Live search request failed:', err.message);
        return { answer: LIVE_SEARCH_UNAVAILABLE, source: 'fallback' };
    }
}

function createStaticServer() {
    return http.createServer(async (req, res) => {
        let safePath = req.url.split('?')[0];
        if (safePath === '/') safePath = '/index.html';

        // --- Chat API: 2-tier answering strategy ---
        if (safePath === '/api/chat' && req.method === 'POST') {
            const body = await collectBody(req);
            let message = '';
            try { message = String(JSON.parse(body).message || ''); } catch (e) { message = ''; }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });

            // Tier 1: verified SVIT knowledge base (exact fees, placements, cutoffs, events, clubs, contacts)
            const kbAnswer = kbLookup(message);
            if (kbAnswer) {
                res.end(JSON.stringify({ answer: kbAnswer, source: 'svitKnowledgeBase' }));
                return;
            }

            // Tier 2: live web search grounding for out-of-scope queries
            const live = await liveSearchAnswer(message);
            res.end(JSON.stringify({ answer: live.answer, source: live.source }));
            return;
        }

        if (safePath === '/api/chat') {
            res.writeHead(405, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ error: 'Use POST with {"message": "your question"}' }));
            return;
        }

        const filePath = path.join(__dirname, safePath);

        // Security check: ensure path is within directory
        if (!filePath.startsWith(__dirname)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });
}

function startServer(port) {
    const server = createStaticServer();
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, () => {
        console.log(`Server started successfully!`);
        console.log(`Local link: http://localhost:${port}/`);
    });
}

startServer(DEFAULT_PORT);
