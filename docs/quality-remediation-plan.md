# Quality Remediation Plan

Based on senior dev code review. Addresses fundamental architectural issues, not just symptoms.

---

## Phase 1: Kill the Singletons (Dependency Injection)

**Problem:** GameState, UIState, InventoryManager, ScenePreloadManager are singletons calling each other, creating hidden dependencies and making testing require `reset()` hacks.

**Solution:** Convert to dependency injection pattern.

### 1.1 Create GameContext Container
```typescript
// packages/anima/src/core/GameContext.ts
export interface GameContext {
  gameState: GameState;
  uiState: UIState;
  inventory: InventoryManager;
  preloadManager: ScenePreloadManager;
}

export function createGameContext(): GameContext {
  const gameState = new GameState();
  const uiState = new UIState();
  const inventory = new InventoryManager(gameState, uiState);
  const preloadManager = new ScenePreloadManager();
  return { gameState, uiState, inventory, preloadManager };
}
```

### 1.2 Refactor Classes to Accept Dependencies
- Remove `private constructor()` and `static getInstance()`
- Accept dependencies via constructor
- Remove all `reset()` methods (no longer needed)

### 1.3 Pass Context Through Scene
- BaseScene receives GameContext in constructor/init
- Child scenes access via `this.context.gameState` etc.

### 1.4 Update Tests
- Create fresh context per test (no reset needed)
- No mocking of singleton getInstance

**Files to modify:**
- `packages/anima/src/state/GameState.ts`
- `packages/anima/src/ui/UIState.ts`
- `packages/anima/src/inventory/InventoryManager.ts`
- `packages/anima/src/scenes/ScenePreloadManager.ts`
- `packages/anima/src/scenes/BaseScene.ts`
- All test files

---

## Phase 2: Error Handling That Actually Handles Errors

**Problem:** Silent `if (!x) return;` everywhere. Callers have no idea operations failed.

**Solution:** Throw errors or return Result types. Let callers decide how to handle.

### 2.1 Define Error Types
```typescript
// packages/anima/src/core/errors.ts
export class AnimaError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AnimaError';
  }
}

export class StoryNotFoundError extends AnimaError {
  constructor(characterId: string) {
    super(`No story found for: ${characterId}`, 'STORY_NOT_FOUND');
  }
}

export class SceneLoadTimeoutError extends AnimaError {
  constructor(sceneKey: string, timeout: number) {
    super(`Scene ${sceneKey} failed to load within ${timeout}ms`, 'SCENE_LOAD_TIMEOUT');
  }
}
```

### 2.2 Fix Silent Failures

**StoryManager.setStoryVariable** - throw if story not found:
```typescript
public setStoryVariable(characterId: string, name: string, value: unknown): void {
  const story = this.stories.get(characterId);
  if (!story) {
    throw new StoryNotFoundError(characterId);
  }
  // ...
}
```

**SceneTransitions.transitionToScene** - don't swallow timeout:
```typescript
try {
  await preloadManager.waitForSceneWithTimeout(sceneKey, 10000);
} catch (error) {
  console.error(`Scene preload failed: ${sceneKey}`, error);
  // Either throw to abort, or proceed with warning
  this.scene.events.emit('sceneLoadWarning', { sceneKey, error });
}
```

**InkDialogueManager.startDialogue** - return success/failure:
```typescript
public async startDialogue(characterId: string, startKnot?: string): Promise<boolean> {
  const story = this.storyManager.getStory(characterId);
  if (!story) {
    console.error(`No story found for: ${characterId}`);
    return false; // Caller knows it failed
  }
  // ...
  return true;
}
```

### 2.3 Files to Fix
- `packages/anima/src/dialogue/StoryManager.ts` (lines 64-72)
- `packages/anima/src/dialogue/InkDialogueManager.ts` (lines 120-155)
- `packages/anima/src/scenes/SceneTransitions.ts` (lines 82-93)
- `packages/anima/src/inventory/InventoryManager.ts` (multiple methods)
- `packages/anima/src/audio/SceneSoundManager.ts` (multiple methods)

---

## Phase 3: Fix Dead Code and Logic Bugs

**Problem:** `checkCondition(undefined)` always returns true, making conditional blocks useless.

### 3.1 Fix SceneSoundManager.updateSoundStates
```typescript
// Current (broken):
for (const objSound of this.manifest.objects) {
  if (this.activeSounds.has(objSound.id) && !this.checkCondition(undefined)) {
    this.stopSound(objSound.id);
  }
}

// Fixed:
for (const objSound of this.manifest.objects) {
  const shouldPlay = this.checkCondition(objSound.condition);
  const isPlaying = this.activeSounds.has(objSound.id);

  if (isPlaying && !shouldPlay) {
    this.stopSound(objSound.id);
  } else if (!isPlaying && shouldPlay) {
    this.startObjectSound(objSound);
  }
}
```

### 3.2 Audit All Conditional Branches
- Search for `checkCondition(undefined)`, `checkCondition(null)`
- Search for conditions that can never be false
- Add tests that verify branches are reachable

---

## Phase 4: Eliminate Duplication

**Problem:** `getPlayerHeadPosition` exists in BaseScene AND SceneTransitions with identical logic.

### 4.1 Single Source of Truth
```typescript
// packages/anima/src/characters/CharacterUtils.ts
export function getCharacterHeadPosition(
  character: Character | undefined,
  fallbackCamera: Phaser.Cameras.Scene2D.Camera
): { x: number; y: number } {
  if (!character) {
    return {
      x: fallbackCamera.scrollX + fallbackCamera.width / 2,
      y: fallbackCamera.scrollY + fallbackCamera.height / 2,
    };
  }
  const headOffset = character.displayHeight * 0.9;
  return { x: character.x, y: character.y - headOffset };
}
```

### 4.2 Update Usages
- BaseScene.getPlayerHeadPosition -> calls CharacterUtils
- SceneTransitions -> calls CharacterUtils
- Remove duplicate implementations

### 4.3 Audit for More Duplication
- Search for similar code blocks across files
- Extract shared utilities

---

## Phase 5: Fix Type Safety (Remove `as unknown as`)

**Problem:** Casting through `unknown` to access Phaser sound methods.

### 5.1 Create Proper Sound Wrapper
```typescript
// packages/anima/src/audio/SoundWrapper.ts
export interface VolumeControllableSound {
  play(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  setVolume(volume: number): void;
  isPlaying: boolean;
}

export function wrapPhaserSound(
  sound: Phaser.Sound.BaseSound
): VolumeControllableSound {
  const webAudioSound = sound as Phaser.Sound.WebAudioSound;
  return {
    play: () => sound.play(),
    stop: () => sound.stop(),
    pause: () => sound.pause(),
    resume: () => sound.resume(),
    destroy: () => sound.destroy(),
    setVolume: (v: number) => webAudioSound.setVolume?.(v),
    get isPlaying() { return sound.isPlaying; }
  };
}
```

### 5.2 Update All Sound Usages
- Replace `as unknown as VolumeControllable` with `wrapPhaserSound()`
- Use `VolumeControllableSound` interface throughout

### 5.3 Files to Fix
- `packages/anima/src/audio/SpatialAudio.ts`
- `packages/anima/src/audio/HoverSoundHandler.ts`
- `packages/anima/src/audio/SceneSoundManager.ts`

---

## Phase 6: Write Real Tests

**Problem:** Tests that pass unconditionally (`expect(true).toBe(true)`).

### 6.1 Delete Fake Tests
Remove all tests containing:
- `expect(true).toBe(true)`
- `if (method) { test } else { pass }`

### 6.2 Write Tests That Fail When Code Breaks

**IrisTransition radius test:**
```typescript
it("animates radius from max to 0 (closing iris)", () => {
  let capturedRadius: number[] = [];
  scene.tweens.add.mockImplementation((config) => {
    // Capture the animation values
    const state = config.targets as { radius: number };
    capturedRadius.push(state.radius); // Initial
    config.onUpdate?.();
    capturedRadius.push(state.radius); // After update
    config.onComplete?.();
    return { destroy: vi.fn() };
  });

  transition.irisOut();

  expect(capturedRadius[0]).toBeGreaterThan(0); // Started open
  // Final radius should be 0 (closed)
  expect(config.radius).toBe(0);
});
```

### 6.3 Add Missing Edge Case Tests
- Negative money amounts
- Empty strings as IDs
- Concurrent operations
- Destroy during async operations

---

## Phase 7: Fix Memory Leaks

**Problem:** Keyboard listeners in HotspotEditor never removed.

### 7.1 Track All Listeners
```typescript
// packages/anima/src/editor/HotspotEditor.ts
private keyboardListeners: Array<{ key: string; callback: () => void }> = [];

private setupKeyboardShortcuts(): void {
  const kb = this.scene.input.keyboard;
  if (!kb) return;

  const addKey = (key: string, callback: () => void) => {
    kb.on(`keydown-${key}`, callback);
    this.keyboardListeners.push({ key, callback });
  };

  addKey('E', () => this.toggle());
  addKey('S', () => this.enabled && this.copyAllJSON());
  addKey('C', () => this.enabled && this.selection.current && this.copySelectedJSON());
}

public destroy(): void {
  const kb = this.scene.input.keyboard;
  for (const { key, callback } of this.keyboardListeners) {
    kb?.off(`keydown-${key}`, callback);
  }
  this.keyboardListeners = [];
  // ... rest of cleanup
}
```

### 7.2 Audit All Event Listeners
- Search for `.on(` patterns
- Ensure matching `.off(` in destroy/shutdown
- Add cleanup tracking where missing

---

## Phase 8: Remove Abstraction Leaks

**Problem:** Accessing inkjs private internals (`_variablesState._globalVariables`).

### 8.1 Use Public API Only
```typescript
// packages/anima/src/dialogue/DialogueParser.ts
public extractColorsFromStory(story: Story, speakerNames: string[]): void {
  // Use public API: story.variablesState
  for (const speaker of speakerNames) {
    const colorVar = `${speaker.toLowerCase()}_color`;
    try {
      const color = story.variablesState.$(colorVar);
      if (typeof color === 'string') {
        this.characterColors.set(speaker.toUpperCase(), color);
      }
    } catch {
      // Variable doesn't exist, skip
    }
  }
}
```

### 8.2 Document Required Ink Variables
- Create ink template showing expected variables
- Validate on story load

---

## Phase 9: Remove Magic Numbers

**Problem:** Parser uses `colonIndex < 20` with no explanation.

### 9.1 Extract Constants with Documentation
```typescript
// packages/anima/src/dialogue/DialogueParser.ts
/**
 * Maximum length for a speaker name.
 * Prevents false positives like "URL: https://..." being parsed as dialogue.
 * Increase if you have speakers with very long names.
 */
private static readonly MAX_SPEAKER_NAME_LENGTH = 20;

public parseLine(line: string): DialogueLine {
  const colonIndex = line.indexOf(":");
  if (colonIndex > 0 && colonIndex < DialogueParser.MAX_SPEAKER_NAME_LENGTH) {
    // ...
  }
}
```

### 9.2 Consider Better Parsing
```typescript
// More robust: require uppercase speaker or explicit marker
const DIALOGUE_PATTERN = /^([A-Z][A-Z0-9_\s]{0,19}):\s*(.+)$/;

public parseLine(line: string): DialogueLine {
  const match = line.match(DIALOGUE_PATTERN);
  if (match) {
    return { speaker: match[1].trim(), text: match[2].trim() };
  }
  return { speaker: "", text: line };
}
```

---

## Phase 10: Fix Scene Load Timeout Handling

**Problem:** Silently continues to broken scene if assets don't load.

### 10.1 Proper Timeout Handling
```typescript
// packages/anima/src/scenes/SceneTransitions.ts
public async transitionToScene(sceneKey: string, options = {}): Promise<void> {
  if (!preloadManager.isSceneLoaded(sceneKey)) {
    UIState.getInstance().showSceneLoading(true);

    try {
      await preloadManager.waitForSceneWithTimeout(sceneKey, 10000);
    } catch (error) {
      UIState.getInstance().showSceneLoading(false);

      // Emit event so game can handle (show error screen, retry, etc.)
      this.scene.events.emit('sceneLoadFailed', {
        sceneKey,
        error,
        retry: () => this.transitionToScene(sceneKey, options)
      });

      // Don't proceed to broken scene
      return;
    }

    UIState.getInstance().showSceneLoading(false);
  }

  // Continue with transition...
}
```

### 10.2 Add Loading Error UI
- Create LoadingErrorScene or overlay
- Show retry/cancel options
- Log errors for debugging

---

## Phase 11: API Hardening

**Problem:** Hardcoded model IDs, insufficient entropy in session IDs.

### 11.1 Configuration System
```typescript
// api/src/config.ts
export const config = {
  tts: {
    modelId: process.env.TTS_MODEL_ID || 'eleven_monolingual_v1',
    stability: parseFloat(process.env.TTS_STABILITY || '0.5'),
    similarityBoost: parseFloat(process.env.TTS_SIMILARITY || '0.75'),
  },
  session: {
    idLength: 32, // Full UUID, no truncation
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
};
```

### 11.2 Fix Session ID Generation
```typescript
// api/src/services/sessions.ts
import { randomUUID } from 'node:crypto';

function generateSessionId(): string {
  // Don't expose timestamp, use full UUID
  return `sess_${randomUUID()}`;
}
```

### 11.3 Update Session ID Validation
```typescript
// api/src/routes/game.ts
const SESSION_ID_PATTERN = /^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
```

---

## Phase 12: Remove GameState API Duplication

**Problem:** `hasItem`/`hasInventoryItem`, `addItem`/`addInventoryItem` aliases.

### 12.1 Pick One API, Deprecate Others
```typescript
// packages/anima/src/state/GameState.ts

// Keep these:
public hasItem(itemId: string): boolean { ... }
public addItem(itemId: string): void { ... }
public removeItem(itemId: string): void { ... }

// Remove these entirely (breaking change) or deprecate:
/** @deprecated Use hasItem() instead */
public hasInventoryItem(itemId: string): boolean {
  console.warn('hasInventoryItem is deprecated, use hasItem');
  return this.hasItem(itemId);
}
```

### 12.2 Update All Callers
- Find all usages of deprecated methods
- Update to new API
- Remove deprecated methods in next major version

---

## Execution Order

1. **Phase 3** (Dead code) - Quick fix, high impact
2. **Phase 7** (Memory leaks) - Quick fix, prevents production issues
3. **Phase 9** (Magic numbers) - Quick fix, improves readability
4. **Phase 4** (Duplication) - Medium effort, reduces maintenance
5. **Phase 5** (Type safety) - Medium effort, catches bugs at compile time
6. **Phase 8** (Abstraction leaks) - Medium effort, prevents breakage on updates
7. **Phase 2** (Error handling) - Medium effort, improves debugging
8. **Phase 10** (Scene loading) - Medium effort, better UX
9. **Phase 6** (Real tests) - High effort, essential for confidence
10. **Phase 11** (API hardening) - Medium effort, production readiness
11. **Phase 12** (API cleanup) - Low effort, cleaner API
12. **Phase 1** (DI) - Highest effort, foundational change (do last or as separate epic)

---

## Success Criteria

- [ ] Zero `as unknown as` casts
- [ ] Zero `expect(true).toBe(true)` tests
- [ ] All event listeners have cleanup
- [ ] No access to private/internal APIs of dependencies
- [ ] All errors either thrown or explicitly logged
- [ ] No duplicate implementations
- [ ] All magic numbers extracted to named constants
- [ ] Session IDs use full UUID
- [ ] TTS config is environment-driven
- [ ] Tests fail when code breaks
