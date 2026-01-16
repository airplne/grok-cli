#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { App } from './ui/app.js';
import { getModel, getDefaultModel, getModelIds, GROK_MODELS } from './config/models.js';
import { CredentialStore } from './auth/credential-store.js';

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

AUTHENTICATION:
  grok auth login       Store API key securely in system keychain
  grok auth logout      Remove stored API key
  grok auth status      Check credential status and expiration
  grok auth doctor      Diagnose keychain availability

  Credentials are stored encrypted in your system keychain and expire
  after 7 days for security. Run 'grok auth login' once to get started.

ENVIRONMENT:
  GROK_LOG_LEVEL        Log level (debug, info, warn, error)

For more information, visit: https://github.com/airplne/grok-cli
`);
  process.exit(0);
}

// Handle --version flag
if (args.includes('--version') || args.includes('-v')) {
  try {
    // Read version from package.json at runtime
    const packageJsonUrl = new URL('../package.json', import.meta.url);
    const packageJsonPath = fileURLToPath(packageJsonUrl);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    console.log(`grok-cli version ${packageJson.version}`);
  } catch (err) {
    // Fallback if package.json can't be read
    console.log('grok-cli version unknown');
  }
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

// Handle auth commands (before TUI, before key check)
if (args[0] === 'auth') {
  const { handleAuthCommand } = await import('./commands/handlers/auth.js');
  // Parse flags for auth command (e.g., --force, -f)
  const authFlags: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      authFlags.force = true;
    }
  }
  await handleAuthCommand(args.slice(1), authFlags);
  process.exit(0); // Auth commands always exit after execution
}

// Check for API key from keychain (NO environment variable support)
let apiKey: string | null = null;
let offlineMode = false;
let offlineModeReason: 'missing' | 'expired' | 'keytar-unavailable' | null = null;

// Check keychain for credential
const credential = await CredentialStore.getKey();

if (credential) {
  // Valid, non-expired credential from keychain
  apiKey = credential.apiKey;
  offlineMode = false;
} else {
  // No valid credential - determine reason
  const status = await CredentialStore.getStatus();

  if (!await CredentialStore.isAvailable()) {
    // Keytar not available
    offlineMode = true;
    offlineModeReason = 'keytar-unavailable';
  } else if (status.exists && status.expired) {
    // Expired credential
    offlineMode = true;
    offlineModeReason = 'expired';
  } else {
    // No credential configured
    offlineMode = true;
    offlineModeReason = 'missing';
  }
}

// Show offline mode banner if needed
if (offlineMode) {
  console.log('');

  if (offlineModeReason === 'keytar-unavailable') {
    const availability = await CredentialStore.getAvailability();
    console.log('Warning: OFFLINE MODE - System Keychain Unavailable');
    if (!availability.available) {
      console.log('\n' + availability.remediation);
      console.log('\nℹ️  After fixing, run: grok auth doctor');
      console.log('   Then try: grok auth login');
    }
  } else if (offlineModeReason === 'expired') {
    console.log('Warning: OFFLINE MODE - Credential Expired');
    console.log('   Your credential expired. Run \'grok auth login\' to re-authenticate.');
    console.log('   Credentials expire every 7 days for security.');
  } else {
    console.log('Info: OFFLINE MODE (No AI)');
    console.log('   Run \'grok auth login\' to enable AI features.');
  }

  console.log('   Tools available: grep, read, write, edit, glob, bash, todo');
  console.log('');
}

// Render the app
render(<App initialPrompt={prompt} model={model} apiKey={apiKey} offlineMode={offlineMode} />);
