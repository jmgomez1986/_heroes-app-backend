import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'], // 'text' imprime resumen en consola, 'html' genera el sitio
      reportsDirectory: 'coverage',
    },
  },
});
