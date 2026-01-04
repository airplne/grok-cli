/**
 * Grok Model Configuration
 *
 * Defines all available xAI Grok models with their capabilities.
 * Reference: https://docs.x.ai/docs/models
 */

export interface ModelConfig {
  /** Model ID used in API calls */
  id: string;
  /** Human-friendly display name */
  displayName: string;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Model description */
  description: string;
  /** Input price per 1M tokens (USD) */
  inputPrice: number;
  /** Output price per 1M tokens (USD) */
  outputPrice: number;
  /** Whether this is the default model */
  isDefault: boolean;
  /** Model capabilities */
  capabilities: {
    functionCalling: boolean;
    streaming: boolean;
    vision: boolean;
  };
}

/**
 * All available Grok models
 */
export const GROK_MODELS: Record<string, ModelConfig> = {
  'grok-3-beta': {
    id: 'grok-3-beta',
    displayName: 'Grok 3 Beta',
    contextWindow: 128000,
    description: 'Most capable model for complex reasoning',
    inputPrice: 3.00,
    outputPrice: 15.00,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-fast-beta': {
    id: 'grok-3-fast-beta',
    displayName: 'Grok 3 Fast Beta',
    contextWindow: 128000,
    description: 'Faster variant of Grok 3',
    inputPrice: 0.60,
    outputPrice: 3.00,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-mini-beta': {
    id: 'grok-3-mini-beta',
    displayName: 'Grok 3 Mini Beta',
    contextWindow: 128000,
    description: 'Small model for simple tasks',
    inputPrice: 0.30,
    outputPrice: 0.50,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-3-mini-fast-beta': {
    id: 'grok-3-mini-fast-beta',
    displayName: 'Grok 3 Mini Fast Beta',
    contextWindow: 128000,
    description: 'Fastest mini model',
    inputPrice: 0.10,
    outputPrice: 0.40,
    isDefault: false,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: false,
    },
  },
  'grok-4-1-fast': {
    id: 'grok-4-1-fast',
    displayName: 'Grok 4.1 Fast',
    contextWindow: 2000000,
    description: 'Latest model with 2M context - best value',
    inputPrice: 0.20,
    outputPrice: 0.50,
    isDefault: true,
    capabilities: {
      functionCalling: true,
      streaming: true,
      vision: true,
    },
  },
};

/**
 * Model ID aliases for convenience
 */
export const MODEL_ALIASES: Record<string, string> = {
  'grok3': 'grok-3-beta',
  'grok-3': 'grok-3-beta',
  'grok3fast': 'grok-3-fast-beta',
  'grok3mini': 'grok-3-mini-beta',
  'grok3minifast': 'grok-3-mini-fast-beta',
  'grok4': 'grok-4-1-fast',
  'grok-4': 'grok-4-1-fast',
  'grok41': 'grok-4-1-fast',
  'grok-4-1': 'grok-4-1-fast',
  'fast': 'grok-4-1-fast',
  'default': 'grok-4-1-fast',
};

/**
 * Get the default model ID
 */
export function getDefaultModel(): string {
  const defaultModel = Object.values(GROK_MODELS).find(m => m.isDefault);
  return defaultModel?.id || 'grok-4-1-fast';
}

/**
 * Get model config by ID or alias
 * @param idOrAlias - Model ID or alias
 * @returns Model config or undefined if not found
 */
export function getModel(idOrAlias: string): ModelConfig | undefined {
  const normalizedId = idOrAlias.toLowerCase();

  // Check direct match
  if (GROK_MODELS[normalizedId]) {
    return GROK_MODELS[normalizedId];
  }

  // Check aliases
  const aliasedId = MODEL_ALIASES[normalizedId];
  if (aliasedId && GROK_MODELS[aliasedId]) {
    return GROK_MODELS[aliasedId];
  }

  return undefined;
}

/**
 * Resolve model ID from alias
 * @param idOrAlias - Model ID or alias
 * @returns Resolved model ID or original if not found
 */
export function resolveModelId(idOrAlias: string): string {
  const model = getModel(idOrAlias);
  return model?.id || idOrAlias;
}

/**
 * Check if a model ID is valid
 */
export function isValidModel(idOrAlias: string): boolean {
  return getModel(idOrAlias) !== undefined;
}

/**
 * Get all available model IDs
 */
export function getModelIds(): string[] {
  return Object.keys(GROK_MODELS);
}

/**
 * Format model for display
 */
export function formatModelDisplay(model: ModelConfig): string {
  const contextStr = model.contextWindow >= 1000000
    ? `${(model.contextWindow / 1000000).toFixed(0)}M`
    : `${(model.contextWindow / 1000).toFixed(0)}K`;

  return `${model.displayName} (${contextStr} context)`;
}

/**
 * Format model pricing for display
 */
export function formatModelPricing(model: ModelConfig): string {
  return `$${model.inputPrice.toFixed(2)}/$${model.outputPrice.toFixed(2)} per 1M tokens (in/out)`;
}
