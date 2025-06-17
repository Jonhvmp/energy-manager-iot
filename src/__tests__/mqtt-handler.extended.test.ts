import { MqttHandler, MqttHandlerOptions } from "../lib/mqtt-handler";
import * as mqtt from "mqtt";
import { EnergyManagerError, ErrorType } from "../utils/error-handler";

// Use global mock, without redefining
jest.mock("mqtt");

/**
 * Advanced tests for the MqttHandler class
 *
 * These tests focus on edge cases and error handling in the MQTT handler,
 * particularly around publishing, subscribing, and connection failures.
 */
describe("MqttHandler - Advanced Tests", () => {
  let mqttHandler: MqttHandler;
  let mockClient: any;
  let callbacks: Record<string, Function> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = {};

    // Get the existing mock client from global mock
    const mockImplementation = (
      mqtt.connect as jest.Mock
    ).getMockImplementation();
    mockClient = mockImplementation ? mockImplementation() : {};

    // Override mockClient.on implementation for this test
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      callbacks[event] = callback;
      return mockClient;
    });

    mqttHandler = new MqttHandler({
      clientId: "test-client",
      username: "user",
      password: "pass",
      clean: true,
    });
  });

  afterEach(() => {
    if (mqttHandler) {
      mqttHandler.removeAllListeners();
    }
  });

  describe("Publication Errors", () => {
    test("should reject when publication fails", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      callbacks["connect"] && callbacks["connect"](); // Simulate connect event
      await connectPromise;

      // Mock publication error
      mockClient.publish.mockImplementationOnce(
        (_topic: string, _message: string, _opts: object, cb?: Function) => {
          if (cb) cb(new Error("Publish failed"));
        },
      );

      // Try to publish
      await expect(
        mqttHandler.publish("test/topic", "message"),
      ).rejects.toThrow(EnergyManagerError);
    });

    test("should reject when subscription fails", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      callbacks["connect"] && callbacks["connect"]();
      await connectPromise;

      // Mock subscription error
      mockClient.subscribe.mockImplementationOnce(
        (_topic: string, _opts: object, cb?: Function) => {
          if (cb) cb(new Error("Subscribe failed"));
        },
      );

      // Try to subscribe
      await expect(mqttHandler.subscribe("test/topic")).rejects.toThrow(
        EnergyManagerError,
      );
    });

    test("should reject when unsubscription fails", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      callbacks["connect"] && callbacks["connect"]();
      await connectPromise;

      // Mock unsubscription error
      mockClient.unsubscribe.mockImplementationOnce(
        (_topic: string, cb?: Function) => {
          if (cb) cb(new Error("Unsubscribe failed"));
        },
      );

      // Try to unsubscribe
      await expect(mqttHandler.unsubscribe("test/topic")).rejects.toThrow(
        EnergyManagerError,
      );
    });
  });

  describe("Initialization Exceptions", () => {
    test("should handle exceptions when creating MQTT client", async () => {
      // Simulate exception error during connection
      jest.spyOn(mqtt, "connect").mockImplementationOnce(() => {
        throw new Error("Connection setup failed");
      });

      // Try to connect
      await expect(
        mqttHandler.connect("mqtt://localhost:1883"),
      ).rejects.toThrow(EnergyManagerError);
    });

    test("should handle disconnection when client is already disconnected", async () => {
      // Client not initialized
      const result = await mqttHandler.disconnect();
      expect(result).toBeUndefined();
    });

    test("should reject when disconnection fails", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      callbacks["connect"] && callbacks["connect"]();
      await connectPromise;

      // Mock disconnection error
      mockClient.end.mockImplementationOnce(
        (force: boolean, opts: object, cb: Function) => {
          cb(new Error("Disconnect failed"));
        },
      );

      // Try to disconnect
      await expect(mqttHandler.disconnect()).rejects.toThrow(
        EnergyManagerError,
      );
    });
  });

  describe("Message Handling", () => {
    test("should handle errors in topic callbacks", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      callbacks["connect"] && callbacks["connect"]();
      await connectPromise;

      // Register callback with error
      const errorCallback = jest.fn(() => {
        throw new Error("Callback error");
      });
      await mqttHandler.subscribe("test/error", errorCallback);

      // Should not throw error even with callback failure
      const message = Buffer.from("test");

      // Simulate message reception
      expect(() => {
        callbacks["message"] && callbacks["message"]("test/error", message);
      }).not.toThrow();

      // Callback should have been called
      expect(errorCallback).toHaveBeenCalled();
    });
  });
});

/**
 * Testes adicionais para o MqttHandler para aumentar a cobertura
 */

describe("MqttHandler Extended Tests", () => {
  let mqttHandler: MqttHandler;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      on: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      end: jest.fn(),
      removeAllListeners: jest.fn()
    };

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    mqttHandler = new MqttHandler();
  });

  afterEach(() => {
    mqttHandler.removeAllListeners();
  });

  test("deve lançar erro quando a publicação falha", async () => {
    // Configurar mock de conexão bem-sucedida
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Conectar
    await mqttHandler.connect("mqtt://localhost:1883");

    // Configurar mock de falha na publicação
    const publishError = new Error("Falha na publicação");
    mockClient.publish.mockImplementation(
      (_topic: string, _message: string, _opts: any, cb: Function) => {
        setTimeout(() => cb(publishError), 0);
      }
    );

    // Tentar publicar
    await expect(mqttHandler.publish("test/topic", { data: "test" }))
      .rejects.toThrow(EnergyManagerError);
  });

  test("deve lançar erro quando a subscrição falha", async () => {
    // Configurar mock de conexão bem-sucedida
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Conectar
    await mqttHandler.connect("mqtt://localhost:1883");

    // Configurar mock de falha na subscrição
    const subscribeError = new Error("Falha na subscrição");
    mockClient.subscribe.mockImplementation(
      (_topic: string, _opts: any, cb: Function) => {
        setTimeout(() => cb(subscribeError), 0);
      }
    );

    // Tentar subscrever
    await expect(mqttHandler.subscribe("test/topic"))
      .rejects.toThrow(EnergyManagerError);
  });

  test("deve lançar erro quando a cancelamento de subscrição falha", async () => {
    // Configurar mock de conexão bem-sucedida
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Conectar
    await mqttHandler.connect("mqtt://localhost:1883");

    // Configurar mock de falha no cancelamento de subscrição
    const unsubscribeError = new Error("Falha no cancelamento de subscrição");
    mockClient.unsubscribe.mockImplementation(
      (_topic: string, cb: Function) => {
        setTimeout(() => cb(unsubscribeError), 0);
      }
    );

    // Tentar cancelar subscrição
    await expect(mqttHandler.unsubscribe("test/topic"))
      .rejects.toThrow(EnergyManagerError);
  });

  test("deve tratar erros durante inicialização do cliente", async () => {
    // Mock para lançar exceção durante connect()
    (mqtt.connect as jest.Mock).mockImplementation(() => {
      throw new Error("Falha na inicialização");
    });

    // Tentar conectar
    await expect(mqttHandler.connect("mqtt://localhost:1883"))
      .rejects.toThrow(EnergyManagerError);
  });

  test("deve lançar erro na desconexão quando falha", async () => {
    // Configurar mock de conexão bem-sucedida
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Conectar
    await mqttHandler.connect("mqtt://localhost:1883");

    // Configurar mock de falha na desconexão
    const disconnectError = new Error("Falha na desconexão");
    mockClient.end.mockImplementation(
      (_force: boolean, _opts: any, cb: Function) => {
        setTimeout(() => cb(disconnectError), 0);
      }
    );

    // Tentar desconectar
    await expect(mqttHandler.disconnect())
      .rejects.toThrow(EnergyManagerError);
  });

  // Aumentar o timeout deste teste para evitar erro de timeout
  test("deve lidar com erros nos callbacks de mensagens", async () => {
    // Configurar mock de conexão bem-sucedida
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Conectar
    await mqttHandler.connect("mqtt://localhost:1883");

    // Registrar callback que lança erro
    const callbackThatThrows = jest.fn().mockImplementation(() => {
      throw new Error("Erro no callback");
    });

    // Configurar mock de subscrição para invocar o callback imediatamente
    mockClient.subscribe.mockImplementation(
      (_topic: string, _opts: any, cb: Function) => {
        setTimeout(() => cb(null), 0);
        return mockClient;
      }
    );

    // Subscrever com callback problemático
    await mqttHandler.subscribe("test/topic", callbackThatThrows);

    // Simular recebimento de mensagem - não deve lançar exceção
    const messageHandler = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    // Não deve lançar exceção quando o callback do tópico lança
    if (messageHandler) {
      expect(() => {
        messageHandler("test/topic", Buffer.from("test message"));
      }).not.toThrow();
    }

    // O callback deve ter sido chamado
    expect(callbackThatThrows).toHaveBeenCalled();
  }, 10000); // Aumentar timeout para 10 segundos

  test("deve resolver imediatamente disconnect quando cliente é nulo", async () => {
    // Não conecte, mantenha o cliente como null

    // Tentar desconectar - deve resolver sem erro
    await expect(mqttHandler.disconnect()).resolves.not.toThrow();
  });
});
