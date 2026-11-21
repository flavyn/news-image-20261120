import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function requireImage(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function dimensions(width: number, height: number): void {
  requireImage(width >= 1 && width <= 1024 && height >= 1 && height <= 1024,
    'image dimensions must each be 1 through 1024');
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(image: Buffer): void {
  let offset = 8;
  let hasData = false;
  let dataEnded = false;
  let hasPalette = false;
  let colorType = -1;
  let bitDepth = 0;
  while (offset < image.length) {
    requireImage(offset + 12 <= image.length, 'truncated PNG chunk header');
    const length = image.readUInt32BE(offset);
    const end = offset + 12 + length;
    requireImage(length <= 0x7fffffff && end <= image.length, 'truncated or oversized PNG chunk');
    const typeBytes = image.subarray(offset + 4, offset + 8);
    requireImage([...typeBytes].every(byte => (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122))
      && (typeBytes[2] & 32) === 0, 'invalid PNG chunk type');
    const type = typeBytes.toString('ascii');
    requireImage(offset !== 8 || type === 'IHDR', 'first PNG chunk must be IHDR');
    requireImage(crc32(image.subarray(offset + 4, end - 4)) === image.readUInt32BE(end - 4),
      `PNG ${type} CRC mismatch`);
    if (type === 'IHDR') {
      requireImage(offset === 8 && length === 13, 'invalid or repeated PNG IHDR');
      dimensions(image.readUInt32BE(16), image.readUInt32BE(20));
      bitDepth = image[24];
      colorType = image[25];
      const allowedDepths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16],
      };
      requireImage(allowedDepths[colorType]?.includes(bitDepth) === true
        && image[26] === 0 && image[27] === 0 && image[28] <= 1, 'invalid PNG IHDR fields');
    }
    if (type === 'PLTE') {
      requireImage(!hasPalette && !hasData && colorType !== 0 && colorType !== 4
        && length >= 3 && length <= 768 && length % 3 === 0
        && (colorType !== 3 || length / 3 <= 2 ** bitDepth), 'invalid PNG palette');
      hasPalette = true;
    }
    if (type === 'IDAT') {
      requireImage(!dataEnded && (colorType !== 3 || hasPalette), 'invalid PNG data ordering');
      hasData = true;
    } else if (hasData) {
      dataEnded = true;
    }
    requireImage((typeBytes[0] & 32) !== 0 || ['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type),
      'unsupported critical PNG chunk');
    if (type === 'IEND') {
      requireImage(length === 0 && end === image.length && hasData, 'invalid PNG IEND or missing image data');
      return;
    }
    offset = end;
  }
  throw new Error('PNG is missing IEND');
}

function validateJpeg(image: Buffer): void {
  let offset = 2;
  let inScan = false;
  let hasFrame = false;
  let hasScan = false;
  while (offset < image.length) {
    if (inScan && image[offset] !== 0xff) {
      offset++;
      continue;
    }
    requireImage(image[offset++] === 0xff, 'invalid JPEG marker');
    while (offset < image.length && image[offset] === 0xff) offset++;
    requireImage(offset < image.length, 'truncated JPEG marker');
    const marker = image[offset++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    inScan = false;
    if (marker === 0xd9) {
      requireImage(hasFrame && hasScan && offset === image.length, 'invalid JPEG EOI or missing frame/scan');
      return;
    }
    requireImage(marker !== 0 && marker !== 0xd8 && !(marker >= 0xd0 && marker <= 0xd7),
      'unexpected JPEG standalone marker');
    if (marker === 0x01) continue;
    requireImage(offset + 2 <= image.length, 'truncated JPEG segment length');
    const length = image.readUInt16BE(offset);
    requireImage(length >= 2 && offset + length <= image.length, 'truncated or invalid JPEG segment');
    if (marker === 0xc0 || marker === 0xc2) {
      requireImage(length >= 8, 'truncated JPEG frame');
      const components = image[offset + 7];
      requireImage(components >= 1 && components <= 4 && length === 8 + 3 * components,
        'invalid JPEG frame length');
      if (!hasFrame) dimensions(image.readUInt16BE(offset + 5), image.readUInt16BE(offset + 3));
      hasFrame = true;
    }
    if (marker === 0xda) {
      requireImage(hasFrame && length >= 6, 'invalid JPEG scan');
      const components = image[offset + 2];
      requireImage(components >= 1 && components <= 4 && length === 6 + 2 * components,
        'invalid JPEG scan length');
      inScan = true;
      hasScan = true;
    }
    offset += length;
  }
  throw new Error('JPEG is missing EOI');
}

try {
  const image = readFileSync(new URL('./entry.png', import.meta.url));
  requireImage(image.length <= 1048576, 'entry.png exceeds 1048576 bytes');
  if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    validatePng(image);
  } else if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
    validateJpeg(image);
  } else {
    throw new Error('entry.png must be a PNG or JPEG image');
  }

  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'entry.png'), image);
  process.exitCode = 0;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Image copy failed: ${message.replace(/[\r\n]+/g, ' ')}`);
  process.exitCode = 1;
}
