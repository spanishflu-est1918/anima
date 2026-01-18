/**
 * StoryScript Lexer
 * Tokenizes .story files for the parser
 */

export const TokenType = {
  // Keywords
  GAME: 'GAME',
  CHARACTERS: 'CHARACTERS',
  INVENTORY: 'INVENTORY',
  SCENE: 'SCENE',
  DESCRIPTION: 'DESCRIPTION',
  ON_ENTER: 'ON_ENTER',
  HOTSPOT: 'HOTSPOT',
  LOOK: 'LOOK',
  TALK: 'TALK',
  USE: 'USE',
  DIALOGUE: 'DIALOGUE',
  CHOICE: 'CHOICE',
  TRIGGER: 'TRIGGER',
  REQUIRE: 'REQUIRE',
  AFTER: 'AFTER',
  CUTSCENE: 'CUTSCENE',
  PUZZLE: 'PUZZLE',
  SOLUTION: 'SOLUTION',
  HINTS: 'HINTS',
  ACT_END: 'ACT_END',
  STATE_CHECK: 'STATE_CHECK',
  TRACK: 'TRACK',
  END: 'END',
  IF: 'IF',
  ELSE: 'ELSE',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  HAS: 'HAS',
  AT: 'AT',
  GIVE: 'GIVE',
  SET: 'SET',
  EXAMINE: 'EXAMINE',

  // Symbols
  COLON: 'COLON',
  ARROW: 'ARROW',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  COMMA: 'COMMA',
  DASH: 'DASH',
  GT: 'GT',
  LT: 'LT',
  GTE: 'GTE',
  LTE: 'LTE',
  EQ: 'EQ',
  EQEQ: 'EQEQ',
  NEQ: 'NEQ',
  CHOICE_MARKER: 'CHOICE_MARKER',  // >

  // Literals
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  IDENTIFIER: 'IDENTIFIER',
  QUOTED_TEXT: 'QUOTED_TEXT',

  // Special
  NEWLINE: 'NEWLINE',
  INDENT: 'INDENT',
  DEDENT: 'DEDENT',
  COMMENT: 'COMMENT',
  EOF: 'EOF',
} as const;

export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, TokenType> = {
  'GAME': TokenType.GAME,
  'CHARACTERS': TokenType.CHARACTERS,
  'INVENTORY': TokenType.INVENTORY,
  'SCENE': TokenType.SCENE,
  'DESCRIPTION': TokenType.DESCRIPTION,
  'ON_ENTER': TokenType.ON_ENTER,
  'HOTSPOT': TokenType.HOTSPOT,
  'LOOK': TokenType.LOOK,
  'TALK': TokenType.TALK,
  'USE': TokenType.USE,
  'DIALOGUE': TokenType.DIALOGUE,
  'CHOICE': TokenType.CHOICE,
  'TRIGGER': TokenType.TRIGGER,
  'REQUIRE': TokenType.REQUIRE,
  'AFTER': TokenType.AFTER,
  'CUTSCENE': TokenType.CUTSCENE,
  'PUZZLE': TokenType.PUZZLE,
  'SOLUTION': TokenType.SOLUTION,
  'HINTS': TokenType.HINTS,
  'ACT_END': TokenType.ACT_END,
  'STATE_CHECK': TokenType.STATE_CHECK,
  'TRACK': TokenType.TRACK,
  'END': TokenType.END,
  'IF': TokenType.IF,
  'ELSE': TokenType.ELSE,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
  'HAS': TokenType.HAS,
  'AT': TokenType.AT,
  'GIVE': TokenType.GIVE,
  'SET': TokenType.SET,
  'EXAMINE': TokenType.EXAMINE,
};

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private indentStack: number[] = [0];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.scanToken();
    }

    // Emit remaining DEDENTs
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push({ type: TokenType.DEDENT, value: '', line: this.line, column: this.column });
    }

    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  private scanToken(): void {
    // Handle start of line - check for indentation
    if (this.column === 1) {
      this.handleIndentation();
      if (this.pos >= this.input.length) return;
    }

    const char = this.input[this.pos];

    // Skip whitespace (not at start of line)
    if (char === ' ' || char === '\t') {
      this.advance();
      return;
    }

    // Newline
    if (char === '\n') {
      this.tokens.push({ type: TokenType.NEWLINE, value: '\n', line: this.line, column: this.column });
      this.advance();
      this.line++;
      this.column = 1;
      return;
    }

    // Carriage return
    if (char === '\r') {
      this.advance();
      return;
    }

    // Comment
    if (char === '#') {
      this.scanComment();
      return;
    }

    // Arrow ->
    if (char === '-' && this.peek() === '>') {
      this.tokens.push({ type: TokenType.ARROW, value: '->', line: this.line, column: this.column });
      this.advance();
      this.advance();
      return;
    }

    // Dash/em-dash
    if (char === '-' || char === '—') {
      this.tokens.push({ type: TokenType.DASH, value: char, line: this.line, column: this.column });
      this.advance();
      return;
    }

    // Slash (for values like 2/10)
    if (char === '/') {
      this.tokens.push({ type: TokenType.IDENTIFIER, value: '/', line: this.line, column: this.column });
      this.advance();
      return;
    }

    // Comparison operators
    if (char === '>' && this.peek() === '=') {
      this.tokens.push({ type: TokenType.GTE, value: '>=', line: this.line, column: this.column });
      this.advance();
      this.advance();
      return;
    }
    if (char === '<' && this.peek() === '=') {
      this.tokens.push({ type: TokenType.LTE, value: '<=', line: this.line, column: this.column });
      this.advance();
      this.advance();
      return;
    }
    if (char === '!' && this.peek() === '=') {
      this.tokens.push({ type: TokenType.NEQ, value: '!=', line: this.line, column: this.column });
      this.advance();
      this.advance();
      return;
    }
    if (char === '=' && this.peek() === '=') {
      this.tokens.push({ type: TokenType.EQEQ, value: '==', line: this.line, column: this.column });
      this.advance();
      this.advance();
      return;
    }

    // Single-char tokens
    if (char === ':') {
      this.tokens.push({ type: TokenType.COLON, value: ':', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === '(') {
      this.tokens.push({ type: TokenType.LPAREN, value: '(', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === ')') {
      this.tokens.push({ type: TokenType.RPAREN, value: ')', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === '[') {
      this.tokens.push({ type: TokenType.LBRACKET, value: '[', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === ']') {
      this.tokens.push({ type: TokenType.RBRACKET, value: ']', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === ',') {
      this.tokens.push({ type: TokenType.COMMA, value: ',', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === '=') {
      this.tokens.push({ type: TokenType.EQ, value: '=', line: this.line, column: this.column });
      this.advance();
      return;
    }
    if (char === '>') {
      // Check if it's a choice marker (at start of meaningful content)
      const prevToken = this.tokens[this.tokens.length - 1];
      if (!prevToken || prevToken.type === TokenType.NEWLINE || prevToken.type === TokenType.INDENT) {
        this.tokens.push({ type: TokenType.CHOICE_MARKER, value: '>', line: this.line, column: this.column });
      } else {
        this.tokens.push({ type: TokenType.GT, value: '>', line: this.line, column: this.column });
      }
      this.advance();
      return;
    }
    if (char === '<') {
      this.tokens.push({ type: TokenType.LT, value: '<', line: this.line, column: this.column });
      this.advance();
      return;
    }

    // Quoted string
    if (char === '"') {
      this.scanString();
      return;
    }

    // Number
    if (this.isDigit(char)) {
      this.scanNumber();
      return;
    }

    // Identifier or keyword
    if (this.isAlpha(char) || char === '_') {
      this.scanIdentifier();
      return;
    }

    // Unknown character - skip
    this.advance();
  }

  private handleIndentation(): void {
    let indent = 0;
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === ' ') {
        indent++;
        this.pos++;
        this.column++;
      } else if (char === '\t') {
        indent += 2; // Treat tab as 2 spaces
        this.pos++;
        this.column++;
      } else {
        break;
      }
    }

    // Skip blank lines and comment-only lines for indentation purposes
    if (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === '\n' || char === '\r' || char === '#') {
        return;
      }
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];
    
    if (indent > currentIndent) {
      this.indentStack.push(indent);
      this.tokens.push({ type: TokenType.INDENT, value: '', line: this.line, column: 1 });
    } else if (indent < currentIndent) {
      while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > indent) {
        this.indentStack.pop();
        this.tokens.push({ type: TokenType.DEDENT, value: '', line: this.line, column: 1 });
      }
    }
  }

  private scanComment(): void {
    const startCol = this.column;
    let value = '';
    
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      value += this.input[this.pos];
      this.advance();
    }
    
    this.tokens.push({ type: TokenType.COMMENT, value, line: this.line, column: startCol });
  }

  private scanString(): void {
    const startCol = this.column;
    this.advance(); // Skip opening quote
    
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\' && this.peek() === '"') {
        this.advance();
        value += '"';
      } else {
        value += this.input[this.pos];
      }
      this.advance();
    }
    
    if (this.pos < this.input.length) {
      this.advance(); // Skip closing quote
    }
    
    this.tokens.push({ type: TokenType.STRING, value, line: this.line, column: startCol });
  }

  private scanNumber(): void {
    const startCol = this.column;
    let value = '';
    
    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      value += this.input[this.pos];
      this.advance();
    }
    
    this.tokens.push({ type: TokenType.NUMBER, value, line: this.line, column: startCol });
  }

  private scanIdentifier(): void {
    const startCol = this.column;
    let value = '';
    
    while (this.pos < this.input.length && (this.isAlphaNumeric(this.input[this.pos]) || this.input[this.pos] === '_')) {
      value += this.input[this.pos];
      this.advance();
    }
    
    const type = KEYWORDS[value] || TokenType.IDENTIFIER;
    this.tokens.push({ type, value, line: this.line, column: startCol });
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(): string | undefined {
    return this.input[this.pos + 1];
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
