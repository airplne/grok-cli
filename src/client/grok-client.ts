import OpenAI from 'openai';

export interface GrokClientConfig {
  apiKey?: string;
  model?: string;
  timeout?: number;
}

export class GrokClient {
  private client: OpenAI;
  public model: string;

  constructor(config: GrokClientConfig = {}) {
    // KEYCHAIN-ONLY: apiKey must be provided via config from CredentialStore
    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error(
        'Missing API key. GrokClient requires API key from keychain.\n' +
        'Run \'grok auth login\' to store credential securely.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
      timeout: config.timeout || 120000,
    });

    this.model = config.model || 'grok-4-1-fast';
  }

  get openai(): OpenAI {
    return this.client;
  }
}
