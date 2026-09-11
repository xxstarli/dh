export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      ...(body instanceof FormData
        ? { body }
        : body !== undefined
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && data.code === "UNAUTHORIZED")
        window.dispatchEvent(new Event("admin-expired"));
      throw new ApiError(
        data.message || "操作失败，请稍后重试",
        response.status,
      );
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new Error("网络请求失败，请稍后重试");
  } finally {
    clearTimeout(timeout);
  }
}
