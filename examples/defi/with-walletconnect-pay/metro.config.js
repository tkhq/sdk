const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @turnkey/core uses WalletConnect, which only falls back to the Node `ws` package when
// there's no global WebSocket. React Native always has one, and the workspace pins ws 8,
// which Metro would otherwise resolve to its Node build and fail to bundle.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
