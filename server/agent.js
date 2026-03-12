/**
 * Agentiq - sipgate Flow WebSocket Agent
 *
 * Handles:
 * - WebSocket connections from sipgate flow (per agent ID)
 * - Chat API for the web UI test panel
 * - Configuration management
 * - Log streaming via SSE
 */

const WebSocket = require('ws');
const crypto = require('crypto');

// ============================================================================
// State — per-agent instances keyed by agent ID
// ============================================================================

const DEFAULT_CONFIG = {
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

// Map<agentId, { config, deployed, chatHistory, sipgateSessions, logClients }>
const agents = new Map();

function getOrCreateAgent(agentId) {
    if (!agents.has(agentId)) {
        agents.set(agentId, {
            config: { ...DEFAULT_CONFIG },
            deployed: false,
            chatHistory: [],
            sipgateSessions: new Map(),
            logClients: new Set(),
        });
    }
    return agents.get(agentId);
}

// ============================================================================
// Logging — scoped per agent
// ============================================================================

function broadcastLog(agent, entry) {
    const data = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
    for (const client of agent.logClients) {
        client.write(`data: ${data}\n\n`);
    }
}

function log(agent, type, direction, detail) {
    console.log(`[agent] ${direction} ${type}:`, detail);
    broadcastLog(agent, { type, direction, detail });
}

// ============================================================================
// LLM
// ============================================================================

function getAnthropicKey(config) {
    return config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
}

function getGeminiKey(config) {
    return config.geminiApiKey || process.env.GEMINI_API_KEY;
}

async function callLLM(config, messages) {
    if (config.llmProvider === 'gemini') {
        return callGemini(config, messages);
    }
    return callAnthropic(config, messages);
}

async function callAnthropic(config, messages) {
    const apiKey = getAnthropicKey(config);
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
            model: config.model,
            max_tokens: 300,
            stream: true,
            system: config.systemPrompt,
            messages,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

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
            model: config.model,
            ttfb: Math.round(ttfb || total),
            total: Math.round(total),
            inputTokens,
            outputTokens,
            tokensPerSec,
        },
    };
}

async function callGemini(config, messages) {
    const apiKey = getGeminiKey(config);
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
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                system_instruction: config.systemPrompt
                    ? { parts: [{ text: config.systemPrompt }] }
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
            model: config.model,
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

function getTtsConfig(config) {
    if (config.ttsProvider === 'azure') {
        return {
            provider: 'azure',
            language: config.ttsLanguage,
            voice: config.ttsVoice,
        };
    }
    return {
        provider: 'eleven_labs',
        voice: config.ttsVoice,
    };
}

function getBargeInConfig(config) {
    switch (config.bargeIn) {
        case 'none': return { strategy: 'none' };
        case 'manual': return { strategy: 'manual' };
        case 'minimum_characters': return { strategy: 'minimum_characters', minimum_characters: 5 };
        default: return { strategy: 'immediate' };
    }
}

function buildSpeakAction(config, sessionId, text) {
    return JSON.stringify({
        type: 'speak',
        session_id: sessionId,
        text,
        user_input_timeout_seconds: config.timeout,
        tts: getTtsConfig(config),
        barge_in: getBargeInConfig(config),
    });
}

// ============================================================================
// WebSocket handler for sipgate flow
// ============================================================================

function handleSipgateConnection(ws, req, agent) {
    const config = agent.config;
    const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    log(agent, 'connection', 'in', `sipgate flow connected from ${remoteAddr}`);

    ws.on('message', async (data) => {
        let event;
        try {
            event = JSON.parse(data.toString());
        } catch {
            log(agent, 'error', 'system', 'Invalid JSON received');
            return;
        }

        const sessionId = event.session?.id;
        log(agent, 'event', 'in', {
            type: event.type,
            session: sessionId,
            text: event.text,
            from: event.session?.from_phone_number,
            to: event.session?.to_phone_number,
        });

        switch (event.type) {
            case 'session_start': {
                agent.sipgateSessions.set(sessionId, [{ role: 'assistant', content: config.greeting }]);
                const msg = buildSpeakAction(config, sessionId, config.greeting);
                ws.send(msg);
                log(agent, 'action', 'out', { type: 'speak', text: config.greeting });
                break;
            }

            case 'user_speak': {
                const history = agent.sipgateSessions.get(sessionId) || [];
                history.push({ role: 'user', content: event.text });

                try {
                    const { text: reply, metrics } = await callLLM(config, history);
                    history.push({ role: 'assistant', content: reply });
                    ws.send(buildSpeakAction(config, sessionId, reply));
                    log(agent, 'action', 'out', { type: 'speak', text: reply });
                    log(agent, 'metrics', 'system', metrics);
                } catch (err) {
                    log(agent, 'error', 'system', err.message);
                    ws.send(buildSpeakAction(config, sessionId, 'Entschuldigung, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es erneut.'));
                }
                break;
            }

            case 'user_speech_started':
                log(agent, 'event', 'in', { type: 'user_speech_started' });
                break;

            case 'assistant_speak':
                log(agent, 'event', 'in', { type: 'assistant_speak' });
                break;

            case 'assistant_speech_ended':
                log(agent, 'event', 'in', { type: 'assistant_speech_ended' });
                break;

            case 'user_input_timeout': {
                ws.send(buildSpeakAction(config, sessionId, 'Sind Sie noch da? Kann ich Ihnen noch weiterhelfen?'));
                log(agent, 'action', 'out', { type: 'speak', text: 'Timeout prompt sent' });
                break;
            }

            case 'session_end': {
                agent.sipgateSessions.delete(sessionId);
                log(agent, 'connection', 'system', `Session ${sessionId} ended`);
                break;
            }

            default:
                log(agent, 'event', 'in', { type: event.type });
        }
    });

    ws.on('close', () => {
        log(agent, 'connection', 'system', 'sipgate flow disconnected');
    });

    ws.on('error', (err) => {
        log(agent, 'error', 'system', err.message);
    });
}

// ============================================================================
// Agent ID validation
// ============================================================================

const AGENT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidAgentId(id) {
    return typeof id === 'string' && AGENT_ID_RE.test(id);
}

// ============================================================================
// Setup
// ============================================================================

function setupAgent(app, server) {
    // WebSocket server — noServer mode so we can route by path
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const match = req.url.match(/^\/ws\/sipgate\/([a-zA-Z0-9_-]+)$/);
        if (!match) {
            // Not our path — let other handlers deal with it or reject
            socket.destroy();
            return;
        }

        const agentId = match[1];
        const agent = agents.get(agentId);
        if (!agent || !agent.deployed) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            handleSipgateConnection(ws, req, agent);
        });
    });

    // API: Which LLM keys are configured server-side?
    app.get('/api/agent/keys', (req, res) => {
        res.json({
            gemini: !!process.env.GEMINI_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
        });
    });

    // API: Update agent config
    app.post('/api/agent/:id/config', (req, res) => {
        const { id } = req.params;
        if (!isValidAgentId(id)) return res.status(400).json({ error: 'Invalid agent ID' });

        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Body required' });

        const agent = getOrCreateAgent(id);
        agent.config = { ...agent.config, ...body };
        agent.deployed = true;
        // Initialize chat history with greeting so the LLM has context
        agent.chatHistory = agent.config.greeting
            ? [{ role: 'assistant', content: agent.config.greeting }]
            : [];
        log(agent, 'config', 'system', 'Agent configuration updated');
        res.json({ success: true });
    });

    // API: Get agent config
    app.get('/api/agent/:id/config', (req, res) => {
        const { id } = req.params;
        if (!isValidAgentId(id)) return res.status(400).json({ error: 'Invalid agent ID' });

        const agent = agents.get(id);
        if (!agent) return res.json({ config: null, deployed: false });

        const { geminiApiKey, anthropicApiKey, ...safeConfig } = agent.config;
        res.json({ config: safeConfig, deployed: agent.deployed });
    });

    // API: Chat (test the agent from the UI)
    app.post('/api/agent/:id/chat', async (req, res) => {
        const { id } = req.params;
        if (!isValidAgentId(id)) return res.status(400).json({ error: 'Invalid agent ID' });

        const agent = agents.get(id);
        if (!agent || !agent.deployed) {
            return res.status(400).json({ error: 'Agent not deployed. Click "Deploy Agent" first.' });
        }

        const { message } = req.body || {};
        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        agent.chatHistory.push({ role: 'user', content: message });
        log(agent, 'chat', 'in', { text: message });

        try {
            const { text: reply, metrics } = await callLLM(agent.config, agent.chatHistory);
            agent.chatHistory.push({ role: 'assistant', content: reply });
            log(agent, 'chat', 'out', { text: reply });
            log(agent, 'metrics', 'system', metrics);
            res.json({ reply, metrics });
        } catch (err) {
            log(agent, 'error', 'system', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // API: Reset chat history
    app.post('/api/agent/:id/chat/reset', (req, res) => {
        const { id } = req.params;
        if (!isValidAgentId(id)) return res.status(400).json({ error: 'Invalid agent ID' });

        const agent = agents.get(id);
        if (agent) {
            agent.chatHistory = agent.config.greeting
                ? [{ role: 'assistant', content: agent.config.greeting }]
                : [];
            log(agent, 'chat', 'system', 'Chat history cleared');
        }
        res.json({ success: true });
    });

    // API: Log stream (SSE)
    app.get('/api/agent/:id/logs', (req, res) => {
        const { id } = req.params;
        if (!isValidAgentId(id)) return res.status(400).json({ error: 'Invalid agent ID' });

        const agent = getOrCreateAgent(id);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        agent.logClients.add(res);

        const ping = setInterval(() => {
            res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
        }, 30000);

        req.on('close', () => {
            clearInterval(ping);
            agent.logClients.delete(res);
        });
    });

    console.log('[agent] WebSocket server ready at /ws/sipgate/:agentId');
    return wss;
}

module.exports = { setupAgent };
