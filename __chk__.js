// Render Lucide icons
        lucide.createIcons();

        // Load external knowledge base from src/data/svitKnowledgeBase.json
        (function loadKnowledgeBase() {
            fetch('/src/data/svitKnowledgeBase.json')
                .then(function (response) { return response.json(); })
                .then(function (kb) {
                    window.__SVIT_KB__ = kb;
                    predefinedQA = kb.chatbot.knowledgeBaseEntries.map(function (e) {
                        return { keywords: e.keywords, answer: resolvePlaceholder(e.answer, kb) };
                    });
                })
                .catch(function (err) { console.warn('KB load failed:', err); });
        })();

        function resolvePlaceholder(key, kb) {
            if (key.indexOf('__') !== 0) return key;
            var name = key.slice(2, -2);
            if (name.indexOf('.') !== -1) {
                var parts = name.split('.');
                var val = kb;
                for (var i = 0; i < parts.length; i++) {
                    if (val[parts[i]] === undefined) return key;
                    val = val[parts[i]];
                }
                return val;
            }
            var map = {
                'GREETING': 'chatbot.greeting', 'COLLEGE_ABOUT': 'college.about',
                'KEA_KCET_CODE': 'admissions.keaKcetCollegeCode', 'COMEDK_CODE': 'admissions.comdkCollegeCode',
                'COURSES_SUMMARY': 'courses.summary', 'FEES_SUMMARY': 'fees.summary', 'NOT_OFFERED': 'courses.notOffered',
                'TIMINGS_SUMMARY': 'timings.summary', 'LIBRARY_DESCRIPTION': 'library.description',
                'PLACEMENTS_SUMMARY': 'placements.summary', 'INTERNSHIPS_SUMMARY': 'internships.summary',
                'MECHANICAL_SUMMARY': 'mechanicalEngineering.summary', 'CLUBS_OVERVIEW': 'clubs.overview',
                'CODING_CLUB': 'clubs.codingClub', 'CODENEX': 'clubs.codenex', 'AIERA': 'clubs.aiera',
                'LANG_NET': 'clubs.langNet', 'DATA_NEXUS': 'clubs.dataNexus', 'AGENTIC_ARC': 'clubs.agenticArc',
                'DATA_SCIENCE_CLUBS': 'clubs.dataScienceClubs', 'CIVIL_TECH': 'clubs.civilTech',
                'HOSTEL_SUMMARY': 'hostel.summary', 'TRANSPORT_SUMMARY': 'transport.summary',
                'ANTI_HALLUCINATION_FALLBACK': 'chatbot.antiHallucinationFallback'
            };
            var path = map[name];
            if (path) {
                var parts = path.split('.');
                var val = kb;
                for (var i = 0; i < parts.length; i++) {
                    if (val[parts[i]] === undefined) return key;
                    val = val[parts[i]];
                }
                return val;
            }
            // Computed placeholders
            if (name === 'ADMISSIONS_PATHWAYS') {
                return 'SVIT Admissions 2026-27 are open until ' + kb.admissions.admissionOpenDate + '. Classes begin ' + kb.admissions.classesBeginDate + '.\n• KEA / KCET College Code: ' + kb.admissions.keaKcetCollegeCode + '\n• COMEDK UGET College Code: ' + kb.admissions.comdkCollegeCode + '\n• Admission Modes:\n  - B.E. / B.Tech (4 Years): KCET (KEA), COMEDK UGET, DCET (Lateral Entry for Diploma holders), Management Quota\n  - MBA (2 Years): Karnataka PGCET, KMAT, MAT, CAT, Management Quota\n  - BBA (3 Years): Direct merit-based admission after 10+2\n\nDocuments Required:\n• 10th (SSLC) & 12th (2nd PUC) Marks Cards\n• Transfer Certificate (TC) & Study Certificate\n• KCET / COMEDK / PGCET / KMAT Rank Card & Allotment Order (if applicable)\n• Caste / Income Certificate (for Karnataka reservation/scholarship categories)\n• Aadhaar Card copy & Passport-size photographs\n\nScholarships:\n• Karnataka State SSP Post-Matric Scholarships\n• NSP (National Scholarship Portal) schemes\n• Merit/fee-concession support for deserving students';
            }
            if (name === 'CONTACT_DETAILS') {
                return 'SVIT Contact Details:\n• Address: ' + kb.college.location + '\n• Phone: ' + kb.college.contactPhone + '\n• Email: ' + kb.college.contactEmail + '\n• Helpdesk: ' + kb.college.helpdeskHours;
            }
            if (name === 'PLACEMENT_CONTACTS') {
                return 'SVIT Placement, Internship & Admission Contacts:\n• Head of Training & Placement: ' + kb.placements.headOfTrainingAndPlacement + '\n• Placement Cell Email: ' + kb.placements.contacts.placementCellEmail + '\n• Internship Cell Email: ' + kb.internships.contacts.internshipCellEmail + '\n• Admissions Email: admission@saividya.ac.in\n• Placement & Enquiry Phones: ' + kb.placements.contacts.phones + '\n• Official Website: ' + kb.placements.contacts.website;
            }
            if (name === 'TRUSTEES') {
                return 'SVIT Management & Trustees (Sri Sai Vidya Vikasa Shikshana Samithi):\n• ' + kb.leadership.trustees.join('\n• ');
            }
            if (name === 'ACADEMIC_LEADERSHIP') {
                return 'SVIT Academic Leadership:\n• ' + kb.leadership.academic.join('\n• ');
            }
            if (name === 'INNOVATION_CELL') {
                return "SVIT has active innovation and professional body chapters:\n• MHRD's Innovation Cell\n• Institution's Innovation Council (IIC)\n• IEEE SSIT (Society on Social Implications of Technology)\n• IEEE Education Society\nThese bodies promote research culture, innovation, and industry-academia collaboration.";
            }
            if (name === 'ACCREDITATIONS') {
                return 'SVIT Accreditations & Approvals:\n• Approved by AICTE (New Delhi)\n• Affiliated to Visvesvaraya Technological University (VTU)\n• Recognized by Government of Karnataka\n• Accredited by NAAC with \'A\' Grade\n• NBA (New Delhi) accredited for CSE, ECE, and ISE departments\n• Active chapters: MHRD\'s Innovation Cell, Institution\'s Innovation Council (IIC), IEEE SSIT, and IEEE Education Society.';
            }
            if (name === 'ENGINEERING_BRANCHES') {
                return 'SVIT Undergraduate Engineering (B.E. / B.Tech – 4 Years):\n• ' + kb.courses.ugEngineering.join('\n• ');
            }
            if (name === 'SCHOLARSHIPS') {
                return 'SVIT Scholarships Supported:\n• ' + kb.admissions.scholarships.join('\n• ');
            }
            if (name === 'DOCUMENTS_REQUIRED') {
                return 'Documents Required for SVIT Admission:\n• ' + kb.admissions.documentsRequired.join('\n• ');
            }
            if (name === 'CAMPUS_FACILITIES_SUMMARY') {
                return kb.transport.summary;
            }
            if (name === 'EVENTS_SUMMARY') {
                return kb.events.summary;
            }
            if (name === 'HACKFEST_DESCRIPTION') {
                return kb.events.flagship[0].description;
            }
            if (name === 'TECHVIDYA_DESCRIPTION') {
                return kb.events.flagship[1].description;
            }
            if (name === 'SKU_DESCRIPTION') {
                return kb.events.flagship[2].description;
            }
            if (name === 'PROMPT_PIXEL') {
                return kb.events.additionalEvents[0].description;
            }
            if (name === 'TECH_OPEN_DAY') {
                return kb.events.additionalEvents[1].description;
            }
            if (name === 'CODERELAY') {
                return kb.events.additionalEvents[2].description;
            }
            if (name === 'BUGGERS_CRACKERS') {
                return kb.events.additionalEvents[3].description;
            }
            if (name === 'ALUMNI_MEET') {
                return kb.events.additionalEvents[4].description;
            }
            if (name === 'BEST_PRACTICES_CSE') {
                return kb.bestPractices.cse;
            }
            if (name === 'BEST_PRACTICES_DS') {
                return kb.bestPractices.dataScience;
            }
            if (name === 'BEST_PRACTICES_CIVIL') {
                return kb.bestPractices.civil;
            }
            return key;
        }

        // Mobile menu toggle logic
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        mobileBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });

        // Close mobile menu when a link inside it is clicked
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                mobileMenu.classList.add('hidden');
            });
        });

        // Chatbot open/close state
        const chatWindow = document.getElementById('chat-window');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        let isChatOpen = false;

        function toggleChat() {
            isChatOpen = !isChatOpen;
            if (isChatOpen) {
                chatWindow.classList.remove('hidden');
                chatWindow.classList.add('flex');
                chatInput.focus();
                scrollToBottom();
            } else {
                chatWindow.classList.add('hidden');
                chatWindow.classList.remove('flex');
            }
        }

        function scrollToBottom() {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Predefined Q&A knowledge base — SVIT (Sai Vidya Institute of Technology)
        let predefinedQA = [];
        /* const predefinedQA = [
            // --- Placements, Internships & Mechanical Engineering (Verified 2026 Data) ---
            // System prompt: placement / internship / Mechanical Engineering queries must be answered with the exact figures below.
            {
                keywords: ['placement email', 'internship email', 'admission email', 'placement phone', 'placement contact', 'placement cell', 'internship cell', 'placement enquiry'],
                answer: "SVIT Placement, Internship & Admission Contacts:\\n• Head of Training & Placement: Prof. Anand Kumar\\n• Placement Cell Email: placement@saividya.ac.in\\n• Internship Cell Email: internship@saividya.ac.in\\n• Admissions Email: admission@saividya.ac.in\\n• Placement & Enquiry Phones: +91 9108015199, +91 9739037743\\n• Official Website: www.saividya.ac.in",
            },
            {
                keywords: ['placement', 'placements', 'placement offers', '2026 placement', 'highest package', 'ctc', 'lpa', '33 lpa', 'branch wise', 'branch-wise', 'package', 'salary', 'training and placement', 'tpo', 'placement officer', 'anand kumar', 'placement statistics'],
                answer: "SVIT Placement Highlights — 2026 Batch:\\n• Head of Training and Placement Department: Prof. Anand Kumar\\n• Total Placement Offers: 413 offers\\n• Highest Package (CTC): 33 LPA\\n\\nBranch-Wise Placement Offers (2026):\\n• ECE (Electronics & Communication Engineering): 101 offers\\n• CSE (Computer Science & Engineering): 86 offers\\n• CSE-DS (Data Science): 83 offers\\n• ISE (Information Science & Engineering): 73 offers\\n• CSE-AIML (Artificial Intelligence & Machine Learning): 69 offers\\n\\nAccreditations & Rankings: Careers360 Ranking 2025 (A+ / AAAAA++), NAAC 'A' Grade, NBA Accredited, AICTE Approved, Affiliated to VTU Belagavi.\\n\\nPlacement Cell: placement@saividya.ac.in | Phones: +91 9108015199, +91 9739037743",
            },
            {
                keywords: ['internship', 'internships', 'stipend', 'stipend based', 'stipend-based', 'internship offers', 'internship statistics'],
                answer: "SVIT Internship Offers — 2026 Passing Out Batch:\\n\\nStipend-Based Internships (284 students total):\\n• ECE: 82\\n• CSE-DS (Data Science): 60\\n• CSE: 55\\n• CSE-AIML (AIML): 50\\n• ISE: 36\\n• ME (Mechanical Engineering): 1\\n\\nGeneral Internships (357 offers total):\\n• ISE: 90\\n• CSE: 82\\n• CSE-AIML (AIML): 78\\n• ECE: 66\\n• CSE-DS (DS): 66\\n• ME (Mechanical Engineering): 0\\n\\nInternship Cell: internship@saividya.ac.in",
            },
            {
                keywords: ['mechanical', 'me branch', 'department of mechanical', 'sae', 'robotics', 'cad cam', 'cae', 'cnc', '3d printing', 'proctor', 'project exhibition', 'toppers meet', 'best outgoing student', 'nptel', 'mooc', 'mechanical best practices', 'design manufacturing', 'thermal fluids', 'simulation'],
                answer: "SVIT Department of Mechanical Engineering — Core Focus Areas: Design & Manufacturing, Thermal & Fluids, CAD/CAE/Simulation, Research & Innovation, and Holistic Development.\\n\\n10 Departmental Best Practices:\\n1. Industry-Institute Interaction — internships, industry exposure, expert interactions, and institute collaboration\\n2. Value Added Programmes — CAD, CAM, CAE, CNC, 3D printing, and emerging mechanical technologies\\n3. MoU with Industries / Centres of Excellence — skill development, consultancy, innovation, research, and community engagement\\n4. Club Activities — SAE, robotics, design challenges, quizzes, events, and teamwork-based learning\\n5. Proctor System — academic guidance, personal counselling, and continuous student support\\n6. Project Exhibition — innovative projects, prototypes, business ideas, and research outcomes\\n7. Toppers Meet — knowledge-sharing sessions by academic achievers\\n8. Best Outgoing Student Award — excellence in academics, leadership, extracurricular activities\\n9. Student Projects Converted into Research Papers — conference papers and journal publications\\n10. MOOC & NPTEL Certifications — online certification courses\\n\\nPlacement & Internship queries: placement@saividya.ac.in | internship@saividya.ac.in",
            },
            {
                keywords: ['hi', 'hello', 'hey', 'greetings', 'start'],
                answer: "Hello! Welcome to Sai Vidya Institute of Technology (SVIT), Bengaluru. How can I help you? Ask about admissions, courses (B.Tech, BBA, MBA), fees, timings, library, events (HackFest, TechVidya, SKU), clubs (Coding Club, CodeNex, AIERA, Civil Tech), accreditations (NAAC, NBA), leadership, alumni meet, or contact details!"
            },
            {
                keywords: ['svit', 'sai vidya', 'college name', 'institute', 'about', 'motto', 'learn to lead'],
                answer: "Sai Vidya Institute of Technology (SVIT) — motto: \"Learn to Lead\" — is located at Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka. Run by Sri Sai Vidya Vikasa Shikshana Samithi. Approved by AICTE, affiliated to VTU, recognized by Govt. of Karnataka, accredited by NAAC with 'A' Grade, and NBA-accredited for CSE, ECE & ISE. We offer B.Tech, BBA, and MBA programs with modern labs, excellent placements, and vibrant campus life."
            },
            {
                keywords: ['admission', 'admissions', 'apply', 'eligibility', 'eligible', 'deadline', 'counseling'],
                answer: "Admissions for 2026-27 are open until July 15, 2026.\n• B.Tech Eligibility: 10+2 with PCM (60%+).\n• BBA Eligibility: 10+2 any stream (50%+).\n• MBA Eligibility: Bachelor's degree in any discipline (50%+) with valid PGCET / KMAT / MAT / CAT score.\nClasses begin August 05, 2026."
            },
            {
                keywords: ['course', 'courses', 'program', 'programs', 'degree', 'btech', 'b.tech', 'bba', 'mba'],
                answer: "SVIT offers:\n• B.Tech Computer Science & Engineering (4 yrs, 180 seats)\n• B.Tech Electronics & Communication Engg. (4 yrs)\n• BBA Business Administration (3 yrs, 120 seats)\n• MBA Master of Business Administration (2 yrs, 60 seats)"
            },
            {
                keywords: ['fee', 'fees', 'tuition', 'cost', 'price', 'charges'],
                answer: "Annual Tuition Fees at SVIT:\n• B.Tech (CSE / ECE): ₹1,30,000/yr\n• BBA: ₹40,000/yr\n• MBA: ₹76,000/yr"
            },
            {
                keywords: ['timing', 'timings', 'class', 'classes', 'schedule', 'lab', 'labs', 'cafeteria', 'canteen', 'hours'],
                answer: "Campus Timings at SVIT:\n• Classes: Mon–Fri, 09:00 AM – 04:30 PM (Lunch 12:30 PM – 01:30 PM)\n• Library: Mon–Sat, 08:00 AM – 08:00 PM\n• Computer Labs: Mon–Sat, 08:30 AM – 06:30 PM\n• Cafeteria: Daily, 07:30 AM – 09:00 PM"
            },
            {
                keywords: ['library', 'books', 'book', 'study', 'reading'],
                answer: "The SVIT Central Library is open Monday to Saturday from 08:00 AM to 08:00 PM, offering textbooks, reference journals, and quiet study spaces."
            },
            {
                keywords: ['hackfest', 'hack fest', 'hackathon'],
                answer: "HackFest is SVIT's flagship National-Level Hackathon! It brings together student innovators from across the country for an intensive 24-to-36-hour coding marathon covering AI, Web/Mobile, Sustainability, and Smart Systems — with industry mentorship, live pitching, and cash prizes."
            },
            {
                keywords: ['techvidya', 'tech vidya', 'technical fest'],
                answer: "TechVidya is SVIT's annual inter-collegiate technical festival featuring competitive coding, robotics challenges, project expos, technical paper presentations, circuit debugging, hands-on workshops, and tech quizzes across all engineering branches."
            },
            {
                keywords: ['sku', 'siri kannada', 'kannada utsava', 'cultural fest', 'cultural'],
                answer: "SKU – Siri Kannada Utsava is SVIT's grand annual Kannada cultural extravaganza celebrating Karnataka's rich heritage, art, literature, music, folk and classical dance, theatre, and student creativity through vibrant inter-departmental and inter-collegiate cultural competitions."
            },
            {
                keywords: ['event', 'events', 'fest', 'festival'],
                answer: "SVIT's 3 Flagship Events:\n• HackFest — National-Level Hackathon (24–36 hr coding marathon with cash prizes)\n• TechVidya — Annual Inter-Collegiate Technical Festival\n• SKU (Siri Kannada Utsava) — Grand Kannada Cultural Extravaganza"
            },
            {
                keywords: ['contact', 'phone', 'email', 'address', 'location', 'where', 'helpdesk'],
                answer: "SVIT Contact Details:\n• Address: Rajanukunte, via Yelahanka, Bengaluru - 560064, Karnataka\n• Phone: +91 8028468191 / +91 9108575191\n• Email: info@saividya.ac.in\n• Helpdesk: Mon–Sat, 09:00 AM – 05:00 PM"
            },
            {
                keywords: ['mtech', 'm.tech', 'mca'],
                answer: "SVIT does not currently offer M.Tech or MCA programs. Our postgraduate program is the MBA (Master of Business Administration) — 2 years, ₹76,000/yr. For undergraduate programs we offer B.Tech and BBA."
            },
            // --- Accreditations & Approvals ---
            {
                keywords: ['naac', 'nba', 'accreditation', 'accredited', 'aicte', 'vtu', 'approved', 'affiliated', 'recognition'],
                answer: "SVIT Accreditations & Approvals:\n• Approved by AICTE (New Delhi)\n• Affiliated to Visvesvaraya Technological University (VTU)\n• Recognized by Government of Karnataka\n• Accredited by NAAC with 'A' Grade\n• NBA (New Delhi) accredited for CSE, ECE, and ISE departments\n• Active chapters: MHRD's Innovation Cell, Institution's Innovation Council (IIC), IEEE SSIT, and IEEE Education Society."
            },
            // --- Management & Trustees ---
            {
                keywords: ['trustee', 'trustees', 'management', 'founder', 'samithi', 'managing trustee'],
                answer: "SVIT Management & Trustees (Sri Sai Vidya Vikasa Shikshana Samithi):\n• Prof. M R Holla – Founder Trustee & President\n• Dr. A M Padma Reddy – Founder Trustee & Vice President\n• Sri. R Srinivas Raju – Managing Trustee & Secretary\n• Prof. R C Shanmukha Swamy – Founder Trustee & Joint Secretary\n• Sri. Manohar M K – Founder Trustee & Treasurer\n• Dr. Y Jayasimha & Mr. Meghashyam Nadimpalli – Founder Trustees"
            },
            // --- Principal & Academic Leadership ---
            {
                keywords: ['principal', 'vice principal', 'hod', 'head of department', 'dean', 'leadership', 'manjunath', 'shashikumar', 'shantakumar', 'lakshminarayaachari'],
                answer: "SVIT Academic Leadership:\n• Principal: Dr. Manjunath T N\n• Vice-Principal: Dr. Lakshminarayaachari\n• Dept. of CSE – HOD: Dr. Shashikumar D R (Professor); Dean Research: Dr. Shantakumar B Patil (Professor)\n• Dept. of CSE (AI & ML) – HOD: Dr. T G Manjunath (Professor)"
            },
            // --- Innovation Cell & Professional Bodies ---
            {
                keywords: ['innovation', 'iic', 'ieee', 'mhrd'],
                answer: "SVIT has active innovation and professional body chapters:\n• MHRD's Innovation Cell\n• Institution's Innovation Council (IIC)\n• IEEE SSIT (Society on Social Implications of Technology)\n• IEEE Education Society\nThese bodies promote research culture, innovation, and industry-academia collaboration."
            },
            // --- Clubs Overview ---
            {
                keywords: ['club', 'clubs', 'technical club', 'student club'],
                answer: "SVIT Student Technical Clubs:\n\n📌 Dept. of CSE:\n• Coding Club SVIT — competitive programming, hackathons, Git/GitHub workshops\n\n📌 Dept. of CSE (AI & ML):\n• CodeNex — \"Next Gen Coding Evolution\"\n• AIERA Club — \"Minds Meet, Talents Thrive\"\n• LANG NET, DATA NEXUS, AGENTIC ARC\n\n📌 Dept. of CSE (Data Science):\n• Data Vision Club, Beyond Code Studio, Yuva Codes Club, NexAura Club, Cevovate Club, Synapse Club, Utkrashta Club\n\n📌 Dept. of Civil Engineering:\n• CIVIL TECH — Infrastructure Development\n• BUILD SMART — Sustainable & Green Building Practice"
            },
            // --- Coding Club SVIT (CSE) ---
            {
                keywords: ['coding club', 'coding club svit'],
                answer: "Coding Club SVIT (Dept. of CSE) — Launched February 9, 2026 at Venue B-113.\nFocus: Competitive programming (LeetCode, HackerRank, CodeChef), project-building workshops, Git & GitHub sessions, pair programming, hackathons, tech talks, and interview/contest readiness.\n\nFaculty Coordinators: Dr. Varun E, Prof. Ramanjinamma G, Prof. Lalitha K.\nStudent Leaders: Mahima K (President), Samyak D Karekar (VP), Jagadeesha (Secretary), Shalini M Gowda (Joint Secretary), Aadita Nag (Treasurer), Kavyashree SN (Documentation), Shankar SB (Social Media), Harshitha N & Suhail D Tamboli (Membership)."
            },
            // --- CodeNex (CSE AI & ML) ---
            {
                keywords: ['codenex', 'code nex'],
                answer: "CodeNex — \"Next Gen Coding Evolution\" (Dept. of CSE, AI & ML).\nA student coding club organizing coding competitions, developer events, and the CodeRelay challenge.\n\nFaculty Coordinators: Ms. Jayshri, Mrs. Pooja A.\nStudent Leaders: Ashraya M (President), Kishore Biradar (VP), Karthik S (Secretary), Keerthana K M (Treasurer), Katta HarshaVardhan (Social Media Lead)."
            },
            // --- AIERA Club ---
            {
                keywords: ['aiera'],
                answer: "AIERA Club — \"Minds Meet, Talents Thrive\" — is a student technical club under the Dept. of CSE (AI & ML) at SVIT, promoting collaboration and innovation in artificial intelligence and emerging technologies."
            },
            // --- LANG NET, DATA NEXUS, AGENTIC ARC ---
            {
                keywords: ['lang net', 'langnet'],
                answer: "LANG NET — \"Next Gen Coding Evolution\" — is a student club under the Dept. of CSE (AI & ML) at SVIT."
            },
            {
                keywords: ['data nexus', 'datanexus'],
                answer: "DATA NEXUS — \"Connecting People, Data and Insights\" — is a student club under the Dept. of CSE (AI & ML) at SVIT."
            },
            {
                keywords: ['agentic arc', 'agenticarc'],
                answer: "AGENTIC ARC — \"A Curve of Intelligent Action\" — is a student club under the Dept. of CSE (AI & ML) at SVIT."
            },
            // --- CSE Data Science Clubs ---
            {
                keywords: ['data science club', 'data vision', 'beyond code', 'yuva codes', 'nexaura', 'cevovate', 'synapse club', 'utkrashta'],
                answer: "SVIT Dept. of CSE (Data Science) Club Ecosystem:\n• Data Vision Club\n• Beyond Code Studio\n• Yuva Codes Club\n• NexAura Club\n• Cevovate Club\n• Synapse Club\n• Utkrashta Club\nThese clubs foster experiential learning, peer mentoring, and project-based development."
            },
            // --- Civil Engineering Clubs ---
            {
                keywords: ['civil tech', 'civiltech', 'build smart', 'buildsmart', 'civil engineering club', 'civil club'],
                answer: "SVIT Dept. of Civil Engineering Clubs:\n\n• CIVIL TECH (Infrastructure Development — Bridges, Roads, Buildings): Structural analysis, bridge modeling, failure analysis, field visits, seminars/workshops, AutoCAD & Revit Architecture training.\n\n• BUILD SMART (Sustainable & Green Building Practice): Urban planning, green building materials, environmental impact assessment, innovative projects, and Mind Hunts.\n\nCoordinators: Prof. Eshwaraj (Faculty); Vidya H U & Bhumik K V (Student Coordinators)."
            },
            // --- Prompt & Pixel Event ---
            {
                keywords: ['prompt', 'pixel', 'prompt and pixel', 'prompt & pixel', 'pair program'],
                answer: "Prompt & Pixel (Prompt | Pair Program) — Organized by the CSE Coding Club on March 25, 2026, 10:00 AM – 12:30 PM in Labs. A beginner-friendly AI co-pilot pair programming and UI/UX design session.\nCoordinated by Prof. Poornima Gowda HS, Prof. Anila Davis, and Prof. K. Lalitha."
            },
            // --- Technical Club Open Day ---
            {
                keywords: ['open day', 'technical open day', 'club open day', 'stall'],
                answer: "Technical Club Open Day (May 6, 2026):\nHosted by the Dept. of CSE (AI & ML) showcasing AIERA Club, CodeNex, LANG NET, DATA NEXUS, and AGENTIC ARC.\n\nFeatured the CSE Coding Club's Ultimate Coding Challenge (Stall No. 1) with two 2-minute speed challenges:\n• BUGGERS — syntax/code debugging challenge\n• CRACKERS — puzzle-solving & logic challenge"
            },
            // --- CodeRelay Event ---
            {
                keywords: ['coderelay', 'code relay'],
                answer: "CodeRelay is an interactive coding competition organized by CodeNex (Dept. of CSE AI & ML) at SVIT. It tests participants' logic, speed, and structured problem-solving skills through relay-style coding rounds."
            },
            // --- BUGGERS & CRACKERS ---
            {
                keywords: ['buggers', 'crackers', 'ultimate coding challenge', 'debugging challenge'],
                answer: "BUGGERS & CRACKERS — Featured at the Technical Club Open Day (May 6, 2026) by the CSE Coding Club (Stall No. 1):\n• BUGGERS: A 2-minute speed syntax/code debugging challenge.\n• CRACKERS: A 2-minute puzzle-solving & logic challenge.\nPart of the Ultimate Coding Challenge event."
            },
            // --- Sammilana 2K26 Alumni Meet ---
            {
                keywords: ['sammilana', 'alumni', 'alumni meet', 'reunite', 'relive', 'reconnect'],
                answer: "SAMMILANA 2K26 — SVIT Alumni Meet 2026:\nHeld on June 13, 2026 at SVIT campus. Theme: \"Reunite. Relive. Reconnect.\"\n• Chief Guests: 2012–2014 batch alumni\n• Guests of Honour: 2015–2016 batch alumni\n• Presided by: Managing Trustee Sri. R Srinivas Raju; Alumni Association Secretary: Prof. Darshan R V\n\nAlumni Contact: +91 91085 75191, +91 93649 12981\nAlumni Email: svitalumni@saividya.ac.in\nGeneral Enquiry: enquiry@saividya.ac.in"
            },
            // --- Best Practices (CSE) ---
            {
                keywords: ['best practice', 'best practices', 'mooc', 'patent', 'sdp', 'peer learning', 'weekend with alumni'],
                answer: "SVIT Dept. of CSE Best Practices:\n• MOOC certifications for students\n• Industry mentorship for projects & patents\n• Micro, mini & major project exhibitions\n• Converting student projects into patents & research articles\n• Hackathons & industrial visits\n• Student Development Programs (SDPs)\n• Emerging Learners & Peer Learning initiatives\n• Product development by students\n• \"Weekend with Alumni\" networking sessions"
            },
            // --- Best Practices (Data Science) ---
            {
                keywords: ['vibe learning', 'harmony 360', 'bond beyond', 'industry pulse', 'linkedin empowerment', 'data science best'],
                answer: "SVIT Dept. of CSE (Data Science) Best Practices:\n• Vibe Learning — experiential & gamified learning\n• Peer-to-Peer Mentoring\n• Harmony 360° & Student-Led UHV community initiatives (NSS, SDGs, heritage/food walks)\n• Project-Based Learning\n• Industrial Conclave\n• Bond Beyond Years — alumni networking\n• Departmental hackathons\n• Active Library Integration\n• Industry Pulse — faculty-led webinar series\n• Headlines to Trend Lines\n• LinkedIn Empowerment for career branding"
            },
            // --- Best Practices (Civil Engineering) ---
            {
                keywords: ['civil best practice', 'civil engineering practice', 'survey camp', 'virtual lab'],
                answer: "SVIT Dept. of Civil Engineering Best Practices:\n• Study blogs & YouTube tutorials\n• Industrial visits & survey camps\n• Software training programs (AutoCAD, Revit)\n• Workshops on recent trends\n• Mentorship programs & technical clubs\n• Ideathons, hackathons & industrial conclaves\n• Alumni interactions & virtual labs\n• Student development programs & expert talks"
            }
        ]; */ // end of commented-out old inline array — data now loaded from src/data/svitKnowledgeBase.json

        function findPredefinedAnswer(query) {
            const normalized = query.toLowerCase();
            // Anti-hallinguation guard: cutoff / seat / fee-concession queries
            const antiHallucinationKeywords = ['cutoff', 'cut off', 'rank', 'seat availability', 'seat allotment', 'fee concession', 'custom fee', 'counselling round', 'category'];
            if (antiHallucinationKeywords.some(function (kw) { return normalized.includes(kw); })) {
                return window.__SVIT_KB__ && window.__SVIT_KB__.chatbot
                    ? window.__SVIT_KB__.chatbot.antiHallucinationFallback
                    : "I can only share verified SVIT information. For cutoff ranks, seat availability, or fee concessions, contact SVIT Admissions at +91 8028468191 or +91 9108575191, or email info@saividya.ac.in / admission@saividya.ac.in.";
            }
            for (let i = 0; i < predefinedQA.length; i++) {
                const entry = predefinedQA[i];
                const matched = entry.keywords.some(function (kw) {
                    return normalized.includes(kw);
                });
                if (matched) {
                    return entry.answer;
                }
            }
            return window.__SVIT_KB__ && window.__SVIT_KB__.chatbot
                ? window.__SVIT_KB__.chatbot.fallbackMessage
                : "I can answer questions about SVIT — Admissions, Courses, Fees, Timings, Library, Events, Clubs, Accreditations, Leadership, Contact details, Placements & Internships, and Mechanical Engineering best practices. Try clicking a quick chip or type your question!";
        }

        function appendUserBubble(text) {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-start justify-end gap-2 max-w-[88%] ml-auto';

            const bubble = document.createElement('div');
            bubble.className = 'bg-brand-600 text-white p-3 rounded-2xl rounded-tr-none text-xs shadow-sm break-words';
            bubble.textContent = text;

            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
            scrollToBottom();
        }

        function appendBotBubble(text) {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-start gap-2 max-w-[88%]';

            const avatar = document.createElement('div');
            avatar.className = 'w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 mt-0.5';
            avatar.innerHTML = '<i data-lucide="bot" class="w-3.5 h-3.5"></i>';

            const bubble = document.createElement('div');
            bubble.className = 'bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none text-slate-800 shadow-sm whitespace-pre-line break-words leading-relaxed';
            bubble.textContent = text;

            wrapper.appendChild(avatar);
            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
            lucide.createIcons();
            scrollToBottom();
        }

        function showTypingIndicator() {
            removeTypingIndicator();
            const indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'flex items-center gap-2 text-slate-500 text-xs py-1';
            indicator.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <i data-lucide="bot" class="w-3.5 h-3.5"></i>
                </div>
                <span class="animate-pulse">Bot is typing...</span>
            `;
            chatMessages.appendChild(indicator);
            lucide.createIcons();
            scrollToBottom();
        }

        function removeTypingIndicator() {
            const existing = document.getElementById('typing-indicator');
            if (existing) {
                existing.remove();
            }
        }

        function processQuestion(questionText) {
            const cleanText = questionText.trim();
            if (!cleanText) return;

            appendUserBubble(cleanText);
            showTypingIndicator();

            setTimeout(function () {
                removeTypingIndicator();
                const reply = findPredefinedAnswer(cleanText);
                appendBotBubble(reply);
            }, 450);
        }

        function handleChatSubmit(event) {
            event.preventDefault();
            const text = chatInput.value;
            chatInput.value = '';
            processQuestion(text);
        }

        function sendQuickQuestion(label) {
            if (!isChatOpen) {
                toggleChat();
            }
            processQuestion(label);
        }

        function askBotAbout(topic) {
            if (!isChatOpen) {
                toggleChat();
            }
            processQuestion(topic);
        }

        function handleFormSubmit(event) {
            event.preventDefault();
            const successBanner = document.getElementById('form-success');
            successBanner.classList.remove('hidden');
            event.target.reset();
            setTimeout(function () {
                successBanner.classList.add('hidden');
            }, 5000);
        }