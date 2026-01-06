import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./packages/anima/src/__tests__/setup.ts"],
		include: ["packages/**/*.test.ts", "api/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["packages/anima/src/**/*.ts", "api/src/**/*.ts"],
			exclude: ["**/*.test.ts", "**/index.ts", "**/*.d.ts"],
		},
		typecheck: {
			enabled: true,
		},
	},
	resolve: {
		alias: {
			"@anima/engine": "/home/gorkolas/www/anima/packages/anima/src",
		},
	},
});
