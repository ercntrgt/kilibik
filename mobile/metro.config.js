const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Monorepo: ../shared kaynak olarak import edilir.
const root = path.resolve(__dirname, '..');
const config = {
  watchFolders: [path.resolve(root, 'shared')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(root, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
