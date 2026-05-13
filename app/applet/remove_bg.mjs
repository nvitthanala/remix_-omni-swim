import { Jimp } from "jimp";

async function main() {
  const image = await Jimp.read("public/logo.png");
  image.scan((x, y, idx) => {
    // get RBG values
    const r = image.bitmap.data[idx];
    const g = image.bitmap.data[idx + 1];
    const b = image.bitmap.data[idx + 2];
    
    // Check if pixel is white or light gray (checkerboard colors)
    // Common checkerboard: white (255,255,255) and gray (around 204,204,204, or 192,192,192)
    // We will set alpha to 0 for any light grey or white pixel that is neutral (r~g~b)
    if (r > 150 && g > 150 && b > 150) {
      if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
        // Set alpha to 0
        image.bitmap.data[idx + 3] = 0;
      }
    }
  });
  
  await image.write("public/logo.png");
  console.log("Background removed and logo processed.");
}

main().catch(console.error);
