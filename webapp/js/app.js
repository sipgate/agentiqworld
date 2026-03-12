/**
 * Agentiq Workshop - Frontend Application
 * 4-Panel demo for sipgate Flow WebSocket integration
 */

// ============================================================================
// Agent templates
// ============================================================================

const TEMPLATES = [
    {
        id: 'kundenservice',
        name: 'Kundenservice',
        description: 'Freundlicher Support-Agent für allgemeine Kundenanfragen',
        config: {
            systemPrompt: `Du bist ein freundlicher Kundenservice-Mitarbeiter bei einem Telekommunikationsunternehmen. Du beantwortest Fragen zu Tarifen, Rechnungen und Vertragslaufzeiten. Bei komplexen Anliegen leitest du an die Fachabteilung weiter. Bleibe stets höflich, geduldig und lösungsorientiert. Fasse dich kurz, du sprichst am Telefon. Wenn du etwas nicht weißt, sag es ehrlich und biete an, einen Kollegen hinzuzuziehen. Verwende keine Emojis, keine Aufzählungen und keine Formatierung. Antworte in kurzen, natürlich klingenden Sätzen.`,
            greeting: 'Hallo und willkommen bei unserem Kundenservice! Mein Name ist Halbot. Wie kann ich Ihnen heute helfen?',
            ttsProvider: 'azure',
            ttsVoice: 'de-DE-KatjaNeural',
            bargeIn: 'immediate',
            timeout: 8,
            llmModel: 'gemini-2.5-flash',
        },
    },
    {
        id: 'terminvereinbarung',
        name: 'Terminvereinbarung',
        description: 'Agent zur strukturierten Terminbuchung',
        config: {
            systemPrompt: `Du bist ein Terminplanungs-Assistent. Deine Aufgabe ist es, Termine mit Anrufern zu vereinbaren. Frage zuerst nach dem Grund des Termins, dann nach dem gewünschten Datum und der Uhrzeit, dann nach dem Namen des Anrufers. Fasse am Ende den Termin zusammen und bitte um Bestätigung. Termine sind nur Montag bis Freitag von neun bis siebzehn Uhr möglich. Wiederhole wichtige Details zur Bestätigung. Fasse dich kurz und sprich natürlich. Verwende keine Emojis, keine Aufzählungen und keine Formatierung.`,
            greeting: 'Guten Tag! Sie sind mit der Terminvereinbarung verbunden. Für welchen Anlass möchten Sie einen Termin buchen?',
            ttsProvider: 'azure',
            ttsVoice: 'de-DE-ConradNeural',
            bargeIn: 'minimum_characters',
            timeout: 10,
            llmModel: 'gemini-2.5-flash',
        },
    },
    {
        id: 'bestellhotline',
        name: 'Bestellhotline',
        description: 'Verkaufsagent für Produktberatung und Bestellungen',
        config: {
            systemPrompt: `Du bist ein Verkaufsberater an einer Bestellhotline. Du berätst Kunden zu Produkten und Tarifen und hilfst bei der Auswahl des passenden Angebots. Du nimmst Bestellungen entgegen, also Name, Adresse und gewünschtes Produkt. Bei Bedarf machst du Upselling-Vorschläge, aber sei nicht aufdringlich. Sei professionell aber warmherzig. Stelle gezielte Fragen um den Bedarf zu verstehen. Fasse Bestelldetails immer zusammen bevor du bestätigst. Sprich kurz und natürlich, das ist ein Telefongespräch. Verwende keine Emojis, keine Aufzählungen und keine Formatierung.`,
            greeting: 'Willkommen bei unserer Bestellhotline! Ich berate Sie gerne zu unseren Produkten. Wonach suchen Sie heute?',
            ttsProvider: 'azure',
            ttsVoice: 'de-DE-AmalaNeural',
            bargeIn: 'immediate',
            timeout: 8,
            llmModel: 'gemini-2.5-flash',
        },
    },
    {
        id: 'techsupport',
        name: 'Technischer Support',
        description: 'IT-Helpdesk für Fehlerdiagnose und Problemlösung',
        config: {
            systemPrompt: `Du bist ein technischer Support-Mitarbeiter. Deine Aufgabe ist es, Anrufern bei technischen Problemen zu helfen. Frage zuerst nach dem Problem und seit wann es besteht. Stelle dann gezielte Diagnosefragen zu Gerät, Betriebssystem und Fehlermeldung. Gib Anleitungen zur Lösung, aber immer nur einen Schritt auf einmal. Warte auf Rückmeldung bevor du weitermachst. Wenn das Problem nicht lösbar ist, leite an den Second-Level-Support weiter. Erkläre technische Begriffe verständlich. Bleib geduldig, auch wenn der Anrufer frustriert ist. Verwende keine Emojis, keine Aufzählungen und keine Formatierung. Antworte in kurzen, natürlich klingenden Sätzen.`,
            greeting: 'Hallo, hier ist der technische Support! Schildern Sie mir bitte kurz Ihr Problem, dann schauen wir gemeinsam nach einer Lösung.',
            ttsProvider: 'azure',
            ttsVoice: 'de-DE-BerndNeural',
            bargeIn: 'none',
            timeout: 12,
            llmModel: 'gemini-2.5-flash',
        },
    },
];

// ============================================================================
// Voice definitions
// ============================================================================

const VOICES = {
    azure: [
        { value: 'de-DE-KatjaNeural', label: 'Katja (DE, female)', language: 'de-DE' },
        { value: 'de-DE-ConradNeural', label: 'Conrad (DE, male)', language: 'de-DE' },
        { value: 'de-DE-AmalaNeural', label: 'Amala (DE, female)', language: 'de-DE' },
        { value: 'de-DE-BerndNeural', label: 'Bernd (DE, male)', language: 'de-DE' },
        { value: 'de-DE-ElkeNeural', label: 'Elke (DE, female)', language: 'de-DE' },
        { value: 'de-DE-KlarissaNeural', label: 'Klarissa (DE, female)', language: 'de-DE' },
        { value: 'en-US-JennyNeural', label: 'Jenny (EN, female)', language: 'en-US' },
        { value: 'en-US-GuyNeural', label: 'Guy (EN, male)', language: 'en-US' },
        { value: 'en-US-AriaNeural', label: 'Aria (EN, female)', language: 'en-US' },
    ],
    eleven_labs: [
        { value: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel' },
        { value: '29vD33N1CtxCmqQRPOHJ', label: 'Drew' },
        { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
        { value: 'pNInz6obpgDQGcFmaJgB', label: 'Adam' },
        { value: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam' },
    ]
};

// ============================================================================
// DOM references
// ============================================================================

const els = {
    templateSelect: document.getElementById('template-select'),
    systemPrompt: document.getElementById('system-prompt'),
    greeting: document.getElementById('greeting'),
    ttsProvider: document.getElementById('tts-provider'),
    ttsVoice: document.getElementById('tts-voice'),
    bargeIn: document.getElementById('barge-in'),
    timeout: document.getElementById('timeout'),
    llmModel: document.getElementById('llm-model'),
    geminiApiKey: document.getElementById('gemini-api-key'),
    anthropicApiKey: document.getElementById('anthropic-api-key'),
    deployBtn: document.getElementById('deploy-btn'),
    statusBadge: document.getElementById('status-badge'),
    connectionInfo: document.getElementById('connection-info'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatSend: document.getElementById('chat-send'),
    clearChat: document.getElementById('clear-chat'),
    codeContent: document.getElementById('code-content'),
    copyCode: document.getElementById('copy-code'),
    wsUrl: document.getElementById('ws-url'),
    copyUrl: document.getElementById('copy-url'),
    logEntries: document.getElementById('log-entries'),
    clearLogs: document.getElementById('clear-logs'),
    autoScroll: document.getElementById('auto-scroll'),
};

// ============================================================================
// State
// ============================================================================

let deployed = false;
let chatEnabled = false;
let logSource = null;
let rawCodeText = '';

// ============================================================================
// Template handling
// ============================================================================

function applyTemplate(templateId) {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const c = template.config;

    els.systemPrompt.value = c.systemPrompt;
    els.greeting.value = c.greeting;
    els.bargeIn.value = c.bargeIn;
    els.timeout.value = c.timeout;
    els.llmModel.value = c.llmModel;

    // Set TTS provider first, then update voice dropdown, then set voice
    els.ttsProvider.value = c.ttsProvider;
    updateVoiceOptions();
    els.ttsVoice.value = c.ttsVoice;

    updateCodePreview();
    saveSettings();
    toast(`Template "${template.name}" geladen`, 'success');
}

// ============================================================================
// Config helpers
// ============================================================================

function getConfig() {
    const provider = els.ttsProvider.value;
    const voiceOption = VOICES[provider]?.find(v => v.value === els.ttsVoice.value) || VOICES[provider]?.[0];

    const model = els.llmModel.value;
    const isGemini = model.startsWith('gemini');

    return {
        systemPrompt: els.systemPrompt.value,
        greeting: els.greeting.value,
        ttsProvider: provider,
        ttsVoice: voiceOption?.value || '',
        ttsLanguage: voiceOption?.language || 'de-DE',
        bargeIn: els.bargeIn.value,
        timeout: parseInt(els.timeout.value) || 8,
        model,
        llmProvider: isGemini ? 'gemini' : 'anthropic',
        geminiApiKey: els.geminiApiKey.value || undefined,
        anthropicApiKey: els.anthropicApiKey.value || undefined,
    };
}

// ============================================================================
// Voice dropdown
// ============================================================================

function updateVoiceOptions() {
    const provider = els.ttsProvider.value;
    const voices = VOICES[provider] || [];
    const currentValue = els.ttsVoice.value;

    els.ttsVoice.innerHTML = voices.map(v =>
        `<option value="${v.value}">${v.label}</option>`
    ).join('');

    // Try to keep current selection, otherwise pick first
    if (voices.some(v => v.value === currentValue)) {
        els.ttsVoice.value = currentValue;
    }

    updateCodePreview();
}

// ============================================================================
// Code generation
// ============================================================================

function escapeForTemplate(str) {
    return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function generateCode() {
    const c = getConfig();

    const ttsJson = c.ttsProvider === 'azure'
        ? `{ provider: "azure", language: "${c.ttsLanguage}", voice: "${c.ttsVoice}" }`
        : `{ provider: "eleven_labs", voice: "${c.ttsVoice}" }`;

    let bargeInJson;
    switch (c.bargeIn) {
        case 'minimum_characters':
            bargeInJson = '{ strategy: "minimum_characters", minimum_characters: 5 }'; break;
        case 'none':
            bargeInJson = '{ strategy: "none" }'; break;
        case 'manual':
            bargeInJson = '{ strategy: "manual" }'; break;
        default:
            bargeInJson = '{ strategy: "immediate" }';
    }

    const promptStr = escapeForTemplate(c.systemPrompt || 'Du bist ein hilfreicher Assistent.');
    const greetingStr = (c.greeting || '').replace(/"/g, '\\"');

    if (c.llmProvider === 'gemini') {
        return generateGeminiCode(c, ttsJson, bargeInJson, promptStr, greetingStr);
    }
    return generateAnthropicCode(c, ttsJson, bargeInJson, promptStr, greetingStr);
}

function generateAnthropicCode(c, ttsJson, bargeInJson, promptStr, greetingStr) {
    return `// -------------------------------------------------------
// sipgate Flow Agent — Anthropic Claude
// -------------------------------------------------------
// Voraussetzungen:
//   npm install @sipgate/ai-flow-sdk @anthropic-ai/sdk ws
//   export ANTHROPIC_API_KEY="sk-ant-..."
// -------------------------------------------------------

import { AiFlowAssistant } from "@sipgate/ai-flow-sdk";
import Anthropic from "@anthropic-ai/sdk";
import WebSocket from "ws";

// --- LLM-Client (liest ANTHROPIC_API_KEY aus der Umgebung) ---
const client = new Anthropic();

const SYSTEM_PROMPT = \`${promptStr}\`;

// Jeder Anruf bekommt eine eigene Session mit Chat-Verlauf
const sessions = new Map();

// --- TTS- und Barge-In-Konfiguration ---
const tts = ${ttsJson};
const barge_in = ${bargeInJson};

// --- Flow-Assistant mit Event-Handlern ---
const assistant = AiFlowAssistant.create({
  // Anruf startet: Begruessung senden
  onSessionStart: async (event) => {
    sessions.set(event.session.id, [{ role: "assistant", content: "${greetingStr}" }]);
    return {
      type: "speak",
      session_id: event.session.id,
      text: "${greetingStr}",
      user_input_timeout_seconds: ${c.timeout},
      tts,
      barge_in,
    };
  },

  // Nutzer hat gesprochen: an Claude weiterleiten
  onUserSpeak: async (event) => {
    const history = sessions.get(event.session.id) || [];
    history.push({ role: "user", content: event.text });

    // Anfrage an Claude mit dem gesamten Gespraechsverlauf
    const response = await client.messages.create({
      model: "${c.model}",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content[0].text;
    history.push({ role: "assistant", content: reply });

    // Antwort per TTS vorlesen lassen
    return {
      type: "speak",
      session_id: event.session.id,
      text: reply,
      user_input_timeout_seconds: ${c.timeout},
      tts,
      barge_in,
    };
  },

  // Stille: Nutzer hat nicht geantwortet
  onUserInputTimeout: async (event) => {
    return {
      type: "speak",
      session_id: event.session.id,
      text: "Sind Sie noch da?",
      user_input_timeout_seconds: ${c.timeout},
      tts,
    };
  },

  // Anruf beendet: Session aufraeumen
  onSessionEnd: async (event) => {
    sessions.delete(event.session.id);
    console.log("Call ended:", event.session.id);
    return null;
  },
});

// --- WebSocket-Server starten (hier verbindet sich sipgate flow) ---
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("sipgate flow connected");
  ws.on("message", assistant.ws(ws));
  ws.on("close", () => console.log("Disconnected"));
});

console.log("Agent running on ws://localhost:8080");`;
}

function generateGeminiCode(c, ttsJson, bargeInJson, promptStr, greetingStr) {
    return `// -------------------------------------------------------
// sipgate Flow Agent — Google Gemini
// -------------------------------------------------------
// Voraussetzungen:
//   npm install @sipgate/ai-flow-sdk @google/generative-ai ws
//   export GEMINI_API_KEY="AIza..."
// -------------------------------------------------------

import { AiFlowAssistant } from "@sipgate/ai-flow-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import WebSocket from "ws";

// --- LLM-Client (liest GEMINI_API_KEY aus der Umgebung) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "${c.model}",
  systemInstruction: \`${promptStr}\`,
});

// Gemini verwaltet den Chat-Verlauf intern pro startChat()-Session
const sessions = new Map();

// --- TTS- und Barge-In-Konfiguration ---
const tts = ${ttsJson};
const barge_in = ${bargeInJson};

// --- Flow-Assistant mit Event-Handlern ---
const assistant = AiFlowAssistant.create({
  // Anruf startet: Begruessung senden + Gemini-Chat-Session anlegen
  onSessionStart: async (event) => {
    sessions.set(event.session.id, model.startChat({
      history: [{ role: "model", parts: [{ text: "${greetingStr}" }] }],
    }));
    return {
      type: "speak",
      session_id: event.session.id,
      text: "${greetingStr}",
      user_input_timeout_seconds: ${c.timeout},
      tts,
      barge_in,
    };
  },

  // Nutzer hat gesprochen: an Gemini weiterleiten
  onUserSpeak: async (event) => {
    const chat = sessions.get(event.session.id);

    // Gemini-Chat haelt den Verlauf automatisch
    const result = await chat.sendMessage(event.text);
    const reply = result.response.text();

    // Antwort per TTS vorlesen lassen
    return {
      type: "speak",
      session_id: event.session.id,
      text: reply,
      user_input_timeout_seconds: ${c.timeout},
      tts,
      barge_in,
    };
  },

  // Stille: Nutzer hat nicht geantwortet
  onUserInputTimeout: async (event) => {
    return {
      type: "speak",
      session_id: event.session.id,
      text: "Sind Sie noch da?",
      user_input_timeout_seconds: ${c.timeout},
      tts,
    };
  },

  // Anruf beendet: Session aufraeumen
  onSessionEnd: async (event) => {
    sessions.delete(event.session.id);
    console.log("Call ended:", event.session.id);
    return null;
  },
});

// --- WebSocket-Server starten (hier verbindet sich sipgate flow) ---
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("sipgate flow connected");
  ws.on("message", assistant.ws(ws));
  ws.on("close", () => console.log("Disconnected"));
});

console.log("Agent running on ws://localhost:8080");`;
}

// ============================================================================
// Syntax highlighting
// ============================================================================

function highlightJS(code) {
    // Every highlighted span gets stashed as a placeholder so that
    // later regex passes can't accidentally match inside HTML attributes
    // (e.g. the keyword regex matching "class" inside class="num").
    const tokens = [];
    function stash(html) {
        tokens.push(html);
        return `\x00TK${tokens.length - 1}\x00`;
    }
    function span(cls, text) {
        return stash(`<span class="${cls}">${text}</span>`);
    }

    // Escape HTML
    let src = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 1. Single-line comments
    src = src.replace(/(\/\/.*)/g, (m) => span('cm', m));

    // 2. Template strings
    src = src.replace(/(`(?:[^`\\]|\\.)*`)/g, (m) => span('str', m));

    // 3. Double-quoted strings
    src = src.replace(/("(?:[^"\\]|\\.)*")/g, (m) => span('str', m));

    // 4. Single-quoted strings
    src = src.replace(/('(?:[^'\\]|\\.)*')/g, (m) => span('str', m));

    // 5. Numbers
    src = src.replace(/\b(\d+)\b/g, (m) => span('num', m));

    // 6. Keywords
    const kws = 'const|let|var|function|async|await|switch|case|break|return|new|if|else|try|catch|throw|class|import|export|from|require|default';
    src = src.replace(new RegExp(`\\b(${kws})\\b`, 'g'), (m) => span('kw', m));

    // 7. Known globals / constructors
    src = src.replace(/\b(Map|WebSocket|GoogleGenerativeAI|Anthropic|AiFlowAssistant|console|process|JSON)\b/g, (m) => span('fn', m));

    // 8. Method calls after dot
    src = src.replace(/\.(\w+)(?=\s*\()/g, (_, name) => '.' + span('fn', name));

    // Restore all stashed spans
    // Multiple passes because spans can be nested (e.g. comment containing a keyword placeholder)
    let prev;
    do {
        prev = src;
        src = src.replace(/\x00TK(\d+)\x00/g, (_, i) => tokens[i]);
    } while (src !== prev);

    return src;
}

function updateCodePreview() {
    rawCodeText = generateCode();
    els.codeContent.innerHTML = highlightJS(rawCodeText);
}

// ============================================================================
// Deploy
// ============================================================================

async function deploy() {
    const config = getConfig();

    if (!config.systemPrompt.trim()) {
        toast('Please enter a system prompt', 'error');
        els.systemPrompt.focus();
        return;
    }

    els.deployBtn.disabled = true;
    els.deployBtn.textContent = 'Deploying...';

    try {
        const res = await fetch('/api/agent/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Deploy failed: ${res.status}`);
        }

        deployed = true;
        chatEnabled = true;

        // Update UI
        els.deployBtn.textContent = 'Re-Deploy Agent';
        els.deployBtn.classList.add('deployed');
        els.statusBadge.textContent = 'Live';
        els.statusBadge.classList.add('active');
        els.chatInput.disabled = false;
        els.chatSend.disabled = false;
        els.chatInput.focus();

        // Show WebSocket URL
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${location.host}/ws/sipgate`;
        els.wsUrl.textContent = wsUrl;

        // Clear chat placeholder
        if (els.chatMessages.querySelector('.chat-placeholder')) {
            els.chatMessages.innerHTML = '';
            addChatBubble('system', 'Agent deployed. Start chatting!');
        }

        addLogEntry('system', 'config', 'Agent deployed successfully');
        toast('Agent deployed!', 'success');

        // Connect to log stream
        connectLogStream();
    } catch (err) {
        toast(err.message, 'error');
        addLogEntry('error', 'deploy', err.message);
    } finally {
        els.deployBtn.disabled = false;
    }
}

// ============================================================================
// Chat
// ============================================================================

async function sendChat(message) {
    if (!message.trim() || !chatEnabled) return;

    addChatBubble('user', message);
    els.chatInput.value = '';
    els.chatInput.disabled = true;
    els.chatSend.disabled = true;

    // Show typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.textContent = 'Agent is thinking';
    els.chatMessages.appendChild(typing);
    scrollChat();

    try {
        const res = await fetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        typing.remove();

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Chat request failed');
        }

        const data = await res.json();
        addChatBubble('assistant', data.reply);
    } catch (err) {
        typing.remove();
        addChatBubble('system', `Error: ${err.message}`);
    } finally {
        els.chatInput.disabled = false;
        els.chatSend.disabled = false;
        els.chatInput.focus();
    }
}

function addChatBubble(role, text, persist = true) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    els.chatMessages.appendChild(bubble);
    scrollChat();
    if (persist) saveChatHistory();
}

function scrollChat() {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function clearChat() {
    els.chatMessages.innerHTML = '';
    if (deployed) {
        addChatBubble('system', 'Chat cleared.');
        fetch('/api/agent/chat/reset', { method: 'POST' });
    } else {
        els.chatMessages.innerHTML = '<div class="chat-placeholder">Configure and deploy your agent to start chatting.</div>';
    }
    saveChatHistory();
}

// ============================================================================
// Log stream
// ============================================================================

function connectLogStream() {
    if (logSource) {
        logSource.close();
    }

    logSource = new EventSource('/api/agent/logs');

    logSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected' || data.type === 'ping') return;

            // Remove placeholder
            const placeholder = els.logEntries.querySelector('.log-placeholder');
            if (placeholder) placeholder.remove();

            // Metrics get attached to the previous log entry as expandable detail
            if (data.type === 'metrics' && data.detail && typeof data.detail === 'object') {
                attachMetrics(data.detail);
                return;
            }

            addLogEntry(data.direction || 'system', data.type || 'event', formatLogDetail(data.detail));
        } catch (e) {
            // ignore parse errors
        }
    };

    logSource.onerror = () => {
        els.connectionInfo.textContent = 'Log stream disconnected';
        // Reconnect after delay
        setTimeout(() => {
            if (deployed) connectLogStream();
        }, 3000);
    };

    logSource.onopen = () => {
        els.connectionInfo.textContent = 'Log stream connected';
    };
}

function formatLogDetail(detail) {
    if (!detail) return '';
    if (typeof detail === 'string') return detail;
    if (detail.text) return detail.text;
    if (detail.message) return detail.message;
    if (detail.type) return `type: ${detail.type}`;
    return JSON.stringify(detail);
}

function addLogEntry(direction, type, detail, persist = true) {
    // Remove placeholder if present
    const placeholder = els.logEntries.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const entry = document.createElement('div');
    entry.className = type === 'metrics' ? 'log-entry log-metrics' : 'log-entry';

    const now = new Date();
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const arrows = { in: '\u2192', out: '\u2190', system: '\u2022', error: '\u2716' };

    entry.innerHTML = `
        <span class="log-toggle"></span>
        <span class="log-time">${time}</span>
        <span class="log-arrow ${direction}">${arrows[direction] || '\u2022'}</span>
        <span class="log-type">${escapeHtml(type)}</span>
        <span class="log-detail">${escapeHtml(String(detail || ''))}</span>
    `;

    els.logEntries.appendChild(entry);
    if (els.autoScroll.checked) {
        els.logEntries.scrollTop = els.logEntries.scrollHeight;
    }
    if (persist) saveLogHistory();
}

function attachMetrics(m) {
    // Find the last log entry and make it expandable with metrics
    const entries = els.logEntries.querySelectorAll('.log-entry');
    const lastEntry = entries[entries.length - 1];
    if (!lastEntry) return;

    lastEntry.classList.add('log-expandable');

    // Set toggle indicator text
    const toggle = lastEntry.querySelector('.log-toggle');
    if (toggle) toggle.textContent = '\u25B6';

    // Build metrics panel
    const panel = document.createElement('div');
    panel.className = 'log-metrics-panel';

    const timeScale = Math.max(m.total, 1);
    const ttfbPct = (m.ttfb / timeScale) * 100;

    const ttfbColor = m.ttfb < 400 ? 'var(--green)' : m.ttfb < 1000 ? 'var(--orange)' : 'var(--red)';
    const totalColor = m.total < 800 ? 'var(--green)' : m.total < 2000 ? 'var(--orange)' : 'var(--red)';
    const tpsColor = m.tokensPerSec > 80 ? 'var(--green)' : m.tokensPerSec > 30 ? 'var(--orange)' : 'var(--red)';

    panel.innerHTML = `
        <div class="metric-row">
            <span class="metric-label">TTFB</span>
            <div class="metric-bar-track"><div class="metric-bar" style="width:${ttfbPct}%;background:${ttfbColor}"></div></div>
            <span class="metric-value">${m.ttfb}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Total</span>
            <div class="metric-bar-track"><div class="metric-bar" style="width:100%;background:${totalColor}"></div></div>
            <span class="metric-value">${m.total}ms</span>
        </div>
        <div class="metric-stats">
            <div class="metric-stat-big" style="color:${tpsColor}">
                <span class="metric-stat-num">${m.tokensPerSec}</span>
                <span class="metric-stat-unit">tok/s</span>
            </div>
            <div class="metric-stat">
                <span class="metric-stat-num">${m.inputTokens}</span>
                <span class="metric-stat-unit">in</span>
            </div>
            <div class="metric-stat">
                <span class="metric-stat-num">${m.outputTokens}</span>
                <span class="metric-stat-unit">out</span>
            </div>
            <div class="metric-stat model">
                ${escapeHtml(m.model)}
            </div>
        </div>
    `;

    lastEntry.appendChild(panel);

    // Toggle on click
    lastEntry.addEventListener('click', () => {
        lastEntry.classList.toggle('expanded');
    });

    saveLogHistory();
}

function clearLogs() {
    els.logEntries.innerHTML = '<div class="log-placeholder">Logs cleared.</div>';
    saveLogHistory();
}

// ============================================================================
// Utilities
// ============================================================================

function pad(n) {
    return String(n).padStart(2, '0');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ============================================================================
// LocalStorage persistence
// ============================================================================

const STORAGE_KEY = 'agentiq-settings';
const CHAT_STORAGE_KEY = 'agentiq-chat';
const LOGS_STORAGE_KEY = 'agentiq-logs';
const MAX_STORED_LOGS = 200;
const PERSISTED_FIELDS = [
    'systemPrompt', 'greeting', 'ttsProvider', 'ttsVoice',
    'bargeIn', 'timeout', 'llmModel', 'geminiApiKey', 'anthropicApiKey'
];

function saveSettings() {
    const data = {};
    for (const key of PERSISTED_FIELDS) {
        data[key] = els[key].value;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function loadSettings() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!data) return;

        // Restore TTS provider first so voice dropdown gets populated
        if (data.ttsProvider) {
            els.ttsProvider.value = data.ttsProvider;
            updateVoiceOptions();
        }

        for (const key of PERSISTED_FIELDS) {
            if (data[key] != null && els[key]) {
                els[key].value = data[key];
            }
        }
    } catch {}
}

function saveChatHistory() {
    try {
        const bubbles = els.chatMessages.querySelectorAll('.chat-bubble');
        const items = Array.from(bubbles).map(b => ({
            role: b.classList.contains('user') ? 'user'
                : b.classList.contains('assistant') ? 'assistant' : 'system',
            text: b.textContent,
        }));
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(items));
    } catch {}
}

function loadChatHistory() {
    try {
        const items = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY));
        if (!items || !items.length) return;
        els.chatMessages.innerHTML = '';
        for (const { role, text } of items) {
            addChatBubble(role, text, false);
        }
    } catch {}
}

function saveLogHistory() {
    try {
        const entries = els.logEntries.querySelectorAll('.log-entry');
        const items = Array.from(entries).slice(-MAX_STORED_LOGS).map(e => ({
            cls: e.className,
            html: e.innerHTML,
        }));
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(items));
    } catch {}
}

function loadLogHistory() {
    try {
        const items = JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY));
        if (!items || !items.length) return;
        els.logEntries.innerHTML = '';
        for (const item of items) {
            const entry = document.createElement('div');
            if (typeof item === 'string') {
                entry.className = 'log-entry';
                entry.innerHTML = item;
            } else {
                entry.className = item.cls || 'log-entry';
                entry.innerHTML = item.html;
            }
            // Ensure every entry has a toggle placeholder for consistent alignment
            if (!entry.querySelector('.log-toggle')) {
                const toggle = document.createElement('span');
                toggle.className = 'log-toggle';
                entry.prepend(toggle);
            }
            els.logEntries.appendChild(entry);
        }
        // Re-attach click handlers for expandable metric entries
        els.logEntries.querySelectorAll('.log-expandable').forEach(entry => {
            entry.addEventListener('click', () => entry.classList.toggle('expanded'));
        });
        els.logEntries.scrollTop = els.logEntries.scrollHeight;
    } catch {}
}

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        toast(`${label} copied!`, 'success');
    } catch {
        toast('Copy failed', 'error');
    }
}

// ============================================================================
// Event listeners
// ============================================================================

async function init() {
    // Voice dropdown init
    updateVoiceOptions();

    // Restore saved state
    loadSettings();
    loadChatHistory();
    loadLogHistory();

    // Hide API key fields when server keys are configured
    try {
        const res = await fetch('/api/agent/keys');
        if (res.ok) {
            const keys = await res.json();
            if (keys.gemini) {
                els.geminiApiKey.closest('.form-group').style.display = 'none';
            }
            if (keys.anthropic) {
                els.anthropicApiKey.closest('.form-group').style.display = 'none';
            }
        }
    } catch {}

    // Restore deployed state from server
    try {
        const res = await fetch('/api/agent/config');
        if (res.ok) {
            const { deployed: isDeployed } = await res.json();
            if (isDeployed) {
                deployed = true;
                chatEnabled = true;
                els.deployBtn.textContent = 'Re-Deploy Agent';
                els.deployBtn.classList.add('deployed');
                els.statusBadge.textContent = 'Live';
                els.statusBadge.classList.add('active');
                els.chatInput.disabled = false;
                els.chatSend.disabled = false;
                const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
                els.wsUrl.textContent = `${proto}//${location.host}/ws/sipgate`;
                connectLogStream();
            }
        }
    } catch {}


    // Settings changes update code preview + save to localStorage
    const settingsInputs = [
        els.systemPrompt, els.greeting, els.ttsProvider, els.ttsVoice,
        els.bargeIn, els.timeout, els.llmModel,
        els.geminiApiKey, els.anthropicApiKey
    ];

    settingsInputs.forEach(el => {
        el.addEventListener('input', () => { updateCodePreview(); saveSettings(); });
        el.addEventListener('change', () => { updateCodePreview(); saveSettings(); });
    });

    els.ttsProvider.addEventListener('change', updateVoiceOptions);

    // Template selector
    els.templateSelect.addEventListener('change', () => {
        if (els.templateSelect.value) {
            applyTemplate(els.templateSelect.value);
            els.templateSelect.value = '';
        }
    });

    // Deploy
    els.deployBtn.addEventListener('click', deploy);

    // Chat
    els.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendChat(els.chatInput.value);
    });

    els.clearChat.addEventListener('click', clearChat);

    // Copy buttons
    els.copyCode.addEventListener('click', () => {
        copyToClipboard(rawCodeText, 'Code');
    });

    els.copyUrl.addEventListener('click', () => {
        copyToClipboard(els.wsUrl.textContent, 'URL');
    });

    // Clear logs
    els.clearLogs.addEventListener('click', clearLogs);

    // Auto-scroll persistence
    try {
        const saved = localStorage.getItem('agentiq-autoscroll');
        if (saved !== null) els.autoScroll.checked = saved === 'true';
    } catch {}
    els.autoScroll.addEventListener('change', () => {
        try { localStorage.setItem('agentiq-autoscroll', els.autoScroll.checked); } catch {}
    });

    // Initial code preview
    updateCodePreview();
}

document.addEventListener('DOMContentLoaded', init);
