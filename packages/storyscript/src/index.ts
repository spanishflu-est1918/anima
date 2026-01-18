/**
 * @anima/storyscript
 * Parser and Runtime for StoryScript adventure game DSL
 */

export * from './types.ts';
export { Lexer, TokenType } from './lexer.ts';
export type { Token } from './lexer.ts';
export { Parser, ParseError } from './parser.ts';
export { StoryRunner, createRunner } from './runtime.ts';
export type { Action, ActionResult, ChoiceResult, GameState, TriggerResult } from './runtime.ts';
export { StoryPlaytester, createClaudeAdapter, createOpenAIAdapter, createMockAdapter } from './playtester.ts';
export type { SceneReport, PlaytestReport, LLMAdapter, ActionRecord, ChoiceRecord } from './playtester.ts';

import { Parser } from './parser.ts';
import type { StoryFile } from './types.js';

/**
 * Parse a StoryScript file contents into an AST
 */
export function parse(input: string): StoryFile {
  const parser = new Parser();
  return parser.parse(input);
}

/**
 * Parse and return JSON representation of the story graph
 */
export function parseToJSON(input: string): string {
  const ast = parse(input);
  return JSON.stringify(ast, null, 2);
}
