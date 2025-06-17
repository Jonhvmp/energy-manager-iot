/**
 * Tests for verifying the correct exports from the library entry point
 *
 * This test suite verifies that all necessary parts of the library API
 * are being exported correctly.
 */

import * as lib from '../index';

describe('Library exports', () => {
  test('should export main classes', () => {
    expect(lib.EnergyManager).toBeDefined();
    expect(lib.MqttHandler).toBeDefined();
    expect(lib.DeviceRegistry).toBeDefined();
  });

  test('should export error handling utilities', () => {
    expect(lib.EnergyManagerError).toBeDefined();
    expect(lib.ErrorType).toBeDefined();
    expect(lib.ErrorSeverity).toBeDefined();
    expect(lib.createErrorHandler).toBeDefined();
  });

  test('should export type definitions', () => {
    expect(lib.DeviceType).toBeDefined();
    expect(lib.PowerMode).toBeDefined();
    expect(lib.ConnectionStatus).toBeDefined();
    expect(lib.CommandType).toBeDefined();
  });

  test('should export logger', () => {
    expect(lib.Logger).toBeDefined();
  });

  test('should export version information', () => {
    expect(lib.VERSION).toBeDefined();
    expect(typeof lib.VERSION).toBe('string');
  });
});
