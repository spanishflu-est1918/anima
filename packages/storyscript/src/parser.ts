/**
 * StoryScript Parser
 * Recursive descent parser for .story files
 */

import { Lexer, Token, TokenType } from './lexer.ts';
import type * as AST from './types.ts';

export class ParseError extends Error {
  token: Token;
  constructor(message: string, token: Token) {
    super(`${message} at line ${token.line}, column ${token.column}`);
    this.name = 'ParseError';
    this.token = token;
  }
}

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;

  parse(input: string): AST.StoryFile {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const storyFile: AST.StoryFile = {
      type: 'StoryFile',
      scenes: [],
      dialogues: [],
      triggers: [],
      puzzles: [],
    };

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      if (this.check(TokenType.GAME)) {
        storyFile.game = this.parseGame();
      } else if (this.check(TokenType.CHARACTERS)) {
        storyFile.characters = this.parseCharacters();
      } else if (this.check(TokenType.INVENTORY)) {
        storyFile.inventory = this.parseInventory();
      } else if (this.check(TokenType.SCENE)) {
        storyFile.scenes.push(this.parseScene());
      } else if (this.check(TokenType.DIALOGUE)) {
        storyFile.dialogues.push(this.parseDialogue());
      } else if (this.check(TokenType.TRIGGER)) {
        storyFile.triggers.push(this.parseTrigger());
      } else if (this.check(TokenType.PUZZLE)) {
        storyFile.puzzles.push(this.parsePuzzle());
      } else if (this.check(TokenType.ACT_END)) {
        storyFile.actEnd = this.parseActEnd();
      } else if (this.check(TokenType.COMMENT)) {
        this.advance(); // Skip comments
      } else {
        // Skip unknown tokens
        this.advance();
      }
    }

    return storyFile;
  }

  // ============================================================================
  // Top-Level Parsers
  // ============================================================================

  private parseGame(): AST.GameBlock {
    this.consume(TokenType.GAME);
    const title = this.consume(TokenType.STRING).value;
    this.skipNewlines();

    const properties: Record<string, string | number> = {};

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT)) break;

        const key = this.consume(TokenType.IDENTIFIER).value;
        this.consume(TokenType.COLON);
        
        if (this.check(TokenType.STRING)) {
          properties[key] = this.advance().value;
        } else if (this.check(TokenType.NUMBER)) {
          properties[key] = parseFloat(this.advance().value);
        } else if (this.check(TokenType.IDENTIFIER)) {
          properties[key] = this.advance().value;
        }
        
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return { type: 'GameBlock', title, properties };
  }

  private parseCharacters(): AST.CharactersBlock {
    this.consume(TokenType.CHARACTERS);
    this.skipNewlines();
    
    const characters: AST.Character[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT)) break;

        characters.push(this.parseCharacter());
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return { type: 'CharactersBlock', characters };
  }

  private parseCharacter(): AST.Character {
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.COLON);
    const name = this.consume(TokenType.STRING).value;
    
    const flags: string[] = [];
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      flags.push(this.consume(TokenType.IDENTIFIER).value);
      while (this.check(TokenType.COMMA)) {
        this.advance();
        flags.push(this.consume(TokenType.IDENTIFIER).value);
      }
      this.consume(TokenType.RPAREN);
    }

    this.skipNewlines();
    const properties: Record<string, string> = {};

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT)) break;

        const key = this.consume(TokenType.IDENTIFIER).value;
        this.consume(TokenType.COLON);
        properties[key] = this.consume(TokenType.STRING).value;
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return { type: 'Character', id, name, flags, properties };
  }

  private parseInventory(): AST.InventoryBlock {
    this.consume(TokenType.INVENTORY);
    this.skipNewlines();
    
    const items: AST.InventoryItem[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT)) break;

        items.push(this.parseInventoryItem());
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return { type: 'InventoryBlock', items };
  }

  private parseInventoryItem(): AST.InventoryItem {
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.COLON);
    const name = this.consume(TokenType.STRING).value;
    
    let description = '';
    if (this.check(TokenType.DASH)) {
      this.advance();
      if (this.check(TokenType.STRING)) {
        description = this.advance().value;
      }
    }

    return { type: 'InventoryItem', id, name, description };
  }

  // ============================================================================
  // Scene Parser
  // ============================================================================

  private parseScene(): AST.SceneBlock {
    this.consume(TokenType.SCENE);
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.skipNewlines();

    const scene: AST.SceneBlock = {
      type: 'SceneBlock',
      id,
      properties: {},
      hotspots: [],
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT)) break;

        if (this.check(TokenType.DESCRIPTION)) {
          scene.description = this.parseTextBlock('DESCRIPTION');
        } else if (this.check(TokenType.ON_ENTER)) {
          scene.onEnter = this.parseTextBlock('ON_ENTER');
        } else if (this.check(TokenType.HOTSPOT)) {
          scene.hotspots.push(this.parseHotspot());
        } else if (this.check(TokenType.IDENTIFIER)) {
          // Property like location:, time:, mood:
          const key = this.advance().value;
          this.consume(TokenType.COLON);
          scene.properties[key] = this.parsePropertyValue();
        } else if (this.check(TokenType.COMMENT)) {
          this.advance();
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    // Skip trailing END if present
    if (this.check(TokenType.END)) {
      this.advance();
    }

    return scene;
  }

  private parsePropertyValue(): string | number {
    if (this.check(TokenType.STRING)) {
      return this.advance().value;
    } else if (this.check(TokenType.NUMBER) || this.check(TokenType.IDENTIFIER)) {
      // Consume everything until newline
      let value = '';
      let lastWasSlash = false;
      while (!this.check(TokenType.NEWLINE) && !this.check(TokenType.COMMENT) && !this.isAtEnd()) {
        const token = this.advance();
        value += token.value;
        lastWasSlash = token.value === '/';
        // Add space between tokens unless the next starts with a special char or last was slash
        if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.COMMENT) && !this.isAtEnd()) {
          const next = this.current();
          if (next && !['/', '-'].includes(next.value[0]) && !lastWasSlash) {
            value += ' ';
          }
        }
      }
      return value.trim();
    }
    return '';
  }

  private parseTextBlock(blockType: 'DESCRIPTION' | 'ON_ENTER' | 'CUTSCENE'): AST.TextBlock {
    this.advance(); // Skip keyword
    this.skipNewlines();

    const lines: AST.TextLine[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        const line = this.parseTextLine();
        if (line) lines.push(line);
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return { type: 'TextBlock', lines };
  }

  private parseTextLine(): AST.TextLine | null {
    if (this.check(TokenType.STRING)) {
      return { type: 'NarrativeLine', text: this.advance().value };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const firstToken = this.advance();
      const speaker = firstToken.value;
      
      // Check for (thinks) mode
      let mode: 'normal' | 'thinks' = 'normal';
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        if (this.check(TokenType.IDENTIFIER)) {
          const modeToken = this.advance();
          if (modeToken.value === 'thinks') {
            mode = 'thinks';
          }
        }
        this.consume(TokenType.RPAREN);
      }

      if (this.check(TokenType.COLON)) {
        this.advance();
        const text = this.check(TokenType.STRING) ? this.advance().value : '';
        return { type: 'DialogueLine', speaker, mode, text };
      }

      // If no colon follows, this is unquoted narrative text
      // Collect rest of line as narrative
      let text = speaker;
      while (!this.check(TokenType.NEWLINE) && !this.check(TokenType.DEDENT) && 
             !this.check(TokenType.END) && !this.isAtEnd()) {
        text += ' ' + this.advance().value;
      }
      return { type: 'NarrativeLine', text: text.trim() };
    }

    if (this.check(TokenType.COMMENT)) {
      this.advance();
    }

    return null;
  }

  // ============================================================================
  // Hotspot Parser
  // ============================================================================

  private parseHotspot(): AST.HotspotBlock {
    this.consume(TokenType.HOTSPOT);
    const id = this.consume(TokenType.IDENTIFIER).value;

    let bounds: [number, number, number, number] | undefined;
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      const nums: number[] = [];
      nums.push(parseFloat(this.consume(TokenType.NUMBER).value));
      for (let i = 0; i < 3; i++) {
        this.consume(TokenType.COMMA);
        nums.push(parseFloat(this.consume(TokenType.NUMBER).value));
      }
      this.consume(TokenType.RBRACKET);
      bounds = nums as [number, number, number, number];
    }

    this.skipNewlines();

    const hotspot: AST.HotspotBlock = {
      type: 'HotspotBlock',
      id,
      bounds,
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.IDENTIFIER) && this.peek()?.type === TokenType.COLON) {
          const key = this.advance().value;
          this.consume(TokenType.COLON);
          if (key === 'name' && this.check(TokenType.STRING)) {
            hotspot.name = this.advance().value;
          }
        } else if (this.check(TokenType.LOOK)) {
          hotspot.look = this.parseActionBlock('LOOK');
        } else if (this.check(TokenType.TALK)) {
          hotspot.talk = this.parseActionBlock('TALK');
        } else if (this.check(TokenType.USE)) {
          hotspot.use = this.parseActionBlock('USE');
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return hotspot;
  }

  private parseActionBlock(action: 'LOOK' | 'TALK' | 'USE'): AST.ActionBlock {
    this.advance(); // Skip LOOK/TALK/USE
    this.skipNewlines();

    const content: AST.Statement[] = [];

    // Check for direct goto
    if (this.check(TokenType.ARROW)) {
      content.push(this.parseGoto());
      return { type: 'ActionBlock', action, content };
    }

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        const stmt = this.parseStatement();
        if (stmt) content.push(stmt);
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return { type: 'ActionBlock', action, content };
  }

  // ============================================================================
  // Dialogue Parser
  // ============================================================================

  private parseDialogue(): AST.DialogueBlock {
    this.consume(TokenType.DIALOGUE);
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.skipNewlines();

    const content: AST.Statement[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        const stmt = this.parseStatement();
        if (stmt) content.push(stmt);
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return { type: 'DialogueBlock', id, content };
  }

  private parseChoice(): AST.ChoiceBlock {
    this.consume(TokenType.CHOICE);
    this.skipNewlines();

    const options: AST.ChoiceOption[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.CHOICE_MARKER) || this.check(TokenType.GT)) {
          options.push(this.parseChoiceOption());
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return { type: 'ChoiceBlock', options };
  }

  private parseChoiceOption(): AST.ChoiceOption {
    this.advance(); // Skip >
    
    let condition: AST.Condition | undefined;
    let text: string;

    // Check for [condition] format
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      // Parse text inside brackets as the option text (condition-less shorthand)
      let bracketText = '';
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        bracketText += this.advance().value + ' ';
      }
      this.consume(TokenType.RBRACKET);
      text = bracketText.trim();
    } else if (this.check(TokenType.STRING)) {
      text = this.advance().value;
    } else {
      text = '';
    }

    this.skipNewlines();
    const content: AST.Statement[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;
        if (this.check(TokenType.CHOICE_MARKER) || this.check(TokenType.GT)) break; // Next option

        const stmt = this.parseStatement();
        if (stmt) content.push(stmt);
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return { type: 'ChoiceOption', text, condition, content };
  }

  // ============================================================================
  // Statement Parser
  // ============================================================================

  private parseStatement(): AST.Statement | null {
    if (this.check(TokenType.STRING)) {
      return { type: 'NarrativeLine', text: this.advance().value };
    }

    if (this.check(TokenType.CHOICE)) {
      return this.parseChoice();
    }

    if (this.check(TokenType.IF)) {
      return this.parseConditional();
    }

    if (this.check(TokenType.ARROW)) {
      return this.parseGoto();
    }

    if (this.check(TokenType.GIVE)) {
      this.advance();
      const item = this.consume(TokenType.IDENTIFIER).value;
      return { type: 'GiveCommand', item };
    }

    if (this.check(TokenType.SET)) {
      return this.parseSet();
    }

    if (this.check(TokenType.EXAMINE)) {
      this.advance();
      const target = this.consume(TokenType.IDENTIFIER).value;
      return { type: 'ExamineCommand', target };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const speaker = this.advance().value;
      
      let mode: 'normal' | 'thinks' = 'normal';
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        if (this.check(TokenType.IDENTIFIER)) {
          if (this.peek()?.value === 'thinks' || this.tokens[this.pos].value === 'thinks') {
            mode = 'thinks';
          }
          this.advance();
        }
        this.consume(TokenType.RPAREN);
      }

      if (this.check(TokenType.COLON)) {
        this.advance();
        const text = this.check(TokenType.STRING) ? this.advance().value : '';
        return { type: 'DialogueLine', speaker, mode, text };
      }
    }

    if (this.check(TokenType.COMMENT)) {
      this.advance();
      return null;
    }

    return null;
  }

  private parseGoto(): AST.GotoStatement {
    this.consume(TokenType.ARROW);
    let target: string;
    if (this.check(TokenType.END)) {
      this.advance();
      target = 'END';
    } else {
      target = this.consume(TokenType.IDENTIFIER).value;
    }
    return { type: 'GotoStatement', target };
  }

  private parseSet(): AST.SetCommand {
    this.consume(TokenType.SET);
    const variable = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.EQ);
    
    let value: string | number | boolean;
    if (this.check(TokenType.STRING)) {
      value = this.advance().value;
    } else if (this.check(TokenType.NUMBER)) {
      value = parseFloat(this.advance().value);
    } else if (this.check(TokenType.IDENTIFIER)) {
      const v = this.advance().value;
      if (v === 'true') value = true;
      else if (v === 'false') value = false;
      else value = v;
    } else {
      value = '';
    }

    return { type: 'SetCommand', variable, value };
  }

  // ============================================================================
  // Conditional Parser
  // ============================================================================

  private parseConditional(): AST.ConditionalBlock {
    const branches: AST.ConditionalBranch[] = [];
    let elseBranch: AST.Statement[] | undefined;

    // Parse IF
    this.consume(TokenType.IF);
    const condition = this.parseCondition();
    this.skipNewlines();
    const content = this.parseConditionalContent();
    branches.push({ type: 'ConditionalBranch', condition, content });

    // Parse ELSE IF / ELSE
    while (this.check(TokenType.ELSE)) {
      this.advance();
      if (this.check(TokenType.IF)) {
        this.advance();
        const elseIfCondition = this.parseCondition();
        this.skipNewlines();
        const elseIfContent = this.parseConditionalContent();
        branches.push({ type: 'ConditionalBranch', condition: elseIfCondition, content: elseIfContent });
      } else {
        this.skipNewlines();
        elseBranch = this.parseConditionalContent();
        break;
      }
    }

    if (this.check(TokenType.END)) this.advance();

    return { type: 'ConditionalBlock', branches, elseBranch };
  }

  private parseConditionalContent(): AST.Statement[] {
    const content: AST.Statement[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && 
             !this.check(TokenType.ELSE) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END) || this.check(TokenType.ELSE)) break;

        const stmt = this.parseStatement();
        if (stmt) content.push(stmt);
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    return content;
  }

  private parseCondition(): AST.Condition {
    let left = this.parsePrimaryCondition();

    while (this.check(TokenType.AND) || this.check(TokenType.OR)) {
      const op = this.advance().type;
      const right = this.parsePrimaryCondition();
      if (op === TokenType.AND) {
        left = { type: 'AndCondition', left, right };
      } else {
        left = { type: 'OrCondition', left, right };
      }
    }

    return left;
  }

  private parsePrimaryCondition(): AST.Condition {
    if (this.check(TokenType.NOT)) {
      this.advance();
      const condition = this.parsePrimaryCondition();
      return { type: 'NotCondition', condition };
    }

    if (this.check(TokenType.HAS)) {
      this.advance();
      this.consume(TokenType.LPAREN);
      const item = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.RPAREN);
      return { type: 'HasCondition', item };
    }

    if (this.check(TokenType.AT)) {
      this.advance();
      this.consume(TokenType.LPAREN);
      const location = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.RPAREN);
      return { type: 'AtCondition', location };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const varName = this.advance().value;
      
      // Check for comparison
      if (this.check(TokenType.EQ) || this.check(TokenType.EQEQ) || 
          this.check(TokenType.NEQ) || this.check(TokenType.GT) ||
          this.check(TokenType.LT) || this.check(TokenType.GTE) ||
          this.check(TokenType.LTE)) {
        const op = this.advance();
        let opType: AST.ComparisonCondition['operator'];
        switch (op.type) {
          case TokenType.EQ:
          case TokenType.EQEQ: opType = '='; break;
          case TokenType.NEQ: opType = '!='; break;
          case TokenType.GT: opType = '>'; break;
          case TokenType.LT: opType = '<'; break;
          case TokenType.GTE: opType = '>='; break;
          case TokenType.LTE: opType = '<='; break;
          default: opType = '=';
        }

        let right: string | number | boolean;
        if (this.check(TokenType.STRING)) {
          right = this.advance().value;
        } else if (this.check(TokenType.NUMBER)) {
          right = parseFloat(this.advance().value);
        } else if (this.check(TokenType.IDENTIFIER)) {
          const v = this.advance().value;
          if (v === 'true') right = true;
          else if (v === 'false') right = false;
          else right = v;
        } else {
          right = '';
        }

        return { type: 'ComparisonCondition', left: varName, operator: opType, right };
      }

      // Simple variable check
      return { type: 'VariableCondition', variable: varName };
    }

    throw new ParseError('Expected condition', this.current());
  }

  // ============================================================================
  // Trigger Parser
  // ============================================================================

  private parseTrigger(): AST.TriggerBlock {
    this.consume(TokenType.TRIGGER);
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.skipNewlines();

    const trigger: AST.TriggerBlock = {
      type: 'TriggerBlock',
      id,
      requirements: [],
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.REQUIRE)) {
          this.advance();
          const condition = this.parseCondition();
          trigger.requirements.push({ type: 'Requirement', condition });
        } else if (this.check(TokenType.AFTER)) {
          this.advance();
          // Parse the AFTER condition (e.g., "3 minutes OR window_looked >= 3")
          const conditions: string[] = [];
          let condStr = '';
          while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
            if (this.check(TokenType.OR)) {
              if (condStr.trim()) conditions.push(condStr.trim());
              condStr = '';
              this.advance();
            } else {
              condStr += this.advance().value + ' ';
            }
          }
          if (condStr.trim()) conditions.push(condStr.trim());
          trigger.afterCondition = { type: 'AfterCondition', conditions };
        } else if (this.check(TokenType.CUTSCENE)) {
          trigger.cutscene = this.parseTextBlock('CUTSCENE');
        } else if (this.check(TokenType.ARROW)) {
          trigger.goto = this.parseGoto().target;
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return trigger;
  }

  // ============================================================================
  // Puzzle Parser
  // ============================================================================

  private parsePuzzle(): AST.PuzzleBlock {
    this.consume(TokenType.PUZZLE);
    const id = this.consume(TokenType.IDENTIFIER).value;
    this.skipNewlines();

    const puzzle: AST.PuzzleBlock = {
      type: 'PuzzleBlock',
      id,
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.IDENTIFIER) && this.peek()?.type === TokenType.COLON) {
          const key = this.advance().value;
          this.consume(TokenType.COLON);
          if (key === 'description' && this.check(TokenType.STRING)) {
            puzzle.description = this.advance().value;
          }
        } else if (this.check(TokenType.SOLUTION)) {
          this.advance();
          puzzle.solution = this.parseListBlock();
        } else if (this.check(TokenType.HINTS)) {
          this.advance();
          puzzle.hints = this.parseListBlock();
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return puzzle;
  }

  private parseListBlock(): string[] {
    this.skipNewlines();
    const items: string[] = [];

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        // Parse numbered items like "1. TALK grocery_clerk"
        if (this.check(TokenType.NUMBER)) {
          this.advance();
          // Skip the dot
          while (this.check(TokenType.IDENTIFIER) || this.check(TokenType.STRING) || 
                 this.check(TokenType.DASH) || this.check(TokenType.LPAREN)) {
            let item = '';
            while (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
              item += this.advance().value + ' ';
            }
            if (item.trim()) items.push(item.trim());
            break;
          }
        } else if (this.check(TokenType.STRING)) {
          items.push(this.advance().value);
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return items;
  }

  // ============================================================================
  // Act End Parser
  // ============================================================================

  private parseActEnd(): AST.ActEndBlock {
    this.consume(TokenType.ACT_END);
    this.skipNewlines();

    const actEnd: AST.ActEndBlock = {
      type: 'ActEndBlock',
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.IDENTIFIER) && this.peek()?.type === TokenType.COLON) {
          const key = this.advance().value;
          this.consume(TokenType.COLON);
          if (key === 'summary' && this.check(TokenType.STRING)) {
            actEnd.summary = this.advance().value;
          } else if (key === 'next' && this.check(TokenType.IDENTIFIER)) {
            actEnd.next = this.advance().value;
            // Handle .story extension
            while (this.check(TokenType.IDENTIFIER) || this.check(TokenType.NUMBER)) {
              actEnd.next += this.advance().value;
            }
          }
        } else if (this.check(TokenType.STATE_CHECK)) {
          actEnd.stateCheck = this.parseStateCheck();
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return actEnd;
  }

  private parseStateCheck(): AST.StateCheckBlock {
    this.consume(TokenType.STATE_CHECK);
    this.skipNewlines();

    const stateCheck: AST.StateCheckBlock = {
      type: 'StateCheckBlock',
      requirements: [],
      tracked: [],
    };

    if (this.check(TokenType.INDENT)) {
      this.advance();
      while (!this.check(TokenType.DEDENT) && !this.check(TokenType.END) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check(TokenType.DEDENT) || this.check(TokenType.END)) break;

        if (this.check(TokenType.COMMENT)) {
          this.advance();
        } else if (this.check(TokenType.REQUIRE)) {
          this.advance();
          
          // Handle HAS(item) format
          if (this.check(TokenType.HAS)) {
            this.advance();
            this.consume(TokenType.LPAREN);
            const item = this.consume(TokenType.IDENTIFIER).value;
            this.consume(TokenType.RPAREN);
            stateCheck.requirements.push({ 
              type: 'StateRequirement', 
              variable: `HAS(${item})`, 
              operator: '=', 
              value: true 
            });
          } else {
            const variable = this.consume(TokenType.IDENTIFIER).value;
            const opToken = this.advance();
            let operator: AST.StateRequirement['operator'] = '=';
            if (opToken.type === TokenType.EQ || opToken.type === TokenType.EQEQ) operator = '=';
            else if (opToken.type === TokenType.NEQ) operator = '!=';
            
            let value: string | number | boolean;
            if (this.check(TokenType.IDENTIFIER)) {
              const v = this.advance().value;
              if (v === 'true') value = true;
              else if (v === 'false') value = false;
              else value = v;
            } else if (this.check(TokenType.NUMBER)) {
              value = parseFloat(this.advance().value);
            } else if (this.check(TokenType.STRING)) {
              value = this.advance().value;
            } else {
              value = '';
            }

            stateCheck.requirements.push({ type: 'StateRequirement', variable, operator, value });
          }
        } else if (this.check(TokenType.TRACK)) {
          this.advance();
          stateCheck.tracked.push(this.consume(TokenType.IDENTIFIER).value);
        } else {
          this.advance();
        }
        this.skipNewlines();
      }
      if (this.check(TokenType.DEDENT)) this.advance();
    }

    if (this.check(TokenType.END)) this.advance();

    return stateCheck;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private consume(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(`Expected ${type}, got ${this.current().type}`, this.current());
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos + 1];
  }

  private isAtEnd(): boolean {
    return this.current()?.type === TokenType.EOF || this.pos >= this.tokens.length;
  }

  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.COMMENT)) {
      this.advance();
    }
  }
}
