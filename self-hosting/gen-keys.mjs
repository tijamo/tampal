#!/usr/bin/env node
/*
 * Generates the Supabase ANON_KEY and SERVICE_ROLE_KEY (HS256 JWTs) from a JWT
 * secret, plus a fresh random secret if you don't pass one.
 *
 *   node gen-keys.mjs                # prints a new JWT secret + both keys
 *   node gen-keys.mjs "<jwt-secret>" # derives the keys from an existing secret
 *
 * Paste the output into ./.env. The keys are long-lived (10 years); rotating the
 * JWT secret invalidates them and all existing sessions.
 */
import { createHmac, randomBytes } from 'node:crypto';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const secret = process.argv[2] || randomBytes(32).toString('hex');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 years

const anon = sign({ role: 'anon', iss: 'supabase', iat, exp }, secret);
const service = sign({ role: 'service_role', iss: 'supabase', iat, exp }, secret);

console.log('# --- copy into self-hosting/.env ---');
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${anon}`);
console.log(`SERVICE_ROLE_KEY=${service}`);
console.log('#');
console.log('# And into the app (.env.local):');
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${service}`);
