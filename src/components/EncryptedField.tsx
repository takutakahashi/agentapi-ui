'use client';

import React, { useState, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import { getEncryptionManager } from '../lib/encryption';

interface EncryptedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  proxyEndpoint: string;
  autoEncrypt?: boolean;
  required?: boolean;
  className?: string;
}

export default function EncryptedField({
  label,
  value,
  onChange,
  placeholder,
  description,
  proxyEndpoint,
  autoEncrypt = true,
  required = false,
  className = ''
}: EncryptedFieldProps) {
  const [showValue, setShowValue] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Check if encryption is available
    const checkEncryption = async () => {
      try {
        const encryption = getEncryptionManager(proxyEndpoint);
        const available = await encryption.isEnabled();
        setEncryptionAvailable(available);
      } catch (error) {
        console.debug('Encryption not available:', error);
        setEncryptionAvailable(false);
      }
    };

    checkEncryption();
  }, [proxyEndpoint]);

  useEffect(() => {
    // Check if the current value is encrypted
    const encryption = getEncryptionManager(proxyEndpoint);
    const encrypted = encryption.isEncrypted(value);
    setIsEncrypted(encrypted);

    if (encrypted && !showValue) {
      setDisplayValue('••••••••••••••••');
    } else {
      setDisplayValue(value);
    }
  }, [value, showValue, proxyEndpoint]);

  const handleEncrypt = async () => {
    if (!value || isEncrypted) return;

    setIsEncrypting(true);
    try {
      const encryption = getEncryptionManager(proxyEndpoint);
      const encryptedValue = await encryption.encryptValue(value);
      onChange(encryptedValue);
    } catch (error) {
      console.error('Failed to encrypt value:', error);
      alert('Failed to encrypt value. Please try again.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // Note: Decryption is handled server-side, so this function is not used client-side
  // const handleDecrypt = async () => {
  //   if (!isEncrypted) return;
  //   try {
  //     const encryption = getEncryptionManager(proxyEndpoint);
  //     const decryptedValue = await encryption.decryptValue(value);
  //     onChange(decryptedValue);
  //   } catch (error) {
  //     console.error('Failed to decrypt value:', error);
  //     alert('Failed to decrypt value. This is expected as decryption happens server-side.');
  //   }
  // };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Auto-encrypt when user stops typing (if enabled and encryption is available)
    if (autoEncrypt && encryptionAvailable && newValue && !isEncrypted) {
      const timeoutId = setTimeout(() => {
        handleEncrypt();
      }, 2000); // Auto-encrypt after 2 seconds of no typing

      return () => clearTimeout(timeoutId);
    }
  };

  const toggleVisibility = () => {
    setShowValue(!showValue);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="flex items-center space-x-2">
          {encryptionAvailable && (
            <div className="flex items-center space-x-1">
              {isEncrypted ? (
                <LockClosedIcon className="h-4 w-4 text-green-500" title="Encrypted" />
              ) : (
                <LockOpenIcon className="h-4 w-4 text-yellow-500" title="Not encrypted" />
              )}
              <span className="text-xs text-gray-500">
                {isEncrypted ? 'Encrypted' : 'Plain text'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          type={showValue ? 'text' : 'password'}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-3">
          <button
            type="button"
            onClick={toggleVisibility}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={showValue ? 'Hide value' : 'Show value'}
          >
            {showValue ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>

          {encryptionAvailable && !isEncrypted && value && (
            <button
              type="button"
              onClick={handleEncrypt}
              disabled={isEncrypting}
              className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
              title="Encrypt value"
            >
              {isEncrypting ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <LockClosedIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}

      {!encryptionAvailable && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ Server-side encryption is not available. Values will be stored in plain text.
        </p>
      )}

      {isEncrypted && (
        <p className="text-sm text-green-600 dark:text-green-400">
          🔒 This value is encrypted and will be decrypted server-side when used.
        </p>
      )}
    </div>
  );
}