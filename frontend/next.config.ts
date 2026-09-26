import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // `standalone` gives a self-contained server for the Docker image; Vercel
  // ignores it.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // Server-only packages that must stay as Node requires rather than being
  // bundled (native bindings / dynamic requires).
  serverExternalPackages: ['@prisma/client', 'prisma', 'bcryptjs', 'nodemailer', 'multer', 'express'],
  // Enable webpack polling for Docker hot reload on Windows/Mac
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
