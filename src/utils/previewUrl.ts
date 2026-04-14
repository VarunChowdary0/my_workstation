export function getPreviewUrl(port: number | string): string {
  if (typeof window === "undefined") return `http://localhost:${port}/`;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://localhost:${port}/`;
  }
  return `${origin}/preview/${port}/`;
}
