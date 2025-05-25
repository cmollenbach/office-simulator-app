// c:/Users/chris/Documents/office-simulator-app/.eslintrc.js
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true, // Good to have for build scripts, etc.
  },
  extends: [
    'eslint:recommended', // Basic ESLint recommendations
    'plugin:react/recommended', // React specific linting rules
    'plugin:react-hooks/recommended', // Rules for React Hooks
    // If you are using Create React App, you might already have 'react-app'
    // and 'react-app/jest'. If so, you can keep those.
    // 'react-app',
    // 'react-app/jest'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    // 'react-hooks' is often included by 'plugin:react/recommended' or 'react-app'
  ],
  settings: {
    react: {
      version: 'detect', // Automatically detect the React version
    },
  },
  rules: {
    // You can add or override global rules here.
    // For example, if 'self' was globally restricted, it might have been here:
    // 'no-restricted-globals': ['error', 'event', 'name', 'self'],

    // Example: Common rules you might want
    'react/prop-types': 'warn', // Warns if prop types are missing
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }], // Warns about unused variables, ignoring those starting with _
    // Add any other global rules your project needs
  },
  overrides: [
    {
      files: ['*.worker.js', '**/*.worker.js'], // Target all files ending with .worker.js
      env: {
        worker: true, // Crucial: Tells ESLint these are worker files
      },
      parserOptions: {
        ecmaVersion: 2021, // Or 12, or 'latest'. Ensures modern syntax is parsed.
        sourceType: 'module', // If your workers use ES modules
      },
      rules: {
        // This ensures 'self' is allowed in worker files,
        // even if it was restricted globally.
        // If you had 'self' in a global 'no-restricted-globals' list,
        // this effectively removes it for worker files.
        // If 'no-restricted-globals' wasn't set globally or didn't include 'self',
        // then 'env: { worker: true }' is often enough.
        // However, explicitly allowing it here is safer if 'self' *could* be restricted.

        // Option 1 (Recommended if 'self' was part of a global restriction):
        // List all other globals you *still* want restricted in workers, omitting 'self'.
        // If your global 'no-restricted-globals' was ['error', 'event', 'self'], you'd use:
        // 'no-restricted-globals': ['error', 'event'],

        // Option 2 (Simpler if 'self' is the only concern or no global restriction existed):
        // If you don't have a global 'no-restricted-globals' or it doesn't list 'self',
        // you might not even need to redefine it here, as `env: { worker: true }`
        // should make `self` known.
        // However, to be absolutely sure and override any potential inherited restriction:
        'no-restricted-globals': 'off', // This will turn off the rule for worker files.
                                        // Or, if you have other globals you want to restrict
                                        // in workers, list them here but exclude 'self'.
                                        // e.g., 'no-restricted-globals': ['error', 'event', 'name']
      },
    },
  ],
};
