import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import manifest from "@/app/manifest";
import { SITE } from "@/lib/site-config";

function pngSize(path: string) {
 const data = readFileSync(resolve(path));
 expect(data.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
 expect(data.toString("ascii", 12, 16)).toBe("IHDR");
 return [data.readUInt32BE(16), data.readUInt32BE(20)];
}
it("provides a Vietnamese manifest with existing regular and maskable icons", () => {
 const data = manifest();
 expect(data).toMatchObject({ name:`${SITE.name} – Luyện tiếng Anh miễn phí`, short_name:SITE.wordmark, lang:"vi", start_url:"/", display:"standalone", background_color:"#fffdf5", theme_color:"#ffc001" });
 for (const size of [192, 512]) for (const purpose of ["any", "maskable"]) {
  const icon = data.icons?.find(icon => icon.sizes === `${size}x${size}` && icon.purpose === purpose);
  expect(icon).toMatchObject({ type:"image/png", src: `/icon-${purpose === "maskable" ? "maskable-" : ""}${size}.png` });
  expect(pngSize(`public${icon!.src}`)).toEqual([size,size]);
 }
});
it("ships the BeeJunior assets and correctly sized application icons", async () => {
 expect(pngSize("app/icon.png")).toEqual([32,32]);
 expect(pngSize("app/apple-icon.png")).toEqual([180,180]);
 const { default: sharp } = await import("sharp");
 const apple = await sharp("app/apple-icon.png").ensureAlpha().raw().toBuffer();
 for (let index = 3; index < apple.length; index += 4) expect(apple[index]).toBe(255);
 expect(pngSize("public/brand/og-image.png")).toEqual([1200,630]);
 for (const [file, dimensions] of [["logo-lockup.webp", [462,88]], ["mascot.webp", [512,348]]] as const) {
  const data = readFileSync(`public/brand/${file}`);
  expect(data.toString("ascii", 0, 4)).toBe("RIFF");
  expect(data.toString("ascii", 8, 12)).toBe("WEBP");
  const metadata = await sharp(data).metadata();
  expect([metadata.width,metadata.height]).toEqual(dimensions);
 }
 expect(readFileSync("public/brand/logo-lockup.webp").length).toBeLessThan(20000);
});
it("embeds 16/32/48 PNG images in a valid ICO directory", () => {
 const data = readFileSync("app/favicon.ico");
 expect([...data.subarray(0,6)]).toEqual([0,0,1,0,3,0]);
 for (const [index, size] of [16,32,48].entries()) {
  const entry = 6 + index * 16;
  expect(data[entry]).toBe(size); expect(data[entry+1]).toBe(size);
  // Pillow uses zero for planes on PNG-backed ICO entries.
  expect([0,1]).toContain(data.readUInt16LE(entry+4)); expect(data.readUInt16LE(entry+6)).toBe(32);
  const length = data.readUInt32LE(entry+8), offset = data.readUInt32LE(entry+12);
  expect(offset + length).toBeLessThanOrEqual(data.length);
  expect(data.toString("ascii",offset+12,offset+16)).toBe("IHDR");
  expect(data.readUInt32BE(offset+16)).toBe(size); expect(data.readUInt32BE(offset+20)).toBe(size);
 }
});
