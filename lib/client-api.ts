export async function api<T>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("网络连接失败，内容已保留，请检查连接后重试。");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error || "服务暂时不可用，请稍后重试。");
  return data as T;
}
