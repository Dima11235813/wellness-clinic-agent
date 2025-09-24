import { createHash } from 'crypto';

/**
 * Generate SHA256 hash of input string or buffer
 */
export function sha256(input: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(typeof input === 'string' ? Buffer.from(input, 'utf8') : input);
  return hash.digest('hex');
}

/**
 * Generate SHA256 hash of file content
 */
export async function hashFile(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath);
  return sha256(content);
}
