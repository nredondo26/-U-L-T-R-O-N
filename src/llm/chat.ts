// Chat unificado con Smart Router — free-first, auto-fallback, circuit breaker

import type { LLMCompletionRequest, LLMCompletionResponse, StreamChunkHandler, ModelSwitchEvent } from './types';
import { SmartRouter } from './router/index';

let defaultRouter: SmartRouter | null = null;

function getRouter(): SmartRouter {
  if (!defaultRouter) {
    defaultRouter = new SmartRouter({ preferFree: true });
  }
  return defaultRouter;
}

export function resetRouter(): void {
  defaultRouter = null;
}

export function getRouterInstance(): SmartRouter {
  return getRouter();
}

export async function chatCompletion(
  req: LLMCompletionRequest,
  onChunk?: StreamChunkHandler,
  onSwitch?: (event: ModelSwitchEvent) => void,
): Promise<LLMCompletionResponse> {
  return getRouter().complete(req, onChunk, onSwitch);
}
