const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', '.superdesign/**', 'tools/**'],
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      // The domain layer must stay pure: no react-native, no expo, no database.
      'no-restricted-imports': [
        'error',
        { patterns: ['react-native*', 'expo*', '@/data/*', '@/features/*', '@/ui/*'] },
      ],
    },
  },
];
