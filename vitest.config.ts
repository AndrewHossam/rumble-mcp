import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/tools/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/test-integration.ts',
                'src/extract-token.ts',
                'src/index.ts',
                'src/api/**/*.ts',
                'src/types/**/*.ts',
                'src/utils/**/*.ts',
                'src/tools/call-details.ts',
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 50,
                statements: 70,
            },
        },
    },
});
