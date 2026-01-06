import { Scene } from "phaser";
import { SceneSoundManager } from "../audio";
import { Character, type CharacterAnimConfig } from "../characters";
import { SpeechText } from "../dialogue";
import { type EditorCallbacks, HotspotEditor } from "../editor";
import { type GroundLineConfig, GroundLineManager } from "../groundline";
import { Hotspot, type HotspotConfig } from "../hotspots";
import { IrisTransition } from "../transitions";
import { UIState } from "../ui";
import { ScenePreloadManager } from "./ScenePreloadManager";

/**
 * Parallax layer configuration
 */
export interface ParallaxLayerConfig {
	key: string;
	scrollFactor: number; // 0 = fixed, 1 = moves with camera
	y: number;
	depth: number;
	tileSprite?: boolean; // Use TileSprite for seamless scrolling
	height?: number;
	origin?: { x: number; y: number };
}

/**
 * Player configuration for createPlayer
 */
export interface PlayerConfig {
	x: number;
	y: number;
	scale?: number;
	spriteKey: string;
	animConfig?: CharacterAnimConfig;
}

/**
 * Transition options for transitionToScene
 */
export interface TransitionOptions {
	data?: Record<string, unknown>;
	duration?: number;
	skipTransition?: boolean;
}

/**
 * Scene configuration
 */
export interface SceneConfig {
	sceneName: string;
	displayName: string;
	worldWidth: number;
	playerSpawn: { x: number; y: number; scale: number };
	playerLeftBoundary?: number;
	playerRightBoundary?: number;
	playerSpeed?: number;
	/** Optional ground line configuration for walking path */
	groundLine?: GroundLineConfig;
}

/**
 * Base scene for point-and-click adventure games.
 * Provides: parallax backgrounds, ground line, edge scrolling, and scene transition helpers.
 */
export abstract class BaseScene extends Scene {
	// Parallax layers
	protected parallaxLayers: Map<
		string,
		Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite
	> = new Map();
	protected parallaxConfigs: Map<string, ParallaxLayerConfig> = new Map();

	// World dimensions
	protected worldWidth = 0;

	// Edge scrolling
	protected readonly EDGE_ZONE = 100;
	protected readonly SCROLL_SPEED = 12;

	// Input blocking
	protected inputBlocked = false;

	// Ground line manager (optional)
	protected groundLineManager?: GroundLineManager;

	// Editor
	protected editor?: HotspotEditor;
	protected editorCallbacks: EditorCallbacks = {};

	// Scene configuration (set by child class)
	protected abstract readonly config: SceneConfig;

	// ===========================================================================
	// EXPANDED API - Player Character
	// ===========================================================================

	/** Player character instance */
	protected player?: Character;

	// ===========================================================================
	// EXPANDED API - Dialogue Systems
	// ===========================================================================

	/** Speech text for floating dialogue */
	protected speechText?: SpeechText;

	// ===========================================================================
	// EXPANDED API - Sound Manager
	// ===========================================================================

	/** Scene sound manager */
	protected soundManager?: SceneSoundManager;

	// ===========================================================================
	// EXPANDED API - Scene Transitions
	// ===========================================================================

	/** Iris transition effect */
	protected irisTransition?: IrisTransition;

	// ===========================================================================
	// EXPANDED API - Hotspot Management
	// ===========================================================================

	/** Active hotspots in the scene */
	protected hotspots: Hotspot[] = [];

	// ===========================================================================
	// EXPANDED API - Debug Mode
	// ===========================================================================

	/** Debug mode flag */
	protected debugMode: boolean = false;

	/**
	 * Base create - sets up physics and camera bounds.
	 * Child classes should call super.create() after setting up backgrounds.
	 */
	create(): void {
		this.worldWidth = this.config.worldWidth;

		// Set up physics world bounds
		this.physics.world.setBounds(0, 0, this.worldWidth, 1080);

		// Set up camera bounds
		this.cameras.main.setBounds(0, 0, this.worldWidth, 1080);

		// Disable browser context menu
		this.input.mouse?.disableContextMenu();

		// Create ground line manager BEFORE editor (so characters can register when created)
		if (this.config.groundLine) {
			this.groundLineManager = new GroundLineManager(
				this,
				this.config.groundLine,
			);
		}

		// Create editor (auto-registration happens when Characters/Hotspots are created)
		this.editor = new HotspotEditor(this, this.editorCallbacks);

		// Connect editor to ground line manager
		if (this.groundLineManager) {
			this.editor.setGroundLineManager(this.groundLineManager);
		}
	}

	// ===========================================================================
	// Parallax Layers
	// ===========================================================================

	/**
	 * Add a parallax layer to the scene
	 */
	protected addParallaxLayer(
		config: ParallaxLayerConfig,
	): Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite {
		const { key, scrollFactor, y, depth, tileSprite, height, origin } = config;

		let layer: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

		if (tileSprite && height) {
			const screenWidth = this.cameras.main.width;
			layer = this.add.tileSprite(screenWidth / 2, y, screenWidth, height, key);
			layer.setOrigin(0.5, origin?.y ?? 0);
			layer.setScrollFactor(0);
		} else {
			layer = this.add.image(0, y, key);
			layer.setOrigin(origin?.x ?? 0, origin?.y ?? 0);
			layer.setScrollFactor(scrollFactor);
		}

		layer.setDepth(depth);
		this.parallaxLayers.set(key, layer);
		this.parallaxConfigs.set(key, config);

		return layer;
	}

	protected getParallaxLayer(
		key: string,
	): Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite | undefined {
		return this.parallaxLayers.get(key);
	}

	protected setLayerTexture(layerKey: string, newTextureKey: string): void {
		const layer = this.parallaxLayers.get(layerKey);
		if (layer) {
			layer.setTexture(newTextureKey);
		}
	}

	/**
	 * Update parallax TileSprites based on camera position.
	 * Call this in update().
	 */
	protected updateParallaxLayers(): void {
		const camX = this.cameras.main.scrollX;

		for (const [key, layer] of this.parallaxLayers) {
			const config = this.parallaxConfigs.get(key);
			if (
				config?.tileSprite &&
				layer instanceof Phaser.GameObjects.TileSprite
			) {
				layer.tilePositionX = camX * config.scrollFactor;
			}
		}
	}

	// ===========================================================================
	// Edge Scrolling
	// ===========================================================================

	/**
	 * Handle edge scrolling - call in update()
	 */
	protected handleEdgeScrolling(pointer: Phaser.Input.Pointer): void {
		const camera = this.cameras.main;
		const screenWidth = this.scale.width;

		const isTouchDevice = pointer.wasTouch;
		if (isTouchDevice && !pointer.isDown) return;

		const edgeZone = isTouchDevice ? screenWidth * 0.08 : this.EDGE_ZONE;

		if (pointer.x < edgeZone) {
			const intensity = 1 - pointer.x / edgeZone;
			camera.scrollX -= this.SCROLL_SPEED * intensity;
		} else if (pointer.x > screenWidth - edgeZone) {
			const intensity = (pointer.x - (screenWidth - edgeZone)) / edgeZone;
			camera.scrollX += this.SCROLL_SPEED * intensity;
		}

		camera.scrollX = Math.max(
			0,
			Math.min(camera.scrollX, this.worldWidth - screenWidth),
		);
	}

	// ===========================================================================
	// Movement Boundaries
	// ===========================================================================

	/**
	 * Clamp movement to configured boundaries
	 */
	protected clampMovement(targetX: number): number {
		let x = targetX;
		if (this.config.playerLeftBoundary !== undefined) {
			x = Math.max(x, this.config.playerLeftBoundary);
		}
		if (this.config.playerRightBoundary !== undefined) {
			x = Math.min(x, this.config.playerRightBoundary);
		}
		return x;
	}

	// ===========================================================================
	// Scene Transitions (Legacy)
	// ===========================================================================

	/**
	 * Fade in the scene from black
	 */
	protected fadeInScene(duration = 500): void {
		this.cameras.main.fadeIn(duration);
	}

	/**
	 * Fade out and transition to another scene
	 */
	protected fadeToScene(
		sceneKey: string,
		data?: Record<string, unknown>,
		duration = 500,
	): void {
		this.inputBlocked = true;
		this.cameras.main.fadeOut(
			duration,
			0,
			0,
			0,
			(_cam: unknown, progress: number) => {
				if (progress === 1) {
					this.scene.start(sceneKey, data);
				}
			},
		);
	}

	// ===========================================================================
	// EXPANDED API - Player Character Methods
	// ===========================================================================

	/**
	 * Create the player character using config from playerSpawn
	 * Returns the created Character instance
	 */
	public createPlayer(): Character {
		const { x, y, scale } = this.config.playerSpawn;

		// Default animation config if none specified
		const defaultAnimConfig: CharacterAnimConfig = {
			walk: {
				key: "player-walk",
				frames: { start: 0, end: 7 },
				frameRate: 12,
			},
			idle: {
				key: "player-idle",
				frames: { start: 0, end: 3 },
				frameRate: 8,
			},
		};

		this.player = new Character(
			this,
			x,
			y,
			"player", // Default texture key
			defaultAnimConfig,
			scale,
			"player",
		);

		if (this.config.playerSpeed) {
			this.player.setMoveSpeed(this.config.playerSpeed);
		}

		return this.player;
	}

	/**
	 * Get the player character instance
	 */
	public getPlayer(): Character | undefined {
		return this.player;
	}

	// ===========================================================================
	// EXPANDED API - Dialogue Systems
	// ===========================================================================

	/**
	 * Set up dialogue systems including SpeechText
	 */
	public setupDialogueSystems(): void {
		this.speechText = new SpeechText(this);
	}

	/**
	 * Get the speech text instance (for subclass access)
	 */
	public getSpeechText(): SpeechText | undefined {
		return this.speechText;
	}

	// ===========================================================================
	// EXPANDED API - Sound Manager
	// ===========================================================================

	/**
	 * Initialize the scene sound manager
	 */
	public async initializeSoundManager(): Promise<void> {
		this.soundManager = new SceneSoundManager(this, this.config.sceneName);
		await this.soundManager.initialize();
	}

	/**
	 * Get the sound manager instance
	 */
	public getSoundManager(): SceneSoundManager | undefined {
		return this.soundManager;
	}

	// ===========================================================================
	// EXPANDED API - Input Handling
	// ===========================================================================

	/**
	 * Set up input handlers for pointer events
	 */
	public setupInputHandlers(): void {
		this.input.on(
			"pointerdown",
			(pointer: Phaser.Input.Pointer) => {
				this.handlePointerDown(pointer);
			},
			this,
		);
	}

	/**
	 * Handle pointer down events - override in subclass for custom behavior
	 */
	protected handlePointerDown(_pointer: Phaser.Input.Pointer): void {
		// Base implementation does nothing
		// Subclasses can override for game-specific click handling
	}

	// ===========================================================================
	// EXPANDED API - Scene Transitions
	// ===========================================================================

	/**
	 * Transition to another scene using iris wipe effect
	 */
	public async transitionToScene(
		sceneKey: string,
		options: TransitionOptions = {},
	): Promise<void> {
		const { data, duration = 600, skipTransition = false } = options;
		const preloadManager = ScenePreloadManager.getInstance();

		// Block input during transition
		this.inputBlocked = true;

		// Iris out centered on player's head (unless skipped)
		if (!skipTransition) {
			this.soundManager?.fadeOutAll(duration);

			const headPos = this.getPlayerHeadPosition();
			this.irisTransition = new IrisTransition(this);

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
		this.scene.start(sceneKey, { ...data, _irisIn: !skipTransition });
	}

	/**
	 * Iris in from black at scene start
	 */
	public async irisInScene(duration = 600): Promise<void> {
		const headPos = this.getPlayerHeadPosition();
		this.irisTransition = new IrisTransition(this);

		// Start with closed iris, then open
		this.irisTransition.drawClosed({ centerX: headPos.x, centerY: headPos.y });
		await this.irisTransition.irisIn({
			centerX: headPos.x,
			centerY: headPos.y,
			duration,
		});
	}

	/**
	 * Get player head position for iris transitions
	 * Returns center of screen if no player exists
	 */
	public getPlayerHeadPosition(): { x: number; y: number } {
		if (!this.player) {
			return {
				x: this.cameras.main.scrollX + this.cameras.main.width / 2,
				y: this.cameras.main.scrollY + this.cameras.main.height / 2,
			};
		}

		// Player origin is at bottom-center (feet)
		// Head is roughly at the top of the sprite (~90% up from feet)
		const headOffset = this.player.displayHeight * 0.9;
		return {
			x: this.player.x,
			y: this.player.y - headOffset,
		};
	}

	// ===========================================================================
	// EXPANDED API - Hotspot Management
	// ===========================================================================

	/**
	 * Add a hotspot to the scene
	 */
	public addHotspot(config: HotspotConfig): void {
		const hotspot = new Hotspot(this, config);
		this.hotspots.push(hotspot);
	}

	/**
	 * Get all hotspots in the scene
	 */
	public getHotspots(): Hotspot[] {
		return this.hotspots;
	}

	/**
	 * Find a hotspot at the given coordinates
	 */
	public findHotspotAtPoint(x: number, y: number): Hotspot | undefined {
		// Return last matching hotspot (topmost in render order)
		const matching = this.hotspots.filter((h) => h.bounds.contains(x, y));
		return matching[matching.length - 1];
	}

	// ===========================================================================
	// EXPANDED API - UI State
	// ===========================================================================

	/**
	 * Update UI state with current scene name
	 */
	public updateUIState(): void {
		UIState.getInstance().setSceneName(this.config.displayName);
	}

	// ===========================================================================
	// EXPANDED API - Debug Mode
	// ===========================================================================

	/**
	 * Set debug mode
	 */
	public setDebugMode(enabled: boolean): void {
		this.debugMode = enabled;
	}

	// ===========================================================================
	// Update
	// ===========================================================================

	/**
	 * Base update - call super.update() from child classes
	 */
	update(_time?: number, _delta?: number): void {
		const pointer = this.input.activePointer;
		this.handleEdgeScrolling(pointer);
		this.updateParallaxLayers();
	}

	// ===========================================================================
	// Cleanup
	// ===========================================================================

	shutdown(): void {
		this.parallaxLayers.clear();
		this.parallaxConfigs.clear();
		this.groundLineManager?.destroy();
		this.editor?.destroy();
		this.soundManager?.destroy();
		this.speechText?.destroy();
		this.irisTransition?.destroy();

		// Clear hotspots
		for (const hotspot of this.hotspots) {
			hotspot.destroy();
		}
		this.hotspots = [];
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	public getConfig(): SceneConfig {
		return this.config;
	}

	/**
	 * Set editor callbacks (for React UI integration)
	 * Call before create() to receive editor events
	 */
	public setEditorCallbacks(callbacks: EditorCallbacks): void {
		this.editorCallbacks = callbacks;
	}

	/**
	 * Get the editor instance
	 */
	public getEditor(): HotspotEditor | undefined {
		return this.editor;
	}

	/**
	 * Get the ground line manager
	 */
	public getGroundLineManager(): GroundLineManager | undefined {
		return this.groundLineManager;
	}
}
