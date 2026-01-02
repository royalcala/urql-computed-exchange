const path = require('path');

module.exports = {
  preset: 'ts-jest',
  verbose: false,
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname),
  coverageDirectory: './coverage',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/performance/.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.test.(t|j)s',
    '!**/node_modules/**',
  ],
};