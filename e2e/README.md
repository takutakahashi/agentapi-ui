# E2E Tests for AgentAPI UI

This directory contains end-to-end tests for the AgentAPI UI application, with a focus on testing Single Profile Mode functionality using mock backends.

## Setup

1. Install Playwright browsers:
```bash
bun run e2e:install
```

2. Run the tests:
```bash
# Run tests in headless mode
bun run e2e

# Run tests with UI mode (interactive)
bun run e2e:ui

# Run tests in headed mode (see the browser)
bun run e2e:headed
```

## Test Structure

- `single-profile-mode.spec.ts` - Tests for Single Profile Mode functionality
- `fixtures/mock-server.ts` - MSW mock server configuration
- `fixtures/test-with-mock.ts` - Custom test fixture with API mocking

## Mock Backend

The tests use MSW (Mock Service Worker) to intercept and mock API requests. This allows us to:
- Test without a real backend
- Control API responses for different scenarios
- Test error handling
- Ensure consistent test results

## Single Profile Mode Testing

The tests verify:
- Login/logout flow with API key authentication
- Profile switcher is hidden in single profile mode
- Message sending and receiving
- Session persistence across page reloads
- Error handling for invalid API keys and server errors

## Environment Variables

The tests use `.env.test` for configuration:
- `NEXT_PUBLIC_SINGLE_PROFILE_MODE=true` - Enables single profile mode
- `COOKIE_ENCRYPTION_SECRET` - Required for cookie encryption in tests