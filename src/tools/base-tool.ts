import { z } from 'zod';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodObject<any>;

  // Override to require confirmation
  requiresConfirmation = false;

  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.zodToJsonSchema(this.parameters),
      },
    };
  }

  private zodToJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
    // Convert Zod schema to JSON Schema for OpenAI
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      properties[key] = this.zodTypeToJsonSchema(zodType);

      if (!zodType.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
    if (zodType instanceof z.ZodString) {
      return { type: 'string', description: zodType.description };
    }
    if (zodType instanceof z.ZodNumber) {
      return { type: 'number', description: zodType.description };
    }
    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean', description: zodType.description };
    }
    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(zodType.element),
        description: zodType.description,
      };
    }
    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }
    return { type: 'string' };
  }
}
