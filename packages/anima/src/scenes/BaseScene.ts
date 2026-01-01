import { Scene } from "phaser";
import { type EditorCallbacks, HotspotEditor } from "../editor";

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
}

/**
 * Base scene for point-and-click adventure games.
 * Provides: parallax backgrounds, edge scrolling, and scene transition helpers.
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

	// Editor
	protected editor?: HotspotEditor;
	protected editorCallbacks: EditorCallbacks = {};

	// Scene configuration (set by child class)
	protected abstract readonly config: SceneConfig;

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

		// Create editor (auto-registration happens when Characters/Hotspots are created)
		this.editor = new HotspotEditor(this, this.editorCallbacks);
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
	// Scene Transitions
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
		this.editor?.destroy();
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
}
