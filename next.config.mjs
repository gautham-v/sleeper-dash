import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'recordbook.fyi' }],
        destination: 'https://leaguemate.fyi/:path*',
        permanent: true,
      },
    ];
  },
  // Silence workspace root detection warning when multiple lockfiles exist
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sleepercdn.com',
      },
    ],
  },
};

export default nextConfig;
