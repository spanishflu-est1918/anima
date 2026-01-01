// Anima Engine - Point-and-Click Adventure Framework
// ===================================================

export * as characters from "./characters";
export type { CharacterAnimConfig } from "./characters/Character";

// Characters
export { Character } from "./characters/Character";
export type {
	DialogueCallbacks,
	DialogueChoice,
	DialogueLine,
	SpeakerTalkingCallback,
	TagCallback,
} from "./dialogue";
export * as dialogue from "./dialogue";
// Dialogue
export { InkDialogueManager, SpeechText } from "./dialogue";
export type {
	EditorCallbacks,
	RegisteredEntity,
	SelectedInfo,
} from "./editor";
export * as editor from "./editor";

// Editor
export {
	EditorPanel,
	getSceneEditor,
	HotspotEditor,
	registerHotspotWithEditor,
	registerWithEditor,
} from "./editor";

// Ground Line
export * as groundline from "./groundline";
export {
	getSceneGroundLine,
	GroundLine,
	GroundLineManager,
	GroundLineRenderer,
	registerWithGroundLine,
} from "./groundline";
export type {
	GroundLineCallbacks,
	GroundLineConfig,
	GroundLinePoint,
	PositionUpdateCallback,
} from "./groundline";

export type {
	HotspotConfig,
	HotspotIcon,
	HotspotVerb,
} from "./hotspots";
export * as hotspots from "./hotspots";
// Hotspots
export { Hotspot, RadialMenu } from "./hotspots";
// Re-export submodules
export * as scenes from "./scenes";
export type { ParallaxLayerConfig, SceneConfig } from "./scenes/BaseScene";
// Scenes
export { BaseScene } from "./scenes/BaseScene";
