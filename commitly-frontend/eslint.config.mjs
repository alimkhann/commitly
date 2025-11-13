import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = [
  // Global ignores
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'next-env.d.ts',
      'components/Dither.tsx',
    ],
  },
  // Next.js core web vitals config (already in flat config format)
  ...nextCoreWebVitals,
  // Next.js TypeScript config (already in flat config format)
  ...nextTypeScript,
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/data/repos',
              message:
                'Import repo data via repoService to keep API and persistence access centralized.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
