import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The shared workspace package ships TypeScript source, so it is bundled in; real deps stay external.
  noExternal: ['@catalogue/shared'],
});
