import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStringify } from '@armoriq/audit';
import type { Decision, ToolCallProposal } from '@armoriq/shared';

// ArmorIQ's thesis is enforcement "cryptographically at the intent layer". So every policy verdict is
// signed: the attestation binds the agent's INTENT (which tool + args) to the policy VERDICT and the
// SIGNER. The policy-engine stays pure — signing happens here, in the server, after evaluate().

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const keyPath = resolve(repoRoot, 'policy-key.json');

// The exact, self-describing fields that get signed — a verifier reconstructs the bytes from these.
export interface SignedDecision {
  proposalId: string;
  conversationId: string;
  toolName: string;
  argsHash: string; // sha256 of the canonical tool args (binds inputs without signing huge blobs)
  status: Decision['status'];
  reason: string;
  matchedRuleId?: string;
}

export interface Attestation {
  alg: 'ed25519';
  keyId: string;
  signature: string; // base64
  signedAt: string; // ISO 8601
  signed: SignedDecision;
}

function loadOrCreateKeys(): { privateKey: KeyObject; publicKey: KeyObject } {
  if (existsSync(keyPath)) {
    const { privateKeyPem, publicKeyPem } = JSON.parse(readFileSync(keyPath, 'utf8'));
    return { privateKey: createPrivateKey(privateKeyPem), publicKey: createPublicKey(publicKeyPem) };
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  writeFileSync(keyPath, JSON.stringify({ privateKeyPem, publicKeyPem }, null, 2));
  return { privateKey, publicKey };
}

const { privateKey, publicKey } = loadOrCreateKeys();
const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
const keyId = createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 16);

function material(signed: SignedDecision): Buffer {
  // Same canonical serializer as the hash chain → order-independent, deterministic.
  return Buffer.from(canonicalStringify(signed), 'utf8');
}

export function attestDecision(proposal: ToolCallProposal, decision: Decision): Attestation {
  const signed: SignedDecision = {
    proposalId: proposal.id,
    conversationId: proposal.conversationId,
    toolName: proposal.toolName,
    argsHash: createHash('sha256').update(canonicalStringify(proposal.args ?? {})).digest('hex'),
    status: decision.status,
    reason: decision.reason,
    matchedRuleId: decision.matchedRuleId,
  };
  // Ed25519 uses a null digest algorithm.
  const signature = cryptoSign(null, material(signed), privateKey).toString('base64');
  return { alg: 'ed25519', keyId, signature, signedAt: new Date().toISOString(), signed };
}

export function verifyAttestation(att: Attestation): boolean {
  if (att.alg !== 'ed25519' || att.keyId !== keyId) return false;
  try {
    return cryptoVerify(null, material(att.signed), publicKey, Buffer.from(att.signature, 'base64'));
  } catch {
    return false;
  }
}

export function publicKeyInfo(): { alg: 'ed25519'; keyId: string; publicKeyPem: string; publicKeyDerB64: string } {
  return {
    alg: 'ed25519',
    keyId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    publicKeyDerB64: publicKeyDer.toString('base64'),
  };
}
