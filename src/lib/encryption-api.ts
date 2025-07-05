import { getEncryptionService } from './encryption';

/**
 * Encryption API helper functions that follow the API specification
 */

export interface EncryptionMetadata {
  timestamp: number;
  apiTokenHash: string;
}

/**
 * Encrypt data for the API endpoint
 * Combines IV, encrypted data, and metadata into a single base64 string
 */
export function encryptForAPI(data: string, apiTokenHash: string): string {
  const encryptionService = getEncryptionService();
  
  // Create metadata
  const metadata: EncryptionMetadata = {
    timestamp: Date.now(),
    apiTokenHash
  };
  
  // Combine original data with metadata
  const payload = {
    data,
    metadata
  };
  
  // Encrypt the payload
  const encrypted = encryptionService.encrypt(payload, apiTokenHash);
  
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
 * Extracts IV and encrypted data from a single base64 string
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
    timestamp: Date.now(), // This will be overridden by the actual timestamp from metadata
    apiTokenHash: currentApiTokenHash // This will be verified from metadata
  };
  
  // Decrypt the payload
  const decrypted = encryptionService.decrypt(encryptedObject, currentApiTokenHash) as {
    data: string;
    metadata: EncryptionMetadata;
  };
  
  // Verify the API token hash from metadata
  if (decrypted.metadata.apiTokenHash !== currentApiTokenHash) {
    throw new Error('API token hash mismatch');
  }
  
  // Check timestamp
  const timeout = process.env.ENCRYPTION_TIMEOUT ? parseInt(process.env.ENCRYPTION_TIMEOUT) * 1000 : null;
  if (timeout && Date.now() - decrypted.metadata.timestamp > timeout) {
    throw new Error('Encrypted data has expired');
  }
  
  // Return the original data
  return decrypted.data;
}