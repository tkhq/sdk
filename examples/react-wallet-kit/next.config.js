const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  images: {
    domains: [],
    unoptimized: true, // Allow base64-encoded images
  },
};

module.exports = withBundleAnalyzer(nextConfig);
