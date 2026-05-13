import { Jimp } from "jimp";
import fs from "fs";

async function main() {
  const image = await Jimp.read("public/logo.png");
  image.scan((x, y, idx) => {
    const r = image.bitmap.data[idx];
    const g = image.bitmap.data[idx + 1];
    const b = image.bitmap.data[idx + 2];
    
    if (r > 150 && g > 150 && b > 150) {
      if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
        image.bitmap.data[idx + 3] = 0;
      }
    }
  });
  
  await image.write("public/logo.png");
  if (fs.existsSync("public/favicon.ico")) {
     await image.write("public/favicon.ico");
  }
  console.log("Background removed and logo processed.");
}

main().catch(console.error);
