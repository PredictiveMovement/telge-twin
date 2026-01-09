module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: ['lib/**/*.{js,ts}', '!lib/**/*.d.ts'],
  transformIgnorePatterns: ['node_modules/(?!(polyclip-ts|@turf)/)'],
  globals: {
    'ts-jest': {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        types: ['jest', 'node'],
      },
    },
  },
  moduleNameMapper: {
    '^@turf/turf$': '<rootDir>/__mocks__/turf.ts',
    '^@turf/clusters-dbscan$': '<rootDir>/__mocks__/@turf/clusters-dbscan.ts',
    '^@turf/(.*)$': '<rootDir>/__mocks__/turf.ts',
  },
}
