import { test, expect } from './fixtures/test-with-mock';

test.describe('Single Profile Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set single profile mode environment
    await page.addInitScript(() => {
      (window as any).NEXT_PUBLIC_SINGLE_PROFILE_MODE = 'true';
    });
  });

  test('should show login modal when not authenticated', async ({ page }) => {
    await page.goto('/?login=required');
    
    // Should show login modal
    await expect(page.getByRole('heading', { name: /Enter API Key/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your API key/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should login with valid API key via API endpoint', async ({ page }) => {
    // Mock the login API endpoint
    await page.route('**/api/auth/login', async (route) => {
      const request = route.request();
      const data = await request.postDataJSON();
      
      if (data?.apiKey === 'valid-test-key') {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'agentapi-auth=mock-token; Path=/; HttpOnly; Secure; SameSite=Strict'
          },
          body: JSON.stringify({ message: 'Successfully logged in' })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid API key' })
        });
      }
    });

    await page.goto('/?login=required');
    
    // Enter API key and login
    await page.getByPlaceholder(/Enter your API key/i).fill('valid-test-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should close modal and navigate to main interface
    await expect(page.getByRole('heading', { name: /Enter API Key/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /Conversations/i })).toBeVisible();
  });

  test('should show error with invalid API key', async ({ page }) => {
    // Mock the login API endpoint
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid API key' })
      });
    });

    await page.goto('/?login=required');
    
    // Enter invalid API key
    await page.getByPlaceholder(/Enter your API key/i).fill('invalid-key');
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should show error message
    await expect(page.getByText(/Invalid API key/i)).toBeVisible();
  });

  test('should not show profile switcher in single profile mode', async ({ page }) => {
    // Set auth cookie to skip login
    await page.context().addCookies([{
      name: 'agentapi-auth',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict'
    }]);
    
    await page.goto('/');
    
    // Check that profile switcher is not visible
    await expect(page.locator('[data-testid="profile-switcher"]')).not.toBeVisible();
    
    // The top bar should still be visible but without profile controls
    await expect(page.locator('header')).toBeVisible();
    
    // Should show logout button instead
    await expect(page.locator('[aria-label="Logout"]')).toBeVisible();
  });

  test('should logout and show login modal', async ({ page }) => {
    // Set auth cookie to skip login
    await page.context().addCookies([{
      name: 'agentapi-auth',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict'
    }]);
    
    // Mock logout endpoint
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'set-cookie': 'agentapi-auth=; Path=/; Max-Age=0'
        },
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.goto('/');
    
    // Click logout button
    await page.locator('[aria-label="Logout"]').click();
    
    // Should redirect with login required param
    await page.waitForURL('**/\\?login=required');
    
    // Should show login modal
    await expect(page.getByRole('heading', { name: /Enter API Key/i })).toBeVisible();
  });

  test('should send and receive messages when authenticated', async ({ page }) => {
    // Set auth cookie to skip login
    await page.context().addCookies([{
      name: 'agentapi-auth',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict'
    }]);
    
    await page.goto('/');
    
    // Wait for chat interface to load
    await page.waitForSelector('[aria-label="Message"]', { timeout: 10000 });
    
    // Send a message
    const messageInput = page.locator('[aria-label="Message"]');
    await messageInput.fill('Hello, test message');
    await page.locator('[aria-label="Send"]').click();
    
    // Check that message appears in chat
    await expect(page.getByText('Hello, test message')).toBeVisible();
    
    // Check for mock response
    await expect(page.getByText(/This is a mock response from the API/i)).toBeVisible();
  });
});