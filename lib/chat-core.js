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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? String(process.env.GEMINI_API_KEY).trim() : '';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
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
        'Answer ONLY using verified SVIT facts from the knowledge base. Never guess.',
        'MANDATORY TABLE FORMATTING (use clean Markdown tables with bold headers and concise bullet notes):',
        '1) Programs & Fees (courses/branches/fees/tuition/btech/bba/mba): table | Program | Duration | Eligibility | Annual Fee | and explicitly note M.Tech and MCA are not offered at SVIT.',
        '2) KCET & COMEDK Cutoffs (cutoff/rank/kcet/comedk/compare): show codes KCET: E173, COMEDK: E113 and table | Branch | KCET 2026 | COMEDK 2026 | (or multi-year 2024|2025|2026 when a specific exam is asked).',
        '3) 2026 Placements & Internships (placement/package/ctc/salary/internship/offers): highlight 413 Total Offers, 33 LPA Highest CTC, 284 Stipend Internships, 357 Total Internships, Prof. Anand Kumar (Head, T&P), then table | Branch | Placement Offers | Stipend Internships | Total Internships |.',
        '4) Department Technical Clubs (club/coding club/codenex/aiera/civil tech/ise clubs/mech clubs): table | Department | Club Name | Focus / Tagline | (filter to specific department when asked).',
        '5) Flagship Events & Alumni Meet (event/fest/hackfest/techvidya/sku/sammilana/open day): table | Event | Category | Key Highlights |.',
        '6) Contacts/Helplines/Leadership (contact/phone/email/address/principal/hod/warden): clean Markdown table of official contacts, emails, campus address Rajanukunte, via Yelahanka, Bengaluru - 560064.',
        'Keep answers concise, scannable, and tailored to what user asked. Use real line breaks only; never output literal \\n escapes. Never return generic welcome menu for a real question.',
        'If question cannot be answered from SVIT knowledge base, politely state that and provide https://saividya.ac.in/, +91 8028468191, +91 9108575191, and info@saividya.ac.in.',
        '',
        '=== SVIT KNOWLEDGE BASE (JSON) ===',
        KB_CONTEXT,
        '=== END KNOWLEDGE BASE ==='
    ].join('\n');
}

const SYSTEM_PROMPT = buildSystemPrompt();

const STRICT_FALLBACK = (kb.chatbot && kb.chatbot.antiHallucinationFallback) ||
    `I don't have verified information about that in the SVIT knowledge base, so I won't guess or invent figures. Please verify directly with SVIT:\n• Official Website: https://saividya.ac.in/\n• Admissions & General Helpline: +91 8028468191, +91 9108575191\n• Email: info@saividya.ac.in / admission@saividya.ac.in`;

// Keywords that must never be answered from guesses — route to the strict official fallback.
const ANTI_HALLUCINATION = [
    'menu', 'donation', 'management quota', 'seat availability', 'seat allotment',
    'counselling round', 'exact cutoff', 'free seat', 'refund', 'how much donation',
    'canteen menu', 'today\'s menu', 'todays menu'
];

// Word-boundary match for short alphanumeric keywords (avoids "hi" in "this",
// "nsp" in "transport", "fee" in "coffee", etc.); substring otherwise.
function kwMatch(m, kw) {
    if (/^[a-z0-9]{1,4}$/.test(kw)) {
        return new RegExp('(^|[^a-z0-9])' + kw + '([^a-z0-9]|$)').test(m);
    }
    return m.includes(kw);
}

function normalizeAnswerText(text) {
    return String(text == null ? '' : text)
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
}

function welcomeText() {
    return normalizeAnswerText((kb.chatbot && kb.chatbot.greeting) ||
        'Hello! Welcome to Sai Vidya Institute of Technology (SVIT). How can I help you?');
}

// Welcome menu ONLY for empty input or a literal bare greeting.
function isGreeting(t) {
    const norm = String(t == null ? '' : t).toLowerCase().replace(/\s+/g, ' ').trim();
    return norm === '' || norm === 'hi' || norm === 'hello' || norm === 'hey';
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

function buildInternshipsText() {
    const i = kb.internships || {};
    const stip = (i.stipendBased2026 && i.stipendBased2026.branchWise) || {};
    const total = (i.general2026 && i.general2026.branchWise) || {};
    const branches = ['ECE','CSE','CSE-DS','ISE','CSE-AIML','ME'];
    const lines = [
        '**SVIT 2026 Internships**',
        '- **Stipend Internships:** 284',
        '- **Total Internships:** 357',
        '',
        '| Branch | Stipend Internships | Total Internships |',
        '|---|---:|---:|'
    ];
    for (const b of branches) lines.push('| ' + b + ' | ' + (stip[b] != null ? stip[b] : 'N/A') + ' | ' + (total[b] != null ? total[b] : 'N/A') + ' |');
    lines.push('');
    lines.push('**Contact:** ' + ((i.contacts && i.contacts.internshipCellEmail) || 'internship@saividya.ac.in'));
    return lines.join('\n');
}

function buildEventsText() {
    return [
        '**SVIT Flagship Events & Alumni Meet**',
        '| Event | Category | Key Highlights |',
        '|---|---|---|',
        '| HackFest | National-Level Hackathon | 24–36 hr coding marathon, AI/Web/Mobile/Sustainability/Smart Systems, cash prizes |',
        '| TechVidya | Annual Inter-Collegiate Technical Festival | Coding, robotics, project expos, paper presentations, workshops, quizzes |',
        '| SKU (Siri Kannada Utsava) | Kannada Cultural Extravaganza | Karnataka heritage, art, literature, music, dance, theatre, cultural competitions |',
        '| Sammilana 2K26 Alumni Meet | Alumni Meet (June 13, 2026) | "Reunite. Relive. Reconnect."; alumni networking at SVIT campus |',
        '| Technical Club Open Day | Department Technical Event (May 6, 2026) | CSE AI&ML clubs showcase; BUGGERS/CRACKERS coding challenges |',
        '',
        '_For event updates: https://saividya.ac.in/_'
    ].join('\n');
}

function buildClubsText(filterDept) {
    const rows = [
        ['CSE', 'Coding Club SVIT', 'Competitive programming, hackathons, Git/GitHub, workshops'],
        ['CSE (AI & ML)', 'CodeNex', 'Next Gen Coding Evolution'],
        ['CSE (AI & ML)', 'AIERA Club', 'Minds Meet, Talents Thrive'],
        ['CSE (AI & ML)', 'LANG NET / DATA NEXUS / AGENTIC ARC', 'Language, data insights, agentic AI initiatives'],
        ['CSE (Data Science)', 'Data Vision / Beyond Code / Yuva Codes / NexAura / Cevovate / Synapse / Utkrashta', 'Data science, peer mentoring, project-based learning'],
        ['ISE', 'AIGNITE', 'AI Club'],
        ['ISE', 'CAPTURE THE FLAG', 'Cyber Security Club'],
        ['ISE', 'CODESPHERE', 'Coding Club'],
        ['ISE', 'V.I.K.H.A.S', 'ISE Cloud Club'],
        ['ISE', 'SAMARTHYA', 'ISE Club'],
        ['ISE', 'TECHNICS FORUM', 'Technical forum'],
        ['Civil Engineering', 'CIVIL TECH', 'Infrastructure Development'],
        ['Civil Engineering', 'BUILD SMART', 'Sustainable & Green Building Practice'],
        ['Mechanical Engineering', 'SAE / Robotics / Design Activities', 'SAE, robotics, design challenges, teamwork-based learning']
    ];
    const f = String(filterDept || '').toLowerCase();
    const filtered = f ? rows.filter(r => r[0].toLowerCase().includes(f)) : rows;
    const use = filtered.length ? filtered : rows;
    const lines = [
        '**SVIT Department Technical Clubs**',
        '| Department | Club Name | Focus / Tagline |',
        '|---|---|---|'
    ];
    for (const r of use) lines.push('| ' + r[0] + ' | ' + r[1] + ' | ' + r[2] + ' |');
    return lines.join('\n');
}

function buildContactsLeadershipText(m) {
    const lower = String(m || '').toLowerCase();
    const wantsLeadership = /principal|hod|founder|trustee|manjunath|warden|leadership/.test(lower);
    const lines = ['**SVIT Contacts & Leadership**',
        '| Category | Details |',
        '|---|---|'];
    lines.push('| Campus Address | Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka |');
    lines.push('| Admissions/General Helpline | +91 8028468191, +91 9108575191 |');
    lines.push('| Official Emails | info@saividya.ac.in, admission@saividya.ac.in |');
    lines.push('| Website | https://saividya.ac.in/ |');
    if (wantsLeadership || /contact|phone|email|address|where|reach/.test(lower)) {
        lines.push('| Principal | Dr. Manjunath T N |');
        lines.push('| Vice-Principal | Dr. Lakshminarayaachari |');
        lines.push('| Autonomous Status | Autonomous under VTU; NAAC \'A\' Grade |');
        lines.push('| Boys Hostel Warden | Mr. Pavan Kumar R (+91 9900034082) |');
        lines.push('| Girls Hostel Wardens | Dr. Vijayashree Budyal (+91 8105148994), Mrs. Lavanya Reddy (+91 8317440756) |');
        lines.push('| Placement Cell | placement@saividya.ac.in | +91 9108015199, +91 9739037743 |');
    }
    return lines.join('\n');
}

function buildBranchDetails(branchKeys) {
    const kcet = (kb.kcetCutoffs && kb.kcetCutoffs.branchWise) || {};
    const comedk = (kb.comedkCutoffs && kb.comedkCutoffs.branchWise) || {};
    const lines = ['**SVIT Branch Details**'];
    for (const k of branchKeys) {
        const k26 = kcet[k] && kcet[k]['2026'] ? kcet[k]['2026'] : 'N/A';
        const c26 = comedk[k] && comedk[k]['2026'] ? comedk[k]['2026'] : 'N/A';
        lines.push('');
        lines.push('**' + branchLabel(k) + '**');
        lines.push('- **KCET 2026 Closing Rank:** ' + k26);
        lines.push('- **COMEDK 2026 Closing Rank:** ' + c26);
        if (k === 'CSE' || k === 'CSE-AIML' || k === 'CSE-DS' || k === 'CSE-CyberSecurity' || k === 'CSBS' || k === 'ISE' || k === 'ECE') {
            lines.push('- **Program:** B.Tech (4 years)');
        } else if (k === 'ME' || k === 'CE') {
            lines.push('- **Program:** B.Tech (4 years)');
        }
    }
    lines.push('');
    lines.push('_Codes: KCET E173, COMEDK E113. For official confirmation: https://saividya.ac.in/_');
    return lines.join('\n');
}

function buildAccreditationsText() {
    const a = kb.accreditations || {};
    return ['**SVIT Accreditations & Approvals**',
        '- **Approved by:** ' + (a.approvedBy || 'AICTE (New Delhi)'),
        '- **Affiliated to:** ' + (a.affiliatedTo || 'Visvesvaraya Technological University (VTU)'),
        '- **Recognized by:** ' + (a.recognizedBy || 'Government of Karnataka'),
        '- **NAAC Grade:** ' + (a.naacGrade || 'A'),
        '- **NBA Accredited for:** ' + (a.nbaDepartments ? a.nbaDepartments.join(', ') : 'CSE, ECE, and ISE'),
        '- **Active chapters:** ' + (a.activeChapters ? a.activeChapters.join(', ') : '')
    ].join('\n');
}

function buildProgramsFeesText() {
    return [
        '**SVIT Programs & Fees**',
        '| Program | Duration | Eligibility | Annual Fee |',
        '|---|---|---|---:|',
        '| B.Tech (Engineering) | 4 Years | 10+2 with PCM (as per admission norms) | ₹1,30,000/yr |',
        '| BBA | 3 Years | 10+2 (any stream) | ₹40,000/yr |',
        '| MBA | 2 Years | Bachelor\'s degree (as per admission norms) | ₹76,000/yr |',
        '',
        '- **Note:** M.Tech and MCA are **not offered** at SVIT.',
        '- **Official confirmation:** https://saividya.ac.in/'
    ].join('\n');
}

function buildFeesText() { return buildProgramsFeesText(); }

function buildPlacementsText() {
    const p = kb.placements || {};
    const bw = p.branchWiseOffers2026 || {};
    const stip = (kb.internships && kb.internships.stipendBased2026 && kb.internships.stipendBased2026.branchWise) || {};
    const totalInt = (kb.internships && kb.internships.general2026 && kb.internships.general2026.branchWise) || {};
    const branches = ['ECE','CSE','CSE-DS','ISE','CSE-AIML','ME'];
    const lines = [
        '**SVIT 2026 Placements & Internships**',
        '- **Total Offers:** 413',
        '- **Highest CTC:** 33 LPA',
        '- **Stipend Internships:** 284',
        '- **Total Internships:** 357',
        '- **Head, T&P:** Prof. Anand Kumar',
        '',
        '| Branch | Placement Offers | Stipend Internships | Total Internships |',
        '|---|---:|---:|---:|'
    ];
    for (const b of branches) {
        const po = bw[b] != null ? bw[b] : 'N/A';
        const si = stip[b] != null ? stip[b] : 'N/A';
        const ti = totalInt[b] != null ? totalInt[b] : 'N/A';
        lines.push('| ' + b + ' | ' + po + ' | ' + si + ' | ' + ti + ' |');
    }
    lines.push('');
    lines.push('**Contact:** ' + ((p.contacts && p.contacts.placementCellEmail) || 'placement@saividya.ac.in') + ' | ' + ((p.contacts && p.contacts.phones) || '+91 9108015199, +91 9739037743'));
    return lines.join('\n');
}

function buildCampusFacilitiesText() {
    const c = kb.campusFacilities || {};
    const parts = ['**SVIT Campus Facilities**'];
    if (c.wifi) parts.push('- **Wi-Fi:** ' + c.wifi);
    if (c.library) parts.push('- **Library:** ' + c.library);
    if (c.labs) parts.push('- **Labs:** ' + c.labs);
    if (c.seminarHalls) parts.push('- **Seminar Halls:** ' + c.seminarHalls);
    if (c.cafeteria) parts.push('- **Cafeteria:** ' + c.cafeteria);
    if (c.sports) parts.push('- **Sports:** ' + c.sports);
    if (c.gymnasium) parts.push('- **Gymnasium:** ' + c.gymnasium);
    return parts.join('\n');
}

const BRANCH_ALIASES = [
    { key: 'CSE', label: 'CSE', patterns: ['cse (ai & ml)', 'cse aiml', 'cse(ai&ml)', 'ai & ml', 'aiml', 'ai and ml', 'artificial intelligence', 'cse (data science)', 'cse ds', 'data science', 'cse (cyber security)', 'cyber security', 'cybersecurity', 'csbs', 'computer science and business systems'], exclude: true },
    { key: 'CSE', label: 'Computer Science & Engineering (CSE)', patterns: ['computer science and engineering', 'cse', 'computer science'] },
    { key: 'CSE-AIML', label: 'CSE (AI & ML)', patterns: ['cse (ai & ml)', 'cse aiml', 'ai & ml', 'aiml', 'ai and ml', 'artificial intelligence'] },
    { key: 'CSE-DS', label: 'CSE (Data Science)', patterns: ['cse (data science)', 'cse ds', 'data science'] },
    { key: 'CSE-CyberSecurity', label: 'CSE (Cyber Security)', patterns: ['cse (cyber security)', 'cyber security', 'cybersecurity'] },
    { key: 'CSBS', label: 'Computer Science & Business Systems (CSBS)', patterns: ['csbs', 'computer science and business systems'] },
    { key: 'ECE', label: 'Electronics & Communication Engineering (ECE)', patterns: ['ece', 'electronics and communication', 'electronics & communication'] },
    { key: 'ISE', label: 'Information Science & Engineering (ISE)', patterns: ['ise', 'information science'] },
    { key: 'ME', label: 'Mechanical Engineering (ME)', patterns: ['mechanical engineering', 'mechanical', 'me '] },
    { key: 'CE', label: 'Civil Engineering (CE)', patterns: ['civil engineering', 'civil', 'ce '] }
];

function detectBranchKeys(m) {
    const keys = [];
    const add = (k) => { if (k && keys.indexOf(k) === -1) keys.push(k); };
    const t = String(m || '').toLowerCase();
    if (/ai\s*[&\-]?\s*ml|aiml|artificial intelligence|cse\s*ai\s*ml/.test(t)) add('CSE-AIML');
    if (/data science|cse\s*-?\s*ds|\bds\b/.test(t)) add('CSE-DS');
    if (/cyber\s*security|cybersecurity/.test(t)) add('CSE-CyberSecurity');
    if (/\bcsbs\b|business systems/.test(t)) add('CSBS');
    if (/\bece\b|electronics/.test(t)) add('ECE');
    if (/\bise\b|information science/.test(t)) add('ISE');
    if (/mechanical|\bme\b/.test(t)) add('ME');
    if (/civil|\bce\b/.test(t)) add('CE');
    if (/\bcse\b|computer science/.test(t) && !/ai\s*[&\-]?\s*ml|aiml|artificial intelligence|data science|\bds\b|cyber|business systems|\bcsbs\b/.test(t)) add('CSE');
    return keys;
}

function branchLabel(key) {
    const map = { 'CSE': 'CSE', 'CSE-AIML': 'CSE (AI & ML)', 'CSE-DS': 'CSE (Data Science)', 'CSE-CyberSecurity': 'CSE (Cyber Security)', 'CSBS': 'CSBS', 'ECE': 'ECE', 'ISE': 'ISE', 'ME': 'Mechanical', 'CE': 'Civil' };
    return map[key] || key;
}

function buildCutoffComparisonTable(branchKeys) {
    const kcet = (kb.kcetCutoffs && kb.kcetCutoffs.branchWise) || {};
    const comedk = (kb.comedkCutoffs && kb.comedkCutoffs.branchWise) || {};
    const allKeys = Object.keys(Object.assign({}, kcet, comedk));
    const keys = (branchKeys && branchKeys.length) ? branchKeys.filter((k) => allKeys.indexOf(k) !== -1) : allKeys;
    const lines = [];
    lines.push('**SVIT Entrance Exam Codes**');
    lines.push('- **KCET (KEA) College Code:** E173');
    lines.push('- **COMEDK UGET College Code:** E113');
    lines.push('');
    lines.push('| Branch | KCET 2026 | COMEDK 2026 |');
    lines.push('|---|---:|---:|');
    for (const k of keys) {
        const k26 = kcet[k] && kcet[k]['2026'] ? kcet[k]['2026'] : 'N/A';
        const c26 = comedk[k] && comedk[k]['2026'] ? comedk[k]['2026'] : 'N/A';
        lines.push('| ' + branchLabel(k) + ' | ' + k26 + ' | ' + c26 + ' |');
    }
    lines.push('');
    lines.push('_Note: Actual cutoffs vary by category and counselling round. Source: verified SVIT knowledge base._');
    return lines.join('\n');
}

function buildExamCutoffTable(exam, branchKeys) {
    const isKcet = exam === 'kcet';
    const data = (isKcet ? kb.kcetCutoffs : kb.comedkCutoffs) || {};
    const bw = data.branchWise || {};
    const keys = (branchKeys && branchKeys.length) ? branchKeys.filter(k => bw[k]) : Object.keys(bw);
    const title = isKcet ? '**SVIT KCET Cutoff Ranks**' : '**SVIT COMEDK Cutoff Ranks**';
    const code = isKcet ? '- **KCET (KEA) College Code:** E173' : '- **COMEDK UGET College Code:** E113';
    const lines = [title, code, '', '| Branch | 2024 | 2025 | 2026 |', '|---|---:|---:|---:|'];
    for (const k of keys) {
        const r = bw[k] || {};
        lines.push('| ' + branchLabel(k) + ' | ' + (r['2024'] || 'N/A') + ' | ' + (r['2025'] || 'N/A') + ' | ' + (r['2026'] || 'N/A') + ' |');
    }
    lines.push('');
    lines.push('_Note: Actual cutoffs vary by category and counselling round._');
    return lines.join('\n');
}

function buildEntranceText(m) {
    const lower = String(m || '').toLowerCase();
    const branchKeys = detectBranchKeys(lower);
    const asksKcet = /kcet|kea|e173|cet/.test(lower);
    const asksComedk = /comedk|e113/.test(lower);
    const asksCompare = /compare|vs.?|versus|difference|between/.test(lower) || (asksKcet && asksComedk);
    const asksCutoff = /cutoff|cut off|rank|closing rank/.test(lower);
    if (asksCompare) return buildCutoffComparisonTable(branchKeys);
    if (asksCutoff && asksKcet && !asksComedk) return buildExamCutoffTable('kcet', branchKeys);
    if (asksCutoff && asksComedk && !asksKcet) return buildExamCutoffTable('comedk', branchKeys);
    if (asksCutoff || branchKeys.length) return buildCutoffComparisonTable(branchKeys);
    const parts = ['**SVIT Entrance Exam Codes**'];
    parts.push('- **KCET (KEA) College Code:** E173');
    parts.push('- **COMEDK UGET College Code:** E113');
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
    const raw = String(message || '');
    const m = raw.toLowerCase().trim();
    if (!m) return null;

    // Never guess — route unverifiable specifics to the official fallback.
    if (ANTI_HALLUCINATION.some((kw) => kwMatch(m, kw))) return normalizeAnswerText(STRICT_FALLBACK);

    const has = (...kws) => kws.some((k) => kwMatch(m, k));
    const out = [];
    const push = (ans) => { const a = normalizeAnswerText(ans); if (a && out.indexOf(a) === -1) out.push(a); };

    const asksCourses = has('course','courses','branch','branches','program','degree','btech','b.tech','be','b.e','bba','mba','mtech','m.tech','mca','phd','stream');
    const asksFees = has('fee','fees','tuition','cost','price','lakh','rupees','amount','structure');
    const asksCutoff = has('cutoff','cut-off','rank','kcet','cet','kea','comedk','dcet','pgcet','kmat','code','eligibility','admission','document','quota','management');
    const asksPlacement = has('placement','placements','package','ctc','salary','lpa','offer','offers','job','recruit','company','anand');
    const asksInternship = has('internship','stipend');
    const asksEvents = has('event','events','fest','hackathon','hackfest','techvidya','sku','kannada','sammilana','alumni','open day','prompt','pixel','coderelay');
    const asksClubs = has('club','clubs','codenex','aiera','coding','sae');
    const asksCampus = has('hostel','room','mess','food','warden','bus','transport','route','wifi','library','lab','sports','gym','campus','acre','scholarship','ssp','nsp');
    const asksLeadershipContact = has('principal','hod','founder','trustee','manjunath','naac','nba','vtu','autonomous','aicte','ranking','accreditation','contact','phone','number','call','email','mail','address','location','where','reach');

    // 1) Programs & Fees
    if (asksCourses || asksFees) {
        push(buildProgramsFeesText());
        if (has('mtech','m.tech','mca')) push('- **M.Tech and MCA:** Not offered at SVIT. MBA is the postgraduate program offered.');
    }

    // 2) Cutoffs / admissions exams / codes
    if (asksCutoff) {
        push(buildEntranceText(m));
        if (has('admission','document','documents','eligibility')) {
            push('**Admission Documents**\n- 10th (SSLC) & 12th (2nd PUC) Marks Cards\n- Transfer Certificate (TC) & Study Certificate\n- KCET/COMEDK/PGCET/KMAT rank/allotment documents (if applicable)\n- Caste/Income Certificate (if applicable)\n- Aadhaar Card copy & passport-size photographs');
        }
        if (has('scholarship','ssp','nsp')) push('**Scholarships**\n- Karnataka State SSP Post-Matric Scholarship & Fee Reimbursement for SC/ST Students\n- Fee Concession for Category I, II, and III Students\n- National Scholarship Portal (NSP) - Minority Religion Scholarship\n- Defence Scholarship');
    } else if (has('admission','document','documents')) {
        push('**Admission Documents**\n- 10th (SSLC) & 12th (2nd PUC) Marks Cards\n- Transfer Certificate (TC) & Study Certificate\n- KCET/COMEDK/PGCET/KMAT rank/allotment documents (if applicable)\n- Caste/Income Certificate (if applicable)\n- Aadhaar Card copy & passport-size photographs');
        push(buildContactsLeadershipText(m));
    }

    // 3) Placements & Internships
    if (asksPlacement && asksInternship) {
        push(buildPlacementsText());
    } else if (asksPlacement) {
        push(buildPlacementsText());
    } else if (asksInternship) {
        push(buildInternshipsText());
    }

    // 4) Events
    if (asksEvents) push(buildEventsText());

    // 5) Clubs
    if (asksClubs) {
        let dept = '';
        if (/ise|aignite|samarthya|capture the flag|codesphere|vikhas|technics/.test(m)) dept = 'ISE';
        else if (/ai\s*&?\s*ml|aiml|codenex|aiera|lang net|data nexus|agentic arc/.test(m)) dept = 'CSE (AI & ML)';
        else if (/data science|data vision|beyond code|yuva codes|nexaura|cevovate|synapse|utkrashta/.test(m)) dept = 'CSE (Data Science)';
        else if (/civil|build smart|civil tech/.test(m)) dept = 'Civil';
        else if (/mechanical|sae|mech/.test(m)) dept = 'Mechanical';
        else if (/coding club|cse/.test(m) && !/ise|civil|mechanical|data science|ai\s*&?\s*ml|aiml/.test(m)) dept = 'CSE';
        push(buildClubsText(dept));
    }

    // 6) Campus/hostel/bus/scholarships
    if (asksCampus) {
        if (has('hostel','room','mess','food','warden')) push(kb.hostel && kb.hostel.summary);
        if (has('bus','transport','route')) push(kb.transport && kb.transport.summary);
        if (has('wifi','library','lab','sports','gym','campus','acre') && !has('hostel','bus','transport','route')) push(buildCampusFacilitiesText());
        if (has('scholarship','ssp','nsp')) push(kb.autonomousInfo && kb.autonomousInfo.summary);
        if (asksCampus && !out.length) push(kb.hostel && kb.hostel.summary);
    }

    // 7) Leadership/contact/accreditations
    if (asksLeadershipContact) {
        if (has('naac','nba','vtu','autonomous','aicte','ranking','accreditation')) push(buildAccreditationsText());
        if (has('principal','hod','founder','trustee','manjunath','contact','phone','number','call','email','mail','address','location','where','reach','warden')) push(buildContactsLeadershipText(m));
        if (has('autonomous') && !/autonomous under vtu/i.test(out.join('\n'))) push('**Autonomous Status:** SVIT is an Autonomous Institution under VTU, accredited by NAAC with \'A\' Grade.');
    }

    return out.length ? out.join('\n\n') : null;
}

/**
 * Primary — Gemini LLM with the FULL SVIT knowledge base in the system prompt.
 * Uses the `x-goog-api-key` header only (works with Google AI Studio "AQ." keys).
 * Tries configured models in order. Returns the answer string, or null on no-key / failure.
 */
async function callGemini(message) {
    if (!GEMINI_API_KEY) return null;
    for (const model of GEMINI_MODELS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: [{ role: 'user', parts: [{ text: String(message) }] }],
                    generationConfig: { temperature: 0.2 }
                }),
                signal: controller.signal
            });
            if (!res.ok) {
                let errBody = '';
                try { errBody = await res.text(); } catch (_) {}
                console.error('[SVIT chat] Gemini API error', { model, status: res.status, statusText: res.statusText, body: errBody.slice(0, 500) });
                continue;
            }
            const data = await res.json();
            const cand = data && data.candidates && data.candidates[0];
            const parts = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : [];
            const text = parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
            if (text) return normalizeAnswerText(text);
        } catch (e) {
            console.error('[SVIT chat] Gemini request failed', { model, error: e && e.message ? e.message : String(e) });
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
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
        return { answer: normalizeAnswerText(STRICT_FALLBACK), source: 'local-kb' };
    }

    // Primary: Gemini LLM with the full KB in the system prompt.
    if (GEMINI_API_KEY) {
        const llmAnswer = await callGemini(trimmed);
        if (llmAnswer) return { answer: llmAnswer, source: 'gemini' };
    }

    // Instant backup: local verified KB keyword matcher.
    const localAnswer = kbLookup(trimmed);
    if (localAnswer) return { answer: normalizeAnswerText(localAnswer), source: 'local-kb' };

    // Last resort: official SVIT contact/website fallback.
    return { answer: normalizeAnswerText(STRICT_FALLBACK), source: 'local-kb' };
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
    const keys = ['message', 'query', 'prompt', 'text'];
    for (const key of keys) {
        if (obj[key] != null) {
            const val = obj[key];
            if (typeof val === 'string') return val.trim();
            if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
        }
    }
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
 * Always returns HTTP 200 with { reply, answer, response } for POST requests.
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

    let message = '';
    try {
        message = await readMessage(req);
    } catch (e) {
        message = '';
    }

    let answer = STRICT_FALLBACK;
    let source = 'fallback';
    try {
        const result = await answerQuestion(message);
        answer = normalizeAnswerText((result && result.answer) ? String(result.answer) : STRICT_FALLBACK);
        source = (result && result.source) ? result.source : 'local-kb';
    } catch (e) {
        const trimmed = String(message || '').trim();
        if (!trimmed || isGreeting(trimmed)) {
            answer = welcomeText();
            source = 'welcome';
        } else {
            const local = kbLookup(trimmed);
            answer = normalizeAnswerText(local || STRICT_FALLBACK);
            source = 'local-kb';
        }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ reply: answer, answer: answer, response: answer, source: source }));
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