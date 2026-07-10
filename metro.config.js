const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the external workspace folder to watchFolders so Metro can bundle files from it
const workspaceRoot = path.resolve(__dirname, '../GC');
config.watchFolders = [workspaceRoot];

// Ensure Metro resolves packages to the local node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName === 'react-native' ||
    moduleName === '@tanstack/react-query' ||
    moduleName.startsWith('react/')
  ) {
    // Force Metro to resolve these modules from the current project's root
    return context.resolveRequest(
      { ...context, originModulePath: path.resolve(__dirname, 'index.js') },
      moduleName,
      platform
    );
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
