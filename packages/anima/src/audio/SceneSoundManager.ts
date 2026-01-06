/**
 * SceneSoundManager - Runtime manager for scene-based audio
 *
 * Handles:
 * - Ambient sounds (scene-wide, condition-based)
 * - Object sounds (spatial, tied to hotspots)
 * - Hover sounds (triggered on hotspot hover)
 * - Oneshot sounds (event-triggered)
 */

import type { Scene } from "phaser";
import { GameState } from "../state/GameState";
import type {
	ActiveSound,
	HoverSoundConfig,
	ObjectSoundConfig,
	SoundManifest,
	SpatialHotspot,
} from "./types";

export class SceneSoundManager {
	private scene: Scene;
	private sceneId: string;
	private gameState: GameState;
	private manifest: SoundManifest | null = null;

	private activeSounds: Map<string, ActiveSound> = new Map();
	private activeHoverSound: ActiveSound | null = null;
	private hotspotMap: Map<string, SpatialHotspot> = new Map();
	private listenerX: number = 0;
	private listenerY: number = 0;
	private masterVolume: number = 1;
	private initialized: boolean = false;

	constructor(scene: Scene, sceneId: string) {
		this.scene = scene;
		this.sceneId = sceneId;
		this.gameState = GameState.getInstance();
	}

	/**
	 * Load manifest and preload all audio for this scene
	 */
	async initialize(): Promise<void> {
		try {
			const response = await fetch(
				`/audio/scenes/${this.sceneId}/manifest.json`,
			);
			if (!response.ok) {
				console.warn(
					`SceneSoundManager: Failed to load manifest for ${this.sceneId}: ${response.status}`,
				);
				this.manifest = { ambient: [], objects: [], hover: [], oneshot: [] };
				this.initialized = true;
				return;
			}

			this.manifest = await response.json();
			if (!this.manifest) {
				this.manifest = { ambient: [], objects: [], hover: [], oneshot: [] };
			}

			await this.preloadSceneAudio();
			this.initialized = true;
		} catch (error) {
			console.warn("SceneSoundManager: Failed to initialize", error);
			this.manifest = { ambient: [], objects: [], hover: [], oneshot: [] };
			this.initialized = true;
		}
	}

	private preloadSceneAudio(): Promise<void> {
		if (!this.manifest) return Promise.resolve();

		const allSounds = [
			...this.manifest.ambient,
			...this.manifest.objects,
			...this.manifest.hover,
			...this.manifest.oneshot,
		];

		if (allSounds.length === 0) return Promise.resolve();

		let loadedCount = 0;
		const totalCount = allSounds.length;

		return new Promise<void>((resolve) => {
			for (const sound of allSounds) {
				const key = sound.id;
				const path = `/audio/scenes/${this.sceneId}/${sound.file}`;

				if (!this.scene.cache.audio.exists(key)) {
					this.scene.load.audio(key, path);
				} else {
					loadedCount++;
				}
			}

			if (loadedCount === totalCount) {
				resolve();
				return;
			}

			this.scene.load.once("complete", () => {
				resolve();
			});

			this.scene.load.start();
		});
	}

	/**
	 * Play an ambient sound by ID
	 */
	playAmbient(soundId: string): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;

		// Prevent duplicate instances
		if (this.activeSounds.has(soundId)) return;

		const config = this.manifest.ambient.find((s) => s.id === soundId);
		if (!config) {
			console.warn(`SceneSoundManager: Ambient sound not found: ${soundId}`);
			return;
		}

		if (!this.scene.cache.audio.exists(soundId)) {
			console.warn(`SceneSoundManager: Audio not loaded: ${soundId}`);
			return;
		}

		const sound = this.scene.sound.add(soundId, {
			loop: config.loop,
			volume: config.volume * this.masterVolume,
		});

		sound.play();

		this.activeSounds.set(soundId, {
			key: soundId,
			sound,
			config,
		});
	}

	/**
	 * Start conditional ambient sounds based on game state
	 */
	startConditionalAmbient(): void {
		if (!this.manifest || !this.initialized) return;

		for (const ambient of this.manifest.ambient) {
			const shouldPlay = this.checkCondition(ambient.condition);
			if (shouldPlay && !this.activeSounds.has(ambient.id)) {
				this.playAmbient(ambient.id);
			}
		}
	}

	/**
	 * Play an object sound at a specific position
	 */
	playObjectSound(soundId: string, sourceX: number, sourceY: number): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;

		// Prevent duplicate instances
		if (this.activeSounds.has(soundId)) return;

		const config = this.manifest.objects.find((s) => s.id === soundId);
		if (!config) {
			console.warn(`SceneSoundManager: Object sound not found: ${soundId}`);
			return;
		}

		if (!this.scene.cache.audio.exists(soundId)) {
			console.warn(`SceneSoundManager: Audio not loaded: ${soundId}`);
			return;
		}

		const volume = this.calculateSpatialVolume(sourceX, sourceY, config);

		const sound = this.scene.sound.add(soundId, {
			loop: config.loop,
			volume: volume * this.masterVolume,
		});

		sound.play();

		this.activeSounds.set(soundId, {
			key: soundId,
			sound,
			config,
			hotspotId: config.hotspotId,
			sourceX,
			sourceY,
		});
	}

	/**
	 * Calculate volume based on distance from listener to source
	 */
	private calculateSpatialVolume(
		sourceX: number,
		sourceY: number,
		config: ObjectSoundConfig,
	): number {
		const dx = sourceX - this.listenerX;
		const dy = sourceY - this.listenerY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance <= config.refDistance) {
			return config.volume;
		}

		if (distance >= config.maxDistance) {
			return 0;
		}

		// Apply rolloff factor to the falloff calculation
		const range = config.maxDistance - config.refDistance;
		const distanceFromRef = distance - config.refDistance;
		const normalizedDistance = distanceFromRef / range;

		// With rolloffFactor, higher values mean steeper falloff
		const falloff = (1 - normalizedDistance) ** config.rolloffFactor;

		return config.volume * falloff;
	}

	/**
	 * Play oneshot sound by trigger ID
	 */
	playOneshot(triggerId: string): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;

		const config = this.manifest.oneshot.find((s) => s.triggerId === triggerId);
		if (!config) {
			return; // Silent fail for unknown triggers
		}

		if (!this.scene.cache.audio.exists(config.id)) {
			console.warn(`SceneSoundManager: Audio not loaded: ${config.id}`);
			return;
		}

		const sound = this.scene.sound.add(config.id, {
			volume: config.volume * this.masterVolume,
		});
		sound.play();
	}

	/**
	 * Handle hotspot hover state for hover-triggered sounds
	 */
	setHoveredHotspot(hotspotId: string | null): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;

		// Find hover sound config for this hotspot
		const hoverConfig = hotspotId
			? this.manifest.hover.find((h) => h.hotspotId === hotspotId)
			: null;

		// If there's a current hover sound and we're changing to a different/no hotspot
		if (this.activeHoverSound) {
			const currentConfig = this.activeHoverSound.config as HoverSoundConfig;

			// If same hotspot, do nothing
			if (hoverConfig && currentConfig.hotspotId === hoverConfig.hotspotId) {
				return;
			}

			// Fade out current hover sound
			this.scene.tweens.add({
				targets: this.activeHoverSound.sound,
				volume: 0,
				duration: currentConfig.fadeOutDuration,
				onComplete: () => {
					if (this.activeHoverSound) {
						this.activeHoverSound.sound.stop();
						this.activeHoverSound = null;
					}
				},
			});
		}

		// Start new hover sound if applicable
		if (hoverConfig && this.scene.cache.audio.exists(hoverConfig.id)) {
			const sound = this.scene.sound.add(hoverConfig.id, {
				volume: 0, // Start at 0 for fade in
			});
			sound.play();

			this.activeHoverSound = {
				key: hoverConfig.id,
				sound,
				config: hoverConfig,
				hotspotId: hoverConfig.hotspotId,
			};

			// Fade in
			this.scene.tweens.add({
				targets: sound,
				volume: hoverConfig.volume * this.masterVolume,
				duration: hoverConfig.fadeInDuration,
			});
		}
	}

	/**
	 * Update listener position for spatial audio calculations
	 */
	updateListenerPosition(x: number, y: number): void {
		this.listenerX = x;
		this.listenerY = y;

		// Update volumes for all spatial sounds
		for (const [, active] of this.activeSounds) {
			if (active.sourceX !== undefined && active.sourceY !== undefined) {
				const config = active.config as ObjectSoundConfig;
				const volume = this.calculateSpatialVolume(
					active.sourceX,
					active.sourceY,
					config,
				);

				const soundWithVolume = active.sound as unknown as {
					setVolume?: (v: number) => void;
				};
				if (soundWithVolume?.setVolume) {
					soundWithVolume.setVolume(volume * this.masterVolume);
				}
			}
		}
	}

	/**
	 * Check condition against game state
	 */
	checkCondition(condition?: string): boolean {
		if (!condition) return true;
		return this.gameState.getFlag(condition) === true;
	}

	/**
	 * Update sound states based on game flags
	 */
	updateSoundStates(): void {
		if (!this.manifest || !this.initialized) return;

		// Check ambient sounds
		for (const ambient of this.manifest.ambient) {
			const shouldPlay = this.checkCondition(ambient.condition);
			const isPlaying = this.activeSounds.has(ambient.id);

			if (shouldPlay && !isPlaying) {
				this.playAmbient(ambient.id);
			} else if (!shouldPlay && isPlaying) {
				this.stopSound(ambient.id);
			}
		}

		// Check object sounds
		for (const objSound of this.manifest.objects) {
			const shouldPlay = this.checkCondition(undefined); // Object sounds don't have conditions in current schema
			const isPlaying = this.activeSounds.has(objSound.id);

			if (!shouldPlay && isPlaying) {
				this.stopSound(objSound.id);
			}
		}
	}

	/**
	 * Stop a specific sound
	 */
	private stopSound(id: string): void {
		const active = this.activeSounds.get(id);
		if (active) {
			active.sound.stop();
			this.activeSounds.delete(id);
		}
	}

	/**
	 * Fade out all sounds
	 */
	fadeOutAll(duration: number = 1000): void {
		for (const [, active] of this.activeSounds) {
			this.scene.tweens.add({
				targets: active.sound,
				volume: 0,
				duration,
				onComplete: () => active.sound.stop(),
			});
		}

		if (this.activeHoverSound) {
			this.scene.tweens.add({
				targets: this.activeHoverSound.sound,
				volume: 0,
				duration,
				onComplete: () => {
					this.activeHoverSound?.sound.stop();
					this.activeHoverSound = null;
				},
			});
		}
	}

	/**
	 * Set master volume for all scene sounds
	 */
	setMasterVolume(volume: number): void {
		this.masterVolume = Math.max(0, Math.min(1, volume));

		for (const [, active] of this.activeSounds) {
			const baseVolume = "volume" in active.config ? active.config.volume : 1;
			const soundWithVolume = active.sound as unknown as {
				setVolume?: (v: number) => void;
			};
			if (soundWithVolume?.setVolume) {
				soundWithVolume.setVolume(baseVolume * this.masterVolume);
			}
		}

		if (this.activeHoverSound) {
			const hoverConfig = this.activeHoverSound.config as HoverSoundConfig;
			const soundWithVolume = this.activeHoverSound.sound as unknown as {
				setVolume?: (v: number) => void;
			};
			if (soundWithVolume?.setVolume) {
				soundWithVolume.setVolume(hoverConfig.volume * this.masterVolume);
			}
		}
	}

	/**
	 * Get current master volume
	 */
	getMasterVolume(): number {
		return this.masterVolume;
	}

	/**
	 * Pause all sounds
	 */
	pauseAll(): void {
		for (const [, active] of this.activeSounds) {
			active.sound.pause();
		}

		if (this.activeHoverSound) {
			this.activeHoverSound.sound.pause();
		}
	}

	/**
	 * Resume all sounds
	 */
	resumeAll(): void {
		for (const [, active] of this.activeSounds) {
			active.sound.resume();
		}

		if (this.activeHoverSound) {
			this.activeHoverSound.sound.resume();
		}
	}

	/**
	 * Stop all sounds and cleanup
	 */
	destroy(): void {
		for (const [id] of this.activeSounds) {
			this.stopSound(id);
		}
		this.activeSounds.clear();

		if (this.activeHoverSound) {
			this.activeHoverSound.sound.stop();
			this.activeHoverSound = null;
		}

		this.hotspotMap.clear();
	}

	/**
	 * Start playing scene sounds with hotspot mapping
	 */
	startSceneSounds(hotspots: SpatialHotspot[]): void {
		if (!this.manifest || !this.initialized) {
			console.warn("SceneSoundManager: Not initialized, cannot start sounds");
			return;
		}

		// Build hotspot map for quick lookup
		for (const hotspot of hotspots) {
			this.hotspotMap.set(hotspot.id, hotspot);
		}

		// Start ambient sounds based on conditions
		this.startConditionalAmbient();

		// Start object sounds linked to hotspots
		for (const objSound of this.manifest.objects) {
			const hotspot = this.hotspotMap.get(objSound.hotspotId);
			if (hotspot) {
				this.playObjectSound(
					objSound.id,
					hotspot.bounds.centerX,
					hotspot.bounds.centerY,
				);
			}
		}
	}
}
