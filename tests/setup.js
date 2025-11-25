/**
 * Test Setup Configuration
 * Runs before all tests
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/legalbot_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Global test utilities
global.testHelpers = {
  /**
   * Create a date offset by days from today
   */
  createDateOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  },

  /**
   * Calculate days between two dates
   */
  daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
  },

  /**
   * Mock employee factory
   */
  createMockEmployee(overrides = {}) {
    return {
      employeeId: 'EMP' + Math.random().toString(36).substring(7),
      name: 'Test Employee',
      hireDate: new Date('2023-01-01'),
      companyId: 'COMPANY001',
      active: true,
      ...overrides
    };
  },

  /**
   * Mock vacation request factory
   */
  createMockVacationRequest(overrides = {}) {
    return {
      employeeId: 'EMP001',
      requestedDays: 5,
      status: 'requested',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-05'),
      reason: 'Personal vacation',
      ...overrides
    };
  }
};

// Suppress console logs during tests (optional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Custom Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveDecimalPlaces(received, places) {
    const decimalPlaces = (received.toString().split('.')[1] || '').length;
    const pass = decimalPlaces <= places;
    if (pass) {
      return {
        message: () => `expected ${received} to have more than ${places} decimal places`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have at most ${places} decimal places, but has ${decimalPlaces}`,
        pass: false,
      };
    }
  }
});
