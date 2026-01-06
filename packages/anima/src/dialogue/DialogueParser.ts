import type { Story } from "inkjs";
import type { DialogueLine, TagCallback } from "./types";

/**
 * Parses and processes Ink dialogue lines and tags.
 */
export class DialogueParser {
	private characterColors: Map<string, string> = new Map();
	private tagCallbacks: Map<string, TagCallback> = new Map();

	/**
	 * Parse dialogue line into speaker and text.
	 * Format: "SPEAKER: text" or just "text"
	 */
	public parseLine(line: string): DialogueLine {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0 && colonIndex < 20) {
			return {
				speaker: line.substring(0, colonIndex).trim(),
				text: line.substring(colonIndex + 1).trim(),
			};
		}
		return { speaker: "", text: line };
	}

	/**
	 * Process Ink tags, calling registered callbacks
	 */
	public async processTags(tags: string[]): Promise<void> {
		for (const tag of tags) {
			if (tag.startsWith("tts:")) continue; // Skip TTS hints

			const tagName = tag.split(":")[0].trim();
			const callback = this.tagCallbacks.get(tagName);
			if (callback) {
				await callback(tag);
			}
		}
	}

	/**
	 * Register a callback for a specific Ink tag
	 */
	public onTag(tag: string, callback: TagCallback): void {
		this.tagCallbacks.set(tag, callback);
	}

	/**
	 * Clear all tag callbacks
	 */
	public clearTagCallbacks(): void {
		this.tagCallbacks.clear();
	}

	/**
	 * Extract speaker colors from Ink variables.
	 * Pattern: {speaker}_color variable in story
	 */
	public extractColorsFromStory(story: Story): void {
		const testVariables = (
			story as Story & {
				_variablesState?: { _globalVariables?: Map<string, unknown> };
			}
		)._variablesState?._globalVariables;

		if (testVariables) {
			for (const [key, value] of testVariables) {
				if (key.endsWith("_color") && typeof value === "string") {
					const speaker = key.replace("_color", "").toUpperCase();
					this.characterColors.set(speaker, value);
				}
			}
		}
	}

	/**
	 * Get speaker color from extracted Ink variables
	 */
	public getSpeakerColor(speaker: string): string | undefined {
		return this.characterColors.get(speaker.toUpperCase());
	}

	/**
	 * Set a speaker color manually
	 */
	public setSpeakerColor(speaker: string, color: string): void {
		this.characterColors.set(speaker.toUpperCase(), color);
	}
}
