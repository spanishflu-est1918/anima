/**
 * StoryScript AST Types
 */

// ============================================================================
// Base Types
// ============================================================================

export interface Position {
  line: number;
  column: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export interface BaseNode {
  type: string;
  location?: Location;
}

// ============================================================================
// Top-Level Nodes
// ============================================================================

export interface StoryFile extends BaseNode {
  type: 'StoryFile';
  game?: GameBlock;
  characters?: CharactersBlock;
  inventory?: InventoryBlock;
  scenes: SceneBlock[];
  dialogues: DialogueBlock[];
  triggers: TriggerBlock[];
  puzzles: PuzzleBlock[];
  actEnd?: ActEndBlock;
}

export interface GameBlock extends BaseNode {
  type: 'GameBlock';
  title: string;
  properties: Record<string, string | number>;
}

export interface CharactersBlock extends BaseNode {
  type: 'CharactersBlock';
  characters: Character[];
}

export interface Character extends BaseNode {
  type: 'Character';
  id: string;
  name: string;
  flags: string[];
  properties: Record<string, string>;
}

export interface InventoryBlock extends BaseNode {
  type: 'InventoryBlock';
  items: InventoryItem[];
}

export interface InventoryItem extends BaseNode {
  type: 'InventoryItem';
  id: string;
  name: string;
  description: string;
}

// ============================================================================
// Scene Nodes
// ============================================================================

export interface SceneBlock extends BaseNode {
  type: 'SceneBlock';
  id: string;
  properties: Record<string, string | number>;
  description?: TextBlock;
  onEnter?: TextBlock;
  hotspots: HotspotBlock[];
}

export interface TextBlock extends BaseNode {
  type: 'TextBlock';
  lines: TextLine[];
}

export type TextLine = NarrativeLine | DialogueLine | ThoughtLine | CommandLine;

export interface NarrativeLine extends BaseNode {
  type: 'NarrativeLine';
  text: string;
}

export interface DialogueLine extends BaseNode {
  type: 'DialogueLine';
  speaker: string;
  mode: 'normal' | 'thinks';
  text: string;
}

export interface ThoughtLine extends BaseNode {
  type: 'ThoughtLine';
  speaker: string;
  text: string;
}

export interface HotspotBlock extends BaseNode {
  type: 'HotspotBlock';
  id: string;
  bounds?: [number, number, number, number]; // [x, y, width, height]
  name?: string;
  look?: ActionBlock;
  talk?: ActionBlock;
  use?: ActionBlock;
}

export interface ActionBlock extends BaseNode {
  type: 'ActionBlock';
  action: 'LOOK' | 'TALK' | 'USE';
  content: Statement[];
}

// ============================================================================
// Dialogue Nodes
// ============================================================================

export interface DialogueBlock extends BaseNode {
  type: 'DialogueBlock';
  id: string;
  content: Statement[];
}

export interface ChoiceBlock extends BaseNode {
  type: 'ChoiceBlock';
  options: ChoiceOption[];
}

export interface ChoiceOption extends BaseNode {
  type: 'ChoiceOption';
  text: string;
  condition?: Condition;
  content: Statement[];
}

// ============================================================================
// Trigger Nodes
// ============================================================================

export interface TriggerBlock extends BaseNode {
  type: 'TriggerBlock';
  id: string;
  requirements: Requirement[];
  afterCondition?: AfterCondition;
  cutscene?: TextBlock;
  goto?: string;
}

export interface Requirement extends BaseNode {
  type: 'Requirement';
  condition: Condition;
}

export interface AfterCondition extends BaseNode {
  type: 'AfterCondition';
  conditions: string[]; // "3 minutes", "window_looked >= 3", etc.
}

// ============================================================================
// Puzzle Nodes
// ============================================================================

export interface PuzzleBlock extends BaseNode {
  type: 'PuzzleBlock';
  id: string;
  description?: string;
  solution?: string[];
  hints?: string[];
}

// ============================================================================
// Act End Node
// ============================================================================

export interface ActEndBlock extends BaseNode {
  type: 'ActEndBlock';
  summary?: string;
  next?: string;
  stateCheck?: StateCheckBlock;
}

export interface StateCheckBlock extends BaseNode {
  type: 'StateCheckBlock';
  requirements: StateRequirement[];
  tracked: string[];
}

export interface StateRequirement extends BaseNode {
  type: 'StateRequirement';
  variable: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

// ============================================================================
// Statements & Commands
// ============================================================================

export type Statement = 
  | NarrativeLine 
  | DialogueLine 
  | ChoiceBlock 
  | ConditionalBlock 
  | GotoStatement 
  | GiveCommand 
  | SetCommand 
  | ExamineCommand;

export interface GotoStatement extends BaseNode {
  type: 'GotoStatement';
  target: string; // "END" or dialogue/scene id
}

export interface GiveCommand extends BaseNode {
  type: 'GiveCommand';
  item: string;
}

export interface SetCommand extends BaseNode {
  type: 'SetCommand';
  variable: string;
  value: string | number | boolean;
}

export interface ExamineCommand extends BaseNode {
  type: 'ExamineCommand';
  target: string;
}

// ============================================================================
// Conditionals
// ============================================================================

export interface ConditionalBlock extends BaseNode {
  type: 'ConditionalBlock';
  branches: ConditionalBranch[];
  elseBranch?: Statement[];
}

export interface ConditionalBranch extends BaseNode {
  type: 'ConditionalBranch';
  condition: Condition;
  content: Statement[];
}

export type Condition = 
  | HasCondition 
  | NotCondition 
  | AtCondition 
  | ComparisonCondition 
  | AndCondition 
  | OrCondition
  | VariableCondition;

export interface HasCondition extends BaseNode {
  type: 'HasCondition';
  item: string;
}

export interface NotCondition extends BaseNode {
  type: 'NotCondition';
  condition: Condition;
}

export interface AtCondition extends BaseNode {
  type: 'AtCondition';
  location: string;
}

export interface ComparisonCondition extends BaseNode {
  type: 'ComparisonCondition';
  left: string;
  operator: '=' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  right: string | number | boolean;
}

export interface VariableCondition extends BaseNode {
  type: 'VariableCondition';
  variable: string;
}

export interface AndCondition extends BaseNode {
  type: 'AndCondition';
  left: Condition;
  right: Condition;
}

export interface OrCondition extends BaseNode {
  type: 'OrCondition';
  left: Condition;
  right: Condition;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ASTNode = 
  | StoryFile 
  | GameBlock 
  | CharactersBlock 
  | Character
  | InventoryBlock 
  | InventoryItem
  | SceneBlock 
  | TextBlock 
  | HotspotBlock 
  | ActionBlock
  | DialogueBlock 
  | ChoiceBlock 
  | ChoiceOption
  | TriggerBlock 
  | Requirement
  | PuzzleBlock
  | ActEndBlock
  | StateCheckBlock
  | Statement
  | Condition;
