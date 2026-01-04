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
    const apiKey = config.apiKey
      || process.env.GROK_API_KEY
      || process.env.XAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GROK_API_KEY or XAI_API_KEY environment variable.'
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
