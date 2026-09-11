import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { emitKeypressEvents } from "node:readline";
async function hiddenInput(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("请在交互终端运行以安全输入密码。");
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const handler = (str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        finish();
        reject(new Error("已取消"));
      } else if (key.name === "return") {
        finish();
        resolve(value);
      } else if (key.name === "backspace") value = value.slice(0, -1);
      else if (str && !key.ctrl && !str.includes("\u001b")) value += str;
    };
    function finish() {
      process.stdin.off("keypress", handler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    }
    process.stdin.on("keypress", handler);
  });
}
async function main() {
  const password = await hiddenInput(
    "设置管理密码（至少 10 字符，输入不回显）：",
  );
  if (password.length < 10 || Buffer.byteLength(password) > 72)
    throw new Error("密码应至少 10 字符，最多 72 字节。");
  if ((await hiddenInput("再次输入：")) !== password)
    throw new Error("两次密码不一致。");
  const hash = await bcrypt.hash(password, 12);
  if (process.argv.includes("--apply")) {
    await db.$transaction([
      db.settings.update({
        where: { id: "singleton" },
        data: { admin_password_hash: hash },
      }),
      db.adminSession.deleteMany(),
    ]);
    console.info("管理密码已更新，已有会话已失效。");
  } else console.info("将以下哈希填入 .env 的 ADMIN_PASSWORD_HASH：\n" + hash);
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
