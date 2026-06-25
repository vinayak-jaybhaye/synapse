export function getMediaUrl(key?: string | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith('http')) return key;
  return `http://localhost:4566/synapse-bucket/${key}`;
}
