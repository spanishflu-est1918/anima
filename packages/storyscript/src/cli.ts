#!/usr/bin/env node
/**
 * StoryScript CLI Parser
 * Usage: node --experimental-strip-types src/cli.ts <file.story>
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse, parseToJSON } from './index.ts';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('StoryScript Parser');
  console.log('Usage: storyscript <file.story> [--output <file.json>]');
  console.log('');
  console.log('Options:');
  console.log('  --output, -o   Write output to file instead of stdout');
  console.log('  --compact      Output compact JSON (no pretty-printing)');
  console.log('  --help, -h     Show this help');
  process.exit(0);
}

let inputFile: string | null = null;
let outputFile: string | null = null;
let compact = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--output' || arg === '-o') {
    outputFile = args[++i];
  } else if (arg === '--compact') {
    compact = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log('StoryScript Parser');
    console.log('Usage: storyscript <file.story> [--output <file.json>]');
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    inputFile = arg;
  }
}

if (!inputFile) {
  console.error('Error: No input file specified');
  process.exit(1);
}

try {
  const content = readFileSync(inputFile, 'utf-8');
  const ast = parse(content);
  const json = compact ? JSON.stringify(ast) : JSON.stringify(ast, null, 2);

  if (outputFile) {
    writeFileSync(outputFile, json);
    console.log(`Parsed ${inputFile} -> ${outputFile}`);
    
    // Print summary
    console.log(`  Scenes: ${ast.scenes.length}`);
    console.log(`  Dialogues: ${ast.dialogues.length}`);
    console.log(`  Triggers: ${ast.triggers.length}`);
  } else {
    console.log(json);
  }
} catch (err) {
  console.error('Parse error:', err instanceof Error ? err.message : err);
  process.exit(1);
}
