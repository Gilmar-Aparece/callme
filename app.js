// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ════════════════════════════════════════════════
// NOVA SYSTEM PROMPT (Claude API)
// ════════════════════════════════════════════════
function buildSystemPrompt() {
  return `You are Nova, a friendly and professional AI interview assistant. Your ONLY job is to answer questions that the user (candidate) asks you.

CRITICAL RULES:
1. NEVER ask the user any questions — not follow-ups, not clarifications, nothing.
2. NEVER ask "What about you?" or "How about you?" or turn anything back to the user.
3. The user asks. You answer. That's it.
4. Keep answers concise and conversational — 2 to 4 sentences max.
5. Base your answers on the candidate's resume when relevant (e.g. if they ask about their experience or skills that appear in their resume).
6. If they greet you, respond warmly but do NOT ask anything back.
7. If they say goodbye or want to end, say a warm farewell.
8. You are speaking aloud so avoid bullet points, markdown, or lists — use natural spoken sentences only.

The candidate is applying for: ${jobTitle}

Their resume:
---
${resume}
---

Remember: User asks → Nova answers. Nova NEVER asks questions.`;
}

function getClosingMessage() {
  return "It was great talking with you! Best of luck — you're going to do great. Take care!";
}

function getOpeningMessage() {
  const greetings = [
    `Hi! I'm Nova, your interview assistant for the ${jobTitle} role. Feel free to ask me anything — about the role, your resume, or anything on your mind.`,
    `Hello! I'm Nova. I've looked over your resume and I'm here to help with your ${jobTitle} interview prep. What would you like to know?`,
    `Hey there! Nova here. I'm ready to help you with your ${jobTitle} interview. Go ahead and ask me anything!`,
  ];
  return pickRandom(greetings);
}


let resume = "";
let resumeFile = null;
let jobTitle = "Web Developer";
let candidateName = "";

function extractNameFromResume(text) {
  // Try first non-empty line — resumes almost always start with the candidate's name
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    // Skip lines that look like headers, emails, phones, or URLs
    if (/[@|http|linkedin|github|^\+?\d]/i.test(line)) continue;
    // Must be 2–4 words, each starting with a capital letter (a name)
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z]/.test(w))) {
      return words[0]; // return first name only
    }
  }
  return "";
}
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
let voicePreset = "default";

const VOICE_PRESETS = {
  "default":     { rate: 1.0,  pitch: 1.05, match: [/samantha|karen|victoria|zira|google.*female/i, /en-(US|GB)/i] },
  "siri-female": { rate: 1.0,  pitch: 1.15, match: [/samantha|karen|victoria|zira|female|en-us/i, /en-(US|GB)/i] },
  "siri-male":   { rate: 0.98, pitch: 0.85, match: [/daniel|fred|aaron|david|male|en-gb/i, /en-(US|GB)/i] },
  "robotic":     { rate: 0.85, pitch: 0.3,  match: [/google uk english male|en-gb.*male|male/i, /en/i] },
  "calm":        { rate: 0.92, pitch: 0.95, match: [/samantha|moira|karen|female/i, /en-(US|GB|AU)/i] },
};


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

// ════════════════════════════════════════════════
// RESUME UPLOAD INTRO (spoken by Nova on setup screen)
// ════════════════════════════════════════════════
function speakResumeIntro(name) {
  // Show Nova preview card on setup screen
  const card = document.getElementById('nova-preview-card');
  if (card) {
    const nameStr = name ? name : "there";
    const msgs = [
      `Hi ${nameStr}! I've read your resume. I'll be asking you questions based on your background — your experience, your stack, and your projects. Ready when you are!`,
      `Hey ${nameStr}! Resume loaded. I'll tailor every question to your actual experience. Just hit Start whenever you're ready.`,
      `Got it, ${nameStr}! I've gone through your resume. I'll base all my questions on your real background. Let's make this feel like the real deal.`,
      `Nice to meet you, ${nameStr}! I've read through your resume and I'm ready to run your mock interview. I'll focus on your experience and skills. Hit Start when you're set!`,
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    card.textContent = msg;
    card.classList.remove('hidden');

    // speak it (uses the synth — no mic needed on setup screen)
    const u = new SpeechSynthesisUtterance(msg);
    u.rate = 1.0; u.pitch = 1.05; u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => /samantha|karen|victoria|zira|google.*female/i.test(v.name))
           || voices.find(v => /en-(US|GB)/i.test(v.lang));
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        const v2 = window.speechSynthesis.getVoices().find(v => /samantha|karen|zira/i.test(v.name));
        if (v2) u.voice = v2;
        window.speechSynthesis.speak(u);
      }, { once: true });
    } else {
      window.speechSynthesis.speak(u);
    }
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
    candidateName = extractNameFromResume(text);
    document.getElementById('resume-text').value = text;
    setDropZoneState('done', file.name, text.length);
    speakResumeIntro(candidateName);
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

  const preset = VOICE_PRESETS[voicePreset] || VOICE_PRESETS.default;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = preset.rate; u.pitch = preset.pitch; u.volume = 1;

  const pickVoice = () => {
    const voices = synth.getVoices();
    let v = null;
    for (const pattern of preset.match) {
      v = voices.find(v => pattern.test(v.name) || pattern.test(v.lang));
      if (v) break;
    }
    if (v) u.voice = v;
  };
  pickVoice();

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    aiCaption = ""; status = "idle"; syncCallUI(); onDone?.();
  };

  u.onend = finish;
  u.onerror = finish;

  // Fallback: some browsers silently fail to fire onend/onerror.
  // Estimate ~190ms per word (min 4s, max 30s) and force progress if stuck.
  const estMs = Math.min(30000, Math.max(4000, text.split(/\s+/).length * 380));
  setTimeout(finish, estMs);

  // If voices aren't loaded yet (common on first load in Chrome/Android),
  // wait for them, then speak.
  if (synth.getVoices().length === 0) {
    let spoken = false;
    const doSpeak = () => {
      if (spoken) return;
      spoken = true;
      pickVoice();
      synth.speak(u);
    };
    synth.addEventListener("voiceschanged", doSpeak, { once: true });
    // Safety: if voiceschanged never fires, speak anyway after a short wait
    setTimeout(doSpeak, 300);
  } else {
    synth.speak(u);
  }
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
// CLAUDE API — Nova answers user questions
// ════════════════════════════════════════════════
async function handleSpeak(userText) {
  status = "thinking"; syncCallUI();
  messages.push({ role: "user", text: userText }); renderMessages();

  // Detect goodbye
  const endWords = ["goodbye","end session","stop interview","that's all","i'm done","finish","end the call","bye","see you"];
  if (endWords.some(w => userText.toLowerCase().includes(w))) {
    const bye = getClosingMessage();
    messages.push({ role:"assistant", text:bye }); renderMessages();
    speak(bye, () => endToEnded());
    return;
  }

  try {
    // Build conversation history for the API
    const apiMessages = messages.map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: buildSystemPrompt(),
        messages: apiMessages
      })
    });

    const data = await response.json();
    const aiText = (data.content || []).map(b => b.type === "text" ? b.text : "").join("").trim()
      || "I'm not sure about that — could you try rephrasing?";

    messages.push({ role:"assistant", text:aiText }); renderMessages();
    speak(aiText, () => setTimeout(startListen, 400));
  } catch (err) {
    const fallback = "Sorry, I had a connection issue. Please try again.";
    messages.push({ role:"assistant", text:fallback }); renderMessages();
    speak(fallback, () => setTimeout(startListen, 400));
  }
}

async function startCall() {
  resume = document.getElementById('resume-text').value.trim();
  if (!resume) {
    const e = document.getElementById('setup-error');
    e.textContent = "Please upload your resume or paste your background first.";
    e.classList.remove('hidden'); return;
  }

  // Unlock speech synthesis on mobile browsers — must happen inside a
  // direct user-gesture handler (this click), not inside a setTimeout.
  try {
    synth.cancel();
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.volume = 0;
    synth.speak(unlock);
  } catch {}
  jobTitle = document.getElementById('job-title').value || "Web Developer";
  messages = []; elapsed = 0;

  showScreen('call-screen');
  maybeShowTips();

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
  candidateName = extractNameFromResume(resume);
  if (resumeFile) { resumeFile = null; setDropZoneState('idle'); }
});

// ════════════════════════════════════════════════
// VOICE PICKER
// ════════════════════════════════════════════════
const voiceSelectSetup = document.getElementById('voice-select');
const voiceSelectCall  = document.getElementById('voice-select-call');
const voicePopover     = document.getElementById('voice-popover');
const btnVoice         = document.getElementById('btn-voice');

function setVoicePreset(val) {
  voicePreset = val;
  if (voiceSelectSetup) voiceSelectSetup.value = val;
  if (voiceSelectCall) voiceSelectCall.value = val;
  try { localStorage.setItem('novaVoicePreset', val); } catch {}
}

// Restore saved preference
try {
  const saved = localStorage.getItem('novaVoicePreset');
  if (saved && VOICE_PRESETS[saved]) setVoicePreset(saved);
} catch {}

voiceSelectSetup?.addEventListener('change', e => setVoicePreset(e.target.value));
voiceSelectCall?.addEventListener('change', e => {
  setVoicePreset(e.target.value);
  voicePopover.classList.add('hidden');
  // Preview the new voice
  speak("This is how I'll sound now.");
});

btnVoice?.addEventListener('click', () => {
  voicePopover.classList.toggle('hidden');
});

// Close popover when tapping elsewhere
document.addEventListener('click', e => {
  if (!voicePopover || voicePopover.classList.contains('hidden')) return;
  if (!voicePopover.contains(e.target) && e.target !== btnVoice) {
    voicePopover.classList.add('hidden');
  }
});

// ════════════════════════════════════════════════
// TIPS / HELP OVERLAY
// ════════════════════════════════════════════════
const tipsOverlay   = document.getElementById('tips-overlay');
const tipsClose     = document.getElementById('tips-close');
const tipsDontShow  = document.getElementById('tips-dont-show');
const btnHelp       = document.getElementById('btn-help');

function showTips() {
  if (tipsOverlay) tipsOverlay.classList.remove('hidden');
}
function hideTips() {
  if (tipsOverlay) tipsOverlay.classList.add('hidden');
}
function maybeShowTips() {
  let dontShow = false;
  try { dontShow = localStorage.getItem('novaTipsDismissed') === 'true'; } catch {}
  if (!dontShow) showTips();
}

tipsClose?.addEventListener('click', () => {
  try {
    if (tipsDontShow?.checked) localStorage.setItem('novaTipsDismissed', 'true');
  } catch {}
  hideTips();
});

btnHelp?.addEventListener('click', () => showTips());
