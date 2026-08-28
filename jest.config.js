module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  testPathIgnorePatterns: ['.*/dist/.*', '.*dist.*'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
