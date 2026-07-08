const fs = require('fs');
const path = require('path');

const root = process.cwd();
const ticketsDir = path.join(root, 'tickets');

function parseObjects(pdf) {
  const objects = new Map();
  const re = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  while ((match = re.exec(pdf))) {
    objects.set(Number(match[1]), match[2]);
  }
  return objects;
}

function extractStream(objectBody) {
  const match = objectBody.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  return match ? match[1] : '';
}

function parseCMap(stream) {
  const map = new Map();
  const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  let match;
  while ((match = re.exec(stream))) {
    const src = match[1].toUpperCase();
    const dst = match[2];
    let chars = '';
    for (let i = 0; i < dst.length; i += 4) {
      const cp = parseInt(dst.slice(i, i + 4), 16);
      if (!Number.isNaN(cp)) chars += String.fromCharCode(cp);
    }
    map.set(src, chars);
  }
  return map;
}

function decodeHex(hex, cmap) {
  hex = hex.replace(/\s+/g, '').toUpperCase();
  let out = '';
  for (let i = 0; i < hex.length;) {
    const code4 = hex.slice(i, i + 4);
    const code2 = hex.slice(i, i + 2);
    if (code4.length === 4 && cmap && cmap.has(code4)) {
      out += cmap.get(code4);
      i += 4;
    } else if (code2.length === 2 && cmap && cmap.has(code2)) {
      out += cmap.get(code2);
      i += 2;
    } else {
      out += '?';
      i += code4.length === 4 ? 4 : 2;
    }
  }
  return out;
}

function extractTextItems(pdf) {
  const objects = parseObjects(pdf);
  const fontToCmapObject = new Map();

  for (const objectBody of objects.values()) {
    const fontMatches = objectBody.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g);
    for (const fontMatch of fontMatches) {
      const fontObject = objects.get(Number(fontMatch[2]));
      const toUnicodeMatch = fontObject && fontObject.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (toUnicodeMatch) {
        fontToCmapObject.set(fontMatch[1], Number(toUnicodeMatch[1]));
      }
    }
  }

  const fontMaps = new Map();
  for (const [font, cmapObjectId] of fontToCmapObject) {
    fontMaps.set(font, parseCMap(extractStream(objects.get(cmapObjectId) || '')));
  }

  const contentStreams = [];
  for (const objectBody of objects.values()) {
    if (/stream/.test(objectBody) && /\bTj\b|\bTf\b|\bBT\b/.test(objectBody)) {
      contentStreams.push(extractStream(objectBody));
    }
  }

  const items = [];
  for (const stream of contentStreams) {
    let currentFont = null;
    let x = 0;
    let y = 0;
    const tokenRe = /\/(F\d+)\s+[\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let match;
    while ((match = tokenRe.exec(stream))) {
      if (match[1]) {
        currentFont = match[1];
      } else if (match[2]) {
        x = Number(match[2]);
        y = Number(match[3]);
      } else if (match[4]) {
        const text = decodeHex(match[4], fontMaps.get(currentFont));
        if (text.trim()) items.push({ x, y, text });
      }
    }
  }
  return items;
}

function groupLines(items) {
  const sorted = [...items].sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (!line) {
      line = { y: item.y, parts: [] };
      lines.push(line);
    }
    line.parts.push(item);
  }
  return lines
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const files = fs.readdirSync(ticketsDir)
  .filter((file) => file.toLowerCase().endsWith('.pdf'))
  .sort();

for (const file of files) {
  const pdf = fs.readFileSync(path.join(ticketsDir, file), 'latin1');
  console.log(`\n===== ${file} =====`);
  console.log(groupLines(extractTextItems(pdf)).join('\n'));
}
