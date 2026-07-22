// __tests__/llm.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getProviders, getProvider, getAllModels, resetProviders } from '../src/llm/providers';

describe('LLM Providers', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_BASE_URL;
    resetProviders();
  });

  afterEach(() => {
    Object.assign(process.env, savedEnv);
    resetProviders();
  });

  it('returns empty when no API keys', () => {
    expect(getProviders()).toEqual([]);
  });

  it('returns null provider when no keys', () => {
    expect(getProvider()).toBeNull();
  });

  it('detects DeepSeek when key set', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    resetProviders();
    const providers = getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].name).toBe('deepseek');
    expect(providers[0].defaultModel).toBe('deepseek-chat');
  });

  it('detects NVIDIA when key set', () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test';
    resetProviders();
    const providers = getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].name).toBe('nvidia');
    expect(providers[0].models.length).toBeGreaterThan(5);
  });

  it('detects OpenRouter when key set', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    resetProviders();
    const providers = getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].name).toBe('openrouter');
  });

  it('prefers DeepSeek over NVIDIA', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.NVIDIA_API_KEY = 'nvapi-test';
    resetProviders();
    expect(getProvider()!.name).toBe('deepseek');
  });

  it('getAllModels returns flat list', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.NVIDIA_API_KEY = 'nvapi-test';
    resetProviders();
    const models = getAllModels();
    expect(models.length).toBeGreaterThan(3);
    expect(models[0]).toHaveProperty('provider');
    expect(models[0]).toHaveProperty('model');
  });

  it('getProvider with specific model finds correct provider', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.NVIDIA_API_KEY = 'nvapi-test';
    resetProviders();
    const p = getProvider('deepseek-ai/deepseek-v4-flash');
    expect(p!.name).toBe('nvidia');
  });
});
