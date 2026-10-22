import { copyFile } from "node:fs/promises";

for (const name of ["index.d.ts", "tours.d.ts", "vite.d.ts"]) {
  await copyFile(new URL(`../src/${name}`, import.meta.url), new URL(`../dist/${name}`, import.meta.url));
}
