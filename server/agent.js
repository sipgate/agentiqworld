/**
 * Agentiq - sipgate Flow WebSocket Agent
 *
 * Handles:
 * - WebSocket connections from sipgate flow
 * - Chat API for the web UI test panel
 * - Configuration management
 * - Log streaming via SSE
 */

const WebSocket = require('ws');

// ============================================================================
// State
// ============================================================================

let agentConfig = {
    systemPrompt: '',
    greeting: 'Hallo, willkommen bei sipgate! Wie kann ich Ihnen helfen?',
    model: 'gemini-2.5-flash',
    llmProvider: 'gemini',
    timeout: 8,
    ttsProvider: 'azure',
    ttsVoice: 'de-DE-KatjaNeural',
    ttsLanguage: 'de-DE',
    bargeIn: 'immediate',
    geminiApiKey: undefined,
    anthropicApiKey: undefined,
};

let deployed = false;
const chatHistory = [];
const sipgateSessions = new Map();
const logClients = new Set();

// ============================================================================
// Logging
// ============================================================================

function broadcastLog(entry) {
    const data = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
    for (const client of logClients) {
        client.write(`data: ${data}\n\n`);
    }
}

function log(type, direction, detail) {
    console.log(`[agent] ${direction} ${type}:`, detail);
    broadcastLog({ type, direction, detail });
}

function formatMetrics(m) {
    return `${m.model} | TTFB ${m.ttfb}ms | Total ${m.total}ms | In ${m.inputTokens} tok | Out ${m.outputTokens} tok | ${m.tokensPerSec} tok/s`;
}

// ============================================================================
// LLM
// ============================================================================

function getAnthropicKey() {
    return agentConfig.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
}

function getGeminiKey() {
    return agentConfig.geminiApiKey || process.env.GEMINI_API_KEY;
}

// Returns { text, metrics: { model, provider, ttfb, total, inputTokens, outputTokens, tokensPerSec } }
async function callLLM(messages) {
    if (agentConfig.llmProvider === 'gemini') {
        return callGemini(messages);
    }
    return callAnthropic(messages);
}

async function callAnthropic(messages) {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
        throw new Error('No Anthropic API key. Set ANTHROPIC_API_KEY or enter a key in the UI.');
    }

    const t0 = performance.now();
    let ttfb = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let text = '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: agentConfig.model,
            max_tokens: 300,
            stream: true,
            system: agentConfig.systemPrompt,
            messages,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            let event;
            try { event = JSON.parse(payload); } catch { continue; }

            switch (event.type) {
                case 'message_start':
                    inputTokens = event.message?.usage?.input_tokens || 0;
                    break;
                case 'content_block_delta':
                    if (!ttfb) ttfb = performance.now() - t0;
                    text += event.delta?.text || '';
                    break;
                case 'message_delta':
                    outputTokens = event.usage?.output_tokens || 0;
                    break;
            }
        }
    }

    const total = performance.now() - t0;
    const tokensPerSec = total > 0 ? Math.round((outputTokens / (total / 1000)) * 10) / 10 : 0;

    return {
        text,
        metrics: {
            provider: 'anthropic',
            model: agentConfig.model,
            ttfb: Math.round(ttfb || total),
            total: Math.round(total),
            inputTokens,
            outputTokens,
            tokensPerSec,
        },
    };
}

async function callGemini(messages) {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new Error('No Gemini API key. Set GEMINI_API_KEY or enter a key in the UI.');
    }

    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const t0 = performance.now();
    let ttfb = 0;
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${agentConfig.model}:streamGenerateContent?alt=sse`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                system_instruction: agentConfig.systemPrompt
                    ? { parts: [{ text: agentConfig.systemPrompt }] }
                    : undefined,
                contents,
                generationConfig: {
                    maxOutputTokens: 300,
                },
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errText}`);
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            let chunk;
            try { chunk = JSON.parse(payload); } catch { continue; }

            const partText = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (partText) {
                if (!ttfb) ttfb = performance.now() - t0;
                text += partText;
            }

            // Usage metadata comes in the final chunk
            if (chunk.usageMetadata) {
                inputTokens = chunk.usageMetadata.promptTokenCount || 0;
                outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
            }
        }
    }

    if (!text) {
        throw new Error('Gemini returned no text response');
    }

    const total = performance.now() - t0;
    const tokensPerSec = total > 0 ? Math.round((outputTokens / (total / 1000)) * 10) / 10 : 0;

    return {
        text,
        metrics: {
            provider: 'gemini',
            model: agentConfig.model,
            ttfb: Math.round(ttfb || total),
            total: Math.round(total),
            inputTokens,
            outputTokens,
            tokensPerSec,
        },
    };
}

// ============================================================================
// sipgate flow helpers
// ============================================================================

function getTtsConfig() {
    if (agentConfig.ttsProvider === 'azure') {
        return {
            provider: 'azure',
            language: agentConfig.ttsLanguage,
            voice: agentConfig.ttsVoice,
        };
    }
    return {
        provider: 'eleven_labs',
        voice: agentConfig.ttsVoice,
    };
}

function getBargeInConfig() {
    switch (agentConfig.bargeIn) {
        case 'none': return { strategy: 'none' };
        case 'manual': return { strategy: 'manual' };
        case 'minimum_characters': return { strategy: 'minimum_characters', minimum_characters: 5 };
        default: return { strategy: 'immediate' };
    }
}

function buildSpeakAction(sessionId, text) {
    return JSON.stringify({
        type: 'speak',
        session_id: sessionId,
        text,
        user_input_timeout_seconds: agentConfig.timeout,
        tts: getTtsConfig(),
        barge_in: getBargeInConfig(),
    });
}

// ============================================================================
// WebSocket handler for sipgate flow
// ============================================================================

function handleSipgateConnection(ws, req) {
    const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    log('connection', 'in', `sipgate flow connected from ${remoteAddr}`);

    ws.on('message', async (data) => {
        let event;
        try {
            event = JSON.parse(data.toString());
        } catch {
            log('error', 'system', 'Invalid JSON received');
            return;
        }

        const sessionId = event.session?.id;
        log('event', 'in', {
            type: event.type,
            session: sessionId,
            text: event.text,
            from: event.session?.from_phone_number,
            to: event.session?.to_phone_number,
        });

        switch (event.type) {
            case 'session_start': {
                sipgateSessions.set(sessionId, []);
                const msg = buildSpeakAction(sessionId, agentConfig.greeting);
                ws.send(msg);
                log('action', 'out', { type: 'speak', text: agentConfig.greeting });
                break;
            }

            case 'user_speak': {
                const history = sipgateSessions.get(sessionId) || [];
                history.push({ role: 'user', content: event.text });

                try {
                    const { text: reply, metrics } = await callLLM(history);
                    history.push({ role: 'assistant', content: reply });
                    ws.send(buildSpeakAction(sessionId, reply));
                    log('action', 'out', { type: 'speak', text: reply });
                    log('metrics', 'system', metrics);
                } catch (err) {
                    log('error', 'system', err.message);
                    ws.send(buildSpeakAction(sessionId, 'Entschuldigung, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es erneut.'));
                }
                break;
            }

            case 'user_speech_started':
                log('event', 'in', { type: 'user_speech_started' });
                break;

            case 'assistant_speak':
                log('event', 'in', { type: 'assistant_speak' });
                break;

            case 'assistant_speech_ended':
                log('event', 'in', { type: 'assistant_speech_ended' });
                break;

            case 'user_input_timeout': {
                ws.send(buildSpeakAction(sessionId, 'Sind Sie noch da? Kann ich Ihnen noch weiterhelfen?'));
                log('action', 'out', { type: 'speak', text: 'Timeout prompt sent' });
                break;
            }

            case 'session_end': {
                sipgateSessions.delete(sessionId);
                log('connection', 'system', `Session ${sessionId} ended`);
                break;
            }

            default:
                log('event', 'in', { type: event.type });
        }
    });

    ws.on('close', () => {
        log('connection', 'system', 'sipgate flow disconnected');
    });

    ws.on('error', (err) => {
        log('error', 'system', err.message);
    });
}

// ============================================================================
// Setup
// ============================================================================

function setupAgent(app, server) {
    // WebSocket server for sipgate flow
    const wss = new WebSocket.Server({ server, path: '/ws/sipgate' });
    wss.on('connection', handleSipgateConnection);

    // API: Which LLM keys are configured server-side?
    app.get('/api/agent/keys', (req, res) => {
        res.json({
            gemini: !!process.env.GEMINI_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
        });
    });

    // API: Update agent config
    app.post('/api/agent/config', (req, res) => {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Body required' });

        agentConfig = { ...agentConfig, ...body };
        deployed = true;
        log('config', 'system', 'Agent configuration updated');
        res.json({ success: true });
    });

    // API: Get agent config
    app.get('/api/agent/config', (req, res) => {
        const { geminiApiKey, anthropicApiKey, ...safeConfig } = agentConfig;
        res.json({ config: safeConfig, deployed });
    });

    // API: Chat (test the agent from the UI)
    app.post('/api/agent/chat', async (req, res) => {
        if (!deployed) {
            return res.status(400).json({ error: 'Agent not deployed. Click "Deploy Agent" first.' });
        }

        const { message } = req.body || {};
        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        chatHistory.push({ role: 'user', content: message });
        log('chat', 'in', { text: message });

        try {
            const { text: reply, metrics } = await callLLM(chatHistory);
            chatHistory.push({ role: 'assistant', content: reply });
            log('chat', 'out', { text: reply });
            log('metrics', 'system', metrics);
            res.json({ reply, metrics });
        } catch (err) {
            log('error', 'system', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // API: Reset chat history
    app.post('/api/agent/chat/reset', (req, res) => {
        chatHistory.length = 0;
        log('chat', 'system', 'Chat history cleared');
        res.json({ success: true });
    });

    // API: Log stream (SSE)
    app.get('/api/agent/logs', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        logClients.add(res);

        const ping = setInterval(() => {
            res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
        }, 30000);

        req.on('close', () => {
            clearInterval(ping);
            logClients.delete(res);
        });
    });

    console.log('[agent] WebSocket server ready at /ws/sipgate');
    return wss;
}

module.exports = { setupAgent };
