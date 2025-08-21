module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/__tests__/**/*.js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: ['lib/**/*.{js,ts}', '!lib/**/*.d.ts'],
  // Ignore ESM modules that cause issues
  transformIgnorePatterns: ['node_modules/(?!(polyclip-ts|@turf)/)'],
  globals: {
    'ts-jest': {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
      },
    },
  },
  // Mock modules that have ESM issues
  moduleNameMapper: {
    '^@turf/(.*)$': '<rootDir>/__mocks__/turf.js',
  },
}
