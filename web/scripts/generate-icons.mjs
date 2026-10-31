// Run from web/: node scripts/generate-icons.mjs. Uses Next's existing sharp dependency.
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../app/icon.svg", import.meta.url));
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/", root), { recursive: true });
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size,size).png().toBuffer()));
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1,2);
directory.writeUInt16LE(sizes.length,4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
 const entry = 6 + 16 * index;
 directory[entry] = size; directory[entry+1] = size;
 directory.writeUInt16LE(1,entry+4); directory.writeUInt16LE(32,entry+6);
 directory.writeUInt32LE(images[index].length,entry+8); directory.writeUInt32LE(offset,entry+12);
 offset += images[index].length;
}
await writeFile(new URL("app/favicon.ico",root),Buffer.concat([directory,...images]));
await sharp(source).resize(180,180).flatten({background:"#111a2b"}).removeAlpha().png().toFile(new URL("app/apple-icon.png",root).pathname);
// At 75% scale the entire book stays inside the central 80% maskable safe zone.
for (const size of [192,512]) {
 const inset = Math.round(size * .75);
 const mark = await sharp(source).resize(inset,inset).png().toBuffer();
 await sharp({create:{width:size,height:size,channels:3,background:"#111a2b"}}).composite([{input:mark,gravity:"centre"}]).removeAlpha().png().toFile(new URL(`public/icon-${size}.png`,root).pathname);
}
