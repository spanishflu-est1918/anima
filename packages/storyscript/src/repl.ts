#!/usr/bin/env tsx
/**
 * StoryScript REPL
 * Play adventure games interactively
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { parse } from './index.ts';
import { StoryRunner } from './runtime.ts';

const storyPath = process.argv[2];
if (!storyPath) {
  console.log('Usage: tsx repl.ts <story.story>');
  process.exit(1);
}

const storyContent = fs.readFileSync(storyPath, 'utf-8');
const story = parse(storyContent);
const runner = new StoryRunner(story);

// Handle transitions that might be triggers
function handleTransition(target: string) {
  // Check if it's a trigger
  const trigger = story.triggers?.find((t: any) => t.id === target);
  if (trigger) {
    console.log('\n--- CUTSCENE ---');
    // Show cutscene lines
    for (const line of trigger.cutscene?.lines || []) {
      if (line.type === 'NarrativeLine') {
        console.log(`  ${line.text}`);
      } else if (line.type === 'DialogueLine') {
        const mode = line.mode ? ` (${line.mode})` : '';
        console.log(`  ${line.speaker}${mode}: "${line.text}"`);
      }
    }
    console.log('--- END CUTSCENE ---\n');
    // Follow the goto
    if (trigger.goto) {
      runner.transition(trigger.goto);
      showScene();
      showActions();
    }
  } else {
    // It's a scene
    runner.transition(target);
    showScene();
    showActions();
  }
}

function showScene() {
  const scene = runner.getCurrentScene();
  const data = runner.getScene();
  
  console.log('\n' + '='.repeat(50));
  console.log(`SCENE: ${scene}`);
  if (data.properties?.location) console.log(`Location: ${data.properties.location}`);
  console.log('='.repeat(50));
  
  const desc = runner.getDescription();
  if (desc) {
    console.log('\n' + (Array.isArray(desc) ? desc.join('\n') : desc));
  }
}

function showActions() {
  const actions = runner.getAvailableActions();
  console.log('\nACTIONS:');
  actions.forEach(a => {
    console.log(`  ${a.verb}:${a.target} — ${a.name}`);
  });
}

function showChoices() {
  const choices = runner.getChoices();
  if (choices.length > 0) {
    console.log('\nCHOICES:');
    choices.forEach((c, i) => {
      console.log(`  ${i}: ${c}`);
    });
  }
}

function showState() {
  const state = runner.getState();
  console.log('\nSTATE:');
  console.log(`  Scene: ${state.currentScene}`);
  console.log(`  Inventory: ${state.inventory.size ? [...state.inventory].join(', ') : '(empty)'}`);
  console.log(`  Flags: ${JSON.stringify(state.flags)}`);
}

function showHelp() {
  console.log(`
COMMANDS:
  look:<target>   — Look at something
  talk:<target>   — Talk to someone  
  use:<target>    — Use/interact with something
  <number>        — Select dialogue choice
  
  actions         — Show available actions
  state           — Show inventory and flags
  help            — Show this help
  quit            — Exit game
`);
}

// Start
console.log('\n🎮 STORYSCRIPT REPL');
console.log('Type "help" for commands\n');
showScene();
showActions();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.setPrompt('\n> ');
rl.prompt();

rl.on('line', (line) => {
  const input = line.trim().toLowerCase();
  
  if (!input) {
    rl.prompt();
    return;
  }
  
  if (input === 'quit' || input === 'exit') {
    console.log('\nGoodbye! 🪽');
    process.exit(0);
  }
  
  if (input === 'help') {
    showHelp();
    rl.prompt();
    return;
  }
  
  if (input === 'actions') {
    showActions();
    rl.prompt();
    return;
  }
  
  if (input === 'state') {
    showState();
    rl.prompt();
    return;
  }
  
  // Dialogue choice
  if (/^\d+$/.test(input)) {
    const idx = parseInt(input);
    const choices = runner.getChoices();
    if (idx >= 0 && idx < choices.length) {
      const result = runner.selectChoice(idx);
      if (result.text) {
        const lines = Array.isArray(result.text) ? result.text : [result.text];
        lines.forEach(l => console.log(`  "${l}"`));
      }
      if (result.goto) {
        console.log(`\n→ Going to ${result.goto}...`);
        handleTransition(result.goto);
      } else {
        showChoices();
      }
    } else {
      console.log('Invalid choice');
    }
    rl.prompt();
    return;
  }
  
  // Action (verb:target)
  if (input.includes(':')) {
    const [verb, ...rest] = input.split(':');
    const target = rest.join(':'); // handle colons in target
    const result = runner.takeAction(verb.toUpperCase(), target);
    
    if (result.text) {
      const lines = Array.isArray(result.text) ? result.text : [result.text];
      lines.forEach(l => console.log(`  "${l}"`));
    }
    
    if (result.dialogue) {
      showChoices();
    }
    
    if (result.goto) {
      console.log(`\n→ Going to ${result.goto}...`);
      handleTransition(result.goto);
    }
    
    rl.prompt();
    return;
  }
  
  console.log('Unknown command. Type "help" for commands.');
  rl.prompt();
});
