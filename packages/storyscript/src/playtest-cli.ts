#!/usr/bin/env tsx
/**
 * StoryScript Playtester CLI
 * Runs an AI agent through a story with verbose logging
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse, StoryRunner } from './index.ts';

// Personality types for different playtesting perspectives
const PERSONALITIES = {
  explorer: `You are a CURIOUS EXPLORER player. You want to look at everything, talk to everyone, and find all the details. You take your time, examine objects thoroughly, and try every dialogue option when possible. You appreciate atmosphere and worldbuilding.`,
  
  rusher: `You are an IMPATIENT SPEEDRUNNER. You want to get through the story quickly. You only do what's necessary to progress. You skip optional content and don't examine things unless required. You get frustrated by slow pacing.`,
  
  detective: `You are a DETECTIVE player. You're looking for clues, inconsistencies, and hidden meanings. You pay attention to names, dates, and details that might be important later. You're suspicious of every character.`,
  
  romantic: `You are a STORY-FOCUSED player who cares most about characters and relationships. You're drawn to emotional moments and character interactions. You want to learn about the woman on the bus. You appreciate good dialogue.`,
  
  skeptic: `You are a SKEPTICAL player. You question the game's logic, notice plot holes, and point out when things don't make sense. You're hard to please but give honest feedback about what works and what doesn't.`
};

type Personality = keyof typeof PERSONALITIES;

class PlaytestLogger {
  private logFile: string;
  private buffer: string[] = [];
  
  constructor(storyName: string, personality: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.logFile = path.join(process.cwd(), `playtest-${storyName}-${personality}-${timestamp}.log`);
    this.log(`=== PLAYTEST START ===`);
    this.log(`Story: ${storyName}`);
    this.log(`Personality: ${personality}`);
    this.log(`Time: ${new Date().toISOString()}`);
    this.log(`======================\n`);
  }
  
  log(message: string) {
    const timestamp = new Date().toISOString().slice(11, 19);
    const line = `[${timestamp}] ${message}`;
    console.log(line);
    this.buffer.push(line);
  }
  
  thought(message: string) {
    this.log(`💭 ${message}`);
  }
  
  action(verb: string, target: string) {
    this.log(`▶ ${verb}:${target}`);
  }
  
  response(text: string | string[] | undefined) {
    if (!text) return;
    const lines = Array.isArray(text) ? text : text.split('\n');
    lines.forEach(line => this.log(`  "${line}"`));
  }
  
  choice(index: number, text: string) {
    this.log(`✓ Choice ${index}: "${text}"`);
  }
  
  score(category: string, value: number, note?: string) {
    this.log(`📊 ${category}: ${value}/10${note ? ` — ${note}` : ''}`);
  }
  
  section(title: string) {
    this.log(`\n${'='.repeat(50)}`);
    this.log(title);
    this.log('='.repeat(50));
  }
  
  save() {
    fs.writeFileSync(this.logFile, this.buffer.join('\n'));
    console.log(`\nLog saved to: ${this.logFile}`);
  }
}

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  const { execSync } = await import('child_process');
  
  // Escape the prompt for shell
  const fullPrompt = `${systemPrompt}\n\n${prompt}`.replace(/'/g, "'\\''");
  
  try {
    const result = execSync(
      `~/bin/opencode run -m zai-coding-plan/glm-4.7 '${fullPrompt}'`,
      { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (e: any) {
    console.error('OpenCode error:', e.message?.slice(0, 100));
    return '{"choice": 0, "reasoning": "fallback"}';
  }
}

async function playScene(
  runner: StoryRunner, 
  logger: PlaytestLogger,
  personality: string,
  maxActions: number = 20
): Promise<{ pacing: number; engagement: number; clarity: number; notes: string }> {
  const scene = runner.getCurrentScene();
  const sceneData = runner.getScene();
  
  logger.section(`SCENE: ${scene}`);
  logger.log(`Location: ${sceneData.properties?.location || 'Unknown'}`);
  logger.log(`Mood: ${sceneData.properties?.mood || 'Unknown'}`);
  
  const description = runner.getDescription();
  logger.log(`\nDescription:`);
  logger.response(description);
  
  let actionCount = 0;
  const actionsTaken: string[] = [];
  
  while (actionCount < maxActions) {
    const actions = runner.getAvailableActions();
    
    if (actions.length === 0 && !runner.isInDialogue()) {
      logger.thought("No more actions available");
      break;
    }
    
    // If in dialogue with choices
    if (runner.isInDialogue()) {
      const choices = runner.getChoices();
      if (choices.length > 0) {
        const choicePrompt = `You're in a dialogue. Available choices:
${choices.map((c, i) => `${i}: ${c}`).join('\n')}

Based on your personality, which do you choose? Respond with JSON: {"choice": <number>, "reasoning": "<why>"}`;
        
        const llmResponse = await callLLM(choicePrompt, personality);
        try {
          const parsed = JSON.parse(llmResponse);
          logger.thought(parsed.reasoning);
          const result = runner.selectChoice(parsed.choice);
          logger.choice(parsed.choice, choices[parsed.choice]);
          if (result.text) logger.response(result.text);
          actionsTaken.push(`choose:${parsed.choice}`);
        } catch {
          // Default to first choice
          const result = runner.selectChoice(0);
          logger.choice(0, choices[0]);
          if (result.text) logger.response(result.text);
          actionsTaken.push(`choose:0`);
        }
      } else {
        runner.exitDialogue();
      }
    } else {
      // Choose an action
      const actionPrompt = `You're in scene "${scene}". Available actions:
${actions.map(a => `- ${a.verb}:${a.target} (${a.name})`).join('\n')}

Actions you've already taken: ${actionsTaken.join(', ') || 'none'}

What do you do next? Consider your personality. If you've explored enough, you can say "exit" to move on.
Respond with JSON: {"action": "<verb>:<target>" or "exit", "reasoning": "<why>"}`;
      
      const llmResponse = await callLLM(actionPrompt, personality);
      try {
        const parsed = JSON.parse(llmResponse);
        logger.thought(parsed.reasoning);
        
        if (parsed.action === 'exit' || parsed.action.startsWith('exit:')) {
          // Try to find an exit
          const exitAction = actions.find(a => a.verb === 'use' && a.target.includes('exit'));
          if (exitAction) {
            const result = runner.takeAction('use', exitAction.target);
            logger.action('use', exitAction.target);
            if (result.text) logger.response(result.text);
            if (result.transition) {
              logger.log(`→ Transitioning to: ${result.transition}`);
              break;
            }
          } else {
            logger.thought("Ready to move on but no exit available yet");
          }
        } else {
          const [verb, target] = parsed.action.split(':');
          const result = runner.takeAction(verb, target);
          logger.action(verb, target);
          if (result.text) logger.response(result.text);
          actionsTaken.push(parsed.action);
          
          if (result.transition) {
            logger.log(`→ Transitioning to: ${result.transition}`);
            break;
          }
        }
      } catch {
        // Random action fallback
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        const result = runner.takeAction(randomAction.verb, randomAction.target);
        logger.action(randomAction.verb, randomAction.target);
        if (result.text) logger.response(result.text);
        actionsTaken.push(`${randomAction.verb}:${randomAction.target}`);
      }
    }
    
    actionCount++;
  }
  
  // Score the scene
  const scorePrompt = `You just played through scene "${scene}" in an adventure game.

Description: ${description}
Actions taken: ${actionsTaken.join(', ')}

Rate the scene:
- Pacing (1-10): Was it too slow, too fast, or just right?
- Engagement (1-10): Did it make you want to keep playing?
- Clarity (1-10): Was it clear what to do and what was happening?

Also provide any notes or suggestions.

Respond with JSON: {"pacing": <n>, "engagement": <n>, "clarity": <n>, "notes": "<your thoughts>"}`;
  
  const scoreResponse = await callLLM(scorePrompt, personality);
  try {
    const scores = JSON.parse(scoreResponse);
    logger.score('Pacing', scores.pacing);
    logger.score('Engagement', scores.engagement);
    logger.score('Clarity', scores.clarity);
    logger.log(`📝 Notes: ${scores.notes}`);
    return scores;
  } catch {
    return { pacing: 5, engagement: 5, clarity: 5, notes: 'Could not parse scores' };
  }
}

async function runPlaytest(storyPath: string, personalityName: Personality) {
  const storyContent = fs.readFileSync(storyPath, 'utf-8');
  const storyName = path.basename(storyPath, '.story');
  
  const story = parse(storyContent);
  const runner = new StoryRunner(story);
  const personality = PERSONALITIES[personalityName];
  const logger = new PlaytestLogger(storyName, personalityName);
  
  logger.log(`\n🎭 Personality: ${personalityName.toUpperCase()}`);
  logger.log(personality);
  
  const sceneScores: any[] = [];
  let sceneCount = 0;
  const maxScenes = 10;
  
  while (sceneCount < maxScenes) {
    const scores = await playScene(runner, logger, personality);
    sceneScores.push({ scene: runner.getCurrentScene(), ...scores });
    
    // Check if we can continue
    const actions = runner.getAvailableActions();
    const hasExit = actions.some(a => a.verb === 'use');
    
    if (!hasExit) {
      logger.log('\n🏁 No more exits available. Playtest complete.');
      break;
    }
    
    sceneCount++;
  }
  
  // Final summary
  logger.section('FINAL REPORT');
  
  const avgPacing = sceneScores.reduce((a, b) => a + b.pacing, 0) / sceneScores.length;
  const avgEngagement = sceneScores.reduce((a, b) => a + b.engagement, 0) / sceneScores.length;
  const avgClarity = sceneScores.reduce((a, b) => a + b.clarity, 0) / sceneScores.length;
  const overall = (avgPacing + avgEngagement + avgClarity) / 3;
  
  logger.log(`Scenes played: ${sceneScores.length}`);
  logger.log(`Average Pacing: ${avgPacing.toFixed(1)}/10`);
  logger.log(`Average Engagement: ${avgEngagement.toFixed(1)}/10`);
  logger.log(`Average Clarity: ${avgClarity.toFixed(1)}/10`);
  logger.log(`Overall Score: ${overall.toFixed(1)}/10`);
  
  logger.save();
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: tsx playtest-cli.ts <story.story> [personality]');
  console.log('Personalities: explorer, rusher, detective, romantic, skeptic');
  process.exit(1);
}

const storyPath = args[0];
const personality = (args[1] || 'explorer') as Personality;

if (!PERSONALITIES[personality]) {
  console.error(`Unknown personality: ${personality}`);
  console.log('Available: explorer, rusher, detective, romantic, skeptic');
  process.exit(1);
}

runPlaytest(storyPath, personality).catch(console.error);
