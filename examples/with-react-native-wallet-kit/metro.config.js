// Metro configuration for the example app in a monorepo
// - Adds monorepo watchFolders and resolves node_modules from the workspace root
// - Aliases `ws` to a React Native-compatible shim to avoid Node "ws" in the bundle
//
// Keep comments when refactoring.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// Watch the entire workspace so Metro can resolve symlinked packages
config.watchFolders = [workspaceRoot];

// Resolve modules from both the app and the workspace root
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  disableHierarchicalLookup: true,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    ws: path.resolve(projectRoot, 'shims/ws.js'),
  },
};

module.exports = config;


