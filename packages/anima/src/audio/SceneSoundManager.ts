/** SceneSoundManager - Runtime manager for scene-based audio */

import type { Scene } from "phaser";
import { GameState } from "../state/GameState";
import { HoverSoundHandler } from "./HoverSoundHandler";
import { SpatialAudioCalculator } from "./SpatialAudio";
import {
	loadManifest,
	preloadSceneAudio,
	createEmptyManifest,
} from "./SoundLoader";
import { VolumeController } from "./VolumeController";
import type { ActiveSound, SoundManifest, SpatialHotspot } from "./types";

export class SceneSoundManager {
	private scene: Scene;
	private sceneId: string;
	private gameState: GameState;
	private manifest: SoundManifest | null = null;

	private activeSounds: Map<string, ActiveSound> = new Map();
	private hotspotMap: Map<string, SpatialHotspot> = new Map();
	private initialized: boolean = false;

	private spatialAudio: SpatialAudioCalculator;
	private hoverHandler: HoverSoundHandler;
	private volumeController: VolumeController;

	constructor(scene: Scene, sceneId: string) {
		this.scene = scene;
		this.sceneId = sceneId;
		this.gameState = GameState.getInstance();
		this.spatialAudio = new SpatialAudioCalculator();
		this.hoverHandler = new HoverSoundHandler(scene);
		this.volumeController = new VolumeController();
	}

	/** Load manifest and preload all audio for this scene */
	async initialize(): Promise<void> {
		try {
			this.manifest = await loadManifest(this.sceneId);
			await preloadSceneAudio(this.scene, this.sceneId, this.manifest);
			this.initialized = true;
		} catch (error) {
			console.warn("SceneSoundManager: Failed to initialize", error);
			this.manifest = createEmptyManifest();
			this.initialized = true;
		}
	}

	/** Play an ambient sound by ID */
	playAmbient(soundId: string): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;
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
			volume: this.volumeController.calculateEffectiveVolume(config.volume),
		});

		sound.play();
		this.activeSounds.set(soundId, { key: soundId, sound, config });
	}

	/** Start conditional ambient sounds based on game state */
	startConditionalAmbient(): void {
		if (!this.manifest || !this.initialized) return;

		for (const ambient of this.manifest.ambient) {
			if (this.checkCondition(ambient.condition) && !this.activeSounds.has(ambient.id)) {
				this.playAmbient(ambient.id);
			}
		}
	}

	/** Play an object sound at a specific position */
	playObjectSound(soundId: string, sourceX: number, sourceY: number): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;
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

		const spatialVolume = this.spatialAudio.calculateSpatialVolume(sourceX, sourceY, config);
		const sound = this.scene.sound.add(soundId, {
			loop: config.loop,
			volume: this.volumeController.calculateEffectiveVolume(spatialVolume),
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

	/** Play oneshot sound by trigger ID */
	playOneshot(triggerId: string): void {
		if (!this.manifest || !this.initialized) return;
		if (!this.scene?.sound?.add) return;

		const config = this.manifest.oneshot.find((s) => s.triggerId === triggerId);
		if (!config) return;

		if (!this.scene.cache.audio.exists(config.id)) {
			console.warn(`SceneSoundManager: Audio not loaded: ${config.id}`);
			return;
		}

		const sound = this.scene.sound.add(config.id, {
			volume: this.volumeController.calculateEffectiveVolume(config.volume),
		});

		sound.once("complete", () => sound.destroy());
		sound.play();
	}

	/** Handle hotspot hover state for hover-triggered sounds */
	setHoveredHotspot(hotspotId: string | null): void {
		if (!this.manifest || !this.initialized) return;
		this.hoverHandler.setHoveredHotspot(
			hotspotId,
			this.manifest,
			this.volumeController.getMasterVolume(),
		);
	}

	/** Update listener position for spatial audio calculations */
	updateListenerPosition(x: number, y: number): void {
		this.spatialAudio.setListenerPosition(x, y);
		this.spatialAudio.updateSpatialSounds(
			this.activeSounds,
			this.volumeController.getMasterVolume(),
		);
	}

	/** Check condition against game state */
	checkCondition(condition?: string): boolean {
		if (!condition) return true;
		return this.gameState.getFlag(condition) === true;
	}

	/** Update sound states based on game flags */
	updateSoundStates(): void {
		if (!this.manifest || !this.initialized) return;

		for (const ambient of this.manifest.ambient) {
			const shouldPlay = this.checkCondition(ambient.condition);
			const isPlaying = this.activeSounds.has(ambient.id);

			if (shouldPlay && !isPlaying) {
				this.playAmbient(ambient.id);
			} else if (!shouldPlay && isPlaying) {
				this.stopSound(ambient.id);
			}
		}

		for (const objSound of this.manifest.objects) {
			if (this.activeSounds.has(objSound.id) && !this.checkCondition(undefined)) {
				this.stopSound(objSound.id);
			}
		}
	}

	private stopSound(id: string): void {
		const active = this.activeSounds.get(id);
		if (active) {
			active.sound.stop();
			active.sound.destroy();
			this.activeSounds.delete(id);
		}
	}

	/** Fade out all sounds */
	fadeOutAll(duration: number = 1000): void {
		if (!this.scene?.tweens) {
			for (const [id] of this.activeSounds) this.stopSound(id);
			this.hoverHandler.destroy();
			return;
		}

		for (const [id, active] of this.activeSounds) {
			const soundToStop = active.sound;
			this.scene.tweens.add({
				targets: soundToStop,
				volume: 0,
				duration,
				onComplete: () => {
					soundToStop.stop();
					soundToStop.destroy();
				},
			});
			this.activeSounds.delete(id);
		}

		this.hoverHandler.fadeOut(duration);
	}

	/** Set master volume for all scene sounds */
	setMasterVolume(volume: number): void {
		this.volumeController.setMasterVolume(volume);
		this.volumeController.updateActiveSoundVolumes(this.activeSounds);
		this.hoverHandler.updateVolume(this.volumeController.getMasterVolume());
	}

	/** Get current master volume */
	getMasterVolume(): number {
		return this.volumeController.getMasterVolume();
	}

	pauseAll(): void {
		for (const [, active] of this.activeSounds) active.sound.pause();
		this.hoverHandler.pause();
	}

	resumeAll(): void {
		for (const [, active] of this.activeSounds) active.sound.resume();
		this.hoverHandler.resume();
	}

	destroy(): void {
		for (const [id] of this.activeSounds) this.stopSound(id);
		this.activeSounds.clear();
		this.hoverHandler.destroy();
		this.hotspotMap.clear();
	}

	/** Start playing scene sounds with hotspot mapping */
	startSceneSounds(hotspots: SpatialHotspot[]): void {
		if (!this.manifest || !this.initialized) {
			console.warn("SceneSoundManager: Not initialized, cannot start sounds");
			return;
		}

		for (const hotspot of hotspots) {
			this.hotspotMap.set(hotspot.id, hotspot);
		}

		this.startConditionalAmbient();

		for (const objSound of this.manifest.objects) {
			const hotspot = this.hotspotMap.get(objSound.hotspotId);
			if (hotspot) {
				this.playObjectSound(objSound.id, hotspot.bounds.centerX, hotspot.bounds.centerY);
			}
		}
	}
}
