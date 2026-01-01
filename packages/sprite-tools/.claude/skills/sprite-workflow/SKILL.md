---
name: sprite-workflow
description: Extract animated sprites from AI-generated videos. Use when creating character sprites from Veo/Kling videos.
---

# Video to Sprite Extraction

**Last updated**: Dec 2024 after 10+ hours of testing

## TL;DR - The Workflow

```
1. GENERATE VIDEO    → Veo 3.1, grey background, NO SHADOWS
2. EXTRACT FRAMES    → ffmpeg
3. REMOVE BACKGROUND → CHROMA KEY (not rembg!)
4. FIND LOOP         → LoopyCut or manual
5. ORGANIZE          → intro/ + loop/ folders
```

## Why Chroma Key > rembg

We tested extensively:
- **rembg**: Cuts into face, eats dark clothing (black shirts)
- **BiRefNet**: Same issues, slower
- **Chroma Key**: Perfect preservation, instant, no ML artifacts

AI video generators produce consistent solid backgrounds. Use that!

---

## Step-by-Step

### 1. Generate Video

Use **Veo 3.1** via Replicate. Critical prompting:

```
This exact character [ACTION], keep identical appearance,
plain grey background, NO SHADOWS, no ground shadow
```

**Why no shadows**: Shadow blob under feet complicates cropping and creates artifacts.

### 2. Extract Frames

```bash
mkdir frames
ffmpeg -i video.mp4 -vsync 0 frames/frame-%03d.png
```

### 3. Remove Background (Chroma Key)

```python
from PIL import Image
import numpy as np
import os

def chroma_key(input_path, output_path):
    img = Image.open(input_path)
    rgb = np.array(img)
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]

    # Grey background (~130,130,130) - adjust if different
    grey_dist = np.sqrt((r.astype(float) - 130)**2 +
                        (g.astype(float) - 130)**2 +
                        (b.astype(float) - 130)**2)

    # Black letterbox bars
    black_dist = np.sqrt(r.astype(float)**2 + g.astype(float)**2 + b.astype(float)**2)

    # Brightness protects dark clothing
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3

    # Key parameters (tested extensively):
    # - grey_dist < 15: tight, protects clothing with grey highlights
    # - brightness > 100: protects black shirts
    is_grey_bg = (grey_dist < 15) & (brightness > 100)
    is_black_bar = black_dist < 10
    is_background = is_grey_bg | is_black_bar

    alpha = (~is_background).astype(np.uint8) * 255
    result = Image.fromarray(np.dstack([rgb, alpha]))
    result.save(output_path)

# Batch process
os.makedirs("sprites", exist_ok=True)
for f in sorted(os.listdir("frames")):
    if f.endswith('.png'):
        chroma_key(f"frames/{f}", f"sprites/{f}")
```

### 4. Find Loop Points

Use **LoopyCut** or identify manually by watching the video:

```bash
python tools/loopycut/loopycut.py video.mp4 loop.mp4 --method hybrid --similarity 80
```

AI videos typically have:
- **Intro**: Wind-up animation (frames 1-N)
- **Loop**: Repeatable cycle (frames N+1 to end)

### 5. Organize Output

```
sprites/
└── character-animation/
    ├── README.md      # Parameters used
    ├── intro/         # Play once
    └── loop/          # Repeat forever
```

---

## Key Parameters Reference

| Parameter | Value | Why |
|-----------|-------|-----|
| `grey_dist` | < 15 | Tight threshold prevents eating into clothing |
| `brightness` | > 100 | Protects dark pixels (black shirts) |
| `black_dist` | < 10 | Removes letterbox bars from video |

Adjust `grey_dist` threshold if background color differs from 130,130,130.

---

## Phaser Integration

```javascript
// Load as atlas or individual frames
this.anims.create({
  key: 'idle-intro',
  frames: introFrames,
  frameRate: 24,
  repeat: 0
});

this.anims.create({
  key: 'idle-loop',
  frames: loopFrames,
  frameRate: 24,
  repeat: -1
});

// Play intro then loop
sprite.play('idle-intro').once('animationcomplete', () => {
  sprite.play('idle-loop');
});
```

---

## Common Issues

**Face getting cut off**
→ rembg does this. Switch to chroma key.

**Black shirt has holes**
→ Grey highlights in shirt being keyed. Tighten threshold (< 15).

**Grey fringe around edges**
→ You're using rembg with mask dilation. Use chroma key instead.

**Shadow blob under feet**
→ Re-generate video with "no shadows" in prompt.

---

## File Structure

```
sources/
├── videos/       # Source videos from Veo
├── sprites/      # Extracted sprite sets
│   └── [name]/
│       ├── intro/
│       ├── loop/
│       └── README.md
├── raw/          # Reference images
└── valid/        # Approved final images
```
