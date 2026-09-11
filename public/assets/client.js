import { state } from './state.js';

export async function api(path, method = 'GET', body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = {};
    if (method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, { method, headers, credentials: 'same-origin',
      signal: controller.signal, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
    let data;
    try { data = await response.json(); } catch { throw new Error('服务器响应异常，请稍后重试'); }
    if (!response.ok) {
      if (response.status === 401 && path !== '/api/admin/login') window.dispatchEvent(new Event('admin-expired'));
      const error = new Error(data.message || '保存失败，请稍后重试');
      error.fields = data.fields || {};
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('请求超时，请稍后重试');
    if (error instanceof TypeError) throw new Error('网络连接失败，请稍后重试');
    throw error;
  } finally { clearTimeout(timer); }
}
