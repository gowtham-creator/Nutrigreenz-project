/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
/*
 * VENDORED REFERENCE - do not edit below the marker.
 *
 * SBI's own `Crypto.ts` (AES-GCM helpers + callback decoder), copied verbatim
 * so the conformance tests can run against the bank's implementation as a
 * third party, independent of both the npm SDK bundle and our port. It is
 * test-only and never imported by application code.
 */
// ---- verbatim from SBI below ----
import * as crypto from 'crypto';

// Constants for GCM parameters
const GCM_IV_LENGTH = 16; // in bytes
const GCM_TAG_LENGTH = 128; // in bits

/**
 * Import a Base64-encoded AES key.
 * @param {string} base64Key - The Base64-encoded AES key.
 * @returns {Promise<any>} - The imported AES key.
 */
async function importKey(base64Key: string): Promise<any> {
  const keyBuffer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw", // Key format
    keyBuffer,
    {
      name: "AES-GCM",
    },
    false, // Non-extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a value using AES-GCM.
 * @param {string} key - The key for encryption.
 * @param {any} value - The plaintext value to encrypt.
 * @returns {Promise<string>} - Base64 encoded ciphertext with IV prepended.
 */
export async function encrypt(key: string, value: any): Promise<string> {
  // Generate random IV
  // const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
  // const iv = new Uint8Array(GCM_IV_LENGTH);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH)); // Random initialized IV of length 16
  const aesKey = await importKey(key)
  // Encrypt the plaintext
  console.log("encrypt aes");
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: GCM_TAG_LENGTH
    },
    aesKey,
    new TextEncoder().encode(value)
  );

  // Combine IV and encrypted value
  const encryptedArray = new Uint8Array(iv.length + encrypted.byteLength);
  encryptedArray.set(iv);
  encryptedArray.set(new Uint8Array(encrypted), iv.length);

  // Encode to Base64 and return
  console.log("encrypt aes return");
  return btoa(String.fromCharCode(...encryptedArray));
}

/**
 * Decrypt a value using AES-GCM.
 * @param {string} key - The key used for AES-GSM decryption.
 * @param {string} encryptedBase64 - Base64 encoded ciphertext with IV prepended.
 * @returns {Promise<any>} - The decrypted plaintext value.
 */
export async function decrypt(key: string, encryptedBase64: string): Promise<any> {
  // Decode Base64
  const encryptedArray = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = encryptedArray.slice(0, GCM_IV_LENGTH);
  const aesKey = await importKey(key)
  const ciphertext = encryptedArray.slice(GCM_IV_LENGTH);

  // Decrypt the ciphertext
  /* Fortify SCA Suppress: PrivacyViolation */
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: GCM_TAG_LENGTH
    },
    aesKey,
    ciphertext
  );
  /* End Fortify SCA Suppress */

  // Decode plaintext and return
  return new TextDecoder().decode(decrypted);
}

/**
     * Decode payload.
     * @param {any} payload - The data for decoding.
     * @returns {Promise<any>} A promise that resolves to the decoded payload.
     */
export async function decodeCallback(payload: any, encryptionKey: string): Promise<any> {
  let uriBase64decoded = payload.replace(/-/g, '+').replace(/_/g, '/');

  while (uriBase64decoded.length % 4) {
      uriBase64decoded += '=';
  }

  uriBase64decoded = atob(uriBase64decoded).replace(/\"/g,'');
  let decryptedPayload = await decrypt(encryptionKey, uriBase64decoded);

  return JSON.parse(decryptedPayload);
}
