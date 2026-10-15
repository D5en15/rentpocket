import type { NextConfig } from 'next';
const config: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  experimental: { serverActions: { bodySizeLimit: '4300kb' } },
};
export default config;
