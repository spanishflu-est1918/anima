/**
 * StoryScript Parser Tests
 */

import { parse, parseToJSON } from './index.ts';

const testCases: { name: string; input: string; check: (ast: any) => boolean }[] = [
  {
    name: 'Parse GAME block',
    input: `
GAME "Test Adventure"
  author: "Test Author"
  version: 1.0
`,
    check: (ast) => ast.game?.title === 'Test Adventure' && ast.game?.properties.author === 'Test Author'
  },
  {
    name: 'Parse SCENE with properties',
    input: `
SCENE test_scene
  location: "Test Location"
  time: morning
  mood: calm
  
  DESCRIPTION
    "A test description."
  END
END
`,
    check: (ast) => ast.scenes[0]?.id === 'test_scene' && 
                    ast.scenes[0]?.properties.location === 'Test Location' &&
                    ast.scenes[0]?.description?.lines[0]?.text === 'A test description.'
  },
  {
    name: 'Parse HOTSPOT with bounds',
    input: `
SCENE room
  HOTSPOT door [100, 200, 50, 80]
    name: "Door"
    LOOK
      "A wooden door."
    END
    USE
      -> next_room
    END
  END
END
`,
    check: (ast) => {
      const hotspot = ast.scenes[0]?.hotspots[0];
      return hotspot?.id === 'door' &&
             hotspot?.bounds?.[0] === 100 &&
             hotspot?.name === 'Door' &&
             hotspot?.use?.content[0]?.target === 'next_room';
    }
  },
  {
    name: 'Parse DIALOGUE with CHOICE',
    input: `
DIALOGUE test_dialogue
  speaker: "Hello!"
  
  CHOICE
    > "Option 1"
      speaker: "You chose 1"
      -> END
    > "Option 2"
      speaker: "You chose 2"
      SET chosen_two = true
      -> END
  END
END
`,
    check: (ast) => {
      const dialogue = ast.dialogues[0];
      const choice = dialogue?.content.find((c: any) => c.type === 'ChoiceBlock');
      return dialogue?.id === 'test_dialogue' &&
             choice?.options.length === 2 &&
             choice?.options[0].text === 'Option 1';
    }
  },
  {
    name: 'Parse IF conditional',
    input: `
SCENE room
  HOTSPOT item [0, 0, 10, 10]
    USE
      IF HAS(key)
        "You unlock the door."
        -> next_room
      ELSE
        "The door is locked."
      END
    END
  END
END
`,
    check: (ast) => {
      const hotspot = ast.scenes[0]?.hotspots[0];
      const cond = hotspot?.use?.content[0];
      return cond?.type === 'ConditionalBlock' &&
             cond?.branches[0]?.condition?.type === 'HasCondition' &&
             cond?.branches[0]?.condition?.item === 'key';
    }
  },
  {
    name: 'Parse TRIGGER with REQUIRE',
    input: `
TRIGGER on_door_open
  REQUIRE HAS(key)
  REQUIRE AT(hallway)
  
  CUTSCENE
    "The door creaks open."
  END
  
  -> secret_room
END
`,
    check: (ast) => {
      const trigger = ast.triggers[0];
      return trigger?.id === 'on_door_open' &&
             trigger?.requirements.length === 2 &&
             trigger?.requirements[0]?.condition?.item === 'key' &&
             trigger?.goto === 'secret_room';
    }
  },
  {
    name: 'Parse complex condition (AND/OR)',
    input: `
SCENE room
  HOTSPOT npc [0, 0, 10, 10]
    TALK
      IF talked_before AND HAS(gift)
        npc: "Thank you for the gift!"
      ELSE IF talked_before
        npc: "Hello again."
      ELSE
        npc: "Who are you?"
      END
    END
  END
END
`,
    check: (ast) => {
      const cond = ast.scenes[0]?.hotspots[0]?.talk?.content[0];
      return cond?.type === 'ConditionalBlock' &&
             cond?.branches[0]?.condition?.type === 'AndCondition' &&
             cond?.branches.length === 2 &&
             cond?.elseBranch?.length === 1;
    }
  },
  {
    name: 'Parse dialogue with speaker modes',
    input: `
DIALOGUE inner_thoughts
  hero: "I should investigate."
  hero (thinks): "Something feels wrong."
END
`,
    check: (ast) => {
      const d = ast.dialogues[0];
      const line1 = d?.content[0];
      const line2 = d?.content[1];
      return line1?.mode === 'normal' && line2?.mode === 'thinks';
    }
  }
];

console.log('StoryScript Parser Tests\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    const ast = parse(test.input);
    if (test.check(ast)) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`✗ ${test.name} - Check failed`);
      console.log('  AST:', JSON.stringify(ast, null, 2).slice(0, 200) + '...');
      failed++;
    }
  } catch (err) {
    console.log(`✗ ${test.name} - Parse error: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log('='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

// Test parsing the actual example file
console.log('\n' + '='.repeat(50));
console.log('Testing actual .story file...\n');

import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const storyPath = resolve('/home/gorkolas/www/anima/adventures/shadow-over-innsmouth/story/act1.story');
  const content = readFileSync(storyPath, 'utf-8');
  const ast = parse(content);
  
  console.log('✓ Successfully parsed act1.story');
  console.log(`  Game: ${ast.game?.title || 'N/A'}`);
  console.log(`  Scenes: ${ast.scenes.length}`);
  console.log(`  Dialogues: ${ast.dialogues.length}`);
  console.log(`  Triggers: ${ast.triggers.length}`);
  
  if (ast.scenes.length > 0) {
    console.log(`\n  Scene IDs:`);
    for (const scene of ast.scenes) {
      const hotspotCount = scene.hotspots.length;
      console.log(`    - ${scene.id} (${hotspotCount} hotspots)`);
    }
  }
  
  if (ast.dialogues.length > 0) {
    console.log(`\n  Dialogue IDs:`);
    for (const dialogue of ast.dialogues) {
      console.log(`    - ${dialogue.id}`);
    }
  }
} catch (err) {
  console.log(`✗ Failed to parse act1.story: ${err instanceof Error ? err.message : err}`);
}

// ============================================================================
// Runtime Tests
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log('StoryScript Runtime Tests\n');

import { StoryRunner } from './runtime.ts';

const runtimeTests: { name: string; run: () => boolean }[] = [
  {
    name: 'Initialize runner with scene',
    run: () => {
      const story = parse(`
SCENE start
  location: "Start"
  DESCRIPTION
    "The beginning."
  END
END
`);
      const runner = new StoryRunner(story);
      return runner.getCurrentScene() === 'start';
    }
  },
  {
    name: 'Get scene description',
    run: () => {
      const story = parse(`
SCENE room
  DESCRIPTION
    "A dark room."
    "It smells of old books."
  END
END
`);
      const runner = new StoryRunner(story);
      const desc = runner.getDescription();
      return desc.includes('dark room') && desc.includes('old books');
    }
  },
  {
    name: 'Track inventory with HAS condition',
    run: () => {
      const story = parse(`
SCENE room
  HOTSPOT door [0,0,10,10]
    USE
      IF HAS(key)
        "The door opens."
      ELSE
        "It's locked."
      END
    END
  END
END
`);
      const runner = new StoryRunner(story);
      
      // Without key
      let result = runner.takeAction('USE', 'door');
      if (!result.text.includes("It's locked.")) return false;
      
      // Give key
      runner.giveItem('key');
      result = runner.takeAction('USE', 'door');
      return result.text.includes('The door opens.');
    }
  },
  {
    name: 'Set and check flags',
    run: () => {
      const story = parse(`
SCENE room
  HOTSPOT button [0,0,10,10]
    name: "Button"
    USE
      SET button_pressed = true
      "Click."
    END
  END
END

SCENE hallway
  HOTSPOT door [0,0,10,10]
    name: "Door"
    USE
      IF button_pressed
        "The door is unlocked."
      ELSE
        "Nothing happens."
      END
    END
  END
END
`);
      const runner = new StoryRunner(story);
      runner.takeAction('USE', 'button'); // can use id
      
      // Check flag was set
      if (runner.getFlag('button_pressed') !== true) return false;
      
      runner.transition('hallway');
      const result = runner.takeAction('USE', 'door');
      return result.text.some(t => t.includes('unlocked'));
    }
  },
  {
    name: 'Dialogue choices',
    run: () => {
      const story = parse(`
DIALOGUE test_talk
  npc: "Hello!"
  
  CHOICE
    > "Hi there"
      npc: "Nice to meet you."
      -> END
    > "Go away"
      npc: "Fine."
      SET rude = true
      -> END
  END
END

SCENE room
  HOTSPOT npc [0,0,10,10]
    TALK
      -> test_talk
    END
  END
END
`);
      const runner = new StoryRunner(story);
      runner.takeAction('TALK', 'npc');
      
      const choices = runner.getChoices();
      if (choices.length !== 2) return false;
      if (!choices.includes('Hi there')) return false;
      
      const result = runner.selectChoice(1); // "Go away"
      if (!result.text.some(t => t.includes('Fine'))) return false;
      return runner.getFlag('rude') === true;
    }
  },
  {
    name: 'GIVE command adds to inventory',
    run: () => {
      const story = parse(`
DIALOGUE shop
  clerk: "Here's your key."
  GIVE room_key
  -> END
END

SCENE lobby
  HOTSPOT clerk [0,0,10,10]
    TALK
      -> shop
    END
  END
END
`);
      const runner = new StoryRunner(story);
      const result = runner.takeAction('TALK', 'clerk');
      
      return runner.hasItem('room_key') && result.itemsGiven.includes('room_key');
    }
  },
  {
    name: 'Scene transition',
    run: () => {
      const story = parse(`
SCENE room_a
  HOTSPOT door [0,0,10,10]
    USE
      -> room_b
    END
  END
END

SCENE room_b
  DESCRIPTION
    "You're in room B."
  END
END
`);
      const runner = new StoryRunner(story);
      const result = runner.takeAction('USE', 'door');
      
      if (result.goto !== 'room_b') return false;
      
      runner.transition('room_b');
      return runner.getCurrentScene() === 'room_b';
    }
  },
  {
    name: 'Trigger conditions',
    run: () => {
      const story = parse(`
SCENE hallway
END

TRIGGER escape
  REQUIRE HAS(key)
  REQUIRE AT(hallway)
  
  CUTSCENE
    "You escape!"
  END
  
  -> freedom
END

SCENE freedom
END
`);
      const runner = new StoryRunner(story, 'hallway');
      
      // Without key - no trigger
      let triggers = runner.checkTriggers();
      if (triggers.length !== 0) return false;
      
      // With key - trigger fires
      runner.giveItem('key');
      triggers = runner.checkTriggers();
      
      return triggers.length === 1 && 
             triggers[0].triggerId === 'escape' &&
             triggers[0].cutsceneText.includes('You escape!');
    }
  },
  {
    name: 'Serialize and deserialize state',
    run: () => {
      const story = parse(`
SCENE room
END
SCENE hallway
END
`);
      const runner = new StoryRunner(story, 'room');
      runner.giveItem('key');
      runner.setFlag('talked', true);
      runner.transition('hallway');
      
      const serialized = runner.serialize();
      const restored = StoryRunner.deserialize(story, serialized);
      
      return restored.getCurrentScene() === 'hallway' &&
             restored.hasItem('key') &&
             restored.getFlag('talked') === true;
    }
  },
  {
    name: 'Get available actions',
    run: () => {
      const story = parse(`
SCENE room
  HOTSPOT painting [0,0,10,10]
    name: "Painting"
    LOOK
      "A portrait."
    END
  END
  
  HOTSPOT door [0,0,10,10]
    name: "Door"
    LOOK
      "A wooden door."
    END
    USE
      "It's locked."
    END
  END
END
`);
      const runner = new StoryRunner(story);
      const actions = runner.getAvailableActions();
      
      const lookActions = actions.filter(a => a.verb === 'LOOK');
      const useActions = actions.filter(a => a.verb === 'USE');
      
      return lookActions.length === 2 && useActions.length === 1;
    }
  }
];

let runtimePassed = 0;
let runtimeFailed = 0;

for (const test of runtimeTests) {
  try {
    if (test.run()) {
      console.log(`✓ ${test.name}`);
      runtimePassed++;
    } else {
      console.log(`✗ ${test.name} - Check failed`);
      runtimeFailed++;
    }
  } catch (err) {
    console.log(`✗ ${test.name} - Error: ${err instanceof Error ? err.message : err}`);
    runtimeFailed++;
  }
}

console.log('='.repeat(50));
console.log(`Runtime Results: ${runtimePassed} passed, ${runtimeFailed} failed`);

const totalFailed = failed + runtimeFailed;
process.exit(totalFailed > 0 ? 1 : 0);
