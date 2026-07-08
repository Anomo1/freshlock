export async function fetchSource(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "freshlock (+https://github.com/Anomo1/freshlock)" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
