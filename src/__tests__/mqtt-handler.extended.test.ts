import { MqttHandler, MqttHandlerOptions } from '../lib/mqtt-handler';
import * as mqtt from 'mqtt';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';

// Usar o mock global, sem redefinir
jest.mock('mqtt');

describe('MqttHandler - Testes Avançados', () => {
  let mqttHandler: MqttHandler;
  let mockClient: any;
  let callbacks: Record<string, Function> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = {};

    // Obter o mock client existente do mock global
    const mockImplementation = (mqtt.connect as jest.Mock).getMockImplementation();
    mockClient = mockImplementation ? mockImplementation() : {};

    // Sobrescrever a implementação do mockClient.on para este teste
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      callbacks[event] = callback;
      return mockClient;
    });

    mqttHandler = new MqttHandler({
      clientId: 'test-client',
      username: 'user',
      password: 'pass',
      clean: true
    });
  });

  afterEach(() => {
    if (mqttHandler) {
      mqttHandler.removeAllListeners();
    }
  });

  describe('Erros de Publicação', () => {
    test('deve rejeitar quando publicação falhar', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect'](); // Simular evento connect
      await connectPromise;

      // Mock de erro na publicação
      mockClient.publish.mockImplementationOnce((_topic: string, _message: string, _opts: object, cb?: Function) => {
        if (cb) cb(new Error('Publish failed'));
      });

      // Tentar publicar
      await expect(mqttHandler.publish('test/topic', 'message')).rejects.toThrow(EnergyManagerError);
    });

    test('deve rejeitar quando assinatura falhar', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock de erro na assinatura
      mockClient.subscribe.mockImplementationOnce((_topic: string, _opts: object, cb?: Function) => {
        if (cb) cb(new Error('Subscribe failed'));
      });

      // Tentar assinar
      await expect(mqttHandler.subscribe('test/topic')).rejects.toThrow(EnergyManagerError);
    });

    test('deve rejeitar quando cancelamento de assinatura falhar', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock de erro no cancelamento
      mockClient.unsubscribe.mockImplementationOnce((_topic: string, cb?: Function) => {
        if (cb) cb(new Error('Unsubscribe failed'));
      });

      // Tentar cancelar assinatura
      await expect(mqttHandler.unsubscribe('test/topic')).rejects.toThrow(EnergyManagerError);
    });
  });

  describe('Exceções de inicialização', () => {
    test('deve tratar exceções ao criar cliente MQTT', async () => {
      // Simular erro de exceção durante conexão
      jest.spyOn(mqtt, 'connect').mockImplementationOnce(() => {
        throw new Error('Connection setup failed');
      });

      // Tentar conectar
      await expect(mqttHandler.connect('mqtt://localhost:1883')).rejects.toThrow(EnergyManagerError);
    });

    test('deve tratar desconexão quando cliente já está desconectado', async () => {
      // Cliente não inicializado
      const result = await mqttHandler.disconnect();
      expect(result).toBeUndefined();
    });

    test('deve rejeitar quando desconexão falhar', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock de erro na desconexão
      mockClient.end.mockImplementationOnce((force: boolean, opts: object, cb: Function) => {
        cb(new Error('Disconnect failed'));
      });

      // Tentar desconectar
      await expect(mqttHandler.disconnect()).rejects.toThrow(EnergyManagerError);
    });
  });

  describe('Manipulação de mensagens', () => {
    test('deve tratar erros em callbacks de tópicos', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Registrar callback com erro
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      await mqttHandler.subscribe('test/error', errorCallback);

      // Não deve lançar erro mesmo com falha no callback
      const message = Buffer.from('test');

      // Simular recebimento de mensagem
      expect(() => {
        callbacks['message'] && callbacks['message']('test/error', message);
      }).not.toThrow();

      // Callback deve ter sido chamado
      expect(errorCallback).toHaveBeenCalled();
    });
  });
});
