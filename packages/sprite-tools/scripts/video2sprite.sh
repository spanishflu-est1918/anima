#!/bin/bash
#
# video2sprite.sh - Convert video to Phaser-ready sprite sheet
#
# Usage: ./video2sprite.sh <video> <output-name> [options]
#
# Options:
#   --fps <n>       Frame rate to extract (default: 12)
#   --fuzz <n>      Chroma key fuzz percentage per pass (default: 8)
#   --passes <n>    Number of chroma key passes (default: 2)
#   --threshold <n> Alpha threshold percentage (default: 90)
#   --cols <n>      Columns in sprite sheet (default: auto)
#   --crop <WxH+X+Y> Crop video before processing (for letterboxing)
#   --chroma <hex>  Override auto-detected chroma color
#   --no-blur       Skip edge blur step
#   --no-threshold  Skip alpha threshold step
#   --preview-video Generate preview video from processed frames
#   --scale <n>     Scale output to n% of original (e.g., 50 for half size)
#   --optimize      Run pngquant compression on final sprite sheet
#   --quality <n-m> pngquant quality range (default: 15-30, requires --optimize)
#

set -e

# Defaults
FPS=12
FUZZ=20
PASSES=2
THRESHOLD=90
COLS=""
CROP=""
CHROMA=""
BLUR=true
DO_THRESHOLD=true
PREVIEW_VIDEO=true
SCALE=""
OPTIMIZE=true
QUALITY="15-30"

# Parse arguments
VIDEO="$1"
OUTPUT="$2"
shift 2 || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --fps) FPS="$2"; shift 2 ;;
        --fuzz) FUZZ="$2"; shift 2 ;;
        --passes) PASSES="$2"; shift 2 ;;
        --threshold) THRESHOLD="$2"; shift 2 ;;
        --cols) COLS="$2"; shift 2 ;;
        --crop) CROP="$2"; shift 2 ;;
        --chroma) CHROMA="$2"; shift 2 ;;
        --no-blur) BLUR=false; shift ;;
        --no-threshold) DO_THRESHOLD=false; shift ;;
        --preview-video) PREVIEW_VIDEO=true; shift ;;
        --scale) SCALE="$2"; shift 2 ;;
        --optimize) OPTIMIZE=true; shift ;;
        --no-optimize) OPTIMIZE=false; shift ;;
        --quality) QUALITY="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ -z "$VIDEO" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: $0 <video> <output-name> [options]"
    echo ""
    echo "Options:"
    echo "  --fps <n>        Frame rate (default: 12)"
    echo "  --fuzz <n>       Chroma fuzz % per pass (default: 8)"
    echo "  --passes <n>     Chroma key passes (default: 2)"
    echo "  --threshold <n>  Alpha threshold % (default: 90)"
    echo "  --cols <n>       Sprite sheet columns (default: auto)"
    echo "  --crop <WxH+X+Y> Crop video (for letterboxing)"
    echo "  --chroma <hex>   Override chroma color (e.g., #34af3a)"
    echo "  --no-blur        Skip edge blur"
    echo "  --no-threshold   Skip alpha threshold (keeps soft edges)"
    echo "  --preview-video  Generate preview video from processed frames"
    echo "  --scale <n>      Scale to n% of original (e.g., 50 for half size)"
    echo "  --optimize       Run pngquant compression (default: ON)"
    echo "  --no-optimize    Skip pngquant compression"
    echo "  --quality <n-m>  pngquant quality (default: 15-30)"
    exit 1
fi

# Save original directory and make output path absolute
ORIG_DIR="$(pwd)"
if [[ "$OUTPUT" != /* ]]; then
    OUTPUT="$ORIG_DIR/$OUTPUT"
fi

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "=== video2sprite ==="
echo "Input: $VIDEO"
echo "Output: $OUTPUT"

# Step 1: Extract frames
echo ""
echo "1. Extracting frames at ${FPS}fps..."
VF="fps=$FPS"
[ -n "$CROP" ] && VF="$VF,crop=$CROP"
[ -n "$SCALE" ] && VF="$VF,scale=iw*${SCALE}/100:ih*${SCALE}/100"
ffmpeg -y -i "$VIDEO" -vf "$VF" "$TMP_DIR/frame_%03d.png" 2>/dev/null
FRAME_COUNT=$(ls "$TMP_DIR"/*.png | wc -l | tr -d ' ')
echo "   Extracted $FRAME_COUNT frames"

# Step 1.5: Auto-detect and remove letterboxing (black bars)
echo ""
echo "1.5. Checking for letterboxing..."
SAMPLE="$TMP_DIR/frame_001.png"
ORIG_WIDTH=$(magick identify -format "%w" "$SAMPLE")
ORIG_HEIGHT=$(magick identify -format "%h" "$SAMPLE")

# Sample top and bottom edges (center of frame, 5 pixels from edge)
CENTER_X=$((ORIG_WIDTH / 2))
TOP_COLOR=$(magick "$SAMPLE" -crop 1x1+${CENTER_X}+5 -format "%[hex:p{0,0}]" info:)
BOTTOM_COLOR=$(magick "$SAMPLE" -crop 1x1+${CENTER_X}+$((ORIG_HEIGHT-5)) -format "%[hex:p{0,0}]" info:)

# Check if colors are black (all RGB < 30)
is_black() {
    local HEX="${1:0:6}"
    local R=$((16#${HEX:0:2}))
    local G=$((16#${HEX:2:2}))
    local B=$((16#${HEX:4:2}))
    [ $R -lt 30 ] && [ $G -lt 30 ] && [ $B -lt 30 ]
}

if is_black "$TOP_COLOR" || is_black "$BOTTOM_COLOR"; then
    echo "   Letterboxing detected (top: #$TOP_COLOR, bottom: #$BOTTOM_COLOR)"

    # Find where black bars end by scanning rows
    # Scan from top until we find non-black
    TOP_CROP=0
    for ((y=0; y<ORIG_HEIGHT/2; y+=5)); do
        ROW_COLOR=$(magick "$SAMPLE" -crop 1x1+${CENTER_X}+${y} -format "%[hex:p{0,0}]" info:)
        if ! is_black "$ROW_COLOR"; then
            TOP_CROP=$y
            break
        fi
    done

    # Scan from bottom until we find non-black
    BOTTOM_CROP=0
    for ((y=ORIG_HEIGHT-1; y>ORIG_HEIGHT/2; y-=5)); do
        ROW_COLOR=$(magick "$SAMPLE" -crop 1x1+${CENTER_X}+${y} -format "%[hex:p{0,0}]" info:)
        if ! is_black "$ROW_COLOR"; then
            BOTTOM_CROP=$((ORIG_HEIGHT - y - 1))
            break
        fi
    done

    if [ $TOP_CROP -gt 0 ] || [ $BOTTOM_CROP -gt 0 ]; then
        NEW_HEIGHT=$((ORIG_HEIGHT - TOP_CROP - BOTTOM_CROP))
        echo "   Cropping: top=${TOP_CROP}px, bottom=${BOTTOM_CROP}px"
        echo "   New size: ${ORIG_WIDTH}x${NEW_HEIGHT}"

        # Crop all frames
        cd "$TMP_DIR"
        mogrify -crop "${ORIG_WIDTH}x${NEW_HEIGHT}+0+${TOP_CROP}" +repage *.png
        cd "$ORIG_DIR"
    else
        echo "   No significant letterboxing found"
    fi
else
    echo "   No letterboxing detected"
fi

# Step 2: Detect chroma color (sample corners and find greenest)
if [ -z "$CHROMA" ]; then
    echo ""
    echo "2. Detecting chroma color..."
    SAMPLE="$TMP_DIR/frame_001.png"
    WIDTH=$(magick identify -format "%w" "$SAMPLE")
    HEIGHT=$(magick identify -format "%h" "$SAMPLE")

    # Sample corners (10 pixels in from edges)
    C1=$(magick "$SAMPLE" -crop 1x1+10+10 -format "%[hex:p{0,0}]" info:)
    C2=$(magick "$SAMPLE" -crop 1x1+$((WIDTH-10))+10 -format "%[hex:p{0,0}]" info:)
    C3=$(magick "$SAMPLE" -crop 1x1+10+$((HEIGHT-10)) -format "%[hex:p{0,0}]" info:)
    C4=$(magick "$SAMPLE" -crop 1x1+$((WIDTH-10))+$((HEIGHT-10)) -format "%[hex:p{0,0}]" info:)

    echo "   Corners: $C1, $C2, $C3, $C4"

    # Find the greenest color (highest G relative to R and B)
    BEST_COLOR="$C1"
    BEST_SCORE=-999
    for C in $C1 $C2 $C3 $C4; do
        # Extract RGB components (handle both 6 and 8 char hex)
        HEX="${C:0:6}"
        R=$((16#${HEX:0:2}))
        G=$((16#${HEX:2:2}))
        B=$((16#${HEX:4:2}))
        # Score: how much greener is it than red/blue?
        MAX_RB=$R
        [ $B -gt $MAX_RB ] && MAX_RB=$B
        SCORE=$((G - MAX_RB))
        echo "   Color #$HEX: R=$R G=$G B=$B, green score=$SCORE"
        if [ $SCORE -gt $BEST_SCORE ]; then
            BEST_SCORE=$SCORE
            BEST_COLOR="$HEX"
        fi
    done

    CHROMA="#$BEST_COLOR"
    echo "   Selected: $CHROMA (green score: $BEST_SCORE)"
fi

# Step 3: Multi-pass chroma key (fuzz-based)
echo ""
echo "3. Applying fuzz-based chroma key ($CHROMA, ${PASSES}x passes at ${FUZZ}% fuzz)..."
cd "$TMP_DIR"
for ((i=1; i<=PASSES; i++)); do
    echo "   Pass $i..."
    mogrify -fuzz "${FUZZ}%" -transparent "$CHROMA" *.png
done

# Step 4: Color-channel cleanup (catches green that fuzz misses)
echo ""
echo "4. Color-channel green cleanup..."
for f in *.png; do
    # Remove pixels where green channel dominates (g > r+0.12 AND g > b+0.12 AND g > 0.35)
    magick "$f" \
        \( +clone -alpha off -fx "g > 0.35 && g > r+0.12 && g > b+0.12 ? 0 : 1" \) \
        -compose DstIn -composite \
        "$f"
done

# Step 5: Morphology cleanup (erode to remove fringe, dilate to restore edges)
echo ""
echo "5. Morphology edge cleanup..."
for f in *.png; do
    magick "$f" \
        \( +clone -alpha extract -morphology Erode Diamond:1 -morphology Dilate Diamond:1 \) \
        -compose CopyOpacity -composite \
        "$f"
done

# Step 6: Edge blur (optional - softens edges)
if [ "$BLUR" = true ]; then
    echo ""
    echo "6. Applying edge blur..."
    mogrify -alpha set -channel A -blur 0x0.5 +channel *.png
fi

# Step 7: Find global bounding box across ALL frames
echo ""
echo "7. Finding global bounding box..."

# Stack all frames and find the combined trim geometry
TRIM_INFO=$(magick convert frame_*.png -layers merge -format "%@" info:)
echo "   Global bounds: $TRIM_INFO"

# Parse the geometry (WxH+X+Y)
CROP_W=$(echo "$TRIM_INFO" | sed 's/\([0-9]*\)x.*/\1/')
CROP_H=$(echo "$TRIM_INFO" | sed 's/[0-9]*x\([0-9]*\)+.*/\1/')
CROP_X=$(echo "$TRIM_INFO" | sed 's/[0-9]*x[0-9]*+\([0-9]*\)+.*/\1/')
CROP_Y=$(echo "$TRIM_INFO" | sed 's/[0-9]*x[0-9]*+[0-9]*+\([0-9]*\)/\1/')

echo "   Crop: ${CROP_W}x${CROP_H} at +${CROP_X}+${CROP_Y}"

# Step 8: Crop all frames to the same global bounding box
echo ""
echo "8. Cropping all frames to global bounds..."
mogrify -crop "${CROP_W}x${CROP_H}+${CROP_X}+${CROP_Y}" +repage *.png

MAX_W=$CROP_W
MAX_H=$CROP_H
echo "   Frame size: ${MAX_W}x${MAX_H}"

# Step 8.5: Generate preview video (optional)
if [ "$PREVIEW_VIDEO" = true ]; then
    echo ""
    echo "8.5. Generating preview video..."
    # Use prores for transparency support, or webm
    ffmpeg -y -framerate "$FPS" -i "frame_%03d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le "${OUTPUT}_preview.mov" 2>/dev/null
    echo "   Preview: ${OUTPUT}_preview.mov"
fi

# Step 9: Calculate grid
if [ -z "$COLS" ]; then
    # Auto-calculate columns (aim for roughly square grid)
    COLS=$(echo "sqrt($FRAME_COUNT)" | bc)
    [ "$COLS" -lt 1 ] && COLS=1
fi
ROWS=$(( (FRAME_COUNT + COLS - 1) / COLS ))
echo ""
echo "9. Building sprite sheet (${COLS}x${ROWS} grid)..."

# Create sprite sheet
magick montage frame_*.png -tile "${COLS}x${ROWS}" -geometry "${MAX_W}x${MAX_H}+0+0" -background none "$TMP_DIR/sheet_full.png"

# Copy full-size sheet
cp "$TMP_DIR/sheet_full.png" "$OUTPUT.png"

# Calculate final frame dimensions
SHEET_W=$(magick identify -format "%w" "$OUTPUT.png")
SHEET_H=$(magick identify -format "%h" "$OUTPUT.png")
FRAME_W=$((SHEET_W / COLS))
FRAME_H=$((SHEET_H / ROWS))

# Fix rounding: resize to exact multiples of frame size
EXACT_W=$((FRAME_W * COLS))
EXACT_H=$((FRAME_H * ROWS))
if [ "$SHEET_W" -ne "$EXACT_W" ] || [ "$SHEET_H" -ne "$EXACT_H" ]; then
    echo "   Fixing dimensions: ${SHEET_W}x${SHEET_H} -> ${EXACT_W}x${EXACT_H}"
    magick "$OUTPUT.png" -resize "${EXACT_W}x${EXACT_H}!" "$OUTPUT.png"
    SHEET_W=$EXACT_W
    SHEET_H=$EXACT_H
fi

# Step 10: Create JSON metadata
echo ""
echo "10. Creating metadata..."
cat > "$OUTPUT.json" << EOF
{
	"name": "$(basename "$OUTPUT")",
	"frameWidth": $FRAME_W,
	"frameHeight": $FRAME_H,
	"frameCount": $FRAME_COUNT,
	"cols": $COLS,
	"rows": $ROWS,
	"fps": $FPS
}
EOF

# Step 11: Create preview GIF
echo ""
echo "11. Creating preview GIF..."
magick frame_*.png -resize 150x -delay $((100/FPS)) -loop 0 "${OUTPUT}_preview.gif"

# Step 12: Optimize with pngquant (optional)
if [ "$OPTIMIZE" = true ]; then
    echo ""
    echo "12. Optimizing with pngquant (quality: $QUALITY)..."
    if command -v pngquant &> /dev/null; then
        BEFORE_SIZE=$(stat -f%z "$OUTPUT.png" 2>/dev/null || stat -c%s "$OUTPUT.png")
        pngquant --quality="$QUALITY" --speed 1 --strip --force "$OUTPUT.png" --output "$OUTPUT.png" 2>/dev/null || {
            echo "   Warning: pngquant optimization failed, keeping original"
        }
        AFTER_SIZE=$(stat -f%z "$OUTPUT.png" 2>/dev/null || stat -c%s "$OUTPUT.png")
        SAVED=$((BEFORE_SIZE - AFTER_SIZE))
        SAVED_MB=$(echo "scale=1; $SAVED / 1048576" | bc)
        PCT=$(echo "scale=0; 100 * $SAVED / $BEFORE_SIZE" | bc)
        echo "   Saved ${SAVED_MB}MB (${PCT}%)"
    else
        echo "   Warning: pngquant not found, skipping optimization"
    fi
fi

echo ""
echo "=== Done ==="
echo "Sprite sheet: $OUTPUT.png (${SHEET_W}x${SHEET_H}, ${FRAME_W}x${FRAME_H} per frame)"
echo "Metadata: $OUTPUT.json"
echo "Preview: ${OUTPUT}_preview.gif"
[ -n "$SCALE" ] && echo "Scale: ${SCALE}%"
[ "$OPTIMIZE" = true ] && echo "Optimized: yes (quality $QUALITY)"
