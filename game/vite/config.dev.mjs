import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	base: "./",
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					phaser: ["phaser"],
				},
			},
		},
	},
	server: {
		port: 8080,
		hmr: false,
	},
});
