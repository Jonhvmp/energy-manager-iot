const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  // Aumentar o tempo limite para testes de integração
  testTimeout: 10000,
  // Forçar saída após os testes, mesmo se houver timers pendentes
  forceExit: true,
  // Detectar recursos que não foram liberados corretamente
  detectOpenHandles: true,
  // Executar apenas testes de integração
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Configurar setup de teste global para mockar MQTT
  setupFiles: ['<rootDir>/test-setup.js'],
};
