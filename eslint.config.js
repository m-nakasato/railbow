import js from '@eslint/js';

export default [
    {
        ignores: ['**/dist/**'],
    },
    js.configs.recommended,
    {
        files: ['**/src/**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                crypto: 'readonly',
                document: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                window: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                OffscreenCanvas: 'readonly',
                // Web Audio API globals
                AudioBufferSourceNode: 'readonly',
                GainNode: 'readonly',
                OscillatorNode: 'readonly',
                PeriodicWave: 'readonly',
                // Build mode flag
                __DEV__: 'readonly',
            },
        },
        rules: {
            'class-methods-use-this': 'warn',
            'no-console': 'off',
            'no-else-return': 'warn',
            'no-empty-function': 'warn',
            'no-eq-null': 'warn',
            'no-extra-semi': 'error',
            'no-invalid-this': 'warn',
            'no-multi-spaces': 'warn',
            'no-new': 'warn',
            'no-param-reassign': 'warn',
            'no-self-compare': 'warn',
            'no-sparse-arrays': 'warn',
            'no-unmodified-loop-condition': 'warn',
            'no-unused-expressions': 'warn',
            'no-use-before-define': 'warn',
            'no-useless-return': 'warn',
            'quote-props': ['warn', 'consistent'],
            'radix': 'warn',
            'require-await': 'warn',
            'yoda': 'warn',
        },
    },
    {
        files: ['**/*.config.js', '**/test/**/*.test.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                global: 'readonly',
                process: 'readonly',
            },
        },
    },
];
