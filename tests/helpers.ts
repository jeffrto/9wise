import { strToU8, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseExport } from '../src/core/parser.ts';
import type { Block } from '../src/core/types.ts';

export function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
}

export function parseFixture(name: string) {
  return parseExport(fixture(name), name);
}

export function blocks(...items: [string, number, number, (string | null)?][]): Block[] {
  return items.map(([text, start, end, note], i) => ({
    index: i + 1,
    line: i + 1,
    text,
    note: note ?? null,
    start,
    end,
  }));
}

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile media-type="application/oebps-package+xml" full-path="OEBPS/content.opf"/></rootfiles>
</container>`;

const OPF = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item href="Text/ch%202.xhtml" id="c2" media-type="application/xhtml+xml"/>
    <item id="c1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`;

const page = (body: string) =>
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Skip me</title>` +
  `<style>p { color: red }</style></head><body>${body}</body></html>`;

export function makeEpub(chapters: string[], extra: Record<string, string> = {}): Uint8Array {
  return zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(CONTAINER),
    'OEBPS/content.opf': strToU8(OPF),
    'OEBPS/Text/ch1.xhtml': strToU8(page(chapters[0] ?? '')),
    'OEBPS/Text/ch 2.xhtml': strToU8(page(chapters[1] ?? '')),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
  });
}
