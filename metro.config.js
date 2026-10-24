const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle emits migrations as .sql files, and Metro has to be able to resolve them.
config.resolver.sourceExts.push('sql');

module.exports = config;
