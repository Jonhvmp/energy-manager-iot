module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Adicionar arquivo de setup para mockar MQTT globalmente
  setupFiles: ['<rootDir>/test-setup.js'],
  // Ajudar a identificar recursos não liberados
  detectOpenHandles: true,
  // Forçar término após os testes
  forceExit: true,
  // Opcional: ignorar testes de integração por padrão (precisam de broker local)
  testPathIgnorePatterns: process.env.RUN_INTEGRATION_TESTS ? [] : ['/integration/']
}
