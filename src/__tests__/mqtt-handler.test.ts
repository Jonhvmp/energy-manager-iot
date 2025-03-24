import { MqttHandler } from '../lib/mqtt-handler';
import * as mqtt from 'mqtt';
import { EnergyManagerError } from '../utils/error-handler';

// Usar o mock global do MQTT, sem tentar redefinir
jest.mock('mqtt');

describe('MqttHandler', () => {
  let mqttHandler: MqttHandler;
  let mockClient: any;
  let mockHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Criar handlers para os eventos
    mockHandlers = {
      connect: jest.fn(),
      message: jest.fn(),
      error: jest.fn(),
      reconnect: jest.fn(),
      offline: jest.fn()
    };

    // Criar um mock client
    mockClient = {
      on: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      end: jest.fn()
    };

    // Adicionar implementação para subscribe invocar callback imediatamente
    mockClient.subscribe.mockImplementation((topic: string, opts: any, cb: Function) => {
      cb(null);
      return mockClient;
    });

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    // Configurar o cliente para usar nossos handlers
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      mockHandlers[event] = callback;
      return mockClient;
    });

    mqttHandler = new MqttHandler({
      clientId: 'test-client',
      // Configurações para evitar timeouts
      connectTimeout: 1,
      reconnectPeriod: 0
    });
  });

  afterEach(() => {
    if (mqttHandler) {
      mqttHandler.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe('Conexão', () => {
    test('deve lançar erro com URL inválida', async () => {
      await expect(mqttHandler.connect('invalid-url')).rejects.toThrow(EnergyManagerError);
    });

    test('deve conectar com sucesso e emitir evento', async () => {
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');

      // Simular evento de conexão
      const connectListener = jest.fn();
      mqttHandler.on('connect', connectListener);

      // Acionar callback de conexão
      mockHandlers.connect();

      await connectPromise;
      expect(connectListener).toHaveBeenCalled();
      expect(mqttHandler.isClientConnected()).toBe(true);
    });

    test('deve emitir evento de erro na conexão', async () => {
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');

      const errorListener = jest.fn();
      mqttHandler.on('error', errorListener);

      // Simular erro
      const error = new Error('Connection refused');
      mockHandlers.error(error);

      await expect(connectPromise).rejects.toThrow(EnergyManagerError);
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });

  describe('Publicação e Assinatura', () => {
    test('deve falhar ao publicar quando desconectado', async () => {
      await expect(mqttHandler.publish('test/topic', 'message')).rejects.toThrow(EnergyManagerError);
    });

    test('deve processar mensagens recebidas', async () => {
      // Conectar primeiro
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      mockHandlers.connect();
      await connectPromise;

      // Configurar listener para mensagens
      const messageListener = jest.fn();
      mqttHandler.on('message', messageListener);

      // Assinar tópico com callback
      const topicCallback = jest.fn();
      await mqttHandler.subscribe('test/topic', topicCallback);

      // Simular recebimento de mensagem
      const message = Buffer.from('test message');
      mockHandlers.message('test/topic', message);

      // Verificar se ambos os callbacks foram chamados
      expect(messageListener).toHaveBeenCalledWith('test/topic', message);
      expect(topicCallback).toHaveBeenCalledWith('test/topic', message);
    });
  });

  describe('Desconexão e Reconexão', () => {
    test('deve lidar com desconexão', async () => {
      // Conectar
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      mockHandlers.connect();
      await connectPromise;

      // Configurar listener para offline
      const offlineListener = jest.fn();
      mqttHandler.on('offline', offlineListener);

      // Simular offline
      mockHandlers.offline();

      expect(offlineListener).toHaveBeenCalled();
      expect(mqttHandler.isClientConnected()).toBe(false);
    });

    test('deve emitir evento na reconexão', async () => {
      // Conectar
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      mockHandlers.connect();
      await connectPromise;

      // Configurar listener para reconexão
      const reconnectListener = jest.fn();
      mqttHandler.on('reconnect', reconnectListener);

      // Simular reconexão
      mockHandlers.reconnect();

      expect(reconnectListener).toHaveBeenCalled();
    });
  });
});
