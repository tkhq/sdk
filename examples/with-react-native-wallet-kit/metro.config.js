const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Monorepo root for this example lives at sdk/
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Support pnpm/yarn workspaces and symlinked packages (Metro 0.83+)
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

// Ensure module resolution includes both the app and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Watch the monorepo root (sdk) so changes in linked packages are picked up
config.watchFolders = [workspaceRoot];

module.exports = config;