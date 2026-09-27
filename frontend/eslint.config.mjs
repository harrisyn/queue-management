import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts'] },
  {
    rules: {
      // The codebase uses `any` at API boundaries; keep it visible, not blocking.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // React Compiler guidance (this app doesn't use the compiler). The
      // patterns flagged - loading data in effects, effects calling functions
      // declared below them, the latest-callback ref - are safe here, so
      // they're warnings to work down rather than build failures.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // `declare global { namespace Express {...} }` is how Express request
    // typings are extended.
    files: ['src/server/middleware/**/*.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },
];

export default config;
