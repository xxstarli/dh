import { test, before, after, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import dns from "node:dns/promises";
import http from "node:http";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { MAX_ICON, readIcon, storeImage } from "../lib/storage";
import { fetchFavicon, safeDownload } from "../lib/favicon";
import { GET } from "../app/api/icons/[filename]/route";

let folder: string;
const fixtures = new Map<string, Buffer>();
before(async () => {
  folder = await mkdtemp(path.join(os.tmpdir(), "navigation-icons-"));
  process.env.UPLOAD_DIR = folder;
  for (const format of ["png", "jpeg", "webp"] as const) {
    fixtures.set(
      format,
      await sharp({
        create: { width: 512, height: 384, channels: 4, background: "#3285ff" },
      })
        .toFormat(format)
        .toBuffer(),
    );
  }
});
after(async () => {
  await rm(folder, { recursive: true, force: true });
});

test("portable image backend really loads WASM and no native libvips", () => {
  const require = createRequire(import.meta.url);
  const binding = require(
    path.join(path.dirname(require.resolve("sharp")), "sharp.cjs"),
  );
  assert.equal(binding.libvipsVersion().isWasm, true);
  assert.ok("emscripten" in sharp.versions);
  const shared = process.report.getReport() as { sharedObjects: string[] };
  assert.equal(
    shared.sharedObjects.some((name) => /sharp|libvips/i.test(name)),
    false,
  );
});

for (const format of ["png", "jpeg", "webp"]) {
  test(`${format} upload decodes, resizes, hashes and rereads WebP`, async () => {
    const input = fixtures.get(format)!;
    const url = await storeImage(input, "image/" + format);
    assert.match(url, /^\/api\/icons\/[a-f0-9]{64}\.webp$/);
    const bytes = await readIcon(path.basename(url));
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 192);
    assert.equal(await storeImage(input, "image/" + format), url);
    const response = await GET(new Request("http://localhost" + url), {
      params: Promise.resolve({ filename: path.basename(url) }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  });
}

test("invalid images, MIME spoofing, empty, oversized and broken streams are rejected", async () => {
  const invalid: [Buffer, string][] = [
    [Buffer.from("renamed text file"), "image/png"],
    [Buffer.from("<html><script>alert(1)</script></html>"), "image/jpeg"],
    [fixtures.get("png")!, "image/jpeg"],
    [fixtures.get("jpeg")!, "image/webp"],
    [fixtures.get("webp")!, "image/png"],
    [fixtures.get("png")!, "text/plain"],
    [Buffer.alloc(0), "image/png"],
    [fixtures.get("png")!.subarray(0, 40), "image/png"],
    [fixtures.get("jpeg")!.subarray(0, 50), "image/jpeg"],
    [fixtures.get("webp")!.subarray(0, 20), "image/webp"],
  ];
  for (const [bytes, mime] of invalid) {
    await assert.rejects(storeImage(bytes, mime), {
      code: "INVALID_FILE_TYPE",
    });
  }
  await assert.rejects(storeImage(Buffer.alloc(MAX_ICON + 1), "image/png"), {
    code: "UPLOAD_TOO_LARGE",
  });
  const bomb = await sharp({
    create: { width: 4001, height: 4000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(storeImage(bomb, "image/png"), {
    code: "INVALID_FILE_TYPE",
  });
});

test("legacy V1 WebP URLs remain readable and paths remain confined", async () => {
  const filename = "a".repeat(64) + ".webp";
  await mkdir(folder, { recursive: true });
  const oldBytes = fixtures.get("webp")!;
  await writeFile(path.join(folder, filename), oldBytes);
  const response = await GET(
    new Request("http://localhost/api/icons/" + filename),
    { params: Promise.resolve({ filename }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), oldBytes);
  for (const name of [
    "../.env",
    "A".repeat(64) + ".webp",
    "a.webp",
    "a".repeat(64) + ".svg",
    filename + "/..",
    "%2e%2e%2f.env",
  ]) {
    await assert.rejects(readIcon(name), { code: "NOT_FOUND" });
  }
});

type Reply = {
  status?: number;
  type?: string;
  body?: Buffer;
  location?: string;
  length?: number;
  hang?: boolean;
};
function network(
  t: TestContext,
  route: (url: URL) => Reply,
  privateDns = false,
) {
  const requested: string[] = [];
  t.mock.method(dns, "lookup", async () => [
    { address: privateDns ? "127.0.0.1" : "93.184.216.34", family: 4 },
  ]);
  t.mock.method(
    http,
    "request",
    (
      raw: URL,
      options: http.RequestOptions,
      callback: (res: http.IncomingMessage) => void,
    ) => {
      requested.push(raw.href);
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error?: Error) => void;
      };
      let closed = false;
      req.destroy = (error) => {
        if (!closed) {
          closed = true;
          if (error) req.emit("error", error);
          req.emit("close");
        }
      };
      req.end = () => {
        queueMicrotask(() => {
          // Verify the request connects to the already-validated address, without a second DNS resolution.
          (
            options.lookup as unknown as (
              host: string,
              options: object,
              cb: (err: null, result: { address: string }[]) => void,
            ) => void
          )(raw.hostname, { all: true }, (err, result) => {
            assert.equal(err, null);
            assert.equal(result[0].address, "93.184.216.34");
          });
          const reply = route(raw);
          if (reply.hang) return;
          const res = new PassThrough() as PassThrough & {
            statusCode: number;
            headers: Record<string, string>;
          };
          res.statusCode = reply.status ?? 200;
          res.headers = { "content-type": reply.type ?? "image/png" };
          if (reply.location) res.headers.location = reply.location;
          if (reply.length !== undefined)
            res.headers["content-length"] = String(reply.length);
          res.on("close", () => req.destroy());
          callback(res as unknown as http.IncomingMessage);
          res.end(reply.body ?? Buffer.alloc(0));
        });
      };
      return req;
    },
  );
  return requested;
}
function ico(png: Buffer) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

for (const format of ["png", "jpeg", "webp"]) {
  test(`${format} favicon is discovered, downloaded, stored and reread`, async (t) => {
    network(t, (url) =>
      url.pathname === "/"
        ? {
            type: "text/html",
            body: Buffer.from(`<link rel="icon" href="/icon.${format}">`),
          }
        : { type: "image/" + format, body: fixtures.get(format)! },
    );
    const result = await fetchFavicon("http://icons.example.com/");
    assert.ok(result);
    assert.equal(
      (await sharp(await readIcon(path.basename(result))).metadata()).format,
      "webp",
    );
  });
}

test("PNG embedded in ICO is extracted; legacy ICO fails to default", async (t) => {
  network(t, (url) => ({
    type: "image/x-icon",
    body:
      url.pathname === "/good"
        ? ico(fixtures.get("png")!)
        : ico(Buffer.alloc(30)),
  }));
  assert.ok(await fetchFavicon("http://icons.example.com/good"));
  assert.equal(await fetchFavicon("http://icons.example.com/bad"), null);
});

test("404 and oversized downloads fail to default without saving", async (t) => {
  network(t, (url) =>
    url.pathname === "/large" ? { length: MAX_ICON + 1 } : { status: 404 },
  );
  assert.equal(await fetchFavicon("http://icons.example.com/"), null);
  await assert.rejects(
    safeDownload("http://icons.example.com/large"),
    /response/,
  );
});

test("streamed download size is bounded even without Content-Length", async (t) => {
  network(t, () => ({ body: Buffer.alloc(MAX_ICON + 1) }));
  await assert.rejects(safeDownload("http://icons.example.com/"), /too large/);
});

test("public redirect works and loops stop after three redirects", async (t) => {
  const seen = network(t, (url) =>
    url.pathname === "/good"
      ? { body: fixtures.get("png")! }
      : {
          status: 302,
          location: url.pathname === "/start" ? "/good" : "/loop",
        },
  );
  assert.ok(await fetchFavicon("http://icons.example.com/start"));
  const before = seen.length;
  await assert.rejects(safeDownload("http://icons.example.com/loop"), /limit/);
  assert.equal(seen.length - before, 4);
});

test("redirects to localhost, private IPs and unsupported protocols are blocked", async (t) => {
  const seen = network(t, (url) => ({
    status: 302,
    location:
      url.pathname === "/protocol"
        ? "file:///etc/passwd"
        : "http://localhost/private",
  }));
  await assert.rejects(
    safeDownload("http://icons.example.com/"),
    /private host/,
  );
  await assert.rejects(safeDownload("http://icons.example.com/protocol"));
  assert.equal(seen.length, 2);
});

test("private DNS answers never reach the HTTP client", async (t) => {
  const seen = network(t, () => ({}), true);
  await assert.rejects(
    safeDownload("http://icons.example.com/"),
    /private address/,
  );
  assert.equal(seen.length, 0);
});

test("request timeout is bounded", async (t) => {
  network(t, () => ({ hang: true }));
  await assert.rejects(
    safeDownload("http://icons.example.com/", Date.now() + 50),
    /timeout/,
  );
});
