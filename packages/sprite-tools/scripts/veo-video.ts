#!/usr/bin/env npx tsx
/**
 * veo-video.ts - Generate animated character videos using Google Veo 3.1
 *
 * USAGE:
 *   npx tsx scripts/veo-video.ts --image character.png --prompt "A punk artist"
 *   npx tsx scripts/veo-video.ts --image character.png --output video.mp4
 *
 * REQUIREMENTS:
 *   - GOOGLE_API_KEY in environment or .env file
 *   - @google/genai package
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load .env
config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error("ERROR: GOOGLE_API_KEY not found in environment");
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
let imagePath = "";
let prompt = "Character with subtle idle animation, minimal movement, fixed camera";
let outputPath = "";
let aspectRatio: "16:9" | "9:16" = "9:16";
let resolution: "720p" | "1080p" = "720p";
let durationSeconds: number | undefined = undefined;
let negativePrompt: string | undefined = undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--image" && args[i + 1]) {
    imagePath = args[++i];
  } else if (args[i] === "--prompt" && args[i + 1]) {
    prompt = args[++i];
  } else if (args[i] === "--output" && args[i + 1]) {
    outputPath = args[++i];
  } else if (args[i] === "--aspect" && args[i + 1]) {
    aspectRatio = args[++i] as "16:9" | "9:16";
  } else if (args[i] === "--resolution" && args[i + 1]) {
    resolution = args[++i] as "720p" | "1080p";
  } else if (args[i] === "--duration" && args[i + 1]) {
    durationSeconds = parseInt(args[++i], 10);
  } else if (args[i] === "--negative" && args[i + 1]) {
    negativePrompt = args[++i];
  }
}

if (!imagePath) {
  console.error("ERROR: --image is required");
  console.log("Usage: npx tsx scripts/veo-video.ts --image <path> [--prompt <text>] [--output <path>]");
  process.exit(1);
}

// Default output
if (!outputPath) {
  outputPath = path.basename(imagePath, path.extname(imagePath)) + ".mp4";
}

async function main() {
  console.log(`[INFO] Image: ${imagePath}`);
  console.log(`[INFO] Prompt: ${prompt}`);
  console.log(`[INFO] Aspect: ${aspectRatio} | Resolution: ${resolution}${durationSeconds ? ` | Duration: ${durationSeconds}s` : ""}`);
  if (negativePrompt) console.log(`[INFO] Negative: ${negativePrompt}`);
  console.log(`[INFO] Output: ${outputPath}`);

  // Read image file
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  // Initialize client
  const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

  console.log("[INFO] Starting video generation with Veo 3.1...");

  // Generate video from image
  let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt: prompt,
    image: {
      imageBytes: imageBase64,
      mimeType: mimeType,
    },
    config: {
      aspectRatio: aspectRatio,
      resolution: resolution,
      ...(durationSeconds && { durationSeconds }),
      ...(negativePrompt && { negativePrompt }),
    },
  });

  console.log(`[INFO] Operation started: ${operation.name}`);

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max

  while (!operation.done && attempts < maxAttempts) {
    attempts++;
    console.log(`[${attempts}] Status: processing...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    operation = await ai.operations.getVideosOperation({
      operation: operation,
    });
  }

  if (!operation.done) {
    console.error("ERROR: Video generation timed out");
    process.exit(1);
  }

  if (operation.error) {
    console.error(`ERROR: ${operation.error.message}`);
    process.exit(1);
  }

  // Download result
  const video = operation.response?.generatedVideos?.[0];
  if (!video?.video) {
    console.error("ERROR: No video in response");
    console.log("Response:", JSON.stringify(operation.response, null, 2));
    process.exit(1);
  }

  console.log("[INFO] Downloading video...");

  await ai.files.download({
    file: video.video,
    downloadPath: outputPath,
  });

  console.log(`[SUCCESS] Video saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
