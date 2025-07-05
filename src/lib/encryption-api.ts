import { getEncryptionService } from './encryption';

/**
 * Encryption API helper functions that follow the API specification
 * Format: (ハッシュ化したトークン).(base64エンコードしたデータ)
 */

/**
 * Encrypt data for the API endpoint
 * Creates raw data format and encrypts it
 */
export function encryptForAPI(data: string, apiTokenHash: string): string {
  const encryptionService = getEncryptionService();
  
  // Create raw data format: {hashedToken}.{base64EncodedData}
  const base64Data = Buffer.from(data, 'utf8').toString('base64');
  const rawData = `${apiTokenHash}.${base64Data}`;
  
  // Encrypt the raw data
  const encrypted = encryptionService.encrypt(rawData, apiTokenHash);
  
  // Decode base64 strings to buffers
  const ivBuffer = Buffer.from(encrypted.iv, 'base64');
  const encryptedDataBuffer = Buffer.from(encrypted.encryptedData, 'base64');
  
  // Combine IV and encrypted data (which includes auth tag)
  const combined = Buffer.concat([ivBuffer, encryptedDataBuffer]);
  
  // Return as single base64 string
  return combined.toString('base64');
}

/**
 * Decrypt data from the API endpoint
 * Extracts IV and encrypted data from a single base64 string and validates token hash
 */
export function decryptFromAPI(encryptedBase64: string, currentApiTokenHash: string): string {
  const encryptionService = getEncryptionService();
  
  // Decode the combined base64 string
  const combined = Buffer.from(encryptedBase64, 'base64');
  
  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  // Create encrypted data object for the encryption service
  const encryptedObject = {
    iv: iv.toString('base64'),
    encryptedData: encryptedData.toString('base64'),
    timestamp: Date.now(), // Will be checked by encryption service
    apiTokenHash: currentApiTokenHash
  };
  
  // Decrypt the raw data
  const decryptedRawData = encryptionService.decrypt(encryptedObject, currentApiTokenHash) as string;
  
  // Parse raw data format: {hashedToken}.{base64EncodedData}
  const parts = decryptedRawData.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid raw data format');
  }
  
  const [storedHashedToken, base64EncodedData] = parts;
  
  // Verify the API token hash matches
  if (storedHashedToken !== currentApiTokenHash) {
    throw new Error('API token hash mismatch');
  }
  
  // Decode the data
  const originalData = Buffer.from(base64EncodedData, 'base64').toString('utf8');
  
  // Return the original data
  return originalData;
}