/**
 * Shared SVIT chatbot core logic.
 * Used by both the local dev server (server.js) and the Vercel serverless
 * function (api/chat.js) so there is a single source of truth.
 *
 * Answering strategy:
 *   Tier 1 — Verified SVIT knowledge base (svitKnowledgeBase.json). Never guesses.
 *   Tier 2 — Live Google Search grounding (Gemini) for out-of-scope questions.
 */

const kb = require('../src/data/svitKnowledgeBase.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const SYSTEM_PROMPT = `You are the official assistant for Sai Vidya Institute of Technology (SVIT), Bengaluru (official website: https://saividya.ac.in/).
The user's question was NOT covered by the verified local SVIT knowledge base, so you must use live web search (googleSearch) to answer.
Prioritize results from site:saividya.ac.in. Retrieve accurate facts only — never invent numbers, names, ranks, fees, or cutoff figures.
If live search finds no definitive answer, say you could not verify the details and provide the official SVIT website (https://saividya.ac.in/) and the admissions helpline (+91 8028468191, +91 9108575191) or email info@saividya.ac.in / admission@saividya.ac.in. Keep answers concise and helpful.`;

const LIVE_SEARCH_UNAVAILABLE = `I couldn't verify that from live search right now, so I won't guess. Please verify directly with SVIT:\n• Official Website: https://saividya.ac.in/\n• Admissions & General Helpline: +91 8028468191, +91 9108575191\n• Email: info@saividya.ac.in / admission@saividya.ac.in`;

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
 * Priority 1 — Verified SVIT Knowledge Base lookup.
 * Returns a joined answer string covering every topic detected in the query,
 * the strict official fallback for unverifiable questions, or null when nothing
 * matches (so the live-search tier can handle it).
 */
function kbLookup(message) {
    if (!kb) return null;
    const m = String(message || '').toLowerCase();
    const trimmed = m.trim();
    if (!trimmed) return (kb.chatbot && kb.chatbot.greeting) || null;

    // Never guess — route unverifiable specifics to the official fallback.
    if (ANTI_HALLUCINATION.some((kw) => kwMatch(m, kw))) return STRICT_FALLBACK;

    const has = (...kws) => kws.some((k) => kwMatch(m, k));
    const out = [];
    const push = (ans) => { if (ans && out.indexOf(ans) === -1) out.push(ans); };

    // Greeting (only for short greeting-like messages)
    if (trimmed.split(/\s+/).length <= 3 && has('hi', 'hello', 'hey', 'greetings')) {
        push(kb.chatbot && kb.chatbot.greeting);
    }

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
 * Priority 2 — Live Web Search Grounding via Gemini API (googleSearch tool).
 * Falls back to the official website + helpline when no key is configured or
 * the request fails. Never invents facts.
 */
async function liveSearchAnswer(message) {
    if (!GEMINI_API_KEY) {
        return { answer: LIVE_SEARCH_UNAVAILABLE, source: 'fallback' };
    }
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
            })
        });
        if (!res.ok) {
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
        return { answer: LIVE_SEARCH_UNAVAILABLE, source: 'fallback' };
    }
}

function collectBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => { resolve(body); });
        req.on('error', () => { resolve(body); });
    });
}

async function readMessage(req) {
    if (req.body && typeof req.body === 'object') return String(req.body.message || '');
    const raw = await collectBody(req);
    try { return String(JSON.parse(raw).message || ''); } catch (e) { return ''; }
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

    const kbAnswer = kbLookup(message);
    if (kbAnswer) {
        res.statusCode = 200;
        res.end(JSON.stringify({ answer: kbAnswer, source: 'svitKnowledgeBase' }));
        return;
    }

    const live = await liveSearchAnswer(message);
    res.statusCode = 200;
    res.end(JSON.stringify({ answer: live.answer, source: live.source }));
}

module.exports = {
    kbLookup,
    liveSearchAnswer,
    handler,
    STRICT_FALLBACK,
    LIVE_SEARCH_UNAVAILABLE,
    SYSTEM_PROMPT
};