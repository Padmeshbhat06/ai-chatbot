/**
 * Shared SVIT chatbot core logic.
 * Used by both the local dev server (server.js) and the Vercel serverless
 * function (api/chat.js) so there is a single source of truth.
 *
 * Answering strategy (never returns the welcome menu for a real question):
 *   0. Empty input or a bare greeting ("hi"/"hello")  -> welcome menu.
 *   1. Unverifiable specifics (donation/menu/quota)    -> strict official fallback.
 *   2. Gemini LLM with the FULL KB in the system prompt (primary).
 *   3. Local verified KB keyword matcher (instant backup / no-key path).
 *   4. Official SVIT contact fallback (only when nothing else answers).
 */

const kb = require('../src/data/svitKnowledgeBase.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_TIMEOUT_MS = 12000;

// Full knowledge base for the LLM prompt. The UI-only `chatbot` section
// (greeting / fallback menu strings) is excluded so the model can never parrot
// the welcome menu instead of answering.
const KB_FOR_LLM = Object.assign({}, kb);
delete KB_FOR_LLM.chatbot;
const KB_CONTEXT = JSON.stringify(KB_FOR_LLM, null, 2);

function buildSystemPrompt() {
    return [
        'You are the official assistant for Sai Vidya Institute of Technology (SVIT), Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka (website https://saividya.ac.in/).',
        "Answer the user's question using ONLY the verified SVIT knowledge base (JSON) provided below.",
        'Never invent, guess, or fabricate any fact, number, fee, rank, cutoff value, name, date, or statistic.',
        "Answer naturally and directly, covering the user's exact phrasing.",
        'The knowledge base is authoritative. Only use web search if the answer is genuinely absent from the knowledge base.',
        'If the answer is not in the knowledge base and cannot be verified, state that clearly and provide exactly:',
        '  Official Website: https://saividya.ac.in/',
        '  Helpline: +91 8028468191, +91 9108575191',
        '  Email: info@saividya.ac.in / admission@saividya.ac.in',
        '',
        '=== SVIT KNOWLEDGE BASE (JSON) ===',
        KB_CONTEXT,
        '=== END KNOWLEDGE BASE ==='
    ].join('\n');
}

const SYSTEM_PROMPT = buildSystemPrompt();

const STRICT_FALLBACK = (kb.chatbot && kb.chatbot.antiHallucinationFallback) ||
    `I don't have verified information about that in the SVIT knowledge base, so I won't guess or invent figures. Please verify directly with SVIT:\n• Official Website: https://saividya.ac.in/\n• Admissions & General Helpline: +91 8028468191, +91 9108575191\n• Email: info@saividya.ac.in / admission@saividya.ac.in`;

// Keywords that must never be answered from guesses — always route to the strict fallback.
const ANTI_HALLUCINATION = [
    'menu', 'donation', 'management quota', 'seat availability', 'seat allotment',
    'counselling round', 'exact cutoff', 'free seat', 'refund', 'how much donation'
];

// Word-boundary match for short alphanumeric keywords (avoids "hi" in "this",
// "nsp" in "transport", "fee" in "coffee", etc.); substring otherwise.
function kwMatch(m, kw) {
    if (/^[a-z0-9]{1,4}$/.test(kw)) {
        return new RegExp('(^|[^a-z0-9])' + kw + '([^a-z0-9]|$)').test(m);
    }
    return m.includes(kw);
}

function welcomeText() {
    return (kb.chatbot && kb.chatbot.greeting) ||
        'Hello! Welcome to Sai Vidya Institute of Technology (SVIT). How can I help you?';
}

// True only for an empty input or a bare greeting.
function isGreeting(t) {
    const norm = String(t).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    return ['hi', 'hello', 'hey', 'greetings', 'hi there', 'hello there'].indexOf(norm) !== -1;
}

function buildContactText() {
    return 'SVIT Contact Details:\n• Address: ' + (kb.college && kb.college.location ? kb.college.location : 'Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka')
        + '\n• Phone: ' + (kb.college && kb.college.contactPhone ? kb.college.contactPhone : '+91 8028468191 / +91 9108575191')
        + '\n• Email: ' + (kb.college && kb.college.contactEmail ? kb.college.contactEmail : 'info@saividya.ac.in')
        + '\n• Helpdesk: ' + (kb.college && kb.college.helpdeskHours ? kb.college.helpdeskHours : 'Mon–Sat, 09:00 AM – 05:00 PM')
        + '\n• Website: https://saividya.ac.in/';
}

function buildLeadershipText() {
    const parts = ['SVIT Academic Leadership:'];
    if (kb.leadership && kb.leadership.academic) parts.push('• ' + kb.leadership.academic.join('\n• '));
    if (kb.leadership && kb.leadership.trustees) parts.push('\nSVIT Management & Trustees (Sri Sai Vidya Vikasa Shikshana Samithi):\n• ' + kb.leadership.trustees.join('\n• '));
    return parts.join('\n');
}

function buildAccreditationsText() {
    const a = kb.accreditations || {};
    return 'SVIT Accreditations & Approvals:\n• Approved by ' + (a.approvedBy || 'AICTE (New Delhi)')
        + '\n• Affiliated to ' + (a.affiliatedTo || 'Visvesvaraya Technological University (VTU)')
        + '\n• Recognized by ' + (a.recognizedBy || 'Government of Karnataka')
        + '\n• NAAC Grade: ' + (a.naacGrade || 'A')
        + '\n• NBA Accredited for: ' + (a.nbaDepartments ? a.nbaDepartments.join(', ') : 'CSE, ECE, and ISE')
        + '\n• Active chapters: ' + (a.activeChapters ? a.activeChapters.join(', ') : '');
}

function buildCampusFacilitiesText() {
    const c = kb.campusFacilities || {};
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

function buildEntranceText(m) {
    const parts = ['SVIT Entrance Exam Codes & Cut-off Ranks:'];
    if (/kcet|kea|e173/.test(m)) parts.push('• KCET (KEA) College Code: E173');
    if (/comedk|e113/.test(m)) parts.push('• COMEDK UGET College Code: E113');
    if (kb.kcetCutoffs && kb.kcetCutoffs.summary) parts.push('\n' + kb.kcetCutoffs.summary);
    if (kb.comedkCutoffs && kb.comedkCutoffs.summary) parts.push('\n' + kb.comedkCutoffs.summary);
    return parts.join('\n');
}

/**
 * Local verified knowledge-base keyword matcher.
 * Returns a joined, detailed answer covering every topic detected in the query,
 * the strict official fallback for unverifiable questions, or null when nothing
 * matches (so the LLM / official fallback can handle it).
 */
function kbLookup(message) {
    if (!kb) return null;
    const m = String(message || '').toLowerCase();
    const trimmed = m.trim();
    if (!trimmed) return null;

    // Never guess — route unverifiable specifics to the official fallback.
    if (ANTI_HALLUCINATION.some((kw) => kwMatch(m, kw))) return STRICT_FALLBACK;

    const has = (...kws) => kws.some((k) => kwMatch(m, k));
    const out = [];
    const push = (ans) => { if (ans && out.indexOf(ans) === -1) out.push(ans); };

    // Entrance exams: KCET / COMEDK codes + cut-off ranks
    if (has('kcet', 'comedk', 'kea', 'e173', 'e113', 'cutoff', 'cut off', 'rank', 'closing rank', 'cet', 'uget')) {
        push(buildEntranceText(m));
    }

    // ISE department clubs (checked before generic clubs so ISE detail wins)
    const iseMatched = has('ise club', 'ise clubs', 'ise department', 'department of ise',
        'information science club', 'aignite', 'samarthya', 'capture the flag', 'codesphere',
        'vikhas', 'technics forum', 'core tech arena', 'creative edge zone');
    if (iseMatched) {
        push(kb.iseClubs && kb.iseClubs.summary);
    } else if (has('club', 'clubs', 'technical club', 'student club')) {
        push(kb.clubs && kb.clubs.overview);
    }

    // Hostel
    if (has('hostel', 'hostels', 'boys hostel', 'girls hostel', 'warden', 'accommodation', 'residential')) {
        push(kb.hostel && kb.hostel.summary);
    }
    // Transport
    if (has('transport', 'bus', 'college bus', 'route', 'commuting')) {
        push(kb.transport && kb.transport.summary);
    }
    // Campus facilities
    if (has('campus facilities', 'infrastructure', 'wifi', 'gymnasium', 'sports', 'auditorium', 'seminar hall')) {
        push(buildCampusFacilitiesText());
    }
    // Autonomous status & scholarships
    if (has('autonomous', 'scholarship', 'scholarships', 'ssp', 'nsp', 'fee concession', 'defence scholarship', 'national scholarship portal')) {
        push(kb.autonomousInfo && kb.autonomousInfo.summary);
    }
    // Fees
    if (has('fee', 'fees', 'tuition', 'cost', 'price', 'charges')) {
        push(kb.fees && kb.fees.summary);
    }
    // Placements
    if (has('placement', 'placements', 'package', 'lpa', 'highest package', 'ctc', 'placement offers', 'training and placement')) {
        push(kb.placements && kb.placements.summary);
    }
    // Internships
    if (has('internship', 'internships', 'stipend')) {
        push(kb.internships && kb.internships.summary);
    }
    // Events
    if (has('event', 'events', 'hackfest', 'techvidya', 'sku', 'fest', 'cultural')) {
        push(kb.events && kb.events.summary);
    }
    // Timings
    if (has('timing', 'timings', 'class', 'classes', 'schedule', 'lab', 'labs', 'cafeteria', 'canteen', 'lunch')) {
        push(kb.timings && kb.timings.summary);
    }
    // Library
    if (has('library', 'book', 'books', 'reading')) {
        push(kb.library && kb.library.description);
    }
    // Contacts
    if (has('contact', 'phone', 'email', 'address', 'location', 'where', 'helpdesk')) {
        push(buildContactText());
    }
    // Courses
    if (has('course', 'courses', 'btech', 'b.tech', 'bba', 'mba', 'branch', 'engineering', 'program', 'programs', 'degree')) {
        push(kb.courses && kb.courses.summary);
    }
    // M.Tech / MCA — not offered
    if (has('mtech', 'm.tech', 'mca')) {
        push(kb.courses && kb.courses.notOffered);
    }
    // Leadership
    if (has('leadership', 'principal', 'vice principal', 'hod', 'trustee', 'dean')) {
        push(buildLeadershipText());
    }
    // Accreditations
    if (has('naac', 'nba', 'accreditation', 'accredited', 'aicte', 'vtu', 'approved', 'affiliated', 'recognition')) {
        push(buildAccreditationsText());
    }
    // About / identity
    if (has('about', 'svit', 'sai vidya', 'motto', 'learn to lead', 'college name', 'institute')) {
        push(kb.college && kb.college.about);
    }

    return out.length ? out.join('\n\n') : null;
}

/**
 * Primary — Gemini LLM with the FULL SVIT knowledge base in the system prompt.
 * Uses the `x-goog-api-key` header only (works with Google AI Studio "AQ." keys).
 * Returns the answer string, or null on no-key / failure / timeout.
 */
async function callGemini(message) {
    if (!GEMINI_API_KEY) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: message }] }],
                tools: [{ googleSearch: {} }]
            }),
            signal: controller.signal
        });
        if (!res.ok) return null;
        const data = await res.json();
        const cand = data && data.candidates && data.candidates[0];
        const text = cand && cand.content && cand.content.parts && cand.content.parts[0]
            ? cand.content.parts[0].text
            : '';
        return text || null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Decide the answer for a user message.
 * Never returns the welcome menu for a real question.
 */
async function answerQuestion(message) {
    const trimmed = String(message == null ? '' : message).trim();

    // Welcome menu ONLY for empty input or a bare greeting.
    if (!trimmed || isGreeting(trimmed)) {
        return { answer: welcomeText(), source: 'welcome' };
    }

    // Never guess unverifiable specifics — go straight to the official fallback.
    const lower = trimmed.toLowerCase();
    if (ANTI_HALLUCINATION.some((kw) => kwMatch(lower, kw))) {
        return { answer: STRICT_FALLBACK, source: 'fallback' };
    }

    // Primary: Gemini LLM with the full KB in the system prompt.
    if (GEMINI_API_KEY) {
        const llmAnswer = await callGemini(trimmed);
        if (llmAnswer) return { answer: llmAnswer, source: 'llm' };
    }

    // Instant backup: local verified KB keyword matcher.
    const localAnswer = kbLookup(trimmed);
    if (localAnswer) return { answer: localAnswer, source: 'svitKnowledgeBase' };

    // Last resort: official SVIT contact/website fallback.
    return { answer: STRICT_FALLBACK, source: 'fallback' };
}

function collectBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => { resolve(body); });
        req.on('error', () => { resolve(body); });
    });
}

function extractMessage(obj) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj.message != null) return String(obj.message).trim();
    if (obj.query != null) return String(obj.query).trim();
    if (obj.prompt != null) return String(obj.prompt).trim();
    return '';
}

/**
 * Robust request-body parsing across environments.
 * Accepts `{ message }`, `{ query }`, or `{ prompt }`, whether the body arrives
 * as a parsed object (Vercel/Express), a raw JSON string, a Buffer, or an
 * unparsed stream (local Node server). Never reads a real question as empty.
 */
async function readMessage(req) {
    // 1. Parsed object (Vercel / Express body-parser)
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        const msg = extractMessage(req.body);
        if (msg) return msg;
    }
    // 2. Raw string body
    if (typeof req.body === 'string' && req.body.trim()) {
        try { return extractMessage(JSON.parse(req.body)) || req.body.trim(); } catch (e) { return req.body.trim(); }
    }
    // 3. Buffer body
    if (Buffer.isBuffer(req.body) && req.body.length) {
        const s = req.body.toString('utf8');
        try { return extractMessage(JSON.parse(s)) || s.trim(); } catch (e) { return s.trim(); }
    }
    // 4. Unparsed stream (local Node server)
    const raw = await collectBody(req);
    if (!raw || !raw.trim()) return '';
    try { return extractMessage(JSON.parse(raw)) || raw.trim(); } catch (e) { return raw.trim(); }
}

/**
 * Vercel serverless handler (also usable by any Node http adapter).
 */
async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Use POST with {"message": "your question"}' }));
        return;
    }

    const message = await readMessage(req);
    const result = await answerQuestion(message);

    res.statusCode = 200;
    res.end(JSON.stringify(result));
}

module.exports = {
    kbLookup,
    answerQuestion,
    callGemini,
    handler,
    welcomeText,
    isGreeting,
    STRICT_FALLBACK,
    SYSTEM_PROMPT
};