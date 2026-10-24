const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle emits migrations as .sql files, and Metro has to be able to resolve them.
config.resolver.sourceExts.push('sql');
// The Register ships as a ready SQLite file (tools/build-register.mjs).
config.resolver.assetExts.push('db');

module.exports = config;
