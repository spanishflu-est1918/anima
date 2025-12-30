#!/usr/bin/env python3
"""
hedra-video.py - Generate animated character videos using Hedra API

USAGE:
    # Lip-sync with audio (Hedra Character 3)
    python hedra-video.py --image character.png --audio voice.mp3 --prompt "A punk artist"
    
    # Image-to-Video without audio (Kling, Veo, Sora models)
    python hedra-video.py --image character.png --prompt "Character walking drunk" --model kling-2.5-i2v
    python hedra-video.py --image character.png --prompt "Character walking" --model sora-2-pro-i2v

AVAILABLE MODELS:
    Lip-sync (requires audio):
      hedra-character-3    - Hedra Character 3 (default for audio)
    
    Image-to-Video (no audio needed):
      kling-2.5-i2v        - Kling 2.5 Turbo I2V (10 cr/s, cheapest)
      kling-2.6-pro-i2v    - Kling 2.6 Pro I2V (20 cr/s)
      veo-3-fast-i2v       - Veo 3 Fast I2V (20 cr/s)
      sora-2-pro-i2v       - Sora 2 Pro I2V (70 cr/s, best quality)
                            DURATIONS: 4, 8, or 12 seconds only
                            NOTE: OpenAI is gay. Use soft language - avoid
                            words like "attack", "fight", "hit", "deflect".
                            Say "gesture", "motion", "movement" instead.

REQUIREMENTS:
    - HEDRA_API_KEY in environment or .env file
    - requests, python-dotenv packages
    - ffprobe (for audio duration detection)

INSTALL:
    pip install requests python-dotenv
"""

import argparse
import os
import sys
import time
import subprocess
import requests
from pathlib import Path

# Load .env file if exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_URL = "https://api.hedra.com/web-app/public"

# Model ID mapping
MODELS = {
    # Lip-sync models (require audio)
    "hedra-character-3": "d1dd37a3-e39a-4854-a298-6510289f9cf2",
    
    # I2V models (no audio required)
    "kling-2.5-i2v": "0e451fde-9e6f-48e6-83a9-222f6cc05eba",
    "kling-2.6-pro-i2v": "f00f87c8-ec48-4e9c-bbb6-1e496c929f89",
    "kling-1.6-i2v": "b5f854ca-6879-4018-b040-76084ceab97d",
    "veo-2-i2v": "b9daa983-98c8-492e-86d0-d7ede704d4ff",
    "veo-3-i2v": "fb657777-6b02-478d-87a9-e02e8c53748c",
    "veo-3-fast-i2v": "9963e814-d1ee-4518-a844-7ed380ddbb20",
    "sora-2-pro-i2v": "b1ee5a44-0f2a-4bba-93ce-ee7420bdb6c1",
}

# Models that don't require audio
NO_AUDIO_MODELS = [
    "kling-2.5-i2v", "kling-2.6-pro-i2v", "kling-1.6-i2v",
    "veo-2-i2v", "veo-3-i2v", "veo-3-fast-i2v", "sora-2-pro-i2v"
]

def get_audio_duration(audio_path: str) -> float:
    """Get audio duration in seconds using ffprobe"""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
            capture_output=True, text=True
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:
        print(f"[WARN] Could not get audio duration: {e}")
    return None

def get_api_key():
    key = os.environ.get("HEDRA_API_KEY")
    if not key:
        print("ERROR: HEDRA_API_KEY not found in environment")
        print("Set it via: export HEDRA_API_KEY='your_key'")
        print("Or add to .env file")
        sys.exit(1)
    return key

def headers():
    return {
        "X-API-Key": get_api_key(),
        "Content-Type": "application/json"
    }

def upload_headers():
    return {
        "X-API-Key": get_api_key()
    }

def check_credits():
    """Check available API credits"""
    resp = requests.get(f"{BASE_URL}/billing/credits", headers=headers())
    if resp.status_code == 200:
        data = resp.json()
        print(f"[INFO] Available credits: {data.get('credits', 'unknown')}")
        return data
    else:
        print(f"[WARN] Could not check credits: {resp.status_code}")
        return None

def create_asset(asset_type: str, name: str):
    """Create an asset placeholder"""
    resp = requests.post(
        f"{BASE_URL}/assets",
        headers=headers(),
        json={"type": asset_type, "name": name}
    )
    if resp.status_code not in [200, 201]:
        print(f"ERROR: Failed to create {asset_type} asset: {resp.text}")
        sys.exit(1)
    return resp.json()

def upload_asset(asset_id: str, file_path: str):
    """Upload file to asset using multipart form data"""
    path = Path(file_path)
    if not path.exists():
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    # Determine content type
    ext = path.suffix.lower()
    content_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4"
    }
    content_type = content_types.get(ext, "application/octet-stream")

    with open(path, "rb") as f:
        files = {"file": (path.name, f, content_type)}
        resp = requests.post(
            f"{BASE_URL}/assets/{asset_id}/upload",
            headers={"X-API-Key": get_api_key()},
            files=files
        )

    if resp.status_code not in [200, 201]:
        print(f"ERROR: Failed to upload {file_path}: {resp.text}")
        sys.exit(1)

    print(f"[INFO] Uploaded: {path.name}")
    return resp.json()

def generate_video(image_asset_id: str, audio_asset_id: str,
                   aspect_ratio: str, resolution: str,
                   text_prompt: str, duration: float = None, seed: int = None,
                   model_id: str = "d1dd37a3-e39a-4854-a298-6510289f9cf2"):
    """Submit video generation request"""
    generated_video_inputs = {
        "text_prompt": text_prompt,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio
    }

    if duration:
        generated_video_inputs["duration_ms"] = int(duration * 1000)

    payload = {
        "type": "video",
        "ai_model_id": model_id,
        "start_keyframe_id": image_asset_id,
        "audio_id": audio_asset_id,
        "generated_video_inputs": generated_video_inputs
    }

    import json
    print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")

    resp = requests.post(
        f"{BASE_URL}/generations",
        headers=headers(),
        json=payload
    )

    if resp.status_code not in [200, 201]:
        print(f"ERROR: Failed to start generation: {resp.text}")
        sys.exit(1)

    return resp.json()

def poll_status(generation_id: str, timeout: int = 600):
    """Poll for generation completion"""
    start_time = time.time()
    last_status = None

    while time.time() - start_time < timeout:
        resp = requests.get(
            f"{BASE_URL}/generations/{generation_id}/status",
            headers=headers()
        )

        if resp.status_code != 200:
            print(f"ERROR: Failed to get status: {resp.text}")
            sys.exit(1)

        data = resp.json()
        status = data.get("status", "unknown")

        if status != last_status:
            print(f"[INFO] Status: {status}")
            last_status = status

        if status in ["completed", "complete"]:
            return data
        elif status in ["failed", "error"]:
            print(f"ERROR: Generation failed: {data}")
            sys.exit(1)

        time.sleep(5)

    print("ERROR: Generation timed out")
    sys.exit(1)

def download_video(url: str, output_path: str):
    """Download generated video"""
    resp = requests.get(url, stream=True)
    if resp.status_code != 200:
        print(f"ERROR: Failed to download video: {resp.status_code}")
        sys.exit(1)

    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    print(f"[INFO] Downloaded: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate animated character videos with Hedra API")
    parser.add_argument("--image", help="Input image path (.png, .jpg)")
    parser.add_argument("--audio", help="Input audio path (.mp3, .wav) - optional for I2V models")
    parser.add_argument("--prompt", default="A character talking", help="Text prompt describing the character/action")
    parser.add_argument("--output", help="Output video path (default: <image_name>.mp4)")
    parser.add_argument("--aspect-ratio", default="9:16", choices=["9:16", "16:9", "1:1"], help="Video aspect ratio")
    parser.add_argument("--resolution", default="720p", choices=["540p", "720p", "1080p"], help="Video resolution")
    parser.add_argument("--duration", type=float, help="Video duration in seconds")
    parser.add_argument("--seed", type=int, help="Seed for reproducible results")
    parser.add_argument("--model", default="kling-2.5-i2v", choices=list(MODELS.keys()), 
                        help="Model to use (default: kling-2.5-i2v)")
    parser.add_argument("--check-credits", action="store_true", help="Check available credits and exit")
    parser.add_argument("--list-models", action="store_true", help="List available models and exit")

    args = parser.parse_args()

    # List models
    if args.list_models:
        print("Available models:")
        print("\nLip-sync (requires --audio):")
        print("  hedra-character-3    - Hedra Character 3")
        print("\nImage-to-Video (no audio needed):")
        print("  kling-2.5-i2v        - Kling 2.5 Turbo (10 cr/s, cheapest)")
        print("  kling-2.6-pro-i2v    - Kling 2.6 Pro (20 cr/s)")
        print("  veo-3-fast-i2v       - Veo 3 Fast (20 cr/s)")
        print("  sora-2-pro-i2v       - Sora 2 Pro (70 cr/s, best)")
        sys.exit(0)

    # Check credits only
    if args.check_credits:
        check_credits()
        sys.exit(0)

    # Validate required inputs
    if not args.image:
        print("ERROR: --image is required for video generation")
        sys.exit(1)
        
    # Check if audio is required for this model
    requires_audio = args.model not in NO_AUDIO_MODELS
    if requires_audio and not args.audio:
        print(f"ERROR: --audio is required for model '{args.model}'")
        print("Use an I2V model (e.g., --model kling-2.5-i2v) for image-to-video without audio")
        sys.exit(1)

    # Auto-select lip-sync model if audio provided and no model override
    model = args.model
    if args.audio and args.model == "kling-2.5-i2v":
        model = "hedra-character-3"
        print(f"[INFO] Auto-selected model: {model} (lip-sync with audio)")

    # Re-check if audio is required for the selected model
    requires_audio = model not in NO_AUDIO_MODELS
    if requires_audio and not args.audio:
        print(f"ERROR: --audio is required for model '{model}'")
        sys.exit(1)

    # Auto-detect duration from audio if not provided
    duration = args.duration
    if args.audio and not duration:
        duration = get_audio_duration(args.audio)
        if duration:
            print(f"[INFO] Auto-detected audio duration: {duration:.2f}s")
        else:
            print("[WARN] Could not auto-detect audio duration, using default")

    # Default output name
    output_path = args.output or Path(args.image).stem + ".mp4"

    print(f"[INFO] Generating video from: {args.image}")
    print(f"[INFO] Audio: {args.audio}")
    print(f"[INFO] Model: {model}")
    print(f"[INFO] Prompt: {args.prompt}")
    print(f"[INFO] Aspect ratio: {args.aspect_ratio}, Resolution: {args.resolution}")

    # Check credits first
    check_credits()

    # Step 1: Create and upload image asset
    print("[INFO] Uploading image...")
    image_name = Path(args.image).stem
    image_asset = create_asset("image", f"{image_name}-image")
    upload_asset(image_asset["id"], args.image)

    # Step 2: Create and upload audio asset if required
    audio_asset_id = None
    if requires_audio and args.audio:
        print("[INFO] Uploading audio...")
        audio_name = Path(args.audio).stem
        audio_asset = create_asset("audio", f"{audio_name}-audio")
        upload_asset(audio_asset["id"], args.audio)
        audio_asset_id = audio_asset["id"]

    # Step 3: Submit generation
    print("[INFO] Starting video generation...")
    gen_result = generate_video(
        image_asset_id=image_asset["id"],
        audio_asset_id=audio_asset_id,
        aspect_ratio=args.aspect_ratio,
        resolution=args.resolution,
        text_prompt=args.prompt,
        duration=duration,
        seed=args.seed,
        model_id=MODELS[model]
    )

    generation_id = gen_result.get("id") or gen_result.get("generation_id")
    print(f"[INFO] Generation ID: {generation_id}")

    # Step 4: Poll for completion
    print("[INFO] Waiting for generation to complete...")
    result = poll_status(generation_id)

    # Step 5: Download video
    video_url = result.get("video_url") or result.get("url") or result.get("output_url")
    if video_url:
        download_video(video_url, output_path)
        print(f"[SUCCESS] Video saved to: {output_path}")
    else:
        print(f"[INFO] Generation complete. Result: {result}")
        print("[WARN] Could not find video URL in response - check Hedra dashboard")

if __name__ == "__main__":
    main()
