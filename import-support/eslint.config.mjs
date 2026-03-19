// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
export default withNuxt({
  plugins: {
    '@stylistic': require('@stylistic/eslint-plugin'),
  },
  rules: {
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/comma-dangle': ['error', 'never'],
  },
});
