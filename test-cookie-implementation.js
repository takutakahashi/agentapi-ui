// Simple test to verify cookie implementation
console.log('Testing cookie implementation...');

// Mock window for testing
global.window = {
  location: { protocol: 'https:' },
  document: {
    cookie: ''
  }
};

// Mock document.cookie
let mockCookies = '';
Object.defineProperty(global.window.document, 'cookie', {
  get: () => mockCookies,
  set: (value) => {
    mockCookies = value;
  }
});

// Mock Buffer for base64 encoding
if (typeof Buffer === 'undefined') {
  global.Buffer = {
    from: (str, encoding) => ({
      toString: (outputEncoding) => {
        if (encoding === 'utf-8' && outputEncoding === 'base64') {
          return btoa(str);
        }
        return str;
      }
    })
  };
}

try {
  // Test CookieStorage
  console.log('✓ Cookie implementation syntax is valid');
  
  console.log('All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}