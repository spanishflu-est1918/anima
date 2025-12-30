# Sprite Tools

Convert videos and images to Phaser-ready assets with automatic background removal.

## Requirements

```bash
brew install imagemagick ffmpeg
pip install rembg  # optional, for AI background removal
```

## Scripts

### chromakey.sh

Remove chroma key (green screen) backgrounds from images:

```bash
./scripts/chromakey.sh <input> <output> [options]

# Examples:
./scripts/chromakey.sh sky.jpg assets/sky.png
./scripts/chromakey.sh walls.jpg assets/walls.png --fuzz 25
./scripts/chromakey.sh layer.jpg output.png --no-trim  # keep original size
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--fuzz` | 20 | Chroma key tolerance (%) |
| `--chroma` | auto | Override chroma color (#hex) |
| `--no-trim` | - | Skip auto-crop to content |
| `--no-blur` | - | Skip edge blur step |

**How it works:**
1. Samples 4 corners to auto-detect the green chroma color
2. Removes that color with configurable fuzz tolerance
3. Applies edge blur to clean alpha channel
4. Trims transparent areas to content bounds

### video2sprite.sh

Convert a video (ideally with green screen) to a sprite sheet:

```bash
./scripts/video2sprite.sh <video> <output-name> [options]

# Examples:
./scripts/video2sprite.sh walk.mp4 assets/sprites/walk
./scripts/video2sprite.sh talk.mp4 assets/sprites/talk --fuzz 25
./scripts/video2sprite.sh video.mp4 output --crop 1080:1600:0:160
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--fps` | 12 | Frame extraction rate |
| `--fuzz` | 20 | Chroma key tolerance (%) |
| `--scale` | 40 | Output scale (%) |
| `--cols` | auto | Sprite sheet columns |
| `--crop` | - | Crop video (WxH+X+Y) |
| `--chroma` | auto | Override chroma color (#hex) |
| `--no-blur` | - | Skip edge blur step |

### split-characters.sh

Split landscape images containing 2 characters into individual 9:16 vertical crops for video production:

```bash
./scripts/split-characters.sh <input> <output-dir> [options]

# Examples:
./scripts/split-characters.sh artist.jpeg ./output
./scripts/split-characters.sh artist.jpeg ./output --left-offset 300 --right-offset 1600
./scripts/split-characters.sh --batch ./sources ./output
./scripts/split-characters.sh artist.jpeg ./output --preview  # show detected positions
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--work-width` | 1100 | Working width before scaling (increase for wider characters) |
| `--left-offset` | auto | Manual X offset for left character center |
| `--right-offset` | auto | Manual X offset for right character center |
| `--no-scale` | - | Don't scale down (may cut off wide characters) |
| `--preview` | - | Show detected positions without processing |
| `--batch` | - | Process all images in a directory |

**How it works:**
1. Auto-detects character positions using green screen removal + bounding box
2. Crops each character at working width (default 1100px)
3. Scales uniformly to 864px width (all characters same size)
4. Adds seamless padding using edge replication (matches original green exactly)
5. Outputs 864×1536 PNG (9:16 ratio)

**Output:** For `artist.jpeg`, creates `artist-left.png` and `artist-right.png`

### rembg-wrapper.py

AI-powered background removal (for non-green screen content):

```bash
python scripts/rembg-wrapper.py input.png output.png
```

**Note:** Use this for isolating subjects (characters, objects). For chroma key backgrounds, use `chromakey.sh` instead.

---

## Asset Creation Workflows

### Parallax Backgrounds

For multi-layer parallax scenes (sky, walls, ground, etc.):

1. **Generate images** with consistent chroma green background (#00FF00 or similar)
2. **Process each layer:**
   ```bash
   ./scripts/chromakey.sh sky.jpg assets/alley/sky.png
   ./scripts/chromakey.sh walls.jpg assets/alley/walls.png
   ./scripts/chromakey.sh ground.jpg assets/alley/ground.png
   ```
3. **Verify dimensions** - layers should be proportional for proper parallax

**Layer structure example (alley scene):**
```
Layer 1 - Sky (0.2x scroll): Distant buildings, tiled horizontally
Layer 2 - Walls (0.5x scroll): Main wall with graffiti
Layer 3 - Objects (0.8x scroll): Dumpster, lamp, props
Layer 4 - Ground (1.0x scroll): Asphalt, debris, moves with camera
```

### Character Sprites

For animated characters from video:

1. **Record video** with green screen background
2. **Convert to sprite sheet:**
   ```bash
   ./scripts/video2sprite.sh character-walk.mp4 assets/sprites/character-walk --fps 12
   ```
3. **Output files:**
   - `character-walk.png` - Sprite sheet
   - `character-walk.json` - Metadata (frameWidth, frameHeight, frameCount)
   - `character-walk_preview.gif` - Preview animation

**Phaser integration:**
```typescript
// preload()
this.load.spritesheet('walk', 'sprites/walk.png', {
  frameWidth: meta.frameWidth,
  frameHeight: meta.frameHeight
});

// create()
this.anims.create({
  key: 'walk',
  frames: this.anims.generateFrameNumbers('walk', { start: 0, end: meta.frameCount - 1 }),
  frameRate: meta.fps,
  repeat: -1
});
```

### Static Props/Objects

For individual objects that need background removal:

1. **For green screen images:** Use `chromakey.sh`
2. **For complex backgrounds:** Use `rembg-wrapper.py`

```bash
# Green screen
./scripts/chromakey.sh dumpster.jpg assets/dumpster.png

# Complex background (AI removal)
python scripts/rembg-wrapper.py photo.jpg assets/object.png
```

---

## Tips

- **Green screen videos** work best - use bright green (#00FF00)
- **Auto chroma detection** samples corners, ensure background fills edges
- **Lower fuzz** (10-15%) if subject colors are similar to background
- **Higher fuzz** (25-30%) for cleaner edges on solid green screens
- **Trim is automatic** - transparent areas are cropped unless `--no-trim`
- **Edge blur** helps reduce green fringing on edges

## Output Formats

All scripts output PNG with transparency. Metadata (JSON) is generated for sprite sheets.
