const runtimeGlobals = Object.fromEntries(
  [
    'AbortController',
    'AbortSignal',
    'clearInterval',
    'clearTimeout',
    'document',
    'exports',
    'fetch',
    'module',
    'navigator',
    'queueMicrotask',
    'require',
    'setInterval',
    'setTimeout',
    'window'
  ].map((name) => [name, 'readonly'])
);

export default [
  {
    files: ['dist/index.js', 'dist/index.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: runtimeGlobals
    },
    rules: {
      'no-undef': 'error'
    }
  }
];
