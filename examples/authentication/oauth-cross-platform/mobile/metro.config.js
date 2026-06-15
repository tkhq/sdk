import { getDefaultConfig } from "expo/metro-config";

/** @type {import('expo/metro-config').MetroConfig} */
const expoConfig = getDefaultConfig(__dirname);

expoConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") {
    return { type: "empty" };
  }

  return context.resolveRequest(context, moduleName, platform);
};

export default expoConfig;
