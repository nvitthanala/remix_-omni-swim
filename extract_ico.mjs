import fs from 'fs';

try {
  const buf = fs.readFileSync('public/favicon.ico');
  // ICO header: 0-1 (reserved), 2-3 (type, 1=ico), 4-5 (count of images)
  const count = buf.readUInt16LE(4);
  console.log("Images in ICO:", count);
  // Directory entry: 16 bytes each
  // width(1), height(1), colors(1), reserved(1), planes(2), bpp(2), size(4), offset(4)
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const w = buf.readUInt8(offset);
    const h = buf.readUInt8(offset+1);
    const size = buf.readUInt32LE(offset+8);
    const dataOffset = buf.readUInt32LE(offset+12);
    console.log(`Image ${i}: ${w == 0 ? 256 : w}x${h == 0 ? 256 : h}, size: ${size}, offset: ${dataOffset}`);
    
    // Check if it's a PNG by checking magic number
    const magic = buf.readUInt32BE(dataOffset);
    if (magic === 0x89504E47) {
      console.log("Found PNG inside ICO!");
      const pngData = buf.subarray(dataOffset, dataOffset + size);
      fs.writeFileSync(`public/extracted_${i}.png`, pngData);
    } else {
      // It's a BMP without the BITMAPFILEHEADER
      console.log("It's a BMP (or something else). BMP header usually 40 bytes.");
    }
  }
} catch (e) {
  console.error(e);
}
