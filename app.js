// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are Nova, an elite AI interview coach conducting a live spoken mock interview.

STRICT SPEAKING RULES:
- This is VOICE. Write ONLY natural spoken sentences. Zero markdown, zero bullet points, zero lists, no asterisks, no emojis.
- Keep every response under 60 words — short, spoken, natural.
- After each candidate answer: give one brief, specific reaction (refer back to something they actually said), then ask exactly one follow-up or next question.
- Be warm, sharp, curious. Sound human, not robotic. Vary your phrasing — don't reuse the same reaction words every turn.
- End when candidate says stop / goodbye / end / finish / done.

QUESTION TOPICS — rotate naturally across the conversation, picked based on {RESUME} and {JOB_TITLE}:
1. Personal / icebreaker: "tell me about yourself", hobbies, favorite color, favorite tech stack, what they enjoy outside work, etc. For light icebreaker questions like favorite color/food/hobby, these are just rapport-builders — react naturally to whatever the candidate says, don't overanalyze.
2. Technical depth tied to their actual resume: specific languages, frameworks, projects, and tools they listed (e.g. PHP, JavaScript, Laravel, Vue, databases, cloud platforms — whatever appears in {RESUME}).
3. Teamwork & collaboration: how they work with a team, how they communicate with designers/PMs/other devs, tools used (Slack, Jira, Git, code reviews, standups), how they handle disagreements or feedback.
4. Debugging & problem solving: ask about a specific bug or tough technical problem from their resume or experience. Always follow up with "How long did it take you to fix that?" or a similar natural question about the timeline (hours, days, a sprint, etc.) — get a real, specific duration.
5. Project timelines & ownership: deadlines, how they planned work, what they'd do differently.
6. HR / behavioral: strengths, weaknesses, why this role, salary expectations (if relevant), career goals.

GROUNDING RULE: Base technical and project questions on what's actually written in {RESUME} — reference real company names, technologies, and roles from it whenever possible. If {RESUME} is thin or generic, ask broader questions suited to {JOB_TITLE} and keep things realistic for that role.

CANDIDATE RESUME (base technical/project questions on this):
{RESUME}

ROLE THEY ARE APPLYING FOR: {JOB_TITLE}

Start with a warm 2-sentence greeting then immediately ask your first question — usually a light "tell me about yourself" or icebreaker — based on their resume and the role.`;

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
  u.onend = () => { aiCaption = ""; status = "idle"; syncCallUI(); onDone?.(); };
  u.onerror = () => { status = "idle"; syncCallUI(); onDone?.(); };
  synth.speak(u);
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
// AI
// ════════════════════════════════════════════════
async function handleSpeak(userText) {
  status = "thinking"; syncCallUI();
  const userMsg = { role: "user", text: userText };
  messages.push(userMsg); renderMessages();

  const endWords = ["goodbye","end session","stop interview","that's all","i'm done","finish","end the call","stop","quit"];
  if (endWords.some(w => userText.toLowerCase().includes(w))) {
    const bye = "That was an excellent session! You spoke with real confidence and depth. Keep practicing out loud — you're going to do great in the real interview. Good luck!";
    messages.push({ role:"assistant", text:bye }); renderMessages();
    speak(bye, () => endToEnded());
    return;
  }

  const sys = SYSTEM_PROMPT
    .replace("{RESUME}", resume || "No resume — treat as mid-level web developer.")
    .replace("{JOB_TITLE}", jobTitle);
  const apiMsgs = messages.map(m => ({ role: m.role==="assistant"?"assistant":"user", content: m.text }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:180, system:sys, messages:apiMsgs }),
    });
    const data = await res.json();
    const aiText = data.content?.map(b=>b.text||"").join("") || "Could you repeat that?";
    messages.push({ role:"assistant", text:aiText }); renderMessages();
    speak(aiText, () => setTimeout(startListen, 400));
  } catch {
    setCallError("Connection error. Tap mic to retry."); status = "idle"; syncCallUI();
  }
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
  const sys = SYSTEM_PROMPT.replace("{RESUME}", resume).replace("{JOB_TITLE}", jobTitle);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:130, system:sys,
        messages:[{role:"user",content:"Begin the interview."}] }),
    });
    const data = await res.json();
    const opening = data.content?.map(b=>b.text||"").join("") || "Hi! I'm Nova. Let's get started — tell me about yourself.";
    messages.push({ role:"assistant", text:opening }); renderMessages();
    speak(opening, () => setTimeout(startListen, 300));
  } catch {
    setCallError("Failed to connect. Check your network."); status = "idle"; syncCallUI();
  }
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
