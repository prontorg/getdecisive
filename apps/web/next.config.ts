import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@decisive/types', '@decisive/config'],
  basePath: '/planner',
};

export default nextConfig;
