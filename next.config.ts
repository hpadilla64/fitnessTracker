import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native module: load from node_modules at runtime instead of bundling
  serverExternalPackages: ['better-sqlite3'],
  // The repo lives on an ExFAT volume, where macOS writes AppleDouble `._*` files into
  // Turbopack's persistent cache and breaks it ("Loading persistence directory failed")
  experimental: {
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
