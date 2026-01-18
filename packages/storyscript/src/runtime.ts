/**
 * StoryScript Runtime - Executor for parsed StoryScript AST
 * Provides an API for agents to play through interactive stories
 */

import type {
  StoryFile,
  SceneBlock,
  DialogueBlock,
  TriggerBlock,
  HotspotBlock,
  Statement,
  ChoiceBlock,
  ChoiceOption,
  Condition,
  TextLine,
  ConditionalBlock,
  TextBlock,
} from './types.ts';

// ============================================================================
// Runtime Types
// ============================================================================

export interface Action {
  verb: 'LOOK' | 'TALK' | 'USE';
  target: string;
  hotspotId: string;
  available: boolean;
}

export interface ActionResult {
  success: boolean;
  text: string[];
  itemsGiven: string[];
  flagsSet: Record<string, string | number | boolean>;
  goto?: string;
  choices?: string[];
}

export interface ChoiceResult {
  success: boolean;
  text: string[];
  itemsGiven: string[];
  flagsSet: Record<string, string | number | boolean>;
  goto?: string;
  nextChoices?: string[];
}

export interface GameState {
  currentScene: string;
  inventory: Set<string>;
  flags: Record<string, string | number | boolean>;
  visitedScenes: Set<string>;
  dialogueStack: string[];
}

export interface TriggerResult {
  triggered: boolean;
  triggerId: string;
  cutsceneText: string[];
  goto?: string;
}

// ============================================================================
// StoryRunner Class
// ============================================================================

export class StoryRunner {
  private story: StoryFile;
  private state: GameState;
  private currentDialogue: DialogueBlock | null = null;
  private currentChoices: ChoiceOption[] = [];
  private pendingText: string[] = [];

  constructor(story: StoryFile, initialScene?: string) {
    this.story = story;
    
    // Initialize state
    const firstScene = initialScene || story.scenes[0]?.id || '';
    this.state = {
      currentScene: firstScene,
      inventory: new Set<string>(),
      flags: {},
      visitedScenes: new Set<string>(),
      dialogueStack: [],
    };

    if (firstScene) {
      this.state.visitedScenes.add(firstScene);
    }
  }

  // ==========================================================================
  // Scene Navigation
  // ==========================================================================

  getCurrentScene(): string {
    return this.state.currentScene;
  }

  getScene(sceneId?: string): SceneBlock | undefined {
    const id = sceneId || this.state.currentScene;
    return this.story.scenes.find(s => s.id === id);
  }

  getDescription(): string {
    const scene = this.getScene();
    if (!scene?.description) return '';
    return this.renderTextBlock(scene.description);
  }

  getOnEnterText(): string {
    const scene = this.getScene();
    if (!scene?.onEnter) return '';
    return this.renderTextBlock(scene.onEnter);
  }

  canTransition(target: string): boolean {
    // Check if target scene exists
    const targetScene = this.story.scenes.find(s => s.id === target);
    if (!targetScene) return false;

    // Check if any trigger blocks this transition
    // (triggers with requirements we don't meet)
    return true;
  }

  transition(target: string): void {
    if (!this.canTransition(target)) {
      throw new Error(`Cannot transition to scene: ${target}`);
    }

    this.state.currentScene = target;
    this.state.visitedScenes.add(target);
    this.currentDialogue = null;
    this.currentChoices = [];
  }

  // ==========================================================================
  // Hotspots & Actions
  // ==========================================================================

  getHotspots(): HotspotBlock[] {
    const scene = this.getScene();
    return scene?.hotspots || [];
  }

  getAvailableActions(): Action[] {
    const hotspots = this.getHotspots();
    const actions: Action[] = [];

    for (const hotspot of hotspots) {
      if (hotspot.look) {
        actions.push({
          verb: 'LOOK',
          target: hotspot.name || hotspot.id,
          hotspotId: hotspot.id,
          available: true,
        });
      }
      if (hotspot.talk) {
        actions.push({
          verb: 'TALK',
          target: hotspot.name || hotspot.id,
          hotspotId: hotspot.id,
          available: true,
        });
      }
      if (hotspot.use) {
        actions.push({
          verb: 'USE',
          target: hotspot.name || hotspot.id,
          hotspotId: hotspot.id,
          available: true,
        });
      }
    }

    return actions;
  }

  takeAction(verb: string, target: string): ActionResult {
    const hotspots = this.getHotspots();
    const hotspot = hotspots.find(
      h => h.id === target || h.name === target || h.name?.toLowerCase() === target.toLowerCase()
    );

    if (!hotspot) {
      return {
        success: false,
        text: [`No hotspot found: ${target}`],
        itemsGiven: [],
        flagsSet: {},
      };
    }

    const actionBlock = 
      verb === 'LOOK' ? hotspot.look :
      verb === 'TALK' ? hotspot.talk :
      verb === 'USE' ? hotspot.use : null;

    if (!actionBlock) {
      return {
        success: false,
        text: [`Cannot ${verb} ${target}`],
        itemsGiven: [],
        flagsSet: {},
      };
    }

    return this.executeStatements(actionBlock.content);
  }

  // ==========================================================================
  // Dialogue & Choices
  // ==========================================================================

  enterDialogue(dialogueId: string): ActionResult {
    const dialogue = this.story.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) {
      return {
        success: false,
        text: [`Dialogue not found: ${dialogueId}`],
        itemsGiven: [],
        flagsSet: {},
      };
    }

    this.currentDialogue = dialogue;
    this.state.dialogueStack.push(dialogueId);
    
    return this.executeStatements(dialogue.content);
  }

  getChoices(): string[] {
    return this.currentChoices.map(opt => opt.text);
  }

  selectChoice(index: number): ChoiceResult {
    if (index < 0 || index >= this.currentChoices.length) {
      return {
        success: false,
        text: ['Invalid choice index'],
        itemsGiven: [],
        flagsSet: {},
      };
    }

    const choice = this.currentChoices[index];
    
    // Check if choice has a condition
    if (choice.condition && !this.evaluateCondition(choice.condition)) {
      return {
        success: false,
        text: ['Choice condition not met'],
        itemsGiven: [],
        flagsSet: {},
      };
    }

    // Clear current choices
    this.currentChoices = [];
    
    // Execute choice content
    const result = this.executeStatements(choice.content);
    
    // Check if new choices were set
    if (this.currentChoices.length > 0) {
      result.choices = this.getChoices();
    }
    
    return {
      ...result,
      nextChoices: this.currentChoices.length > 0 ? this.getChoices() : undefined,
    };
  }

  isInDialogue(): boolean {
    return this.currentDialogue !== null || this.currentChoices.length > 0;
  }

  exitDialogue(): void {
    this.currentDialogue = null;
    this.currentChoices = [];
    this.state.dialogueStack = [];
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  getState(): GameState {
    return {
      ...this.state,
      inventory: new Set(this.state.inventory),
      visitedScenes: new Set(this.state.visitedScenes),
    };
  }

  hasItem(item: string): boolean {
    return this.state.inventory.has(item);
  }

  giveItem(item: string): void {
    this.state.inventory.add(item);
  }

  removeItem(item: string): void {
    this.state.inventory.delete(item);
  }

  getFlag(name: string): string | number | boolean | undefined {
    return this.state.flags[name];
  }

  setFlag(name: string, value: string | number | boolean): void {
    this.state.flags[name] = value;
  }

  // ==========================================================================
  // Triggers
  // ==========================================================================

  checkTriggers(): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const trigger of this.story.triggers) {
      if (this.checkTrigger(trigger)) {
        const result: TriggerResult = {
          triggered: true,
          triggerId: trigger.id,
          cutsceneText: trigger.cutscene 
            ? this.renderTextBlockLines(trigger.cutscene) 
            : [],
          goto: trigger.goto,
        };
        results.push(result);
      }
    }

    return results;
  }

  private checkTrigger(trigger: TriggerBlock): boolean {
    // Check all requirements
    for (const req of trigger.requirements) {
      if (!this.evaluateCondition(req.condition)) {
        return false;
      }
    }

    // Check AFTER conditions if present
    if (trigger.afterCondition) {
      // For now, we skip time-based conditions
      // In a real implementation, you'd track time spent, interaction counts, etc.
      for (const cond of trigger.afterCondition.conditions) {
        // Parse conditions like "3 minutes" or "window_looked >= 3"
        if (cond.includes('minutes') || cond.includes('seconds')) {
          // Time-based: skip for now
          continue;
        }
        // Interaction count: check flag
        const match = cond.match(/(\w+)\s*(>=|<=|>|<|==|=)\s*(\d+)/);
        if (match) {
          const [, varName, op, valStr] = match;
          const val = parseInt(valStr, 10);
          const current = this.state.flags[varName];
          if (typeof current !== 'number') return false;
          
          switch (op) {
            case '>=': if (!(current >= val)) return false; break;
            case '<=': if (!(current <= val)) return false; break;
            case '>': if (!(current > val)) return false; break;
            case '<': if (!(current < val)) return false; break;
            case '=':
            case '==': if (!(current === val)) return false; break;
          }
        }
      }
    }

    return true;
  }

  // ==========================================================================
  // Condition Evaluation
  // ==========================================================================

  evaluateCondition(condition: Condition): boolean {
    switch (condition.type) {
      case 'HasCondition':
        return this.state.inventory.has(condition.item);
      
      case 'NotCondition':
        return !this.evaluateCondition(condition.condition);
      
      case 'AtCondition':
        return this.state.currentScene === condition.location;
      
      case 'VariableCondition':
        // A bare variable is truthy if it exists and is truthy
        const val = this.state.flags[condition.variable];
        return val !== undefined && val !== false && val !== 0 && val !== '';
      
      case 'ComparisonCondition': {
        const left = this.state.flags[condition.left];
        const right = condition.right;
        
        switch (condition.operator) {
          case '=':
          case '==':
            return left === right;
          case '!=':
            return left !== right;
          case '>':
            return (left as number) > (right as number);
          case '<':
            return (left as number) < (right as number);
          case '>=':
            return (left as number) >= (right as number);
          case '<=':
            return (left as number) <= (right as number);
          default:
            return false;
        }
      }
      
      case 'AndCondition':
        return this.evaluateCondition(condition.left) && this.evaluateCondition(condition.right);
      
      case 'OrCondition':
        return this.evaluateCondition(condition.left) || this.evaluateCondition(condition.right);
      
      default:
        return false;
    }
  }

  // ==========================================================================
  // Statement Execution
  // ==========================================================================

  private executeStatements(statements: Statement[]): ActionResult {
    const text: string[] = [];
    const itemsGiven: string[] = [];
    const flagsSet: Record<string, string | number | boolean> = {};
    let goto: string | undefined;
    let choices: string[] | undefined;

    for (const stmt of statements) {
      switch (stmt.type) {
        case 'NarrativeLine':
          text.push(stmt.text);
          break;
        
        case 'DialogueLine':
          if (stmt.mode === 'thinks') {
            text.push(`${stmt.speaker} (thinks): "${stmt.text}"`);
          } else {
            text.push(`${stmt.speaker}: "${stmt.text}"`);
          }
          break;
        
        case 'GotoStatement':
          if (stmt.target === 'END') {
            this.exitDialogue();
          } else {
            // Check if it's a dialogue reference
            const dialogue = this.story.dialogues.find(d => d.id === stmt.target);
            if (dialogue) {
              const dialogueResult = this.enterDialogue(stmt.target);
              text.push(...dialogueResult.text);
              itemsGiven.push(...dialogueResult.itemsGiven);
              Object.assign(flagsSet, dialogueResult.flagsSet);
              if (dialogueResult.goto) goto = dialogueResult.goto;
              if (dialogueResult.choices) choices = dialogueResult.choices;
            } else {
              // It's a scene transition
              goto = stmt.target;
            }
          }
          break;
        
        case 'GiveCommand':
          console.log('  [DEBUG] GIVE command found:', stmt.item);
          this.giveItem(stmt.item);
          itemsGiven.push(stmt.item);
          break;
        
        case 'SetCommand':
          this.setFlag(stmt.variable, stmt.value);
          flagsSet[stmt.variable] = stmt.value;
          break;
        
        case 'ChoiceBlock':
          // Filter choices by condition
          this.currentChoices = stmt.options.filter(opt => 
            !opt.condition || this.evaluateCondition(opt.condition)
          );
          choices = this.getChoices();
          break;
        
        case 'ConditionalBlock':
          const condResult = this.executeConditional(stmt);
          text.push(...condResult.text);
          itemsGiven.push(...condResult.itemsGiven);
          Object.assign(flagsSet, condResult.flagsSet);
          if (condResult.goto) goto = condResult.goto;
          if (condResult.choices) choices = condResult.choices;
          break;
      }
    }

    return { success: true, text, itemsGiven, flagsSet, goto, choices };
  }

  private executeConditional(conditional: ConditionalBlock): ActionResult {
    // Find the first matching branch
    for (const branch of conditional.branches) {
      const conditionResult = this.evaluateCondition(branch.condition);
      console.log('  [DEBUG] Condition:', JSON.stringify(branch.condition), '→', conditionResult);
      if (conditionResult) {
        return this.executeStatements(branch.content);
      }
    }

    // Execute else branch if no condition matched
    if (conditional.elseBranch) {
      console.log('  [DEBUG] Executing elseBranch');
      return this.executeStatements(conditional.elseBranch);
    }

    return { success: true, text: [], itemsGiven: [], flagsSet: {} };
  }

  // ==========================================================================
  // Text Rendering
  // ==========================================================================

  private renderTextBlock(block: TextBlock): string {
    return this.renderTextBlockLines(block).join('\n');
  }

  private renderTextBlockLines(block: TextBlock): string[] {
    const lines: string[] = [];
    
    for (const line of block.lines) {
      switch (line.type) {
        case 'NarrativeLine':
          lines.push(line.text);
          break;
        case 'DialogueLine':
          if (line.mode === 'thinks') {
            lines.push(`${line.speaker} (thinks): "${line.text}"`);
          } else {
            lines.push(`${line.speaker}: "${line.text}"`);
          }
          break;
        case 'ThoughtLine':
          lines.push(`${line.speaker} (thinks): "${line.text}"`);
          break;
      }
    }
    
    return lines;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  getAllScenes(): SceneBlock[] {
    return this.story.scenes;
  }

  getAllDialogues(): DialogueBlock[] {
    return this.story.dialogues;
  }

  getInventoryItems(): string[] {
    return Array.from(this.state.inventory);
  }

  getItemInfo(itemId: string): { name: string; description: string } | undefined {
    const item = this.story.inventory?.items.find(i => i.id === itemId);
    if (!item) return undefined;
    return { name: item.name, description: item.description };
  }

  getCharacterInfo(charId: string): { name: string; description?: string } | undefined {
    const char = this.story.characters?.characters.find(c => c.id === charId);
    if (!char) return undefined;
    return { name: char.name, description: char.properties.description };
  }

  reset(initialScene?: string): void {
    const firstScene = initialScene || this.story.scenes[0]?.id || '';
    this.state = {
      currentScene: firstScene,
      inventory: new Set<string>(),
      flags: {},
      visitedScenes: new Set<string>(),
      dialogueStack: [],
    };
    if (firstScene) {
      this.state.visitedScenes.add(firstScene);
    }
    this.currentDialogue = null;
    this.currentChoices = [];
  }

  // ==========================================================================
  // Serialization (for save/load)
  // ==========================================================================

  serialize(): string {
    return JSON.stringify({
      currentScene: this.state.currentScene,
      inventory: Array.from(this.state.inventory),
      flags: this.state.flags,
      visitedScenes: Array.from(this.state.visitedScenes),
      dialogueStack: this.state.dialogueStack,
    });
  }

  static deserialize(story: StoryFile, serialized: string): StoryRunner {
    const data = JSON.parse(serialized);
    const runner = new StoryRunner(story, data.currentScene);
    runner.state.inventory = new Set(data.inventory);
    runner.state.flags = data.flags;
    runner.state.visitedScenes = new Set(data.visitedScenes);
    runner.state.dialogueStack = data.dialogueStack;
    return runner;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRunner(story: StoryFile, initialScene?: string): StoryRunner {
  return new StoryRunner(story, initialScene);
}
