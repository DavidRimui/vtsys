/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization settings
  images: {
    domains: ['localhost', 'res.cloudinary.com', 'images.unsplash.com'],
    // Only use unoptimized in development
    unoptimized: process.env.NODE_ENV !== 'production',
    // Add formats for modern browsers
    formats: ['image/avif', 'image/webp'],
    // Set reasonable size limits
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  
  // Disable ESLint and TypeScript errors only in CI/CD pipelines
  eslint: {
    ignoreDuringBuilds: process.env.CI === 'true',
  },
  typescript: {
    ignoreBuildErrors: process.env.CI === 'true',
  },
  
  // Enable production source maps for better error tracking
  productionBrowserSourceMaps: true,
  
  // Optimize bundle size
  swcMinify: true,
  
  // Configure server compression
  compress: true,
  
  // Use a custom output directory for easier deployment
  distDir: process.env.BUILD_DIR || '.next',
  
  // Configure headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
