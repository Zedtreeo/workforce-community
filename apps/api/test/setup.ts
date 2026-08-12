/**
 * Global test setup — runs before each test file.
 * Sets env vars and provides common test utilities.
 */

// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/hrms_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret';

// Increase timeout for integration tests
jest.setTimeout(15000);
