/**
 * Text-to-Speech service using ElevenLabs API
 * Provides voice synthesis for game dialogue
 */

export interface TTSConfig {
  apiKey: string;
  defaultVoiceId?: string;
  baseUrl?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export interface TTSService {
  generateSpeech(text: string, voiceId?: string): Promise<ArrayBuffer>;
  getVoices(): Promise<Voice[]>;
}

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Create a TTS service instance
 */
export function createTTSService(config: TTSConfig): TTSService {
  const { apiKey, defaultVoiceId, baseUrl = ELEVENLABS_BASE_URL } = config;

  if (!apiKey) {
    throw new Error("TTS service requires an API key");
  }

  /**
   * Generate speech audio from text
   */
  async function generateSpeech(
    text: string,
    voiceId?: string
  ): Promise<ArrayBuffer> {
    const voice = voiceId ?? defaultVoiceId;
    if (!voice) {
      throw new Error("No voice ID provided and no default voice configured");
    }

    const response = await fetch(`${baseUrl}/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS generation failed: ${response.status} - ${error}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Get available voices from ElevenLabs
   */
  async function getVoices(): Promise<Voice[]> {
    const response = await fetch(`${baseUrl}/voices`, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch voices: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { voices: Voice[] };
    return data.voices;
  }

  return {
    generateSpeech,
    getVoices,
  };
}

// Singleton instance - initialized when API key is available
let ttsServiceInstance: TTSService | null = null;

/**
 * Get or create the TTS service instance
 */
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is not set");
    }
    ttsServiceInstance = createTTSService({
      apiKey,
      defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID,
    });
  }
  return ttsServiceInstance;
}
