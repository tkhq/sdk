const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Prevent Node-only modules from being bundled into React Native.
// WalletConnect pulls in `ws` which requires Node's `stream`, `https`, etc.
// React Native has a built-in WebSocket global, so `ws` is not needed.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
