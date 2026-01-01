import { Story } from "inkjs";
import type { SpeechText } from "./SpeechText";

/**
 * Dialogue line with speaker and text
 */
export interface DialogueLine {
	speaker: string;
	text: string;
	color?: string;
}

/**
 * Dialogue choice option
 */
export interface DialogueChoice {
	index: number;
	text: string;
}

/**
 * Callbacks for custom dialogue handling
 */
export interface DialogueCallbacks {
	/** Called when dialogue line should be displayed */
	onLine?: (line: DialogueLine) => Promise<void>;
	/** Called when choices are available */
	onChoices?: (choices: DialogueChoice[]) => Promise<number>;
	/** Called when dialogue ends */
	onEnd?: () => void;
	/** Called when speaker starts talking */
	onTalkingStart?: (speaker: string) => void;
	/** Called when speaker stops talking */
	onTalkingEnd?: (speaker: string) => void;
}

/**
 * Per-speaker talking callbacks
 */
export interface SpeakerTalkingCallback {
	onStart: () => void;
	onEnd: () => void;
}

/**
 * Tag callback for processing Ink tags
 */
export type TagCallback = (tag: string) => void | Promise<void>;

/**
 * Simplified Ink dialogue manager for point-and-click adventures.
 * Games provide callbacks for display, TTS, and choices.
 */
export class InkDialogueManager {
	private stories: Map<string, Story> = new Map();
	private currentStory?: Story;
	private currentCharacterId?: string;
	private callbacks: DialogueCallbacks = {};
	private speakerTalkingCallbacks: Map<string, SpeakerTalkingCallback> =
		new Map();
	private tagCallbacks: Map<string, TagCallback> = new Map();
	private characterColors: Map<string, string> = new Map();
	private characterSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
	private interruptedDialogues: Set<string> = new Set();
	private _isDialogueActive = false;

	// Optional SpeechText for floating dialogue
	private speechText?: SpeechText;
	private dialogueClickResolver?: () => void;

	constructor(callbacks?: DialogueCallbacks) {
		if (callbacks) {
			this.callbacks = callbacks;
		}
	}

	/**
	 * Set callbacks for dialogue handling
	 */
	public setCallbacks(callbacks: DialogueCallbacks): void {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	/**
	 * Set SpeechText for floating dialogue display
	 */
	public setSpeechText(speechText: SpeechText): void {
		this.speechText = speechText;
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
	 * Check if dialogue is currently active
	 */
	public isDialogueActive(): boolean {
		return this._isDialogueActive;
	}

	/**
	 * Register a character sprite for positioning
	 */
	public registerCharacterSprite(
		speakerName: string,
		sprite: Phaser.GameObjects.Sprite,
	): void {
		this.characterSprites.set(speakerName.toUpperCase(), sprite);
	}

	/**
	 * Get character sprite by name
	 */
	public getCharacterSprite(
		speakerName: string,
	): Phaser.GameObjects.Sprite | undefined {
		return this.characterSprites.get(speakerName.toUpperCase());
	}

	/**
	 * Register talking callbacks for a specific speaker
	 */
	public registerSpeakerTalking(
		speaker: string,
		onStart: () => void,
		onEnd: () => void,
	): void {
		this.speakerTalkingCallbacks.set(speaker.toUpperCase(), { onStart, onEnd });
	}

	/**
	 * Unregister talking callbacks for a speaker
	 */
	public unregisterSpeakerTalking(speaker: string): void {
		this.speakerTalkingCallbacks.delete(speaker.toUpperCase());
	}

	/**
	 * Register an Ink story (compiled JSON)
	 */
	public registerStory(characterId: string, storyJson: string): void {
		try {
			const story = new Story(storyJson);
			this.stories.set(characterId, story);
			this.extractColorsFromStory(story);
		} catch (error) {
			console.error(`Failed to register story for ${characterId}:`, error);
		}
	}

	/**
	 * Extract speaker colors from Ink variables
	 */
	private extractColorsFromStory(story: Story): void {
		// Common speaker variable pattern: {speaker}_color
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
	 * Get speaker color from Ink or undefined
	 */
	public getSpeakerColor(speaker: string): string | undefined {
		return this.characterColors.get(speaker.toUpperCase());
	}

	/**
	 * Get a variable value from a registered story
	 */
	public getStoryVariable(characterId: string, variableName: string): unknown {
		const story = this.stories.get(characterId);
		if (!story) return undefined;
		try {
			return story.variablesState.$(variableName);
		} catch {
			return undefined;
		}
	}

	/**
	 * Set a variable value in a registered story
	 */
	public setStoryVariable(
		characterId: string,
		variableName: string,
		value: string | number | boolean,
	): void {
		const story = this.stories.get(characterId);
		if (!story) return;
		try {
			story.variablesState.$(variableName, value);
		} catch {
			// Variable might not exist
		}
	}

	/**
	 * Start dialogue at a specific knot
	 */
	public async startDialogue(
		characterId: string,
		startKnot?: string,
	): Promise<void> {
		const story = this.stories.get(characterId);
		if (!story) {
			console.error(`No story found for: ${characterId}`);
			return;
		}

		this._isDialogueActive = true;
		this.currentStory = story;
		this.currentCharacterId = characterId;

		try {
			// Resume interrupted dialogue
			if (this.interruptedDialogues.has(characterId)) {
				this.interruptedDialogues.delete(characterId);
				await this.continueStory();
				return;
			}

			// Jump to specific knot if provided
			if (startKnot) {
				try {
					story.ChoosePathString(startKnot);
				} catch (error) {
					console.error(`Failed to start at knot ${startKnot}:`, error);
					return;
				}
			}

			await this.continueStory();
		} finally {
			this._isDialogueActive = false;
			this.callbacks.onEnd?.();
		}
	}

	/**
	 * Interrupt current dialogue (can be resumed later)
	 */
	public interruptDialogue(): void {
		if (this.currentCharacterId && this.currentStory) {
			if (
				this.currentStory.canContinue ||
				this.currentStory.currentChoices.length > 0
			) {
				this.interruptedDialogues.add(this.currentCharacterId);
			}
		}
		this._isDialogueActive = false;
		this.speechText?.hide();
		this.dialogueClickResolver = undefined;
	}

	/**
	 * Check if dialogue was interrupted
	 */
	public hasInterruptedDialogue(characterId: string): boolean {
		return this.interruptedDialogues.has(characterId);
	}

	/**
	 * Continue story playback
	 */
	private async continueStory(): Promise<void> {
		if (!this.currentStory) return;

		const story = this.currentStory;

		while (story.canContinue) {
			const line = story.Continue()?.trim();

			// Process tags
			if (story.currentTags) {
				await this.processTags(story.currentTags);
			}

			if (line) {
				const dialogueLine = this.parseLine(line);
				await this.showDialogue(dialogueLine);
			}
		}

		// Handle choices
		if (story.currentChoices.length > 0) {
			await this.handleChoices();
		} else {
			this.speechText?.hide();
		}
	}

	/**
	 * Process Ink tags
	 */
	private async processTags(tags: string[]): Promise<void> {
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
	 * Show dialogue line
	 */
	private async showDialogue(line: DialogueLine): Promise<void> {
		// Get color for speaker
		line.color = line.color || this.getSpeakerColor(line.speaker);

		// If custom onLine callback provided, use it
		if (this.callbacks.onLine) {
			await this.callbacks.onLine(line);
			return;
		}

		// Default: use SpeechText if available
		if (this.speechText) {
			return new Promise<void>((resolve) => {
				const sprite = this.characterSprites.get(line.speaker.toUpperCase());
				this.speechText?.show(line.speaker, line.text, sprite, line.color);

				// Trigger talking callbacks
				const speakerCallback = this.speakerTalkingCallbacks.get(
					line.speaker.toUpperCase(),
				);
				if (speakerCallback) {
					speakerCallback.onStart();
				} else {
					this.callbacks.onTalkingStart?.(line.speaker);
				}

				// Store resolver for click-to-advance
				this.dialogueClickResolver = () => {
					this.speechText?.hide();
					if (speakerCallback) {
						speakerCallback.onEnd();
					} else {
						this.callbacks.onTalkingEnd?.(line.speaker);
					}
					this.dialogueClickResolver = undefined;
					resolve();
				};
			});
		}

		// No display method available - just log
		console.log(`[${line.speaker}]: ${line.text}`);
	}

	/**
	 * Handle dialogue click to advance
	 */
	public handleDialogueClick(): void {
		if (this.dialogueClickResolver) {
			this.dialogueClickResolver();
		}
	}

	/**
	 * Check if waiting for click to advance
	 */
	public isWaitingForClick(): boolean {
		return this.dialogueClickResolver !== undefined;
	}

	/**
	 * Handle player choices
	 */
	private async handleChoices(): Promise<void> {
		if (!this.currentStory) return;

		const choices = this.currentStory.currentChoices.map((c, i) => ({
			index: i,
			text: c.text,
		}));

		// If custom onChoices callback, use it
		if (this.callbacks.onChoices) {
			const selectedIndex = await this.callbacks.onChoices(choices);
			this.currentStory.ChooseChoiceIndex(selectedIndex);
			await this.continueStory();
			return;
		}

		// Default: auto-select first choice (for testing)
		console.log("Choices:", choices.map((c) => c.text).join(", "));
		if (choices.length > 0) {
			this.currentStory.ChooseChoiceIndex(0);
			await this.continueStory();
		}
	}

	/**
	 * Parse dialogue line into speaker and text
	 */
	private parseLine(line: string): DialogueLine {
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
	 * Get available knots for debugging
	 */
	public getAvailableKnots(characterId: string): string[] {
		const story = this.stories.get(characterId);
		if (!story) return [];

		const knots: string[] = [];
		const content = story.mainContentContainer;

		if (content?.namedContent) {
			for (const [name] of content.namedContent) {
				if (!name.startsWith("global") && name !== "global decl") {
					knots.push(name);
				}
			}
		}

		return knots;
	}

	/**
	 * Jump to a specific knot (for debugging)
	 */
	public async jumpToKnot(
		characterId: string,
		knotName: string,
	): Promise<void> {
		const story = this.stories.get(characterId);
		if (!story) return;

		this.currentStory = story;
		this.currentCharacterId = characterId;
		this._isDialogueActive = true;

		try {
			story.ChoosePathString(knotName);
			await this.continueStory();
		} catch (error) {
			console.error(`Failed to jump to knot ${knotName}:`, error);
		} finally {
			this._isDialogueActive = false;
		}
	}

	/**
	 * Get current choices (for external UI)
	 */
	public getCurrentChoices(): DialogueChoice[] {
		if (!this.currentStory) return [];
		return this.currentStory.currentChoices.map((c, i) => ({
			index: i,
			text: c.text,
		}));
	}

	/**
	 * Select a choice programmatically
	 */
	public async selectChoice(index: number): Promise<void> {
		if (!this.currentStory) return;
		if (index < 0 || index >= this.currentStory.currentChoices.length) return;

		this.currentStory.ChooseChoiceIndex(index);
		await this.continueStory();
	}
}
