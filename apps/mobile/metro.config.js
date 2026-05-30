const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// Disable strict package exports resolution to prevent warnings/errors on unexported files
config.resolver.unstable_enablePackageExports = false;

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Allow Metro to resolve nested (sub)dependencies
config.resolver.disableHierarchicalLookup = false;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const duplicatePackages = [
    'react-native-safe-area-context',
    'react-native-screens',
    'react-native-gesture-handler',
    'react-native-reanimated',
    'react-native-svg',
    'react-native-worklets',
  ];
  
  if (duplicatePackages.includes(moduleName)) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, 'node_modules', moduleName),
      platform
    );
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
