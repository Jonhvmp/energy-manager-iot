import {
  EnergyManagerError,
  ErrorType,
  ErrorSeverity,
  createErrorHandler,
  handleError
} from "../utils/error-handler";
import Logger from "../utils/logger";

// Mock Logger to avoid actual logging during tests
jest.mock("../utils/logger", () => {
  return {
    __esModule: true,
    default: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      child: jest.fn().mockReturnThis(),
      withCorrelationId: jest.fn().mockReturnThis()
    }
  };
});

describe("Error Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("EnergyManagerError", () => {
    test("should create error with correct properties", () => {
      const error = new EnergyManagerError(
        "Connection timeout",
        ErrorType.CONNECTION,
        { host: "localhost" },
        ErrorSeverity.HIGH,
        "corr-123"
      );

      expect(error.name).toBe("EnergyManagerError");
      expect(error.message).toBe("Connection timeout");
      expect(error.type).toBe(ErrorType.CONNECTION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.data).toEqual({ host: "localhost" });
      expect(error.correlationId).toBe("corr-123");
      expect(error.code).toMatch(/^EM-CONN-/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    test("should use default severity when not specified", () => {
      const error = new EnergyManagerError(
        "Test error",
        ErrorType.VALIDATION
      );

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    test("should generate a toJSON representation", () => {
      const error = new EnergyManagerError(
        "Test error",
        ErrorType.INTERNAL_ERROR,
        { detail: "test" }
      );

      const json = error.toJSON();
      expect(json).toHaveProperty("name", "EnergyManagerError");
      expect(json).toHaveProperty("message", "Test error");
      expect(json).toHaveProperty("type", ErrorType.INTERNAL_ERROR);
      expect(json).toHaveProperty("data", { detail: "test" });
      expect(json).toHaveProperty("code");
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("stack");
    });
  });

  describe("createErrorHandler", () => {
    test("should create module-specific error handler", () => {
      const handleModuleError = createErrorHandler("TestModule");

      expect(typeof handleModuleError).toBe("function");

      // Should use module logger
      expect(Logger.child).toHaveBeenCalledWith("TestModule");
    });

    test("should handle EnergyManagerError", () => {
      const handleModuleError = createErrorHandler("TestModule");
      const error = new EnergyManagerError("Test error", ErrorType.VALIDATION);

      expect(() => {
        handleModuleError(error, "test context");
      }).toThrow(error);

      expect(Logger.error).toHaveBeenCalled();
    });

    test("should handle standard Error", () => {
      const handleModuleError = createErrorHandler("TestModule");
      const error = new Error("Standard error");

      expect(() => {
        handleModuleError(error, "test context");
      }).toThrow(error);

      expect(Logger.error).toHaveBeenCalled();
    });

    test("should use correlationId if provided", () => {
      const handleModuleError = createErrorHandler("TestModule");
      const error = new Error("Test error");

      expect(() => {
        handleModuleError(error, "test context", "correlation-123");
      }).toThrow(error);

      expect(Logger.withCorrelationId).toHaveBeenCalledWith("correlation-123");
    });
  });

  describe("handleError", () => {
    test("should handle EnergyManagerError", () => {
      const error = new EnergyManagerError(
        "Test error",
        ErrorType.CONNECTION
      );

      expect(() => {
        handleError(error, "test context");
      }).toThrow(error);

      expect(Logger.error).toHaveBeenCalled();
    });

    test("should handle standard Error", () => {
      const error = new Error("Standard error");

      expect(() => {
        handleError(error, "test context");
      }).toThrow(error);

      expect(Logger.error).toHaveBeenCalled();
    });

    test("should use correlationId if provided", () => {
      const error = new Error("Test error");

      expect(() => {
        handleError(error, "test context", "correlation-123");
      }).toThrow(error);

      expect(Logger.withCorrelationId).toHaveBeenCalledWith("correlation-123");
    });
  });
});
