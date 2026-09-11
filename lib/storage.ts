import path from "node:path";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { AppError } from "./errors";
export const MAX_ICON = 2 * 1024 * 1024;
export const storageDir = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./storage/icons",
  );
export async function storeImage(input: Buffer, mime?: string) {
  if (input.length > MAX_ICON)
    throw new AppError("UPLOAD_TOO_LARGE", "图片大小不能超过 2MB", 413);
  if (mime && !["image/png", "image/jpeg", "image/webp"].includes(mime))
    throw new AppError("INVALID_FILE_TYPE", "仅支持 PNG、JPG、WebP 图片");
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 16000000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format))
      throw new Error("type");
    if (
      mime &&
      { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" }[
        metadata.format as "png" | "jpeg" | "webp"
      ] !== mime
    )
      throw new Error("mime");
    output = await image
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    throw new AppError(
      "INVALID_FILE_TYPE",
      "图片无法识别，请上传有效的 PNG、JPG 或 WebP 图片",
    );
  }
  const filename = createHash("sha256").update(output).digest("hex") + ".webp";
  await mkdir(storageDir(), { recursive: true });
  await writeFile(path.join(storageDir(), filename), output);
  return "/api/icons/" + filename;
}
export async function assertIconExists(url: string) {
  try {
    await access(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ storageDir(),
        path.basename(url),
      ),
    );
  } catch {
    throw new AppError(
      "INVALID_INPUT",
      "图标已不可用，请重新上传或恢复自动获取",
    );
  }
}
export async function readIcon(filename: string) {
  if (!/^[a-f0-9]{64}\.webp$/.test(filename))
    throw new AppError("NOT_FOUND", "图标不存在", 404);
  try {
    return await readFile(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ storageDir(),
        filename,
      ),
    );
  } catch {
    throw new AppError("NOT_FOUND", "图标不存在", 404);
  }
}
