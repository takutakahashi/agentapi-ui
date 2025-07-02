const { chromium } = require('playwright');

async function simpleTest() {
  console.log('Starting simple test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // ホームページへアクセス
    console.log('Navigating to home page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // スクリーンショット取得
    await page.screenshot({ path: 'home-page.png' });
    console.log('Home page screenshot saved');
    
    const title = await page.title();
    console.log('Page title:', title);
    
    // プロファイルページへ直接アクセス
    console.log('Trying to navigate to profiles via URL...');
    await page.goto('http://localhost:3000/profiles', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'profiles-direct.png' });
    console.log('Profiles page direct access screenshot saved');
    
    const profilesContent = await page.locator('body').textContent();
    console.log('Contains "Profiles":', profilesContent.includes('Profiles'));
    console.log('Contains "New Profile":', profilesContent.includes('New Profile'));
    console.log('Contains "Initializing":', profilesContent.includes('Initializing'));
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'simple-test-error.png' });
  } finally {
    await browser.close();
  }
}

simpleTest().catch(console.error);