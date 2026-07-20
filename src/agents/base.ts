// src/agents/base.ts
// Agente base - todos los agentes especializados heredan de aqui

import type { ChatMessage, ToolDefinition, ToolResult } from '../shared/types';
import type { AgentConfig, AgentResult, AgentEvent } from './types';
import { chatCompletion } from '../llm/chat';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected history: ChatMessage[] = [];
  protected toolMap: Map<string, (args: Record<string, unknown>) => Promise<string>> = new Map();
  protected onEvent?: (event: AgentEvent) => void;

  constructor(config: AgentConfig) {
    this.config = config;
    this.registerTools();
  }

  setEventEmitter(cb: (event: AgentEvent) => void): void {
    this.onEvent = cb;
  }

  protected emit(event: AgentEvent): void {
    this.onEvent?.(event);
  }

  protected abstract registerTools(): void;

  protected addTool(
    definition: ToolDefinition,
    handler: (args: Record<string, unknown>) => Promise<string>,
  ): void {
    this.toolMap.set(definition.function.name, handler);
    if (!this.config.tools.find(t => t.function.name === definition.function.name)) {
      this.config.tools.push(definition);
    }
  }

  async run(userMessage: string, context?: string): Promise<AgentResult> {
    this.emit({ type: 'thought', agent: this.config.name, message: `Analizando: "${userMessage.slice(0, 80)}"` });

    const systemMsg = this.config.systemPrompt + (context ? '\n\n' + context : '');
    this.history = [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMessage },
    ];

    const toolCalls: AgentResult['toolCalls'] = [];
    let finalContent = '';
    const maxTurns = 10;
    let turn = 0;

    while (turn < maxTurns) {
      turn++;
      const response = await chatCompletion(
        {
          model: this.config.model || 'deepseek-chat',
          messages: this.history,
          tools: this.config.tools,
          tool_choice: 'auto',
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 8192,
        },
        (chunk) => {
          if (chunk.content) {
            this.emit({ type: 'thought', agent: this.config.name, message: chunk.content });
          }
        },
      );

      if (response.tool_calls && response.tool_calls.length > 0) {
        this.history.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.tool_calls,
        } as unknown as ChatMessage);

        for (const tc of response.tool_calls) {
          const fnName = tc.function.name;
          this.emit({ type: 'action', agent: this.config.name, message: `${fnName}`, data: tc.function.arguments });

          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}

          let result: string;
          const handler = this.toolMap.get(fnName);
          if (handler) {
            try {
              result = await handler(args);
              this.emit({ type: 'result', agent: this.config.name, message: result.slice(0, 200) });
            } catch (e: unknown) {
              result = 'Error: ' + (e instanceof Error ? e.message : String(e));
              this.emit({ type: 'error', agent: this.config.name, message: result });
            }
          } else {
            result = `Herramienta no encontrada: ${fnName}`;
            this.emit({ type: 'error', agent: this.config.name, message: result });
          }

          toolCalls.push({ name: fnName, args, result });

          this.history.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
      } else if (response.content) {
        finalContent = response.content;
        this.emit({ type: 'done', agent: this.config.name, message: 'Completado' });
        break;
      }
    }

    if (!finalContent) {
      finalContent = 'Se alcanzo el maximo de turnos sin respuesta final.';
      this.emit({ type: 'error', agent: this.config.name, message: finalContent });
    }

    return {
      content: finalContent,
      toolCalls,
      model: this.config.model || 'unknown',
    };
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt;
  }

  getTools(): ToolDefinition[] {
    return this.config.tools;
  }
}
