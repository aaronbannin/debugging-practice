import { randomUUID } from 'node:crypto';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

export function uuid(): string {
  return randomUUID();
}

export function shortId(prefix: string): string {
  const raw = randomUUID().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[parseInt(raw.slice(i * 2, i * 2 + 2), 16) % alphabet.length];
  }
  return `${prefix}_${out}`;
}
