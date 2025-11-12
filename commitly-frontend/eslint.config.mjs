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
    ],
  },
  // Next.js core web vitals config (already in flat config format)
  ...nextCoreWebVitals,
  // Next.js TypeScript config (already in flat config format)
  ...nextTypeScript,
];

export default eslintConfig;
