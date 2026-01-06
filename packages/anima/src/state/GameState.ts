/**
 * GameState - Core state management singleton
 *
 * Manages all game state including:
 * - Character states (e.g., "opening", "angry", "happy")
 * - Boolean flags for game progression
 * - Inventory items (using Set for uniqueness)
 * - Money with clamping at 0
 */
export class GameState {
	private static instance: GameState;
	private characterStates: Map<string, string> = new Map();
	private flags: Map<string, boolean> = new Map();

	// Inventory system
	private inventoryItems: Set<string> = new Set();
	private money: number = 40; // Starting cash per spec

	private constructor() {
		// Private constructor enforces singleton pattern
	}

	public static getInstance(): GameState {
		if (!GameState.instance) {
			GameState.instance = new GameState();
		}
		return GameState.instance;
	}

	public getCharacterState(characterId: string): string {
		return this.characterStates.get(characterId) || "opening";
	}

	public setCharacterState(characterId: string, state: string): void {
		this.characterStates.set(characterId, state);
	}

	public getFlag(key: string): boolean {
		return this.flags.get(key) || false;
	}

	public setFlag(key: string, value: boolean): void {
		this.flags.set(key, value);
	}

	// Inventory methods
	public hasInventoryItem(itemId: string): boolean {
		return this.inventoryItems.has(itemId);
	}

	/** Alias for hasInventoryItem (used by InventoryManager) */
	public hasItem(itemId: string): boolean {
		return this.hasInventoryItem(itemId);
	}

	public addInventoryItem(itemId: string): void {
		this.inventoryItems.add(itemId);
	}

	/** Alias for addInventoryItem (used by InventoryManager) */
	public addItem(itemId: string): void {
		this.addInventoryItem(itemId);
	}

	public removeInventoryItem(itemId: string): void {
		this.inventoryItems.delete(itemId);
	}

	/** Alias for removeInventoryItem (used by InventoryManager) */
	public removeItem(itemId: string): void {
		this.removeInventoryItem(itemId);
	}

	public getInventory(): string[] {
		return Array.from(this.inventoryItems);
	}

	public clearInventory(): void {
		this.inventoryItems.clear();
	}

	// Money methods
	public getMoney(): number {
		return this.money;
	}

	public setMoney(amount: number): void {
		this.money = Math.max(0, amount);
	}

	public spendMoney(amount: number): boolean {
		if (this.money < amount) {
			return false;
		}
		this.money -= amount;
		return true;
	}

	/**
	 * Reset all game state to initial values
	 * Used when restarting the game
	 */
	public reset(): void {
		this.characterStates.clear();
		this.flags.clear();
		this.inventoryItems.clear();
		this.money = 40;
	}
}
