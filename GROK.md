# GROK.md - Project Context

This file provides context to grok-cli about your project.

## Project Overview

grok-cli is a Claude Code clone that uses the xAI Grok API.

## Coding Guidelines

- Use TypeScript with strict mode
- Follow ESM module conventions (use .js extensions in imports)
- Use Ink for terminal UI components
- Prefer React functional components with hooks
- Use React.memo for performance-critical components

## Directory Structure

- `src/` - Source code
  - `agent/` - Agent loop and execution
  - `client/` - API client wrapper
  - `tools/` - Tool implementations
  - `ui/` - Ink React components
  - `security/` - Path validation and command allowlist
  - `context/` - GROK.md loading

## Testing

Run tests with: `npm test`
Run in development: `npm run dev`

## API Configuration

Set your API key:
```bash
export GROK_API_KEY="xai-your-key-here"
# or
export XAI_API_KEY="xai-your-key-here"
```
