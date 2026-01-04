#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { App } from './ui/app.js';
import { getModel, getDefaultModel, getModelIds, GROK_MODELS } from './config/models.js';

// Parse CLI arguments
const args = process.argv.slice(2);

// Handle --help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
grok-cli - Claude Code for xAI Grok

USAGE:
  grok [options] [prompt]

OPTIONS:
  --model, -m <model>   Set the model to use (default: ${getDefaultModel()})
  --list-models         List all available models
  --version, -v         Show version
  --help, -h            Show this help message

MODELS:
${getModelIds().map(id => {
  const m = GROK_MODELS[id];
  const defaultStr = m.isDefault ? ' (default)' : '';
  return `  ${id.padEnd(25)} ${m.displayName}${defaultStr}`;
}).join('\n')}

EXAMPLES:
  grok                           Start interactive mode
  grok "Hello, what can you do?" Send a prompt directly
  grok --model grok-3-beta       Start with a specific model
  grok -m grok4 "Complex task"   Use model alias with prompt

COMMANDS (in interactive mode):
  /help                 Show available commands
  /model [name]         Show or switch model
  /clear                Clear conversation
  /history [count]      Show conversation history
  /exit                 Exit the CLI

ENVIRONMENT:
  GROK_API_KEY          xAI API key (required)
  XAI_API_KEY           Alternative API key env var
  GROK_LOG_LEVEL        Log level (debug, info, warn, error)

For more information, visit: https://github.com/your-org/grok-cli
`);
  process.exit(0);
}

// Handle --version flag
if (args.includes('--version') || args.includes('-v')) {
  console.log('grok-cli version 1.0.0');
  process.exit(0);
}

// Handle --list-models flag
if (args.includes('--list-models')) {
  console.log('\nAvailable Models:');
  console.log('=================\n');

  for (const [id, model] of Object.entries(GROK_MODELS)) {
    const defaultStr = model.isDefault ? ' (default)' : '';
    const contextStr = model.contextWindow >= 1000000
      ? `${(model.contextWindow / 1000000).toFixed(0)}M`
      : `${(model.contextWindow / 1000).toFixed(0)}K`;

    console.log(`${model.displayName}${defaultStr}`);
    console.log(`  ID: ${id}`);
    console.log(`  ${model.description}`);
    console.log(`  Context: ${contextStr} tokens`);
    console.log(`  Pricing: $${model.inputPrice.toFixed(2)}/$${model.outputPrice.toFixed(2)} per 1M tokens (in/out)`);
    console.log('');
  }

  process.exit(0);
}

// Parse --model flag
let model: string | undefined;
const modelFlagIndex = args.findIndex(a => a === '--model' || a === '-m');
if (modelFlagIndex !== -1 && args[modelFlagIndex + 1]) {
  const requestedModel = args[modelFlagIndex + 1];
  const modelConfig = getModel(requestedModel);

  if (!modelConfig) {
    console.error(`Error: Unknown model "${requestedModel}"`);
    console.error(`\nAvailable models: ${getModelIds().join(', ')}`);
    console.error('\nUse --list-models for details.');
    process.exit(1);
  }

  model = modelConfig.id;
  // Remove model flag and value from args
  args.splice(modelFlagIndex, 2);
}

// Extract prompt (remaining non-flag arguments)
const prompt = args
  .filter(a => !a.startsWith('-'))
  .join(' ')
  .trim() || undefined;

// Check for API key
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  console.error('Error: Missing API key.');
  console.error('\nSet GROK_API_KEY or XAI_API_KEY environment variable:');
  console.error('  export GROK_API_KEY="xai-your-key-here"');
  console.error('\nGet your API key from: https://console.x.ai/');
  process.exit(1);
}

// Render the app
render(<App initialPrompt={prompt} model={model} />);
