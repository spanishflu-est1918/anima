import type { Scene } from "phaser";
import type { Hotspot } from "../hotspots/Hotspot";
import { DragController } from "./DragController";
import { EditorRenderer } from "./EditorRenderer";
import { HandleManager } from "./HandleManager";
import { SelectionManager } from "./SelectionManager";
import type {
	Bounds,
	EditorCallbacks,
	RegisteredEntity,
	Selectable,
	SelectedInfo,
} from "./types";
import { getEntityBounds, getHotspotBounds } from "./types";

// Re-export types for consumers
export type { RegisteredEntity, EditorCallbacks, SelectedInfo };

// Scene registry - allows auto-registration from Character/Hotspot constructors
const sceneEditors = new WeakMap<Scene, HotspotEditor>();

export function getSceneEditor(scene: Scene): HotspotEditor | undefined {
	return sceneEditors.get(scene);
}

export function registerWithEditor(
	scene: Scene,
	id: string,
	name: string,
	sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
	color = 0x06b6d4,
): void {
	sceneEditors.get(scene)?.registerEntity(id, name, sprite, color);
}

export function registerHotspotWithEditor(
	scene: Scene,
	hotspot: Hotspot,
): void {
	sceneEditors.get(scene)?.registerHotspot(hotspot);
}

/**
 * Visual editor for hotspots and entities.
 * Coordinates sub-components for rendering, selection, handles, and dragging.
 */
export class HotspotEditor {
	private scene: Scene;
	private enabled = false;
	private hotspots: Hotspot[] = [];
	private entities: RegisteredEntity[] = [];
	private callbacks: EditorCallbacks;
	private _clickConsumed = false;

	// Sub-components
	private renderer: EditorRenderer;
	private handles: HandleManager;
	private selection: SelectionManager;
	private drag: DragController;

	constructor(scene: Scene, callbacks?: EditorCallbacks) {
		this.scene = scene;
		this.callbacks = callbacks || {};
		sceneEditors.set(scene, this);

		// Initialize sub-components
		this.renderer = new EditorRenderer(scene);
		this.handles = new HandleManager(scene);
		this.selection = new SelectionManager();
		this.drag = new DragController();

		// Wire up callbacks
		this.selection.setSelectCallback((info) => this.callbacks.onSelect?.(info));
		this.handles.setResizeCallback((corner, wx, wy) =>
			this.startResize(corner, wx, wy),
		);

		this.setupKeys();
	}

	// Registration API
	registerHotspot(h: Hotspot): void {
		if (!this.hotspots.includes(h)) this.hotspots.push(h);
	}

	registerEntity(
		id: string,
		name: string,
		sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
		color: number,
	): void {
		this.entities = this.entities.filter((e) => e.id !== id);
		this.entities.push({
			id,
			name,
			sprite,
			color,
		});
	}

	// Toggle editor on/off
	toggle(): void {
		this.enabled = !this.enabled;
		this.renderer.setVisible(this.enabled);

		if (this.enabled) {
			this.setupPointerEvents();
			this.redraw();
			console.log("🎨 Editor ON | E=toggle S=copyAll C=copySelected");
		} else {
			this.handles.clear();
			this.renderer.clear();
			this.selection.clear();
			console.log("🎨 Editor OFF");
		}

		this.callbacks.onToggle?.(this.enabled);
	}

	private setupKeys(): void {
		const kb = this.scene.input.keyboard;
		kb?.on("keydown-E", () => this.toggle());
		kb?.on("keydown-S", () => this.enabled && this.copyAllJSON());
		kb?.on(
			"keydown-C",
			() => this.enabled && this.selection.current && this.copySelectedJSON(),
		);
	}

	private setupPointerEvents(): void {
		this.scene.input.off("pointerdown", this.onPointerDown, this);
		this.scene.input.off("pointermove", this.onPointerMove, this);
		this.scene.input.off("pointerup", this.onPointerUp, this);

		this.scene.input.on("pointerdown", this.onPointerDown, this);
		this.scene.input.on("pointermove", this.onPointerMove, this);
		this.scene.input.on("pointerup", this.onPointerUp, this);
	}

	private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
		if (!this.enabled) return;
		this._clickConsumed = false;

		const cam = this.scene.cameras.main;
		const wx = pointer.x + cam.scrollX;
		const wy = pointer.y + cam.scrollY;

		// 1. HANDLES FIRST - if clicking a handle, start resize (not move!)
		if (this.selection.current && this.handles.tryStartResize(wx, wy)) {
			this._clickConsumed = true;
			return;
		}

		// 2. Entities
		for (const e of this.entities) {
			const b = getEntityBounds(e);
			if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
				this.select({ type: "entity", entity: e });
				this.drag.startMove(wx, wy, b);
				this._clickConsumed = true;
				return;
			}
		}

		// 3. Hotspots
		for (const h of this.hotspots) {
			if (h.bounds.contains(wx, wy)) {
				this.select({ type: "hotspot", hotspot: h });
				const b = getHotspotBounds(h);
				this.drag.startMove(wx, wy, b);
				this._clickConsumed = true;
				return;
			}
		}

		// Clicked nothing
		this.select(null);
		this._clickConsumed = true;
	};

	private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
		if (!this.drag.isActive || !this.selection.current) return;

		const cam = this.scene.cameras.main;
		const wx = pointer.x + cam.scrollX;
		const wy = pointer.y + cam.scrollY;

		this.drag.apply(wx, wy, this.selection.current);
		this.redraw();
	};

	private onPointerUp = (): void => {
		this.drag.end();
	};

	private startResize(
		corner: "nw" | "ne" | "sw" | "se",
		wx: number,
		wy: number,
	): void {
		const sel = this.selection.current;
		if (!sel) return;

		let bounds: Bounds;
		let scale = 1;

		if (sel.type === "hotspot") {
			bounds = getHotspotBounds(sel.hotspot);
		} else if (sel.type === "entity") {
			bounds = getEntityBounds(sel.entity);
			scale = sel.entity.sprite.scale;
		} else {
			return;
		}

		this.drag.startResize(corner, wx, wy, bounds, scale);
	}

	private select(sel: Selectable | null): void {
		this.selection.select(sel);
		this.redraw();
	}

	private redraw(): void {
		this.handles.clear();
		this.renderer.render(this.hotspots, this.entities, this.selection.current);

		// Create handles for selected item
		const bounds = this.selection.getSelectedBounds(getEntityBounds);
		if (bounds) {
			this.handles.create(bounds);
		}
	}

	// JSON copy
	copySelectedJSON(): void {
		const json = this.selection.getSelectedJSON();
		if (json) {
			navigator.clipboard
				.writeText(json)
				.then(() => console.log("📋 Copied:", json));
		}
	}

	copyAllJSON(): void {
		const data = {
			hotspots: this.hotspots.map((h) => ({
				id: h.id,
				x: h.bounds.x,
				y: h.bounds.y,
				width: h.bounds.width,
				height: h.bounds.height,
			})),
			entities: Object.fromEntries(
				this.entities.map((e) => [
					e.id,
					{
						x: e.sprite.x,
						y: e.sprite.y,
						scale: e.sprite.scale,
					},
				]),
			),
		};
		const json = JSON.stringify(data, null, 2);
		navigator.clipboard
			.writeText(json)
			.then(() => console.log("📋 Copied all:", json));
	}

	// Public API
	isEnabled(): boolean {
		return this.enabled;
	}

	consumedClick(): boolean {
		return this.enabled && this._clickConsumed;
	}

	/**
	 * Update callbacks (for late binding from React)
	 */
	setCallbacks(callbacks: EditorCallbacks): void {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	destroy(): void {
		sceneEditors.delete(this.scene);
		this.handles.destroy();
		this.renderer.destroy();
	}
}
