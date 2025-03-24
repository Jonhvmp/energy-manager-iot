// Setup global para todos os testes - garante que MQTT está sempre mockado
const mqtt = require('mqtt');

// Criar cliente mock que não dispara eventos de timeout
const mockClient = {
  on: jest.fn().mockImplementation((event, callback) => {
    // Armazenar callback, mas não executar automaticamente
    return mockClient;
  }),
  end: jest.fn((force, opts, cb) => typeof cb === 'function' ? cb() : undefined),
  publish: jest.fn((topic, message, opts, cb) => typeof cb === 'function' ? cb() : undefined),
  subscribe: jest.fn((topic, opts, cb) => typeof cb === 'function' ? cb() : undefined),
  unsubscribe: jest.fn((topic, cb) => typeof cb === 'function' ? cb() : undefined),
  removeAllListeners: jest.fn()
};

// Mock do módulo MQTT com configuração que evita timeouts
jest.mock('mqtt', () => {
  const mockConnect = jest.fn(() => mockClient);
  // Expor o cliente mock para os testes
  mockConnect.getMockImplementation = () => () => mockClient;

  return {
    connect: mockConnect
  };
});

// Limpeza global
if (typeof beforeEach === 'function') {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reiniciar comportamento do mockClient.on para cada teste
        mockClient.on.mockImplementation((event, callback) => {
            return mockClient;
        });
    });
} else {
    // Se beforeEach não estiver definido, cria uma versão default
    global.beforeEach = (fn) => fn();
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.on.mockImplementation((event, callback) => {
            return mockClient;
        });
    });
}

console.log('MQTT mock global configurado para os testes');
