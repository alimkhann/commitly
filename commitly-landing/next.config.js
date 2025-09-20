/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "clsx"],
  },
};

module.exports = nextConfig;