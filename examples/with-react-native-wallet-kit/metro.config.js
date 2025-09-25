const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    ws: path.resolve(__dirname, 'shims/ws.js'),
    crypto: path.resolve(__dirname, 'shims/crypto.js'),
    '@noble/hashes/crypto': path.resolve(__dirname, 'shims/noble-crypto.js'),
  },
};
module.exports = config;