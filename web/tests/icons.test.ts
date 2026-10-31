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
 expect(data).toMatchObject({ name:SITE.name, short_name:SITE.wordmark, lang:"vi", start_url:"/", display:"standalone", background_color:"#f9f9ff", theme_color:"#111a2b" });
 for (const size of [192, 512]) for (const purpose of ["any", "maskable"]) {
  const icon = data.icons?.find(icon => icon.sizes === `${size}x${size}` && icon.purpose === purpose);
  expect(icon).toMatchObject({ type:"image/png" });
  expect(pngSize(`public${icon!.src}`)).toEqual([size,size]);
 }
});
it("ships the SVG source and correctly sized opaque Apple icon", () => {
 const svg = readFileSync("app/icon.svg", "utf8");
 expect(svg).toContain('viewBox="0 0 64 64"');
 expect(svg).toContain("#111a2b"); expect(svg).toContain("#f5691a");
 expect(pngSize("app/apple-icon.png")).toEqual([180,180]);
 expect(readFileSync("app/apple-icon.png")[25]).toBe(2); // RGB without alpha
});
it("embeds 16/32/48 PNG images in a valid ICO directory", () => {
 const data = readFileSync("app/favicon.ico");
 expect([...data.subarray(0,6)]).toEqual([0,0,1,0,3,0]);
 for (const [index, size] of [16,32,48].entries()) {
  const entry = 6 + index * 16;
  expect(data[entry]).toBe(size); expect(data[entry+1]).toBe(size);
  expect(data.readUInt16LE(entry+4)).toBe(1); expect(data.readUInt16LE(entry+6)).toBe(32);
  const length = data.readUInt32LE(entry+8), offset = data.readUInt32LE(entry+12);
  expect(offset + length).toBeLessThanOrEqual(data.length);
  expect(data.toString("ascii",offset+12,offset+16)).toBe("IHDR");
  expect(data.readUInt32BE(offset+16)).toBe(size); expect(data.readUInt32BE(offset+20)).toBe(size);
 }
});
