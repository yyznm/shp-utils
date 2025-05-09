import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({
    include: ['./lib/**/*.ts', './lib/*.ts'],
    rollupTypes: true,
    clearPureImport: true,
    outDir: 'dist',
  })],
  build: {
    lib: {
      entry: './lib/index.ts',
      name: 'ShpUtils',
      fileName: 'shp-utils',
    },
  },
})
