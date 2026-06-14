// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// SCRIPTED QUESTION BANK (no API — fully offline)
// ════════════════════════════════════════════════

// Reactions said BEFORE asking the next question — randomized so it feels natural
const REACTIONS = [
  "Got it, thanks for sharing that.",
  "Nice, that's good to know.",
  "Interesting, I appreciate the detail.",
  "Okay, that makes sense.",
  "Cool, thanks for walking me through that.",
  "Good to hear.",
  "Alright, noted.",
  "That's helpful context, thank you.",
];

// Personal / icebreaker questions
const ICEBREAKERS = [
  "Tell me a little about yourself and your background.",
  "What's your favorite color, and why does that one stand out to you?",
  "Do you have a favorite color? I'd love to know why you picked it.",
  "Just a fun one — what's your favorite color and what makes you like it?",
  "What do you enjoy doing outside of work?",
  "What's your favorite programming language to work in, and why?",
  "If you could only use one tool for the rest of your career, what would it be, and why?",
  "What's something you're proud of that isn't on your resume?",
  "What's your favorite food, and why does it stand out to you?",
  "If you had a free weekend with no plans, how would you spend it?",
  "What's a hobby of yours, and how did you get into it?",
  "What's your favorite movie or show, and what do you like about it?",
  "Do you have a favorite season? What makes it your favorite?",
  "What's something that always makes you laugh?",
  "If you could travel anywhere right now, where would you go and why?",
  "What's a small thing that makes your day better?",
];

// Team contribution questions
const CONTRIBUTION = [
  "How do you think you can contribute to our team?",
  "What unique strengths would you bring to this team?",
  "How do you usually add value beyond just your own tasks?",
  "If you joined this team tomorrow, what's the first thing you'd want to help with?",
  "What kind of role do you naturally take on in a team — leader, supporter, problem-solver?",
  "How do you help teammates who are stuck or struggling with something?",
  "What would your past coworkers say you bring to a team?",
  "How do you make sure your work fits well with what the rest of the team is doing?",
];

// Teamwork & collaboration questions
const TEAMWORK = [
  "How do you usually collaborate with your team on a project?",
  "What tools does your team use for communication and task tracking, like Slack or Jira?",
  "Tell me about a time you disagreed with a teammate. How did you handle it?",
  "How do you handle code reviews, both giving and receiving feedback?",
  "How do you stay in sync with designers or product managers during a project?",
  "Describe how a typical standup or team meeting goes for you.",
  "How do you support a teammate who's falling behind on their tasks?",
  "Tell me about a successful team project you were part of. What made it work well?",
  "How do you handle it when a teammate's work depends on something you haven't finished yet?",
];

// Debugging / problem solving — always followed by a duration question
const DEBUGGING = [
  "Tell me about a tricky bug you've fixed recently. What was the issue?",
  "Walk me through a time something broke in production. How did you find the root cause?",
  "What's the hardest technical problem you've solved in your last role?",
  "Have you ever dealt with a performance issue? What did you do to fix it?",
  "Tell me about a bug that took longer than expected to fix. What made it difficult?",
  "Describe a time you had to debug code that someone else wrote.",
];
const DURATION_FOLLOWUPS = [
  "How long did it take you to fix that?",
  "Roughly how many days did that take from start to finish?",
  "Was that something you fixed in a few hours, or did it stretch over days?",
  "How long were you working on that issue before it was resolved?",
  "Looking back, how many days would you say that bug cost you?",
];

// Project timeline / ownership questions
const TIMELINE = [
  "Tell me about a project where you owned the timeline. How did you plan it out?",
  "Have you ever had to push back on a deadline? How did that conversation go?",
  "Looking back at a past project, what would you do differently?",
  "How do you prioritize tasks when everything feels urgent?",
  "Tell me about a project that took longer than planned. What happened?",
  "How do you estimate how long a task or feature will take you?",
];

// HR / behavioral questions
const HR = [
  "What would you say is your biggest strength?",
  "What's an area you're actively working to improve?",
  "Why are you interested in this role?",
  "Where do you see yourself in a few years?",
  "What kind of work environment helps you do your best work?",
  "What motivates you to do your best work?",
  "Tell me about a time you received tough feedback. How did you respond?",
  "What are you looking for in your next role that you don't have now?",
];

// Tech-specific question pools, keyed by keyword found in resume
const TECH_QUESTIONS = {
  php:        ["Tell me about a project where you used PHP. What did you build?", "How do you handle errors and exceptions in your PHP code?"],
  laravel:    ["What do you like about working with Laravel?", "Have you worked with Laravel's Eloquent ORM? Tell me about that."],
  javascript: ["How comfortable are you with JavaScript, and what's a project you used it in?", "Do you prefer working with vanilla JavaScript or a framework, and why?"],
  vue:        ["Tell me about your experience working with Vue.js.", "How do you manage state in a Vue application?"],
  react:      ["Tell me about a React project you've worked on.", "How do you manage state in your React applications — hooks, context, or something else?"],
  node:       ["What kind of backend work have you done with Node.js?", "How do you structure a Node.js API project?"],
  mysql:      ["How do you approach designing a database schema in MySQL?", "Tell me about a time you had to optimize a slow database query."],
  sql:        ["How would you describe your SQL skills, and where have you used them?", "Tell me about a time you had to optimize a slow query."],
  docker:     ["How have you used Docker in your past projects?", "Walk me through how you'd containerize an application you've built."],
  aws:        ["What AWS services have you worked with?", "Tell me about deploying an application to AWS."],
  git:        ["How do you use Git in your day-to-day workflow?", "Tell me about a time a merge conflict gave you trouble."],
  api:        ["Tell me about an API you've built or worked with.", "How do you approach designing a REST API?"],
  python:     ["Tell me about a project where you used Python.", "What Python libraries or frameworks do you use most often?"],
  css:        ["How do you approach responsive design and styling?", "What's your go-to approach for CSS — plain CSS, Sass, Tailwind, or something else?"],
  html:       ["How do you ensure your HTML is accessible and semantic?", "Tell me about a project where front-end structure mattered a lot."],
};

// Build a flow of question "slots" — types in rough rotation order
const QUESTION_FLOW = ["icebreaker", "tech", "teamwork", "debugging", "tech", "contribution", "timeline", "hr", "teamwork", "tech", "contribution", "hr"];

let questionIndex = 0;
let usedTech = [];
let pendingDurationFollowup = false;

function pickRandom(arr, exclude) {
  const pool = exclude ? arr.filter(x => !exclude.includes(x)) : arr;
  return pool[Math.floor(Math.random() * pool.length)] || arr[Math.floor(Math.random() * arr.length)];
}

function detectTechFromResume() {
  const text = (resume || "").toLowerCase();
  return Object.keys(TECH_QUESTIONS).filter(k => text.includes(k));
}

function getNextQuestion() {
  // If we owe a duration follow-up from a debugging answer, ask it first
  if (pendingDurationFollowup) {
    pendingDurationFollowup = false;
    return pickRandom(DURATION_FOLLOWUPS);
  }

  const slot = QUESTION_FLOW[questionIndex % QUESTION_FLOW.length];
  questionIndex++;

  switch (slot) {
    case "icebreaker":
      return pickRandom(ICEBREAKERS);
    case "contribution":
      return pickRandom(CONTRIBUTION);
    case "teamwork":
      return pickRandom(TEAMWORK);
    case "timeline":
      return pickRandom(TIMELINE);
    case "hr":
      return pickRandom(HR);
    case "debugging":
      pendingDurationFollowup = true; // ask duration right after this is answered
      return pickRandom(DEBUGGING);
    case "tech": {
      const found = detectTechFromResume();
      if (found.length === 0) return pickRandom(ICEBREAKERS); // fallback if resume has no recognized tech
      const key = pickRandom(found, usedTech.length < found.length ? usedTech : []);
      usedTech.push(key);
      return pickRandom(TECH_QUESTIONS[key]);
    }
    default:
      return pickRandom(ICEBREAKERS);
  }
}

function getClosingMessage() {
  return "That was an excellent session! You spoke with real confidence and depth. Keep practicing out loud — you're going to do great in the real interview. Good luck!";
}

function getOpeningMessage() {
  const greetings = [
    `Hi, I'm Nova. Great to have you here for this ${jobTitle} interview practice.`,
    `Hello! I'm Nova, and I'll be running your mock interview for the ${jobTitle} role today.`,
    `Hi there, I'm Nova. Let's get started with your ${jobTitle} interview practice.`,
  ];
  return pickRandom(greetings) + " " + pickRandom(ICEBREAKERS);
}


let resume = "";
let resumeFile = null;
let jobTitle = "Web Developer";
let messages = [];
let status = "idle";    // idle | listening | thinking | speaking
let liveText = "";
let interimText = "";
let volume = 0;
let elapsed = 0;
let aiCaption = "";

let recInstance = null;
const synth = window.speechSynthesis;
let silenceTimer = null;
let animFrame = null;
let analyser = null;
let stream = null;
let timerInterval = null;
let startTime = null;
let orbAnimFrame = null;

const STATUS_LABEL = { idle:"Tap to speak", listening:"Listening…", thinking:"Nova is thinking…", speaking:"Nova is speaking…" };
const STATUS_COLOR = { idle:"#475569", listening:"#f472b6", thinking:"#34d399", speaking:"#818cf8" };
const ORB_COLOR   = { idle:"#334155", listening:"#f472b6", thinking:"#34d399", speaking:"#818cf8" };
const ORB_GLOW    = { idle:"#1e293b", listening:"#db2777", thinking:"#10b981", speaking:"#6366f1" };

// ════════════════════════════════════════════════
// SCREEN HELPERS
// ════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ════════════════════════════════════════════════
// ORB VISUALIZER
// ════════════════════════════════════════════════
const BARS = 36, R = 54, CX = 84, CY = 84;

function drawOrb() {
  const color = ORB_COLOR[status];
  const glow  = ORB_GLOW[status];
  const isL = status === "listening";
  const isS = status === "speaking";
  const isT = status === "thinking";
  const t = Date.now();

  // gradient stop colors
  const g = document.querySelector('#g1 stop:first-child');
  const g2 = document.querySelector('#g1 stop:last-child');
  if (g) g.setAttribute('stop-color', color);
  if (g2) g2.setAttribute('stop-color', glow);

  // rings
  const ringsEl = document.getElementById('orb-rings');
  if (ringsEl) {
    if (isL || isS) {
      ringsEl.innerHTML = [1,2,3].map(i => {
        const r2 = R + 12 + i*16 + (isL ? Math.min(volume*0.35, 16) : 0);
        const opacs = ["22","18","0e"];
        return `<circle cx="${CX}" cy="${CY}" r="${r2}" fill="none"
          stroke="${color}${opacs[i-1]}" stroke-width="1.5"
          style="animation:rp ${1.3+i*0.35}s ease-out infinite;animation-delay:${i*0.22}s" />`;
      }).join('');
    } else {
      ringsEl.innerHTML = '';
    }
  }

  // bars
  const barsEl = document.getElementById('orb-bars');
  if (barsEl) {
    let html = '';
    for (let i = 0; i < BARS; i++) {
      const a = (i/BARS)*Math.PI*2 - Math.PI/2;
      const noise = isL ? Math.sin(t/110+i*0.9)*volume*0.28
                  : isS ? Math.sin(t/85+i*1.2)*9
                  : isT ? Math.sin(t/190+i*0.6)*4 : 0;
      const len = 5 + Math.max(0, noise);
      const x1 = CX+Math.cos(a)*(R+5), y1 = CY+Math.sin(a)*(R+5);
      const x2 = CX+Math.cos(a)*(R+5+len), y2 = CY+Math.sin(a)*(R+5+len);
      const op = (isL||isS||isT) ? 0.75 : 0.18;
      html += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
        stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity="${op}" />`;
    }
    barsEl.innerHTML = html;
  }

  // emoji
  const emojiEl = document.getElementById('orb-emoji');
  if (emojiEl) emojiEl.textContent = isL?"🎙":isS?"🔊":isT?"💭":"✦";

  orbAnimFrame = requestAnimationFrame(drawOrb);
}

// ════════════════════════════════════════════════
// UI SYNC
// ════════════════════════════════════════════════
function syncCallUI() {
  // status label + color
  const sl = document.getElementById('status-label');
  if (sl) { sl.textContent = STATUS_LABEL[status]; sl.style.color = STATUS_COLOR[status]; }

  // ambient blob
  const blob = document.getElementById('ambient-blob');
  if (blob) blob.style.background = `radial-gradient(circle,${STATUS_COLOR[status]}16 0%,transparent 72%)`;

  // ai caption
  const captBox = document.getElementById('ai-caption-box');
  const captTxt = document.getElementById('ai-caption-text');
  if (captBox && captTxt) {
    if (aiCaption) { captBox.classList.remove('hidden'); captTxt.textContent = aiCaption; }
    else captBox.classList.add('hidden');
  }

  // live transcript
  const lt = document.getElementById('live-transcript');
  const lf = document.getElementById('live-final');
  const li = document.getElementById('live-interim');
  if (lt && lf && li) {
    if (liveText || interimText) { lt.classList.remove('hidden'); lf.textContent = liveText; li.textContent = interimText; }
    else lt.classList.add('hidden');
  }

  // mic button
  const btn = document.getElementById('mic-btn');
  const hint = document.getElementById('mic-hint');
  if (btn) {
    btn.textContent = status==="listening"?"⏹":status==="speaking"?"⏩":"🎙";
    if (status==="listening") {
      btn.style.background = "linear-gradient(135deg,#db2777,#f472b6)";
      btn.style.boxShadow = "0 0 0 3px rgba(244,114,182,0.28),0 8px 24px rgba(219,39,119,0.38)";
    } else if (status==="speaking") {
      btn.style.background = "linear-gradient(135deg,#6366f1,#818cf8)";
      btn.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.22),0 8px 24px rgba(124,58,237,0.32)";
    } else {
      btn.style.background = "linear-gradient(135deg,#7c3aed,#a855f7)";
      btn.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.22),0 8px 24px rgba(124,58,237,0.32)";
    }
  }
  if (hint) {
    hint.textContent = status==="listening"
      ? 'Pause to submit · tap ⏹ to cancel'
      : status==="speaking"
      ? 'Tap ⏩ to interrupt'
      : 'Tap mic to speak · "goodbye" to end';
  }
}

function renderMessages() {
  const hist = document.getElementById('msg-history');
  if (!hist) return;
  const recent = messages.slice(-6);
  hist.innerHTML = recent.map(m => `
    <div class="msg-bubble-wrap ${m.role}">
      <div class="msg-bubble ${m.role}">${m.text}</div>
    </div>`).join('');
  hist.scrollTop = hist.scrollHeight;
}

function setCallError(msg) {
  const el = document.getElementById('call-error');
  if (!el) return;
  if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

function fmtTime(s) {
  return String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0");
}

// ════════════════════════════════════════════════
// FILE EXTRACTION
// ════════════════════════════════════════════════
async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    if (!window.pdfjsLib) {
      await new Promise((res,rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(" ") + "\n";
    }
    return text.trim();
  }

  if (ext === "docx") {
    if (!window.mammoth) {
      await new Promise((res,rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return result.value.trim();
  }

  if (ext === "txt") return await file.text();

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

function setDropZoneState(state, filename, chars) {
  document.getElementById('dz-idle').style.display    = state==='idle'    ? '' : 'none';
  document.getElementById('dz-loading').style.display = state==='loading' ? '' : 'none';
  document.getElementById('dz-done').style.display    = state==='done'    ? '' : 'none';
  const dz = document.getElementById('drop-zone');
  dz.classList.remove('dragover','done');
  if (state==='done') {
    dz.classList.add('done');
    document.getElementById('dz-filename').textContent = filename || '';
    document.getElementById('dz-chars').textContent = `${chars} characters extracted · Click to replace`;
  }
}

async function handleFile(file) {
  if (!file) return;
  setDropZoneState('loading');
  document.getElementById('setup-error').classList.add('hidden');
  try {
    const text = await extractTextFromFile(file);
    if (!text || text.length < 30) throw new Error("Could not read text from file. Try copy-pasting instead.");
    resume = text;
    resumeFile = file;
    document.getElementById('resume-text').value = text;
    setDropZoneState('done', file.name, text.length);
  } catch(e) {
    setDropZoneState('idle');
    const errEl = document.getElementById('setup-error');
    errEl.textContent = e.message || "Failed to read file.";
    errEl.classList.remove('hidden');
  }
}

// ════════════════════════════════════════════════
// AUDIO VISUALIZER
// ════════════════════════════════════════════════
async function startViz() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser(); an.fftSize = 128;
    src.connect(an); analyser = an;
    const d = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      an.getByteFrequencyData(d);
      volume = d.reduce((a,b) => a+b, 0) / d.length;
      animFrame = requestAnimationFrame(tick);
    };
    tick();
  } catch { setCallError("Mic access denied. Allow microphone in browser settings."); }
}

function stopViz() {
  cancelAnimationFrame(animFrame);
  stream?.getTracks().forEach(t => t.stop());
  volume = 0;
}

// ════════════════════════════════════════════════
// TTS
// ════════════════════════════════════════════════
function speak(text, onDone) {
  synth.cancel();
  aiCaption = text; status = "speaking"; syncCallUI();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 1.05; u.volume = 1;
  const voices = synth.getVoices();
  const v = voices.find(v => /samantha|karen|victoria|zira|google.*female/i.test(v.name))
    || voices.find(v => /en-(US|GB)/i.test(v.lang));
  if (v) u.voice = v;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    aiCaption = ""; status = "idle"; syncCallUI(); onDone?.();
  };

  u.onend = finish;
  u.onerror = finish;

  // Fallback: some browsers (esp. mobile) silently fail to fire onend/onerror.
  // Estimate ~110ms per word (min 4s) and force progress if TTS gets stuck.
  const estMs = Math.max(4000, text.split(/\s+/).length * 380);
  setTimeout(finish, estMs);

  synth.speak(u);

  // Extra guard: if speech never actually starts (some Android WebViews),
  // bail out quickly so the conversation doesn't hang.
  setTimeout(() => {
    if (!done && !synth.speaking && !synth.pending) finish();
  }, 600);
}

// ════════════════════════════════════════════════
// STT
// ════════════════════════════════════════════════
function startListen() {
  if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
    setCallError("Use Google Chrome for voice recognition."); return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
  recInstance = rec;
  let buf = "";

  rec.onstart = () => {
    status = "listening"; interimText = ""; liveText = "";
    syncCallUI(); startViz();
  };

  rec.onresult = e => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t2 = e.results[i][0].transcript;
      e.results[i].isFinal ? (final += t2) : (interim += t2);
    }
    if (final) { buf += " " + final; liveText = buf.trim(); }
    interimText = interim; syncCallUI();
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => { if (buf.trim().length > 2) rec.stop(); }, 2200);
  };

  rec.onend = () => {
    stopViz(); clearTimeout(silenceTimer);
    const said = buf.trim(); interimText = ""; liveText = ""; syncCallUI();
    if (said.length > 2 && !["thinking","speaking"].includes(status)) handleSpeak(said);
    else if (said.length <= 2) { status = "idle"; syncCallUI(); }
    buf = "";
  };

  rec.onerror = e => {
    stopViz();
    if (!["no-speech","aborted"].includes(e.error)) setCallError("Mic error: " + e.error);
    status = "idle"; syncCallUI();
  };

  rec.start();
}

function stopListen() {
  recInstance?.stop(); synth.cancel(); stopViz();
  clearTimeout(silenceTimer);
  status = "idle"; interimText = ""; liveText = "";
  syncCallUI();
}

// ════════════════════════════════════════════════
// SCRIPTED INTERVIEW LOGIC (no API)
// ════════════════════════════════════════════════
function handleSpeak(userText) {
  status = "thinking"; syncCallUI();
  const userMsg = { role: "user", text: userText };
  messages.push(userMsg); renderMessages();

  const endWords = ["goodbye","end session","stop interview","that's all","i'm done","finish","end the call","stop","quit"];
  if (endWords.some(w => userText.toLowerCase().includes(w))) {
    const bye = getClosingMessage();
    messages.push({ role:"assistant", text:bye }); renderMessages();
    speak(bye, () => endToEnded());
    return;
  }

  // Friendly greeting handling — only on the very first user message
  const greetWords = ["hello","hi","hey","good morning","good afternoon","good evening"];
  const isGreeting = greetWords.some(w => userText.toLowerCase().trim().startsWith(w));
  if (isGreeting && messages.filter(m => m.role === "user").length === 1) {
    setTimeout(() => {
      const greetReplies = [
        "Hey there! Glad you're here.",
        "Hi! Nice to meet you.",
        "Hello! Thanks for joining.",
      ];
      const aiText = pickRandom(greetReplies) + " " + getNextQuestion();
      messages.push({ role:"assistant", text:aiText }); renderMessages();
      speak(aiText, () => setTimeout(startListen, 400));
    }, 400 + Math.random() * 400);
    return;
  }

  // Small natural delay so it doesn't feel instant/robotic
  setTimeout(() => {
    const reaction = pickRandom(REACTIONS);
    const nextQuestion = getNextQuestion();
    const aiText = reaction + " " + nextQuestion;
    messages.push({ role:"assistant", text:aiText }); renderMessages();
    speak(aiText, () => setTimeout(startListen, 400));
  }, 500 + Math.random() * 600);
}

async function startCall() {
  resume = document.getElementById('resume-text').value.trim();
  if (!resume) {
    const e = document.getElementById('setup-error');
    e.textContent = "Please upload your resume or paste your background first.";
    e.classList.remove('hidden'); return;
  }
  jobTitle = document.getElementById('job-title').value || "Web Developer";
  messages = []; elapsed = 0;
  questionIndex = 0; usedTech = []; pendingDurationFollowup = false;

  showScreen('call-screen');

  // resume badge
  const badge = document.getElementById('resume-badge');
  if (resumeFile) { badge.textContent = "📄 " + resumeFile.name; badge.style.display = ''; }
  else badge.style.display = 'none';

  // start timer
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('call-timer').textContent = fmtTime(elapsed);
  }, 1000);

  // start orb animation
  drawOrb();

  status = "thinking"; syncCallUI();
  setTimeout(() => {
    const opening = getOpeningMessage();
    messages.push({ role:"assistant", text:opening }); renderMessages();
    speak(opening, () => setTimeout(startListen, 300));
  }, 400 + Math.random() * 400);
}

function endToEnded() {
  stopListen(); clearInterval(timerInterval);
  cancelAnimationFrame(orbAnimFrame);

  // populate ended screen
  const userCount = messages.filter(m => m.role==="user").length;
  document.getElementById('ended-meta').textContent =
    `${fmtTime(elapsed)} · ${userCount} answers · Based on your resume`;

  const txBox = document.getElementById('transcript-box');
  const txEntries = document.getElementById('transcript-entries');
  if (messages.length > 0) {
    txBox.classList.remove('hidden');
    txEntries.innerHTML = messages.map(m => `
      <div class="tx-entry">
        <div class="tx-role ${m.role}">${m.role==="user"?"You":"Nova"}</div>
        <p class="tx-text">${m.text}</p>
      </div>`).join('');
  } else {
    txBox.classList.add('hidden');
  }

  showScreen('ended-screen');
}

function reset() {
  stopListen(); messages = []; elapsed = 0;
  resume = ""; resumeFile = null;
  setDropZoneState('idle');
  document.getElementById('resume-text').value = '';
  document.getElementById('setup-error').classList.add('hidden');
  cancelAnimationFrame(orbAnimFrame);
  showScreen('setup-screen');
}

// ════════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════════
document.getElementById('btn-start').addEventListener('click', startCall);
document.getElementById('btn-end').addEventListener('click', () => endToEnded());
document.getElementById('btn-again').addEventListener('click', startCall);
document.getElementById('btn-edit').addEventListener('click', reset);

document.getElementById('mic-btn').addEventListener('click', () => {
  if (status==="listening") stopListen();
  else if (status==="speaking") { synth.cancel(); aiCaption=""; status="idle"; syncCallUI(); setTimeout(startListen,200); }
  else startListen();
});

// File input
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });

// Resume text area also updates resume
document.getElementById('resume-text').addEventListener('input', e => {
  resume = e.target.value;
  if (resumeFile) { resumeFile = null; setDropZoneState('idle'); }
});
