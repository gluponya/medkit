const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle emits migrations as .sql files, and Metro has to be able to resolve them.
config.resolver.sourceExts.push('sql');
// The Register ships as a ready SQLite file (tools/build-register.mjs).
config.resolver.assetExts.push('db');
// expo-sqlite on the web runs SQLite as a .wasm module.
config.resolver.assetExts.push('wasm');

// expo-sqlite's web worker gets its file system through ours, which keeps the
// files in memory where the browser has no place for them
// (src/data/db/web/AccessHandlePoolVFS.ts).
const fileSystem = path.join(__dirname, 'src/data/db/web/AccessHandlePoolVFS.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === './wa-sqlite/AccessHandlePoolVFS' &&
    /expo-sqlite[\\/]web[\\/]worker\.ts$/.test(context.originModulePath)
  ) {
    return { type: 'sourceFile', filePath: fileSystem };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
