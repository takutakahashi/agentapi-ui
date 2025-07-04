import { test, expect } from './fixtures/test-with-mock';

test.describe('Single Profile Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set single profile mode environment
    await page.addInitScript(() => {
      (window as any).NEXT_PUBLIC_SINGLE_PROFILE_MODE = 'true';
    });
  });

  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login or show login UI
    await expect(page.getByRole('heading', { name: /AgentAPI UI/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your API key/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should login with valid API key', async ({ page }) => {
    await page.goto('/');
    
    // Enter API key and login
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should navigate to main chat interface
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });

  test('should show error with invalid API key', async ({ page }) => {
    await page.goto('/');
    
    // Enter invalid API key
    await page.getByPlaceholder(/Enter your API key/i).fill('invalid-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should show error message
    await expect(page.getByText(/Invalid API key/i)).toBeVisible();
  });

  test('should not show profile switcher in single profile mode', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Check that profile switcher is not visible
    await expect(page.locator('[data-testid="profile-switcher"]')).not.toBeVisible();
    
    // The top bar should still be visible but without profile controls
    await expect(page.locator('header')).toBeVisible();
  });

  test('should send and receive messages', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Send a message
    const messageInput = page.getByRole('textbox', { name: /message/i });
    await messageInput.fill('Hello, test message');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Check that message appears in chat
    await expect(page.getByText('Hello, test message')).toBeVisible();
    
    // Check for mock response
    await expect(page.getByText(/This is a mock response from the API/i)).toBeVisible();
  });

  test('should logout and return to login page', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Find and click logout button
    await page.getByRole('button', { name: /logout/i }).click();
    
    // Should return to login page
    await expect(page.getByPlaceholder(/Enter your API key/i)).toBeVisible();
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Verify logged in
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Should still be logged in
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your API key/i)).not.toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Mock API error
    await page.route('**/api/proxy/messages', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Send a message
    const messageInput = page.getByRole('textbox', { name: /message/i });
    await messageInput.fill('Test error handling');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Should show error message
    await expect(page.getByText(/error/i)).toBeVisible();
  });
});