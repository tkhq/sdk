/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // stellar-sdk uses some browser-incompatible modules in its server bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
