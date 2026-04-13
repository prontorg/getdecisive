import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@decisive/types', '@decisive/config'],
};

export default nextConfig;
