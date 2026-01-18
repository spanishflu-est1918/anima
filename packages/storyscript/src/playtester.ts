/**
 * StoryScript Playtester - AI agent that plays through stories and provides feedback
 */

import type { StoryRunner, Action, ActionResult, ChoiceResult } from './runtime.ts';

// ============================================================================
// Types
// ============================================================================

export interface SceneReport {
  sceneId: string;
  actions: ActionRecord[];
  choicesMade: ChoiceRecord[];
  pacing: number;      // 1-10
  engagement: number;  // 1-10
  clarity: number;     // 1-10
  notes: string[];
}

export interface ActionRecord {
  verb: string;
  target: string;
  resultSummary: string;
}

export interface ChoiceRecord {
  options: string[];
  selected: number;
  selectedText: string;
  reasoning: string;
}

export interface PlaytestReport {
  scenes: SceneReport[];
  overallScore: number;
  suggestions: string[];
  emotionalArc: string;
}

export interface LLMAdapter {
  /**
   * Complete a prompt and return the response
   */
  complete(prompt: string): Promise<string>;
}

// ============================================================================
// StoryPlaytester
// ============================================================================

export class StoryPlaytester {
  private llm: LLMAdapter;
  private maxActionsPerScene: number;
  private maxScenes: number;
  private verbose: boolean;

  constructor(llm: LLMAdapter, options?: {
    maxActionsPerScene?: number;
    maxScenes?: number;
    verbose?: boolean;
  }) {
    this.llm = llm;
    this.maxActionsPerScene = options?.maxActionsPerScene ?? 10;
    this.maxScenes = options?.maxScenes ?? 50;
    this.verbose = options?.verbose ?? false;
  }

  async playthrough(runner: StoryRunner): Promise<PlaytestReport> {
    const sceneReports: SceneReport[] = [];
    let scenesVisited = 0;

    while (scenesVisited < this.maxScenes) {
      const sceneId = runner.getCurrentScene();
      const report = await this.playScene(runner, sceneId);
      sceneReports.push(report);
      scenesVisited++;

      // Check if story ended (no more scenes or explicit end)
      const state = runner.getState();
      if (state.currentScene !== sceneId) {
        // Scene changed during playthrough
        continue;
      }

      // Check if we have unexplored scenes
      const allScenes = runner.getAllScenes();
      const unvisited = allScenes.filter(s => !state.visitedScenes.has(s.id));
      
      if (unvisited.length === 0 && !runner.isInDialogue()) {
        // All scenes visited and not in dialogue - story complete
        break;
      }

      // If stuck, try to find a way out
      const actions = runner.getAvailableActions();
      if (actions.length === 0 && !runner.isInDialogue()) {
        break;
      }
    }

    return this.generateFinalReport(sceneReports, runner);
  }

  private async playScene(runner: StoryRunner, sceneId: string): Promise<SceneReport> {
    const actions: ActionRecord[] = [];
    const choicesMade: ChoiceRecord[] = [];
    let actionCount = 0;

    // Get scene intro
    const description = runner.getDescription();
    const onEnter = runner.getOnEnterText();
    
    if (this.verbose) {
      console.log(`\n=== Scene: ${sceneId} ===`);
      if (description) console.log(description);
      if (onEnter) console.log(onEnter);
    }

    // Play through scene
    while (actionCount < this.maxActionsPerScene) {
      // Check for choices first
      if (runner.isInDialogue()) {
        const choices = runner.getChoices();
        if (choices.length > 0) {
          const choice = await this.makeChoice(runner, choices);
          choicesMade.push(choice);
          actionCount++;
          
          // Check if scene changed
          if (runner.getCurrentScene() !== sceneId) break;
          continue;
        }
      }

      // Get available actions
      const availableActions = runner.getAvailableActions();
      if (availableActions.length === 0) {
        break;
      }

      // Decide on action
      const action = await this.decideAction(runner, availableActions, actions);
      if (!action) break;

      // Execute action
      const result = runner.takeAction(action.verb, action.target);
      actions.push({
        verb: action.verb,
        target: action.target,
        resultSummary: result.text.join(' ').slice(0, 200),
      });
      actionCount++;

      if (this.verbose) {
        console.log(`> ${action.verb} ${action.target}`);
        console.log(result.text.join('\n'));
      }

      // Handle goto
      if (result.goto) {
        runner.transition(result.goto);
        break;
      }

      // Handle choices from action
      if (result.choices && result.choices.length > 0) {
        continue; // Will handle in next iteration
      }
    }

    // Evaluate scene
    return this.evaluateScene(sceneId, description, onEnter, actions, choicesMade);
  }

  private async decideAction(
    runner: StoryRunner,
    available: Action[],
    previousActions: ActionRecord[]
  ): Promise<Action | null> {
    // Avoid repeating actions we've already done
    const unexplored = available.filter(a => 
      !previousActions.some(prev => 
        prev.verb === a.verb && prev.target === a.target
      )
    );

    if (unexplored.length === 0) {
      return null; // Nothing new to explore
    }

    const prompt = `You are playtesting an interactive story. You're in a scene with these available actions:

${unexplored.map((a, i) => `${i + 1}. ${a.verb} ${a.target}`).join('\n')}

Previous actions in this scene:
${previousActions.length === 0 ? 'None yet' : previousActions.map(a => `- ${a.verb} ${a.target}`).join('\n')}

Scene description: ${runner.getDescription()}

As a curious player exploring the story, which action would you take next? Reply with just the number.`;

    try {
      const response = await this.llm.complete(prompt);
      const index = parseInt(response.trim().match(/\d+/)?.[0] ?? '1', 10) - 1;
      
      if (index >= 0 && index < unexplored.length) {
        return unexplored[index];
      }
      return unexplored[0];
    } catch {
      // Fallback: just pick the first unexplored action
      return unexplored[0];
    }
  }

  private async makeChoice(runner: StoryRunner, choices: string[]): Promise<ChoiceRecord> {
    const prompt = `You are playtesting an interactive story. You're presented with these dialogue choices:

${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}

As a player exploring the story, which would you choose? Consider:
- What seems most interesting narratively?
- What might reveal more story content?

Reply with just the number and a brief reason (e.g., "2 - seems like it will reveal more about the mystery").`;

    let selected = 0;
    let reasoning = 'Exploring first option';

    try {
      const response = await this.llm.complete(prompt);
      const match = response.match(/^(\d+)/);
      if (match) {
        selected = Math.max(0, Math.min(parseInt(match[1], 10) - 1, choices.length - 1));
        reasoning = response.replace(/^\d+\s*[-–—]?\s*/, '').trim() || 'Selected this option';
      }
    } catch {
      // Fallback to first choice
    }

    // Execute the choice
    const result = runner.selectChoice(selected);

    if (this.verbose) {
      console.log(`> Choice: "${choices[selected]}"`);
      console.log(result.text.join('\n'));
    }

    return {
      options: choices,
      selected,
      selectedText: choices[selected],
      reasoning,
    };
  }

  private async evaluateScene(
    sceneId: string,
    description: string,
    onEnter: string,
    actions: ActionRecord[],
    choices: ChoiceRecord[]
  ): Promise<SceneReport> {
    const prompt = `You are evaluating a scene from an interactive story for playtest feedback.

Scene: ${sceneId}
Description: ${description || '(none)'}
On Enter: ${onEnter || '(none)'}

Actions taken:
${actions.length === 0 ? 'None' : actions.map(a => `- ${a.verb} ${a.target}: ${a.resultSummary}`).join('\n')}

Choices made:
${choices.length === 0 ? 'None' : choices.map(c => `- Chose "${c.selectedText}" from ${c.options.length} options`).join('\n')}

Rate this scene on a scale of 1-10 for:
1. PACING - How well does the scene flow? Is it too slow/fast?
2. ENGAGEMENT - How interesting is the content?
3. CLARITY - Is it clear what's happening and what to do?

Also provide 1-3 specific notes or suggestions.

Reply in this exact format:
PACING: [1-10]
ENGAGEMENT: [1-10]
CLARITY: [1-10]
NOTES:
- [note 1]
- [note 2]`;

    let pacing = 5;
    let engagement = 5;
    let clarity = 5;
    const notes: string[] = [];

    try {
      const response = await this.llm.complete(prompt);
      
      const pacingMatch = response.match(/PACING:\s*(\d+)/i);
      const engagementMatch = response.match(/ENGAGEMENT:\s*(\d+)/i);
      const clarityMatch = response.match(/CLARITY:\s*(\d+)/i);
      
      if (pacingMatch) pacing = Math.min(10, Math.max(1, parseInt(pacingMatch[1], 10)));
      if (engagementMatch) engagement = Math.min(10, Math.max(1, parseInt(engagementMatch[1], 10)));
      if (clarityMatch) clarity = Math.min(10, Math.max(1, parseInt(clarityMatch[1], 10)));

      // Extract notes
      const notesSection = response.split(/NOTES:/i)[1];
      if (notesSection) {
        const noteMatches = notesSection.match(/-\s*(.+)/g);
        if (noteMatches) {
          notes.push(...noteMatches.map(n => n.replace(/^-\s*/, '').trim()));
        }
      }
    } catch {
      notes.push('Evaluation failed - using default scores');
    }

    return {
      sceneId,
      actions,
      choicesMade: choices,
      pacing,
      engagement,
      clarity,
      notes,
    };
  }

  private async generateFinalReport(
    scenes: SceneReport[],
    runner: StoryRunner
  ): Promise<PlaytestReport> {
    // Calculate overall score
    const avgPacing = scenes.reduce((sum, s) => sum + s.pacing, 0) / scenes.length;
    const avgEngagement = scenes.reduce((sum, s) => sum + s.engagement, 0) / scenes.length;
    const avgClarity = scenes.reduce((sum, s) => sum + s.clarity, 0) / scenes.length;
    const overallScore = Math.round((avgPacing + avgEngagement + avgClarity) / 3 * 10) / 10;

    // Generate emotional arc and suggestions via LLM
    const summaryPrompt = `You just playtested an interactive story with ${scenes.length} scenes.

Scene-by-scene summary:
${scenes.map(s => `- ${s.sceneId}: Pacing ${s.pacing}/10, Engagement ${s.engagement}/10, Clarity ${s.clarity}/10`).join('\n')}

Key notes from playtesting:
${scenes.flatMap(s => s.notes).slice(0, 10).map(n => `- ${n}`).join('\n')}

Provide:
1. EMOTIONAL_ARC: A 1-2 sentence description of the emotional journey (e.g., "Starts mysterious, builds tension, but lacks a satisfying resolution")
2. SUGGESTIONS: 3-5 actionable suggestions to improve the story

Format:
EMOTIONAL_ARC: [description]
SUGGESTIONS:
- [suggestion 1]
- [suggestion 2]
- [suggestion 3]`;

    let emotionalArc = 'Unable to analyze emotional arc';
    const suggestions: string[] = [];

    try {
      const response = await this.llm.complete(summaryPrompt);
      
      const arcMatch = response.match(/EMOTIONAL_ARC:\s*(.+?)(?=SUGGESTIONS:|$)/is);
      if (arcMatch) {
        emotionalArc = arcMatch[1].trim();
      }

      const suggestionsSection = response.split(/SUGGESTIONS:/i)[1];
      if (suggestionsSection) {
        const suggestionMatches = suggestionsSection.match(/-\s*(.+)/g);
        if (suggestionMatches) {
          suggestions.push(...suggestionMatches.map(s => s.replace(/^-\s*/, '').trim()));
        }
      }
    } catch {
      suggestions.push('Unable to generate suggestions - LLM error');
    }

    return {
      scenes,
      overallScore,
      suggestions,
      emotionalArc,
    };
  }
}

// ============================================================================
// Simple LLM Adapters
// ============================================================================

/**
 * Create an Anthropic Claude adapter
 */
export function createClaudeAdapter(apiKey: string, model = 'claude-sonnet-4-20250514'): LLMAdapter {
  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json() as { content: Array<{ type: string; text?: string }> };
      return data.content[0]?.text ?? '';
    },
  };
}

/**
 * Create an OpenAI-compatible adapter
 */
export function createOpenAIAdapter(
  apiKey: string, 
  model = 'gpt-4o-mini',
  baseUrl = 'https://api.openai.com/v1'
): LLMAdapter {
  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    },
  };
}

/**
 * Create a mock adapter for testing (cycles through pre-defined responses)
 */
export function createMockAdapter(responses?: string[]): LLMAdapter {
  let index = 0;
  const defaultResponses = [
    '1', // For action selection
    '1 - exploring the main path',  // For choice selection
    `PACING: 7
ENGAGEMENT: 8
CLARITY: 7
NOTES:
- Scene has good atmosphere
- Could use more interactive elements`,
    `EMOTIONAL_ARC: The story builds intrigue through exploration but could benefit from clearer stakes.
SUGGESTIONS:
- Add more character depth early on
- Consider adding environmental storytelling
- Make objectives clearer to the player`,
  ];

  const responseList = responses ?? defaultResponses;

  return {
    async complete(_prompt: string): Promise<string> {
      const response = responseList[index % responseList.length];
      index++;
      return response;
    },
  };
}
