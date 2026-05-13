import { Jimp } from "jimp";

async function run() {
  try {
    const fn = "public/favicon.ico";
    const img = await Jimp.read(fn);
    console.log("Read favicon.ico! Width:", img.bitmap.width, "Height:", img.bitmap.height);
    
    // Convert checkerboard to transparent
    img.scan((x, y, idx) => {
      const r = img.bitmap.data[idx];
      const g = img.bitmap.data[idx+1];
      const b = img.bitmap.data[idx+2];
      
      // Checkerboard is usually #ffffff and #cccccc or something similar
      // Actually, if it's a checkerboard, it's a bunch of grey and white.
      // Let's just make it a bounding box approach or just turn white/grey to transparent.
      // But wait! If the red part of the logo is "Omni", we should keep red/dark colors.
      if ((r > 180 && g > 180 && b > 180) && Math.abs(r-g)<20 && Math.abs(g-b)<20) {
        img.bitmap.data[idx+3] = 0; // transparent
      }
    });

    await img.write("public/logo.png");
    console.log("Wrote logo.png");
  } catch (e) {
    console.error(e.message);
  }
}
run();
