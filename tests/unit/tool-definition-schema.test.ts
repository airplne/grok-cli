/**
 * Unit Tests: Tool Definition Schema
 * Tests that Zod schemas are correctly converted to JSON Schema for LLM tools
 */

import { describe, it, expect } from 'vitest';
import { TodoTool } from '../../src/tools/todo.js';

describe('Tool Definition Schema', () => {
  describe('TodoTool schema', () => {
    it('generates correct JSON schema for todos array of objects', () => {
      const tool = new TodoTool();
      const definition = tool.getDefinition();

      // Check top-level structure
      expect(definition.function.name).toBe('TodoWrite');
      expect(definition.function.parameters).toHaveProperty('type', 'object');
      expect(definition.function.parameters).toHaveProperty('properties');

      const params = definition.function.parameters as any;

      // Check todos property exists
      expect(params.properties).toHaveProperty('todos');

      // Check todos is an array
      const todosSchema = params.properties.todos;
      expect(todosSchema.type).toBe('array');

      // Check todos.items is an object (not a string!)
      expect(todosSchema.items).toHaveProperty('type', 'object');
      expect(todosSchema.items).toHaveProperty('properties');

      // Check todos.items has content, status, activeForm properties
      const itemProps = todosSchema.items.properties;
      expect(itemProps).toHaveProperty('content');
      expect(itemProps).toHaveProperty('status');
      expect(itemProps).toHaveProperty('activeForm');

      // Check content is a string
      expect(itemProps.content.type).toBe('string');

      // Check status is an enum
      expect(itemProps.status.type).toBe('string');
      expect(itemProps.status.enum).toEqual(['pending', 'in_progress', 'completed']);

      // Check activeForm is a string
      expect(itemProps.activeForm.type).toBe('string');

      // Check required fields
      expect(todosSchema.items.required).toContain('content');
      expect(todosSchema.items.required).toContain('status');
      expect(todosSchema.items.required).toContain('activeForm');
    });

    it('includes descriptions in schema', () => {
      const tool = new TodoTool();
      const definition = tool.getDefinition();
      const params = definition.function.parameters as any;

      const todosSchema = params.properties.todos;
      expect(todosSchema.description).toBe('The updated todo list');

      const itemProps = todosSchema.items.properties;
      expect(itemProps.content.description).toBe('Task description in imperative form');
      expect(itemProps.status.description).toBe('Task status');
      expect(itemProps.activeForm.description).toBe('Present continuous form shown during execution');
    });
  });
});
