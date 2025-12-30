#!/usr/bin/env python3
"""Generate video using VEO 3.1 with reference image."""

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Load .env from sprite-tools root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from google import genai
from google.genai import types

def main():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in .env")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # Reference image - bartender idle frame
    ref_image_path = Path(__file__).parent.parent / "sources" / "bartender-idle.mp4"

    # Extract first frame from video as reference
    import subprocess
    ref_frame_path = Path(__file__).parent.parent / "sources" / "bartender-ref.png"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(ref_image_path),
        "-vframes", "1", "-q:v", "2", str(ref_frame_path)
    ], capture_output=True)

    # Load reference image
    with open(ref_frame_path, "rb") as f:
        ref_image_data = f.read()

    ref_image = types.Image(image_bytes=ref_image_data, mime_type="image/png")

    reference = types.VideoGenerationReferenceImage(
        image=ref_image,
        reference_type="asset"  # asset for visual style reference
    )

    prompt = """Medium shot, waist-up framing, transparent background. Head, torso, and shoulders COMPLETELY STILL - ONLY arms move.

1. Right hand moves beer glass behind back
2. Emerges with EMPTY glass
3. Positions under invisible tap, glass fills with amber beer
4. Sets full glass down on invisible counter below frame
5. Reaches behind back, emerges with new glass and cloth
6. Returns to polishing position"""

    print("Generating video with VEO 3.1...")
    print(f"Duration: 6 seconds")
    print(f"Reference: {ref_frame_path}")
    print(f"Prompt: {prompt[:100]}...")

    # Try without reference images first (API access issue)
    operation = client.models.generate_videos(
        model="veo-3.1-generate-preview",
        prompt=prompt,
        config=types.GenerateVideosConfig(
            duration_seconds=6,
            aspect_ratio="9:16",  # Portrait for character
            resolution="720p",
        ),
    )

    print("Waiting for generation...")
    while not operation.done:
        print(".", end="", flush=True)
        time.sleep(10)
        operation = client.operations.get(operation)

    print("\nDone!")

    if operation.response and operation.response.generated_videos:
        video = operation.response.generated_videos[0]
        output_path = Path(__file__).parent.parent / "sources" / "bartender-pour.mp4"
        client.files.download(file=video.video)
        video.video.save(str(output_path))
        print(f"Saved to: {output_path}")
    else:
        print("Error: No video generated")
        print(operation)

if __name__ == "__main__":
    main()
