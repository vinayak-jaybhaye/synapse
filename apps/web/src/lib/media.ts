const S3_URL = process.env.NEXT_PUBLIC_S3_URL || "http://localhost:4566/synapse-bucket";

export function getMediaUrl(key?: string | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("http")) return key;
  return `${S3_URL}/${key}`;
}
