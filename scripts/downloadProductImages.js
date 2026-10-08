import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, "..", "src", "productImages.json");
const outputDirectory = path.join(here, "..", "public", "product-images");
const sourcePage = "https://mtpcrackers.in/products.php?device=desktop";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(outputDirectory, { recursive: true });

let failures = 0;
for (const [name, image] of Object.entries(manifest)) {
  const outputPath = path.join(outputDirectory, image.file);
  try {
    const response = await fetch(image.source, {
      headers: {
        referer: sourcePage,
        "user-agent": "HubballiCrackers product image downloader"
      }
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(`Unexpected response: ${response.status} ${response.headers.get("content-type")}`);
    }
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(`Saved ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`Could not download ${name}: ${error.message}`);
  }
}

if (failures) {
  throw new Error(`Failed to download ${failures} product image(s).`);
}
