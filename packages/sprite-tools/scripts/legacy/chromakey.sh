#!/bin/bash
#
# chromakey.sh - Remove chroma key background from images
#
# Usage: ./chromakey.sh <input> <output> [options]
#
# Options:
#   --fuzz <n>      Chroma key fuzz percentage (default: 20)
#   --chroma <hex>  Override auto-detected chroma color
#   --no-trim       Skip auto-crop to content bounds
#   --no-blur       Skip edge blur step
#

set -e

# Defaults
FUZZ=30
CHROMA=""
TRIM=true
BLUR=true

# Parse arguments
INPUT="$1"
OUTPUT="$2"
shift 2 || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --fuzz) FUZZ="$2"; shift 2 ;;
        --chroma) CHROMA="$2"; shift 2 ;;
        --no-trim) TRIM=false; shift ;;
        --no-blur) BLUR=false; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: $0 <input> <output> [options]"
    echo ""
    echo "Options:"
    echo "  --fuzz <n>      Chroma fuzz % (default: 20)"
    echo "  --chroma <hex>  Override chroma color (e.g., #00FF00)"
    echo "  --no-trim       Skip auto-crop"
    echo "  --no-blur       Skip edge blur"
    exit 1
fi

echo "=== chromakey ==="
echo "Input: $INPUT"
echo "Output: $OUTPUT"

# Step 1: Auto-detect chroma color from corners
if [ -z "$CHROMA" ]; then
    echo ""
    echo "1. Detecting chroma color..."

    WIDTH=$(magick identify -format "%w" "$INPUT")
    HEIGHT=$(magick identify -format "%h" "$INPUT")

    # Sample corners (10 pixels in from edges)
    C1=$(magick "$INPUT" -crop 1x1+10+10 -format "%[hex:p{0,0}]" info:)
    C2=$(magick "$INPUT" -crop 1x1+$((WIDTH-10))+10 -format "%[hex:p{0,0}]" info:)
    C3=$(magick "$INPUT" -crop 1x1+10+$((HEIGHT-10)) -format "%[hex:p{0,0}]" info:)
    C4=$(magick "$INPUT" -crop 1x1+$((WIDTH-10))+$((HEIGHT-10)) -format "%[hex:p{0,0}]" info:)

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

        echo "   #$HEX: R=$R G=$G B=$B, green score=$SCORE"

        if [ $SCORE -gt $BEST_SCORE ]; then
            BEST_SCORE=$SCORE
            BEST_COLOR="$HEX"
        fi
    done

    CHROMA="#$BEST_COLOR"
    echo "   Selected: $CHROMA (green score: $BEST_SCORE)"
fi

# Step 2: Apply chroma key
echo ""
echo "2. Applying chroma key ($CHROMA, fuzz ${FUZZ}%)..."
magick "$INPUT" -fuzz "${FUZZ}%" -transparent "$CHROMA" "$OUTPUT"

# Step 3: Edge cleanup - erode then dilate to remove green fringe
echo ""
echo "3. Cleaning up edges..."
magick "$OUTPUT" \
    -alpha extract \
    -morphology Erode Diamond:1 \
    -morphology Dilate Diamond:1 \
    "$OUTPUT.mask.png"
magick "$OUTPUT" "$OUTPUT.mask.png" -alpha off -compose CopyOpacity -composite "$OUTPUT"
rm "$OUTPUT.mask.png"

# Step 4: Edge blur (optional)
if [ "$BLUR" = true ]; then
    echo ""
    echo "4. Applying edge blur..."
    magick "$OUTPUT" -alpha set -virtual-pixel transparent \
        -channel A -blur 0x1 -level '50%,100%' +channel "$OUTPUT"
fi

# Step 4: Trim (optional)
if [ "$TRIM" = true ]; then
    echo ""
    echo "4. Trimming to content bounds..."
    BEFORE=$(magick identify -format "%wx%h" "$OUTPUT")
    magick "$OUTPUT" -trim +repage "$OUTPUT"
    AFTER=$(magick identify -format "%wx%h" "$OUTPUT")
    echo "   $BEFORE → $AFTER"
fi

# Final info
echo ""
echo "=== Done ==="
FINAL_SIZE=$(magick identify -format "%wx%h" "$OUTPUT")
echo "Output: $OUTPUT ($FINAL_SIZE)"
