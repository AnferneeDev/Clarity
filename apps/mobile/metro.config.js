const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

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
      path.resolve(__dirname, 'node_modules', moduleName),
      platform
    );
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
