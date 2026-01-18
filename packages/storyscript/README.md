# @anima/storyscript

TypeScript parser for StoryScript, a domain-specific language for AI-generated, AI-playable point-and-click adventure games.

## Installation

```bash
npm install @anima/storyscript
```

## Usage

### As a Library

```typescript
import { parse, parseToJSON } from '@anima/storyscript';

const storyContent = `
SCENE intro
  location: "Starting Room"
  
  DESCRIPTION
    "You find yourself in a dark room."
  END
  
  HOTSPOT door [100, 200, 50, 80]
    name: "Door"
    USE
      -> hallway
    END
  END
END
`;

// Parse to AST
const ast = parse(storyContent);
console.log(ast.scenes[0].id); // "intro"

// Parse to JSON string
const json = parseToJSON(storyContent);
console.log(json);
```

### CLI

```bash
# Parse and output to stdout
npx tsx src/cli.ts story.story

# Parse and write to file
npx tsx src/cli.ts story.story -o output.json

# Compact JSON output
npx tsx src/cli.ts story.story --compact
```

## StoryScript Format

StoryScript supports the following constructs:

### Game Metadata
```storyscript
GAME "Game Title"
  author: "Author Name"
  version: 1.0
```

### Scenes
```storyscript
SCENE scene_id
  location: "Location Name"
  time: morning
  mood: tense
  
  DESCRIPTION
    "Narrative text describing the scene."
    character (thinks): "Internal monologue."
  END
  
  ON_ENTER
    "Text shown when entering."
  END
  
  HOTSPOT item_id [x, y, width, height]
    name: "Item Name"
    LOOK
      "Description when looked at."
    END
    TALK
      -> dialogue_id
    END
    USE
      IF HAS(key)
        "You unlock it."
        -> next_scene
      ELSE
        "It's locked."
      END
    END
  END
END
```

### Dialogues
```storyscript
DIALOGUE dialogue_id
  speaker: "Hello!"
  
  CHOICE
    > "Option 1"
      speaker: "You chose 1."
      SET some_flag = true
      -> END
    > "Option 2"
      speaker: "You chose 2."
      GIVE item_id
      -> END
  END
END
```

### Triggers
```storyscript
TRIGGER on_event
  REQUIRE HAS(item)
  REQUIRE AT(location)
  
  CUTSCENE
    "Cutscene text."
  END
  
  -> next_scene
END
```

### Conditionals
```storyscript
IF HAS(item) AND talked_to_npc
  npc: "Thanks for the item!"
ELSE IF talked_to_npc
  npc: "Do you have it?"
ELSE
  npc: "Who are you?"
END
```

## AST Structure

The parser outputs a `StoryFile` AST with:

- `game` - Game metadata block
- `characters` - Character definitions
- `inventory` - Item definitions  
- `scenes[]` - Scene blocks with hotspots
- `dialogues[]` - Dialogue trees
- `triggers[]` - Event triggers
- `puzzles[]` - Puzzle definitions
- `actEnd` - Act ending and state tracking

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Parse a file
npm run parse -- path/to/file.story
```

## License

MIT
