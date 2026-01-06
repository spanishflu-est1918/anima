/**
 * VolumeController - Manages master volume and volume updates for active sounds
 *
 * Handles:
 * - Master volume state and clamping
 * - Applying volume changes to all active sounds
 * - Volume calculation with base config volumes
 */

import type { ActiveSound } from "./types";

/**
 * Interface for objects with setVolume method
 */
interface VolumeControllable {
	setVolume?: (volume: number) => void;
}

export class VolumeController {
	private masterVolume: number = 1;

	/**
	 * Get current master volume
	 */
	getMasterVolume(): number {
		return this.masterVolume;
	}

	/**
	 * Set master volume (clamped to 0-1 range)
	 */
	setMasterVolume(volume: number): void {
		this.masterVolume = Math.max(0, Math.min(1, volume));
	}

	/**
	 * Calculate effective volume for a sound
	 */
	calculateEffectiveVolume(baseVolume: number): number {
		return baseVolume * this.masterVolume;
	}

	/**
	 * Update volumes for all active sounds based on their config volumes
	 */
	updateActiveSoundVolumes(activeSounds: Map<string, ActiveSound>): void {
		for (const [, active] of activeSounds) {
			const baseVolume = "volume" in active.config ? active.config.volume : 1;
			const soundWithVolume = active.sound as unknown as VolumeControllable;
			if (soundWithVolume?.setVolume) {
				soundWithVolume.setVolume(baseVolume * this.masterVolume);
			}
		}
	}
}
