import fict from '@fictjs/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts'
      },
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: (id) => id === '@fictjs/runtime' || id.startsWith('@fictjs/runtime/')
    }
  },
  plugins: [fict({ library: true })]
});
