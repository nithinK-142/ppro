const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    setupFiles: ['./test/setup.js'],
    fileParallelism: false
  }
});
