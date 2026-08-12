/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hrms/ui'],

  // Docker: standalone output bundles everything into .next/standalone
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
};

module.exports = nextConfig;
