import { Scene } from "phaser";
import { IrisTransition } from "../transitions";
import { UIState } from "../ui";
import { ScenePreloadManager } from "./ScenePreloadManager";
import type { SceneSoundManager } from "../audio";
import type { Character } from "../characters";

/**
 * Transition options for scene changes
 */
export interface TransitionOptions {
	data?: Record<string, unknown>;
	duration?: number;
	skipTransition?: boolean;
}

/**
 * Manages scene transitions including iris wipe and fade effects.
 * Uses composition pattern - instantiate and delegate from BaseScene.
 */
export class SceneTransitions {
	private readonly scene: Scene;
	private irisTransition?: IrisTransition;

	constructor(scene: Scene) {
		this.scene = scene;
	}

	/**
	 * Get player head position for iris transitions.
	 * Falls back to screen center if player is undefined.
	 */
	private getPlayerHeadPosition(
		player: Character | undefined,
	): { x: number; y: number } {
		if (!player) {
			const cam = this.scene.cameras.main;
			return {
				x: cam.scrollX + cam.width / 2,
				y: cam.scrollY + cam.height / 2,
			};
		}

		// Player origin is at bottom-center (feet)
		// Head is roughly at the top of the sprite (~90% up from feet)
		const headOffset = player.displayHeight * 0.9;
		return {
			x: player.x,
			y: player.y - headOffset,
		};
	}

	/**
	 * Transition to another scene using iris wipe effect
	 */
	public async transitionToScene(
		sceneKey: string,
		options: TransitionOptions = {},
		player?: Character,
		soundManager?: SceneSoundManager,
	): Promise<void> {
		const { data, duration = 600, skipTransition = false } = options;
		const preloadManager = ScenePreloadManager.getInstance();

		// Iris out centered on player's head (unless skipped)
		if (!skipTransition) {
			soundManager?.fadeOutAll(duration);

			const headPos = this.getPlayerHeadPosition(player);
			// Destroy old transition before creating new one
			this.irisTransition?.destroy();
			this.irisTransition = new IrisTransition(this.scene);

			// Wait for iris to close
			await this.irisTransition.irisOut({
				centerX: headPos.x,
				centerY: headPos.y,
				duration,
			});
		}

		// Wait for scene assets if not loaded
		if (!preloadManager.isSceneLoaded(sceneKey)) {
			UIState.getInstance().showSceneLoading(true);

			try {
				await preloadManager.waitForSceneWithTimeout(sceneKey, 10000);
			} catch {
				// Continue anyway on timeout
			}

			UIState.getInstance().showSceneLoading(false);
		}

		// Start the scene
		this.scene.scene.start(sceneKey, { ...data, _irisIn: !skipTransition });
	}

	/**
	 * Iris in from black at scene start
	 */
	public async irisIn(duration = 600, player?: Character): Promise<void> {
		const headPos = this.getPlayerHeadPosition(player);
		// Destroy old transition before creating new one
		this.irisTransition?.destroy();
		this.irisTransition = new IrisTransition(this.scene);

		// Start with closed iris, then open
		this.irisTransition.drawClosed({ centerX: headPos.x, centerY: headPos.y });
		await this.irisTransition.irisIn({
			centerX: headPos.x,
			centerY: headPos.y,
			duration,
		});
	}

	/**
	 * Fade in the scene from black
	 */
	public fadeIn(duration = 500): void {
		this.scene.cameras.main.fadeIn(duration);
	}

	/**
	 * Fade out and transition to another scene
	 */
	public fadeToScene(
		sceneKey: string,
		data?: Record<string, unknown>,
		duration = 500,
	): void {
		this.scene.cameras.main.fadeOut(
			duration,
			0,
			0,
			0,
			(_cam: unknown, progress: number) => {
				if (progress === 1) {
					this.scene.scene.start(sceneKey, data);
				}
			},
		);
	}

	/**
	 * Destroy the iris transition effect
	 */
	public destroy(): void {
		this.irisTransition?.destroy();
		this.irisTransition = undefined;
	}
}
