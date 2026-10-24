module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Lets Drizzle's .sql migrations be imported as strings.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
