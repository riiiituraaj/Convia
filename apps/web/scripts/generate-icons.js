const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const r = 0x12,
    g = 0x3f,
    b = 0x30;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const margin = Math.floor(size * 0.08);
      const inMark = x >= margin && x < size - margin && y >= margin && y < size - margin;
      if (inMark) {
        raw[offset++] = r;
        raw[offset++] = g;
        raw[offset++] = b;
      } else {
        raw[offset++] = 0xee;
        raw[offset++] = 0xf9;
        raw[offset++] = 0xf2;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const publicDir = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(publicDir, "icon-192.png"), makePng(192));
fs.writeFileSync(path.join(publicDir, "icon-512.png"), makePng(512));
fs.writeFileSync(path.join(publicDir, "favicon.png"), makePng(32));
console.log("Icons written to public/");
