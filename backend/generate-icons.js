// backend/generate-icons.js - Tự động tạo icon16.png, icon48.png, icon128.png chuẩn PNG
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Vẽ hình vuông bo góc màu cam (#ea580c)
  const radius = Math.round(size * 0.22);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Tính khoảng cách bo góc
      let inBounds = true;
      if (x < radius && y < radius) {
        inBounds = Math.hypot(x - radius, y - radius) <= radius;
      } else if (x >= width - radius && y < radius) {
        inBounds = Math.hypot(x - (width - radius - 1), y - radius) <= radius;
      } else if (x < radius && y >= height - radius) {
        inBounds = Math.hypot(x - radius, y - (height - radius - 1)) <= radius;
      } else if (x >= width - radius && y >= height - radius) {
        inBounds = Math.hypot(x - (width - radius - 1), y - (height - radius - 1)) <= radius;
      }

      if (inBounds) {
        // Nền cam Shopee #ea580c (234, 88, 12)
        let r = 234, g = 88, b = 12, a = 255;

        // Vẽ biểu tượng tia sét / chữ S trắng ở giữa
        const nx = x / size;
        const ny = y / size;

        // Họa tiết chữ S cách điệu màu trắng
        const inS = (
          (ny >= 0.25 && ny <= 0.35 && nx >= 0.28 && nx <= 0.72) ||
          (ny >= 0.35 && ny <= 0.52 && nx >= 0.28 && nx <= 0.42) ||
          (ny >= 0.45 && ny <= 0.55 && nx >= 0.28 && nx <= 0.72) ||
          (ny >= 0.52 && ny <= 0.68 && nx >= 0.58 && nx <= 0.72) ||
          (ny >= 0.65 && ny <= 0.75 && nx >= 0.28 && nx <= 0.72)
        );

        if (inS) {
          r = 255; g = 255; b = 255;
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    pngSignature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idatData),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

const iconsDir = path.join(__dirname, "..", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, generatePng(size));
  console.log(`[OK] Generated: ${filePath}`);
});
