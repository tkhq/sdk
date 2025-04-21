/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mock Node.js built-ins for client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        tls: false,
        net: false,
        https: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
