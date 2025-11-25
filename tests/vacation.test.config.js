/**
 * Jest Configuration for Vacation Module Tests
 */

module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  collectCoverageFrom: [
    'services/vacationService.js',
    'services/vacationValidation.js',
    'services/vacationAuditService.js',
    'routes/vacations.js',
    'models/VacationRequest.js',
    'models/Employee.js'
  ],
  testMatch: [
    '**/tests/vacation.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};
