# Anima - Point-and-Click Adventure Engine

Extracted from the Will Stancil game. A personal framework for building narrative point-and-click adventure games.

---

## Framework Identity

**Name:** Anima
**Tagline:** Soul of the adventure
**Target audience:** Personal use, vibe coders, LLM-assisted development
**Philosophy:** Clear conventions over flexibility. LLM-friendly patterns. Full classic adventure game feature set.

---

## Core Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI Layer | React + Tailwind | LLMs generate this fluently. HTML/CSS better for complex UI than Phaser. |
| Dialogue System | Ink only | No abstraction. Ink is the right tool - embrace it fully. |
| TTS | Core feature | Voice is the differentiator, not an optional add-on. |
| Scene Definition | Hybrid | Config for standard stuff, TypeScript hooks for custom behavior. |
| Feature Scope | Full Sierra/LucasArts | Inventory, verbs, puzzles, environmental state, dialogue unlocks. |
| Backend | Included | Ships with Hono API for TTS, AI, persistence. |
| Persistence | Checkpoint-based | Save at key story moments, not arbitrary positions. |
| Architecture | Shared engine | Core package imported by each game project. |
| Will relationship | Separate | Will stays as-is. Anima is for new games only. |

---

## Core Systems

### 1. Dialogue System (`InkDialogueManager`)
- Ink story management (register, start, continue)
- TTS integration with pre-generated audio
- Floating speech text (Monkey Island-style)
- Character sprite registration for positioning
- Talking animation callbacks
- Choice handling via React UI

**Known patterns:**
- Exit dialogue timing: Some dialogues need the player to walk away BEFORE NPCs react. Use `will_exited` flag in Ink, check post-dialogue, trigger separate knot after movement.
- TTS lookup uses speaker name (lowercase), not story ID
- Colors stored per-speaker in Ink as `{speaker}_color` variables

### 2. Hotspot System
- Rectangular interactive areas
- Verb-based interaction (look, talk, use, take)
- Radial menu for verb selection
- Debug visualization + editor (press H)

### 3. Character System
- Player character with walk-to movement
- NPCs with idle/talking animation states
- Sprite registration for dialogue positioning

### 4. Scene Management
- BaseScene with common setup
- Hybrid definition: config (JSON) + code (TypeScript class)
- Parallax backgrounds
- Camera edge scrolling
- Sound manager integration

### 5. TTS Pipeline
- ElevenLabs voice generation
- Per-character voice IDs
- Manifest-based audio lookup
- Pre-generation from Ink scripts
- CLI tooling for batch generation

### 6. UI Layer (React)
- React overlay on Phaser canvas
- GameDialogue component for choices
- GameUI for verbs/inventory
- Floating text (Phaser) for NPC speech
- Tailwind styling throughout

### 7. Inventory System
- Item pickup/drop
- Item combinations (use A with B)
- Item usage on hotspots
- Visual inventory UI

### 8. Puzzle Mechanics
- Environmental state changes (flags)
- Dialogue unlocks (learn info, use elsewhere)
- Inventory combinations
- State-dependent hotspot behavior

### 9. Persistence
- Checkpoint-based saves
- GameState singleton for flags
- Character state tracking
- Story progress serialization

---

## Asset Creation Pipeline

The secret sauce. AI-driven asset generation from prompts to playable sprites.

### CRITICAL: ULTRA-FAITHFUL TO ASHLEY'S ART

**Ashley's paintings ARE the game's visual identity. Non-negotiable.**

AI generation must reproduce her style EXACTLY - not "inspired by", not "similar to". If AI can't match it perfectly, we extract directly from her paintings or don't use AI.

**Ashley's Style (sacred, do not dilute):**
- 1930s Fleischer "Rubber Hose" + Tibetan Thangka fusion
- Clean black ink outlines, consistent weight
- Opaque vibrant fills (acrylic/gouache look, NOT digital gradient)
- Specific color relationships (blue mustache = Tibetan shape in clown color)
- Canvas texture feel
- The linework has WEIGHT and CONFIDENCE
- Features are SOFT and PLIABLE, not rigid
- The weird/sacred/funny energy - this is NOT generic cartoon

**If AI output looks generic: REJECT IT.**

**Fallback approaches when AI fails:**
1. Extract characters directly from Ashley's paintings (rembg, manual masking)
2. Use her paintings as actual game assets, process minimally
3. Have Ashley paint what's needed
4. Don't ship until it looks right

### Pipeline Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Nano Banana    │────▶│  Hedra / Veo    │────▶│  video2sprite   │────▶│  Phaser Ready   │
│  (Image Gen)    │     │  (Video Gen)    │     │  (Processing)   │     │  (Spritesheet)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
     Prompt              Static Image +          Green screen           PNG + JSON meta
     ───────▶            Audio/Motion            video file             ─────────────▶
     Character           ──────────▶             ──────────▶            Game asset
     reference
```

### 1. Image Generation

Create base character images and backgrounds using AI image models.

**Available Models:**

| Model | Strengths | Best For |
|-------|-----------|----------|
| Nano Banana (Gemini) | Style matching, green screen, Claude integration | Characters with existing style reference |
| GPT-5 (OpenAI) | Photorealism, precise edits, multimodal context | Detailed environments, realistic characters |

**Key patterns:**
- Use existing project images as style reference
- Request green screen backgrounds (#00FF00) for easy compositing
- Generate at high resolution, scale down in engine
- Create 9:16 portraits for Hedra video input

**Claude skills integration (Nano Banana):**
- Reference existing sprites: "Match the art style of @game/public/assets/sprites/will.png"
- Consistent character design across poses
- Scene backgrounds with parallax layer separation

**GPT-5 workflow:**
- Use GPT-5 for initial concepts
- Iterate with "edit this image to..." for refinements
- Export and process through sprite-tools pipeline
- OpenRouter: `openai/gpt-5-image` for API access

### 2. Character Splitting

For landscape images containing multiple characters:

```bash
./scripts/split-characters.sh duo-image.png ./output
# Outputs: duo-image-left.png, duo-image-right.png (864×1536, 9:16)
```

Auto-detects character positions, crops, scales uniformly, pads with green.

### 3. Video Generation

All video generation uses `hedra-video.py` which wraps multiple models through Hedra's unified API.

**Setup:**
```bash
export HEDRA_API_KEY="your_key"  # Get from hedra.com
pip install requests python-dotenv
```

**Available Models:**

| Model | Use Case | Cost | Notes |
|-------|----------|------|-------|
| `hedra-character-3` | Lip-sync talking | - | Requires `--audio` |
| `kling-2.5-i2v` | Motion/idle (cheap) | 10 cr/s | Good for tests |
| `kling-2.6-pro-i2v` | Motion/idle (quality) | 20 cr/s | Better details |
| `veo-3-fast-i2v` | Motion/idle (fast) | 20 cr/s | Google Veo |
| `sora-2-pro-i2v` | Motion/idle (best) | 70 cr/s | **Best quality**, 4/8/12s only |

**Lip-sync (talking animations):**
```bash
# Requires audio file - auto-detects duration
python scripts/hedra-video.py \
  --image ash-idle-clean.png \
  --audio dialogue.mp3 \
  --prompt "A cheerful clown girl talking" \
  --output ash-talking.mp4
```

**Image-to-Video (motion animations):**
```bash
# Idle animation with Kling (cheap, good for testing)
python scripts/hedra-video.py \
  --image ash-idle-clean.png \
  --prompt "Character breathing subtly, slight sway, blinking" \
  --model kling-2.5-i2v \
  --duration 4 \
  --output ash-idle.mp4

# Walk cycle with Sora 2 Pro (best quality)
python scripts/hedra-video.py \
  --image skyler-idle-clean.png \
  --prompt "Character walking to the left, full body visible, smooth motion" \
  --model sora-2-pro-i2v \
  --duration 4 \
  --output skyler-walk.mp4
```

**Sora 2 Pro Tips:**
- Durations: 4, 8, or 12 seconds ONLY
- Avoid aggressive words: use "gesture" not "attack", "motion" not "fight"
- Best for: cinematic quality, smooth motion, production assets

**Veo 3.1 Direct** (Google API, alternative):
```bash
# Requires GOOGLE_API_KEY
pnpm tsx scripts/veo-video.ts \
  --image character.png \
  --prompt "walking left" \
  --output walk.mp4
```

**Check credits:**
```bash
python scripts/hedra-video.py --check-credits
python scripts/hedra-video.py --list-models
```

### 4. Video to Sprite Sheet

Convert AI-generated video to game-ready sprite sheet:

```bash
./scripts/video2sprite.sh walking.mp4 will-walk --fps 12 --fuzz 20
```

**Output:**
- `will-walk.png` - Sprite sheet (all frames in grid)
- `will-walk.json` - Metadata (frameWidth, frameHeight, frameCount)
- `will-walk_preview.gif` - Preview animation

**Processing:**
1. Extract frames at specified FPS
2. Auto-detect green screen color (samples corners)
3. Remove chroma key with configurable tolerance
4. Apply edge blur to clean alpha
5. Trim to content bounds
6. Assemble into sprite sheet

### 5. Background/Layer Processing

For parallax backgrounds and scene layers:

```bash
./scripts/chromakey.sh sky-layer.jpg assets/alley/sky.png
./scripts/chromakey.sh walls-layer.jpg assets/alley/walls.png --fuzz 25
```

**AI background removal** (for non-green screen):
```bash
python scripts/rembg-wrapper.py photo.jpg assets/object.png
```

### 6. Sprite Size Matching

All character sprites must match a reference size:

```bash
./scripts/compare-sprites.sh reference.png new-sprite.png 261x572 454x1537 36.9
```

Compares silhouettes - adjust scale until tops align.

### Asset Pipeline Tools Summary

| Script | Purpose |
|--------|---------|
| `video2sprite.sh` | Video → sprite sheet with chroma key |
| `chromakey.sh` | Remove green screen from images |
| `split-characters.sh` | Split duo images into individuals |
| `compare-sprites.sh` | Size matching between sprites |
| `resize-sprite.sh` | Scale sprite sheets |
| `optimize-sprites.sh` | Compress for production |
| `hedra-video.py` | Generate talking videos |
| `veo-video.ts` | Generate motion videos |
| `rembg-wrapper.py` | AI background removal |

### External Services

| Service | Purpose | Cost Model |
|---------|---------|------------|
| Gemini (Nano Banana) | Image generation (style matching) | API calls |
| GPT-5 (OpenAI) | Image generation (photorealism) | ChatGPT Pro / API |
| Hedra API | Video generation (unified) | Credits - see [hedra.com](https://hedra.com) |
| ↳ Hedra Character 3 | Lip-sync talking videos | Included in Hedra |
| ↳ Kling 2.5/2.6 | Motion video (budget) | 10-20 cr/s |
| ↳ Veo 3 Fast | Motion video (Google) | 20 cr/s |
| ↳ Sora 2 Pro | Motion video (best quality) | 70 cr/s |
| Veo 3.1 Direct | Motion video (Google API) | API calls |
| ElevenLabs | Voice synthesis | Characters/month |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| Phaser 3 | Game engine |
| inkjs | Dialogue scripting |
| React 19 | UI overlay |
| Tailwind v4 | UI styling |
| ElevenLabs | TTS generation |
| Hono | API server |
| Turso (libsql) | Database |
| Vercel AI SDK | LLM integration |
| ImageMagick | Image processing (sprite tools) |
| FFmpeg | Video processing (sprite tools) |
| rembg | AI background removal (optional) |

---

## Project Structure (New Game)

```
my-adventure-game/
├── api/                    # Hono backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   └── package.json
├── game/                   # Phaser + React frontend
│   ├── src/
│   │   ├── scenes/         # Game scenes
│   │   ├── components/     # React UI
│   │   ├── managers/       # Dialogue, Sound, etc.
│   │   ├── characters/     # Character definitions
│   │   └── config/         # Scene configs
│   ├── public/
│   │   ├── audio/          # TTS + SFX
│   │   ├── sprites/        # Character spritesheets
│   │   └── backgrounds/    # Scene backgrounds
│   └── package.json
├── dialogue/               # Ink source files
│   ├── *.ink
│   └── compiled/           # Generated JSON
├── packages/
│   ├── anima/              # Shared engine (or npm package)
│   └── sprite-tools/       # Asset creation pipeline
│       ├── scripts/        # Shell/Python/TS tools
│       │   ├── video2sprite.sh
│       │   ├── chromakey.sh
│       │   ├── hedra-video.py
│       │   ├── veo-video.ts
│       │   └── ...
│       └── sources/        # Raw assets (videos, images)
└── package.json            # Monorepo root
```

---

## Configuration Schema

### Scene Config (`scenes/bar.json`)
```json
{
  "id": "bar",
  "background": "backgrounds/bar.png",
  "music": "audio/bar-ambient.mp3",
  "parallax": [
    { "image": "backgrounds/bar-foreground.png", "depth": 10, "factor": 0.5 }
  ],
  "hotspots": [
    {
      "id": "jukebox",
      "rect": { "x": 100, "y": 200, "width": 80, "height": 120 },
      "verbs": {
        "look": { "dialogue": "jukebox_look" },
        "use": { "dialogue": "jukebox_use", "requires": "has_quarter" }
      }
    }
  ],
  "npcs": [
    {
      "id": "bartender",
      "sprite": "bartender",
      "position": { "x": 400, "y": 300 },
      "dialogue": "bartender_main"
    }
  ],
  "walkableArea": { "polygon": [[0, 400], [800, 400], [800, 600], [0, 600]] }
}
```

### Character Config (`characters/bartender.json`)
```json
{
  "id": "bartender",
  "displayName": "Bartender",
  "spritesheet": "sprites/bartender.png",
  "frameSize": { "width": 64, "height": 128 },
  "animations": {
    "idle": { "frames": [0, 1, 2, 3], "frameRate": 4, "repeat": -1 },
    "talking": { "frames": [4, 5, 6, 7], "frameRate": 8, "repeat": -1 }
  },
  "voice": {
    "elevenLabsId": "voice_id_here",
    "color": "#FF6B6B"
  }
}
```

---

## Known Issues / Quirks

Document patterns discovered during Will development:

1. **Exit dialogue timing**: Player must walk away before NPCs comment. Solved via `will_exited` Ink variable + scene-side check + separate `drunk_exit` knot.

2. **TTS character mismatch**: `showDialogueWithTTS` was using story ID instead of speaker name for audio lookup. Fixed by extracting speaker from Ink line.

3. **Talking animation sync**: Callbacks need to match exact speaker names from Ink (PINK, ORANGE, TEAL) to sprite mappings.

---

## Extraction Strategy

1. **Will stays untouched** - It's a working game, no refactoring risk
2. **Extract patterns, not code** - Document what works, rebuild cleanly for Anima
3. **New game = test bed** - Build Anima by building the next game with it
4. **Iterate** - First extraction won't be perfect. Improve with each game.

---

## Next Steps

- [ ] Create `anima` repo
- [ ] Set up monorepo structure (api + game + packages/anima + packages/sprite-tools)
- [ ] Port sprite-tools scripts (already battle-tested)
- [ ] Port core game systems from Will as clean implementations
- [ ] Build first game scene to validate architecture
- [ ] Create example asset generation workflow (image → video → sprite)
- [ ] Document patterns as they emerge

### Asset Pipeline Priority

The sprite-tools package is the most portable part - shell scripts with minimal dependencies. Start here:
1. Copy scripts as-is (they work)
2. Document the full workflow with examples
3. Add convenience wrappers for common patterns
