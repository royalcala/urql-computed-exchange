const path = require('path');

module.exports = {
  preset: 'ts-jest',
  verbose: false,
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, 'src'),
  coverageDirectory: './coverage',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.test.(t|j)s',
    '!**/node_modules/**',
  ],
};
