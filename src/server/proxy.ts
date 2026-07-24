// src/server/proxy.ts
// OpenAI / Anthropic compatible API proxy
// Permite usar Claude Code, Codex, y otras tools con ULTRON como backend

import type { IncomingMessage, ServerResponse } from 'http';
import type { Orchestrator } from '../agents/orchestrator';
import type { ChatMessage, ToolCall } from '../shared/types';
import { chatCompletion } from '../llm/chat';
import { getAllModels } from '../llm/providers';

export async function handleOpenAIChat(req: IncomingMessage, res: ServerResponse, orch: Orchestrator): Promise<void> {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);

    const messages: ChatMessage[] = (data.messages || []).map((m: any) => ({
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      name: m.name,
    }));

    if (data.system) {
      messages.unshift({ role: 'system', content: typeof data.system === 'string' ? data.system : data.system });
    }

    const tools = (data.tools || []).map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.function?.name || t.name || '',
        description: t.function?.description || t.description || '',
        parameters: t.function?.parameters || t.parameters || {},
      },
    }));

    const model = data.model || orch.getCurrentModel();
    const stream = data.stream === true;

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const response = await chatCompletion(
        { model, messages, tools: tools.length > 0 ? tools : undefined, temperature: data.temperature ?? 0.7, max_tokens: data.max_tokens ?? 8192 },
        (chunk) => {
          if (chunk.done) {
            res.write(`data: [DONE]\n\n`);
          } else if (chunk.content) {
            const delta = { choices: [{ delta: { content: chunk.content }, index: 0 }] };
            res.write(`data: ${JSON.stringify(delta)}\n\n`);
          }
        },
      );

      if (!response.content && !response.tool_calls) {
        const finish = {
          choices: [{ finish_reason: 'stop', index: 0, delta: {} }],
          usage: response.usage || {},
        };
        res.write(`data: ${JSON.stringify(finish)}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    const response = await chatCompletion({
      model, messages, tools: tools.length > 0 ? tools : undefined,
      temperature: data.temperature ?? 0.7, max_tokens: data.max_tokens ?? 8192,
    });

    const openaiResp: any = {
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model || model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content || null,
        },
        finish_reason: response.finish_reason || 'stop',
      }],
      usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    if (response.tool_calls) {
      openaiResp.choices[0].message.tool_calls = response.tool_calls.map((tc: ToolCall) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(openaiResp));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: msg, type: 'server_error' } }));
  }
}

export async function handleOpenAIModels(req: IncomingMessage, res: ServerResponse, orch: Orchestrator): Promise<void> {
  const models = getAllModels();
  const data = {
    object: 'list',
    data: models.map(m => ({
      id: m.model,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: m.provider,
    })),
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleAnthropicMessages(req: IncomingMessage, res: ServerResponse, orch: Orchestrator): Promise<void> {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);

    const messages: ChatMessage[] = [];

    if (data.system) {
      const sys = typeof data.system === 'string' ? data.system
        : Array.isArray(data.system) ? data.system.map((s: any) => s.text || '').join('\n')
        : '';
      if (sys) messages.push({ role: 'system', content: sys });
    }

    for (const m of (data.messages || [])) {
      const content = typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.map((c: any) => c.text || '').join('\n')
        : '';
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content });
    }

    // Map Anthropic tools to OpenAI format
    const tools = (data.tools || []).map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.name || '',
        description: t.description || '',
        parameters: t.input_schema || {},
      },
    }));

    const model = data.model || orch.getCurrentModel();
    const stream = data.stream === true;

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const response = await chatCompletion(
        { model, messages, tools: tools.length > 0 ? tools : undefined, temperature: data.temperature ?? 0.7, max_tokens: data.max_tokens ?? 8192 },
        (chunk) => {
          if (chunk.done) {
            res.write(`event: message_stop\ndata: {}\n\n`);
          } else if (chunk.content) {
            const event = {
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: chunk.content },
            };
            res.write(`event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`);
          }
        },
      );

      res.write(`event: message_stop\ndata: {}\n\n`);
      res.end();
      return;
    }

    const response = await chatCompletion({
      model, messages, tools: tools.length > 0 ? tools : undefined,
      temperature: data.temperature ?? 0.7, max_tokens: data.max_tokens ?? 8192,
    });

    const anthropicResp: any = {
      id: 'msg_' + Date.now(),
      type: 'message',
      role: 'assistant',
      model: response.model || model,
      content: [{ type: 'text', text: response.content || '' }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };

    if (response.tool_calls) {
      anthropicResp.content = response.tool_calls.map((tc: ToolCall) => ({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || '{}'),
      }));
      anthropicResp.stop_reason = 'tool_use';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(anthropicResp));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'server_error', message: msg } }));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
