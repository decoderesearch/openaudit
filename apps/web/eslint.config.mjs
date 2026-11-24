import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

// The top loading bar starts only for router.push and router.replace from this wrapper.
const USE_ROUTER = {
  name: 'next/navigation',
  importNames: ['useRouter'],
  message: "Import useRouter from 'nextjs-toploader/app', so navigation shows the loading bar.",
};

const NEXT_LINK = {
  name: 'next/link',
  message: "Import Link from '@/components/link'. It does not prefetch.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    '.next/**',
    '.next-test/**',
    '.next-prod/**',
    '.open-next/**',
    '.wrangler/**',
    'cloudflare-env.d.ts',
    'lib/generated/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-restricted-imports': ['error', { paths: [USE_ROUTER, NEXT_LINK] }],
    },
  },
  {
    files: ['components/link.tsx', 'components/model-link.tsx', 'components/method-link.tsx'],
    rules: { 'no-restricted-imports': ['error', { paths: [USE_ROUTER] }] },
  },
  {
    // Playwright fixtures call `use`, which is not the React hook.
    files: ['e2e/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]);
