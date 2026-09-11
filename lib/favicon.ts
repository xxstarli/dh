import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { normalizeUrl } from "./validation";
import { MAX_ICON, storeImage } from "./storage";
export function isPublicAddress(address: string) {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export async function safeDownload(
  raw: string,
  deadline = Date.now() + 6000,
  redirects = 0,
): Promise<{ body: Buffer; type: string; url: string }> {
  const url = new URL(normalizeUrl(raw)),
    host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("port");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
    throw new Error("private host");
  if (redirects > 3 || Date.now() >= deadline) throw new Error("limit");
  let timer: NodeJS.Timeout | undefined;
  const addresses = await Promise.race([
    dns.lookup(host, { all: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("dns timeout")),
        Math.max(1, deadline - Date.now()),
      );
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("private address");
  const selected = addresses[0];
  // Pin the validated IP for the TCP connection: DNS rebinding cannot change it.
  const response = await new Promise<{
    body: Buffer;
    type: string;
    location?: string;
    status: number;
  }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "PersonalNavigation/1.0",
          Accept: "text/html,image/*",
          "Accept-Encoding": "identity",
        },
        lookup: ((
          _host: unknown,
          options: unknown,
          callback: (...args: unknown[]) => void,
        ) => {
          if ((options as { all?: boolean })?.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        }) as never,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
          res.resume();
          resolve({
            body: Buffer.alloc(0),
            type: "",
            location: res.headers.location,
            status: res.statusCode!,
          });
          return;
        }
        if (
          res.statusCode !== 200 ||
          Number(res.headers["content-length"]) > MAX_ICON
        ) {
          res.destroy();
          reject(new Error("response"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_ICON) {
            res.destroy(new Error("too large"));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            body: Buffer.concat(chunks),
            type: res.headers["content-type"] || "",
            status: 200,
          }),
        );
      },
    );
    const timeout = setTimeout(
      () => request.destroy(new Error("timeout")),
      Math.max(1, deadline - Date.now()),
    );
    request.on("error", reject);
    request.on("close", () => clearTimeout(timeout));
    request.end();
  });
  if (response.location)
    return safeDownload(
      new URL(response.location, url).href,
      deadline,
      redirects + 1,
    );
  if (response.status !== 200) throw new Error("redirect");
  return { ...response, url: url.href };
}
function icoPng(body: Buffer): Buffer {
  if (
    body.length < 6 ||
    body.readUInt16LE(0) !== 0 ||
    body.readUInt16LE(2) !== 1
  )
    return body;
  const count = Math.min(body.readUInt16LE(4), 64);
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > body.length) break;
    const size = body.readUInt32LE(entry + 8),
      offset = body.readUInt32LE(entry + 12);
    if (
      offset + size <= body.length &&
      body
        .subarray(offset, offset + 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return body.subarray(offset, offset + size);
  }
  throw new Error("unsupported ico");
}
export async function fetchFavicon(raw: string): Promise<string | null> {
  const deadline = Date.now() + 6000;
  try {
    const url = normalizeUrl(raw),
      candidates: string[] = [];
    try {
      const page = await safeDownload(url, deadline);
      if (page.type.startsWith("image/"))
        return await storeImage(icoPng(page.body));
      const html = page.body.toString("utf8");
      for (const tag of html.match(/<link\b[^>]{0,2048}>/gi) || []) {
        const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (rel && /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(rel) && href)
          candidates.push(
            new URL(href.replaceAll("&amp;", "&"), page.url).href,
          );
      }
    } catch {
      /* Root page failure still permits conventional favicon fallback. */
    }
    candidates.push(new URL("/favicon.ico", url).href);
    for (const candidate of [...new Set(candidates)].slice(0, 5)) {
      if (Date.now() >= deadline) break;
      try {
        const icon = await safeDownload(candidate, deadline);
        return await storeImage(icoPng(icon.body));
      } catch {
        /* Try next bounded candidate. */
      }
    }
  } catch {
    /* Auxiliary request never blocks saving. */
  }
  return null;
}
