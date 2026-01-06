# Will → Anima Extraction Plan

## Gap Analysis Summary

**Will**: Complete game (~32 TS files in game systems, 1070-line BaseScene, full API backend)
**Anima**: Partial extraction (~26 TS files, 295-line BaseScene, NO API backend)

---

## Systems Extracted (Already in Anima)

| System | Status | Notes |
|--------|--------|-------|
| BaseScene | Partial | ~30% of Will's functionality |
| InkDialogueManager | Partial | Core logic, missing TTS/camera integration |
| SpeechText | Done | Floating dialogue text |
| Character | Done | Generic character class |
| Hotspot | Done | Interactive areas |
| RadialMenu | Done | Verb selection |
| HotspotEditor | Done | Visual editor |
| GroundLineManager | Done | 2.5D perspective walking |

---

## Systems NOT Extracted (The Gap)

### Tier 1: Core Engine Systems (Must Have)

#### 1. GameState Singleton
**Will location**: `game/src/game/systems/InkDialogueManager.ts:12-98`
**What it does**:
- Character state tracking (per-NPC dialogue state)
- Flag system (boolean game flags)
- Inventory storage
- Money tracking
- Reset functionality

**Action**: Extract to `packages/anima/src/state/GameState.ts`

#### 2. InventoryManager
**Will location**: `game/src/game/systems/InventoryManager.ts`
**What it does**:
- Item definitions (id, name, icon, descriptions)
- Progressive look descriptions (multi-look items)
- Pickup/remove items
- Item combinations (use A with B)
- Money management
- UI state synchronization

**Action**: Extract to `packages/anima/src/inventory/InventoryManager.ts`

#### 3. SceneSoundManager
**Will location**: `game/src/game/systems/SceneSoundManager.ts`
**What it does**:
- Manifest-based audio loading
- Ambient sounds (scene-wide, condition-based)
- Object sounds (spatial, tied to hotspots)
- Oneshot sounds (event-triggered)
- Distance-based volume (spatial audio)
- Hover-triggered sounds
- Master volume, pause/resume, fade

**Action**: Extract to `packages/anima/src/audio/SceneSoundManager.ts`

#### 4. BaseScene Completion
**Will location**: `game/src/game/scenes/BaseScene.ts` (1070 lines)
**Missing features**:
- Player character integration (generic, not Will-specific)
- Input handling (click, hover, radial menu orchestration)
- Dialogue systems setup (setupDialogueSystems)
- Sound manager integration
- Scene transitions (transitionToScene, irisInScene)
- Dialogue camera centering
- Hotspot hover state management
- Debug mode
- UI state bridge

**Action**: Expand `packages/anima/src/scenes/BaseScene.ts`

#### 5. IrisTransition
**Will location**: `game/src/game/systems/IrisTransition.ts`
**What it does**:
- Classic iris wipe effect (out/in)
- Customizable center point, duration, easing
- Callback hooks

**Action**: Extract to `packages/anima/src/transitions/IrisTransition.ts`

#### 6. ScenePreloadManager
**Will location**: `game/src/game/systems/ScenePreloadManager.ts`
**What it does**:
- Background asset preloading
- Scene dependency graph
- Load state tracking
- Timeout handling

**Action**: Extract to `packages/anima/src/scenes/ScenePreloadManager.ts`

### Tier 2: UI Bridge

#### 7. UIState Bridge
**Will location**: `game/src/components/UIOverlay.tsx` (uiState)
**What it does**:
- Scene name display
- Hovered hotspot tracking
- Dialogue visibility/content
- Inventory state
- Selected verb tracking
- Scene loading indicator

**Action**: Extract to `packages/anima/src/ui/UIState.ts` (vanilla JS/TS observable, framework-agnostic)

### Tier 3: Backend (api/)

#### 8. API Skeleton
**Will location**: `api/src/`
**What's needed**:
- Hono server setup
- TTS service (ElevenLabs abstraction)
- Session management (basic)
- Database connection (Turso/libsql)

**Action**: Create `api/` folder with extracted patterns

---

## Files to Create/Modify

```
packages/anima/src/
├── state/
│   └── GameState.ts           # NEW - singleton state management
├── inventory/
│   ├── types.ts               # EXISTS - expand with combinations
│   └── InventoryManager.ts    # NEW - full inventory system
├── audio/
│   ├── types.ts               # NEW - sound manifest types
│   └── SceneSoundManager.ts   # NEW - spatial audio system
├── transitions/
│   └── IrisTransition.ts      # NEW - iris wipe effect
├── scenes/
│   ├── BaseScene.ts           # EXPAND - add missing features
│   └── ScenePreloadManager.ts # NEW - background loading
├── ui/
│   ├── UIState.ts             # NEW - observable state bridge
│   └── index.ts               # EXPAND exports
└── index.ts                   # EXPAND exports

api/                           # NEW FOLDER
├── src/
│   ├── index.ts               # Hono server entry
│   ├── routes/
│   │   └── game.ts            # Generic game routes
│   ├── services/
│   │   ├── tts.ts             # ElevenLabs abstraction
│   │   └── sessions.ts        # Session management
│   └── db/
│       └── client.ts          # Turso connection
└── package.json
```

---

## Extraction Order (Dependencies)

```
Phase 1: Foundation (parallel)
├── GameState (no deps)
├── Inventory types expansion (no deps)
├── Audio types (no deps)
└── UIState bridge (no deps)

Phase 2: Managers (depends on Phase 1)
├── InventoryManager (GameState, UIState)
├── SceneSoundManager (GameState, Audio types)
└── IrisTransition (no deps)

Phase 3: Scene Integration (depends on Phase 2)
├── ScenePreloadManager
└── BaseScene expansion (all managers)

Phase 4: Backend (parallel with Phase 3)
├── API skeleton
├── TTS service
└── Session service
```

---

## Key Patterns to Preserve

### 1. Singleton Pattern (GameState, InventoryManager)
```typescript
private static instance: GameState;
public static getInstance(): GameState {
  if (!GameState.instance) {
    GameState.instance = new GameState();
  }
  return GameState.instance;
}
```

### 2. Manifest-based Audio Loading
```typescript
// /audio/scenes/manifest.json
{
  "scenes": {
    "bar": {
      "ambient": [...],
      "objects": [...],
      "oneshots": [...]
    }
  }
}
```

### 3. Callback Registration (Talking animations)
```typescript
registerSpeakerTalking(speaker: string, onStart: () => void, onEnd: () => void)
```

### 4. Progressive Descriptions
```typescript
descriptions: {
  look: string | string[]  // Array for multi-look items
}
```

---

## What NOT to Extract (Will-specific)

- `DrunkEffectsManager` - Will-specific visual effect
- `ChromaticAberrationFX` - Will-specific shader
- `BattleSystem`, `InkBattleManager` - Game-specific
- `TwitterSimulator`, `chaosEvents` - Game-specific
- Character-specific prompts (`jamal.ts`, `bartender.ts`)
- `Will.ts` character class (use generic Character)

---

## Test Strategy

After each phase:
1. Run `pnpm typecheck` (zero errors)
2. Run `pnpm lint` (zero warnings)
3. Test game in `game/` folder compiles and runs
4. Verify exports in `packages/anima/src/index.ts`

---

## Estimated Scope

| Phase | Files | Lines (approx) |
|-------|-------|----------------|
| Phase 1 | 4 | ~300 |
| Phase 2 | 3 | ~700 |
| Phase 3 | 2 | ~800 |
| Phase 4 | 4 | ~400 |
| **Total** | **13** | **~2200** |
