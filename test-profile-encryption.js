const { chromium } = require('playwright');

async function testProfileEncryption() {
  console.log('Starting profile encryption test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // UIにアクセス
    console.log('Navigating to profiles page...');
    await page.goto('http://localhost:3000/profiles', { waitUntil: 'networkidle' });
    
    // 暗号化初期化の完了を待つ
    console.log('Waiting for secure storage initialization...');
    await page.waitForTimeout(10000);  // より長い時間を待機
    
    // 初期化完了を確認
    try {
      await page.waitForSelector('text=Initializing secure storage...', { state: 'hidden', timeout: 15000 });
      console.log('Secure storage initialization completed');
    } catch (e) {
      console.log('Still initializing or initialization message not found');
    }
    
    // ページタイトルを確認
    const title = await page.title();
    console.log('Page title:', title);
    
    // スクリーンショットを取得して状況確認
    await page.screenshot({ path: 'profile-page-debug.png' });
    console.log('Debug screenshot saved as profile-page-debug.png');
    
    // ページの内容をチェック
    const pageContent = await page.locator('body').textContent();
    console.log('Page text content preview:', pageContent.substring(0, 200));
    
    // LocalStorage をチェック
    const storageInfo = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      return {
        allKeys: keys,
        secureKeys: keys.filter(key => key.startsWith('agentapi-secure-profile-')),
        regularKeys: keys.filter(key => key.startsWith('agentapi-profile-'))
      };
    });
    
    console.log('LocalStorage status:');
    console.log('- All keys:', storageInfo.allKeys);
    console.log('- Secure profile keys:', storageInfo.secureKeys);
    console.log('- Regular profile keys:', storageInfo.regularKeys);
    
    return; // テストを早期終了して調査
    await page.waitForTimeout(1000);
    
    // プロファイル作成フォームに入力
    console.log('Filling profile form...');
    await page.fill('input[name="name"]', 'Test Encrypted Profile');
    await page.fill('textarea[name="description"]', 'This is a test profile for encryption');
    
    // API キーを入力（これが暗号化される必要がある）
    await page.fill('input[placeholder="Enter API key"]', 'test-api-key-12345');
    
    // 環境変数を追加
    await page.click('text=Add Variable');
    await page.fill('input[placeholder="Variable name"]', 'SECRET_TOKEN');
    await page.fill('input[placeholder="Variable value"]', 'secret-value-12345');
    
    // プロファイルを保存
    console.log('Saving profile...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // プロファイル一覧に戻ったか確認
    const currentUrl = page.url();
    console.log('Current URL after save:', currentUrl);
    
    // 作成されたプロファイルが表示されているか確認
    const profileCards = await page.locator('[data-testid="profile-card"], .profile-card, .grid > div').count();
    console.log('Number of profile cards:', profileCards);
    
    // ローカルストレージをチェックして暗号化されているか確認
    const finalStorageCheck = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      const secureKeys = keys.filter(key => key.startsWith('agentapi-secure-profile-'));
      const regularKeys = keys.filter(key => key.startsWith('agentapi-profile-') && !key.startsWith('agentapi-secure-profile-'));
      
      return {
        secureProfileKeys: secureKeys,
        regularProfileKeys: regularKeys,
        allKeys: keys
      };
    });
    
    console.log('LocalStorage analysis:');
    console.log('- Secure profile keys:', finalStorageCheck.secureProfileKeys.length);
    console.log('- Regular profile keys:', finalStorageCheck.regularProfileKeys.length);
    console.log('- All keys:', finalStorageCheck.allKeys);
    
    // スクリーンショットを取得
    await page.screenshot({ path: 'profile-test-screenshot.png' });
    console.log('Screenshot saved as profile-test-screenshot.png');
    
    console.log('Profile encryption test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'profile-test-error.png' });
  } finally {
    await browser.close();
  }
}

testProfileEncryption().catch(console.error);