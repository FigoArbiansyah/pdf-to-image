import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) {
            return 'pdfjs';
          }
          if (id.includes('jszip')) {
            return 'jszip';
          }
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
  }
});
