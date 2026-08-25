import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OWNER = "vastraastudio9-rgb";
const REPO = "meridian-desk";
const REF = process.env.MERIDIAN_REF || "gh-pages";
const OUT = "public";

async function grab(path, optional = false) {
  const urls = [
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${REF}/${path}`,
    `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${REF}/${path}`,
  ];
  let last = "no attempt";
  for (const url of urls) {
    for (let i = 0; i < 4; i++) {
      try {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) {
          last = `${url} ${res.status}`;
          await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const dest = join(OUT, path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        console.log("pulled", path, buf.length, "from", url);
        return;
      } catch (err) {
        last = `${url} ${err instanceof Error ? err.message : err}`;
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
  }
  if (optional) {
    console.warn("skip", path, last);
    return;
  }
  throw new Error(`missing ${path} (${last})`);
}

await mkdir(OUT, { recursive: true });
await grab("index.html");
const html = await readFile(join(OUT, "index.html"), "utf8");
const refs = [
  ...html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g),
].map((m) => m[1]);
for (const path of new Set(refs)) await grab(path);
await grab("og.jpg", true);
