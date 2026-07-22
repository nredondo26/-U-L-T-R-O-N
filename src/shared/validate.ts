export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateEnv(): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };
  const requiredKeys = ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'NVIDIA_API_KEY', 'OPENROUTER_API_KEY'];
  const hasAny = requiredKeys.some(k => process.env[k]);

  if (!hasAny) {
    result.errors.push('No API keys found. Set at least one: DASHSCOPE_API_KEY, DEEPSEEK_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY');
    result.valid = false;
  }

  if (!process.env.DASHSCOPE_API_KEY && !process.env.DEEPSEEK_API_KEY && !process.env.NVIDIA_API_KEY && !process.env.OPENROUTER_API_KEY) {
    result.warnings.push('No LLM providers configured. The assistant will not be able to respond.');
  }

  return result;
}

export function validateConfig(config: { maxSteps?: number; webPort?: number }): ValidationResult {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };
  if (config.maxSteps !== undefined && (config.maxSteps < 1 || config.maxSteps > 100)) {
    result.warnings.push(`maxSteps ${config.maxSteps} is outside recommended range (1-100)`);
  }
  if (config.webPort !== undefined && (config.webPort < 1024 || config.webPort > 65535)) {
    result.errors.push(`webPort ${config.webPort} must be between 1024 and 65535`);
    result.valid = false;
  }
  return result;
}
