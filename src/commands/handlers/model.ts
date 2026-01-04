/**
 * /model Command Handler
 *
 * Display current model or switch to a different model.
 * Usage: /model [name]
 */

import type { Command, CommandResult, ParsedCommand, CommandContext } from '../types.js';
import {
  GROK_MODELS,
  getModel,
  resolveModelId,
  isValidModel,
  formatModelDisplay,
  formatModelPricing,
} from '../../config/models.js';

export const modelCommand: Command = {
  name: 'model',
  description: 'Display current model or switch to a different model',
  usage: '/model [name]',
  arguments: [
    {
      name: 'name',
      description: 'Model name or alias to switch to',
      required: false,
      type: 'string',
    },
  ],
  examples: [
    '/model',
    '/model grok-3-beta',
    '/model grok4',
    '/model --list',
  ],
  aliases: ['m'],

  async execute(args: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    // Handle --list flag
    if (args.flags.list || args.flags.l) {
      return {
        success: true,
        output: formatModelList(context.currentModel),
        action: { type: 'none' },
      };
    }

    // No argument - show current model
    if (args.args.length === 0) {
      const currentConfig = getModel(context.currentModel);

      if (!currentConfig) {
        return {
          success: true,
          output: `Current model: ${context.currentModel} (unknown model)\n\nUse /model --list to see available models.`,
          action: { type: 'none' },
        };
      }

      return {
        success: true,
        output: formatCurrentModel(currentConfig),
        action: { type: 'none' },
      };
    }

    // Switch to specified model
    const requestedModel = args.args[0];

    if (!isValidModel(requestedModel)) {
      const availableModels = Object.keys(GROK_MODELS).join(', ');
      return {
        success: false,
        error: `Unknown model: ${requestedModel}\n\nAvailable models: ${availableModels}\n\nUse /model --list for details.`,
      };
    }

    const resolvedId = resolveModelId(requestedModel);
    const modelConfig = getModel(resolvedId)!;

    // Check if already using this model
    if (resolvedId === context.currentModel) {
      return {
        success: true,
        output: `Already using ${modelConfig.displayName}.`,
        action: { type: 'none' },
      };
    }

    // Update the model
    context.setModel(resolvedId);

    return {
      success: true,
      output: `Switched to ${modelConfig.displayName}\n\n${formatModelDisplay(modelConfig)}\n${formatModelPricing(modelConfig)}`,
      action: { type: 'set_model', model: resolvedId },
      data: { previousModel: context.currentModel, newModel: resolvedId },
    };
  },
};

/**
 * Format current model display
 */
function formatCurrentModel(model: import('../../config/models.js').ModelConfig): string {
  const lines: string[] = [
    'Current Model',
    '=============',
    '',
    `  ${model.displayName}`,
    `  ID: ${model.id}`,
    '',
    `  ${model.description}`,
    '',
    `  Context: ${formatContextWindow(model.contextWindow)}`,
    `  Pricing: ${formatModelPricing(model)}`,
    '',
    'Capabilities:',
    `  Function Calling: ${model.capabilities.functionCalling ? 'Yes' : 'No'}`,
    `  Streaming: ${model.capabilities.streaming ? 'Yes' : 'No'}`,
    `  Vision: ${model.capabilities.vision ? 'Yes' : 'No'}`,
    '',
    'Use /model <name> to switch models, or /model --list to see all available models.',
  ];

  return lines.join('\n');
}

/**
 * Format model list display
 */
function formatModelList(currentModelId: string): string {
  const lines: string[] = [
    'Available Models',
    '================',
    '',
  ];

  for (const [id, model] of Object.entries(GROK_MODELS)) {
    const isCurrent = id === currentModelId;
    const marker = isCurrent ? '>' : ' ';
    const defaultMarker = model.isDefault ? ' (default)' : '';

    lines.push(`${marker} ${model.displayName}${defaultMarker}`);
    lines.push(`    ID: ${model.id}`);
    lines.push(`    ${model.description}`);
    lines.push(`    Context: ${formatContextWindow(model.contextWindow)} | ${formatModelPricing(model)}`);
    lines.push('');
  }

  lines.push('Use /model <name> to switch to a different model.');

  return lines.join('\n');
}

/**
 * Format context window for display
 */
function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(0)}M tokens`;
  }
  return `${(tokens / 1000).toFixed(0)}K tokens`;
}

export default modelCommand;
