import { api } from './api';
import { canonicalStringify } from './canonical';
import type { Attestation } from './types';

let cachedKey: CryptoKey | null | undefined;

// Return real ArrayBuffers — SubtleCrypto's BufferSource params don't accept the generic
// Uint8Array<ArrayBufferLike> that TS 5.x produces, so we hand over plain ArrayBuffers.
function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function toBuffer(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

async function importPublicKey(): Promise<CryptoKey | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const pk = await api.getPubkey();
    cachedKey = await crypto.subtle.importKey('spki', b64ToBuffer(pk.publicKeyDerB64), { name: 'Ed25519' }, false, [
      'verify',
    ]);
  } catch {
    cachedKey = null; // browser lacks Ed25519 SubtleCrypto (or fetch failed) — use server fallback
  }
  return cachedKey;
}

// Verify a decision attestation. Prefers trustless client-side Ed25519 (Web Crypto); falls back to
// the server's /policy/verify if the browser can't do Ed25519.
export async function verifyAttestation(att: Attestation): Promise<boolean> {
  try {
    const key = await importPublicKey();
    if (key) {
      const data = toBuffer(new TextEncoder().encode(canonicalStringify(att.signed)));
      return await crypto.subtle.verify({ name: 'Ed25519' }, key, b64ToBuffer(att.signature), data);
    }
  } catch {
    /* fall through to server verifier */
  }
  try {
    return await api.verifyAttestationOnServer(att);
  } catch {
    return false;
  }
}
