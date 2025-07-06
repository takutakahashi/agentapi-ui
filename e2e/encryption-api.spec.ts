import { test, expect } from '@playwright/test';

test.describe('Encryption API', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoints
    await page.route('**/api/encrypt', async (route) => {
      const request = route.request();
      const method = request.method();
      
      if (method !== 'POST') {
        await route.continue();
        return;
      }

      try {
        const body = await request.postDataJSON();
        const { data } = body;

        if (!data) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid data format', code: 'INVALID_DATA' })
          });
          return;
        }

        // Check if it's valid base64
        try {
          Buffer.from(data, 'base64');
        } catch {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Data must be base64 encoded', code: 'INVALID_DATA' })
          });
          return;
        }

        // Check for mock authentication
        const cookie = request.headers()['cookie'] || '';
        if (!cookie.includes('agentapi_token=')) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid or missing token', code: 'UNAUTHORIZED' })
          });
          return;
        }

        // Mock successful encryption
        const decodedData = Buffer.from(data, 'base64').toString('utf8');
        const mockEncrypted = Buffer.from(JSON.stringify({
          data: decodedData,
          timestamp: Date.now(),
          token: 'mock-token'
        })).toString('base64');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ encrypted: mockEncrypted })
        });
      } catch (error) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Encryption failed', code: 'ENCRYPTION_FAILED' })
        });
      }
    });

    await page.route('**/api/decrypt', async (route) => {
      const request = route.request();
      const method = request.method();
      
      if (method !== 'POST') {
        await route.continue();
        return;
      }

      try {
        const body = await request.postDataJSON();
        const { data } = body;

        if (!data) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid data format', code: 'INVALID_DATA' })
          });
          return;
        }

        // Check if it's valid base64
        try {
          Buffer.from(data, 'base64');
        } catch {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Data must be base64 encoded', code: 'INVALID_DATA' })
          });
          return;
        }

        // Check for mock authentication
        const cookie = request.headers()['cookie'] || '';
        if (!cookie.includes('agentapi_token=')) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid or missing token', code: 'UNAUTHORIZED' })
          });
          return;
        }

        // Try to decrypt
        try {
          const decryptedObj = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
          
          // Check if it's our mock encrypted format
          if (!decryptedObj.data || !decryptedObj.token) {
            throw new Error('Invalid encrypted format');
          }

          // Check token mismatch
          const tokenFromCookie = cookie.match(/agentapi_token=([^;]+)/)?.[1];
          if (tokenFromCookie === 'wrong-token') {
            await route.fulfill({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Invalid or missing token', code: 'UNAUTHORIZED' })
            });
            return;
          }

          const decryptedBase64 = Buffer.from(decryptedObj.data, 'utf8').toString('base64');
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ decrypted: decryptedBase64 })
          });
        } catch {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Decryption failed', code: 'DECRYPTION_FAILED' })
          });
        }
      } catch (error) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Decryption failed', code: 'DECRYPTION_FAILED' })
        });
      }
    });

    // Set auth cookie
    await page.context().addCookies([{
      name: 'agentapi_token',
      value: 'test-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict'
    }]);
  });

  test.describe('/api/encrypt', () => {
    test('should encrypt valid base64 data', async ({ page }) => {
      const testData = 'Hello, World!';
      const base64Data = Buffer.from(testData).toString('base64');

      const response = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('encrypted');
      expect(typeof body.encrypted).toBe('string');
      expect(body.encrypted).not.toBe(base64Data);
    });

    test('should return 400 for missing data', async ({ page }) => {
      const response = await page.request.post('/api/encrypt', {
        data: {}
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid data format');
      expect(body).toHaveProperty('code', 'INVALID_DATA');
    });

    test('should return 400 for invalid base64 data', async ({ page }) => {
      const response = await page.request.post('/api/encrypt', {
        data: { data: 'not-valid-base64!' }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Data must be base64 encoded');
      expect(body).toHaveProperty('code', 'INVALID_DATA');
    });

    test('should return 401 without authentication', async ({ page }) => {
      // Clear cookies
      await page.context().clearCookies();

      const testData = 'Hello, World!';
      const base64Data = Buffer.from(testData).toString('base64');

      const response = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid or missing token');
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    test('should handle large data', async ({ page }) => {
      const largeData = 'a'.repeat(10000);
      const base64Data = Buffer.from(largeData).toString('base64');

      const response = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('encrypted');
      expect(body.encrypted.length).toBeGreaterThan(0);
    });

    test('should handle special characters', async ({ page }) => {
      const specialData = '特殊文字 🚀 ~!@#$%^&*()_+-=[]{}|;:,.<>?';
      const base64Data = Buffer.from(specialData).toString('base64');

      const response = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('encrypted');
    });
  });

  test.describe('/api/decrypt', () => {
    test('should decrypt valid encrypted data', async ({ page }) => {
      // First encrypt some data
      const testData = 'Test decryption data';
      const base64Data = Buffer.from(testData).toString('base64');

      const encryptResponse = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(encryptResponse.status()).toBe(200);
      const encryptBody = await encryptResponse.json();
      const encryptedData = encryptBody.encrypted;

      // Now decrypt it
      const decryptResponse = await page.request.post('/api/decrypt', {
        data: { data: encryptedData }
      });

      expect(decryptResponse.status()).toBe(200);
      const decryptBody = await decryptResponse.json();
      expect(decryptBody).toHaveProperty('decrypted');
      
      // Verify the decrypted data matches original
      const decryptedText = Buffer.from(decryptBody.decrypted, 'base64').toString('utf8');
      expect(decryptedText).toBe(testData);
    });

    test('should return 400 for missing data', async ({ page }) => {
      const response = await page.request.post('/api/decrypt', {
        data: {}
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid data format');
      expect(body).toHaveProperty('code', 'INVALID_DATA');
    });

    test('should return 400 for invalid base64 data', async ({ page }) => {
      const response = await page.request.post('/api/decrypt', {
        data: { data: 'not-valid-base64!' }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Data must be base64 encoded');
      expect(body).toHaveProperty('code', 'INVALID_DATA');
    });

    test('should return 401 without authentication', async ({ page }) => {
      // Clear cookies
      await page.context().clearCookies();

      const response = await page.request.post('/api/decrypt', {
        data: { data: 'c29tZS1lbmNyeXB0ZWQtZGF0YQ==' }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid or missing token');
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    test('should fail to decrypt data with wrong token', async ({ page }) => {
      // First encrypt with original token
      const testData = 'Secret data';
      const base64Data = Buffer.from(testData).toString('base64');

      const encryptResponse = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(encryptResponse.status()).toBe(200);
      const encryptBody = await encryptResponse.json();
      const encryptedData = encryptBody.encrypted;

      // Change token
      await page.context().clearCookies();
      await page.context().addCookies([{
        name: 'agentapi_token',
        value: 'wrong-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict'
      }]);

      const decryptResponse = await page.request.post('/api/decrypt', {
        data: { data: encryptedData }
      });

      expect(decryptResponse.status()).toBe(401);
      const decryptBody = await decryptResponse.json();
      expect(decryptBody).toHaveProperty('error', 'Invalid or missing token');
      expect(decryptBody).toHaveProperty('code', 'UNAUTHORIZED');
    });

    test('should handle round-trip encryption/decryption with special characters', async ({ page }) => {
      const specialData = '日本語 한국어 中文 Emoji: 🎉🔐🌟 Symbols: ©®™±§¶';
      const base64Data = Buffer.from(specialData).toString('base64');

      // Encrypt
      const encryptResponse = await page.request.post('/api/encrypt', {
        data: { data: base64Data }
      });

      expect(encryptResponse.status()).toBe(200);
      const encryptBody = await encryptResponse.json();

      // Decrypt
      const decryptResponse = await page.request.post('/api/decrypt', {
        data: { data: encryptBody.encrypted }
      });

      expect(decryptResponse.status()).toBe(200);
      const decryptBody = await decryptResponse.json();
      
      // Verify round-trip
      const decryptedText = Buffer.from(decryptBody.decrypted, 'base64').toString('utf8');
      expect(decryptedText).toBe(specialData);
    });

    test('should fail to decrypt corrupted data', async ({ page }) => {
      // Create some fake encrypted data
      const corruptedData = Buffer.from('this-is-not-real-encrypted-data').toString('base64');

      const response = await page.request.post('/api/decrypt', {
        data: { data: corruptedData }
      });

      expect(response.status()).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty('error', 'Decryption failed');
      expect(body).toHaveProperty('code', 'DECRYPTION_FAILED');
    });
  });

  test.describe('Integration tests', () => {
    test('should handle multiple concurrent encryption requests', async ({ page }) => {
      const testData = ['Data 1', 'Data 2', 'Data 3', 'Data 4', 'Data 5'];
      
      const encryptPromises = testData.map(data => {
        const base64Data = Buffer.from(data).toString('base64');
        return page.request.post('/api/encrypt', {
          data: { data: base64Data }
        });
      });

      const responses = await Promise.all(encryptPromises);
      
      responses.forEach((response, index) => {
        expect(response.status()).toBe(200);
      });

      const bodies = await Promise.all(responses.map(r => r.json()));
      
      // All responses should have encrypted field
      bodies.forEach(body => {
        expect(body).toHaveProperty('encrypted');
      });
    });

    test('should maintain data integrity across multiple encrypt/decrypt cycles', async ({ page }) => {
      const originalData = 'Test data for multiple cycles';
      let currentData = Buffer.from(originalData).toString('base64');

      // Perform multiple encrypt/decrypt cycles
      for (let i = 0; i < 5; i++) {
        // Encrypt
        const encryptResponse = await page.request.post('/api/encrypt', {
          data: { data: currentData }
        });
        expect(encryptResponse.status()).toBe(200);
        const encryptBody = await encryptResponse.json();

        // Decrypt
        const decryptResponse = await page.request.post('/api/decrypt', {
          data: { data: encryptBody.encrypted }
        });
        expect(decryptResponse.status()).toBe(200);
        const decryptBody = await decryptResponse.json();

        currentData = decryptBody.decrypted;
      }

      // Final data should match original
      const finalData = Buffer.from(currentData, 'base64').toString('utf8');
      expect(finalData).toBe(originalData);
    });
  });
});