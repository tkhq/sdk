import rollupBaseConfig from '../../rollup.config.base.mjs';
import versionInjector from 'rollup-plugin-version-injector';

export default () => {
  const configs = rollupBaseConfig(); // This should be an array of configurations

  // Add the versionInjector plugin to each configuration
  configs.forEach((config) => {
    config.plugins = [
      ...(config.plugins || []),
      versionInjector({
        logLevel: 'warn',
      }),
    ];
  });

  return configs;
};
