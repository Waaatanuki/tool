import antfu from '@antfu/eslint-config'

export default antfu({
  unocss: true,
  formatters: true,
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
})
