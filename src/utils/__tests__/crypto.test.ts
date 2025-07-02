/**
 * Web Crypto API暗号化機能のテスト
 * 
 * Note: このテストはブラウザ環境でのみ動作します
 * Jest環境ではWeb Crypto APIやIndexedDBが利用できないため、
 * ブラウザコンソールでの手動テストが必要です
 */

import { encrypt, decrypt, encryptSensitiveFields, decryptSensitiveFields, shouldEncryptField } from '../crypto';

// ブラウザ環境でのみテストを実行
if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
  console.log('🔐 Testing Web Crypto API encryption...');

  // 基本的な暗号化・復号化テスト
  async function testBasicEncryption() {
    console.log('Testing basic encryption/decryption...');
    
    const testData = 'Hello, secure world!';
    
    try {
      const encrypted = await encrypt(testData);
      console.log('✅ Encryption successful:', encrypted);
      
      const decrypted = await decrypt(encrypted);
      console.log('✅ Decryption successful:', decrypted);
      
      if (testData === decrypted) {
        console.log('✅ Basic encryption test PASSED');
      } else {
        console.error('❌ Basic encryption test FAILED');
      }
    } catch (error) {
      console.error('❌ Basic encryption test FAILED:', error);
    }
  }

  // 機密フィールド暗号化テスト
  async function testSensitiveFieldsEncryption() {
    console.log('Testing sensitive fields encryption...');
    
    const testProfile = {
      id: 'test-profile',
      name: 'Test Profile',
      agentApiProxy: {
        apiKey: 'secret-api-key-12345',
        endpoint: 'https://example.com',
        enabled: true,
        timeout: 30000
      },
      environmentVariables: [
        { key: 'PUBLIC_VAR', value: 'public-value', description: 'Public variable' },
        { key: 'SECRET_VAR', value: 'secret-value-67890', description: 'Secret variable' }
      ],
      githubAuth: {
        accessToken: 'github-access-token-abc123',
        refreshToken: 'github-refresh-token-def456',
        tokenExpiresAt: '2024-12-31T23:59:59Z'
      }
    };
    
    try {
      const encrypted = await encryptSensitiveFields(testProfile);
      console.log('✅ Sensitive fields encryption successful:', encrypted);
      
      const decrypted = await decryptSensitiveFields(encrypted);
      console.log('✅ Sensitive fields decryption successful:', decrypted);
      
      // 機密フィールドが正しく復号化されているかチェック
      if (
        decrypted.agentApiProxy.apiKey === testProfile.agentApiProxy.apiKey &&
        decrypted.githubAuth.accessToken === testProfile.githubAuth.accessToken &&
        decrypted.environmentVariables[1].value === testProfile.environmentVariables[1].value
      ) {
        console.log('✅ Sensitive fields encryption test PASSED');
      } else {
        console.error('❌ Sensitive fields encryption test FAILED');
      }
    } catch (error) {
      console.error('❌ Sensitive fields encryption test FAILED:', error);
    }
  }

  // フィールド判定テスト
  function testShouldEncryptField() {
    console.log('Testing field encryption detection...');
    
    const testCases = [
      { field: 'agentApiProxy.apiKey', expected: true },
      { field: 'githubAuth.accessToken', expected: true },
      { field: 'environmentVariables.0.value', expected: true },
      { field: 'name', expected: false },
      { field: 'agentApiProxy.endpoint', expected: false },
      { field: 'environmentVariables.0.key', expected: false }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const result = shouldEncryptField(testCase.field);
      if (result === testCase.expected) {
        console.log(`✅ ${testCase.field} -> ${result}`);
      } else {
        console.error(`❌ ${testCase.field} -> ${result}, expected ${testCase.expected}`);
        allPassed = false;
      }
    }
    
    if (allPassed) {
      console.log('✅ Field encryption detection test PASSED');
    } else {
      console.error('❌ Field encryption detection test FAILED');
    }
  }

  // すべてのテストを実行
  async function runAllTests() {
    console.log('🚀 Starting crypto tests...');
    
    testShouldEncryptField();
    await testBasicEncryption();
    await testSensitiveFieldsEncryption();
    
    console.log('🎉 All crypto tests completed!');
  }

  // テスト実行（ブラウザコンソールで手動実行用）
  (window as any).runCryptoTests = runAllTests;
  
  console.log('To run tests, execute: runCryptoTests()');
} else {
  console.log('⚠️ Crypto tests skipped - requires browser environment');
}

export {};