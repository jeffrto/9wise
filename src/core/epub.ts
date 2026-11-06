import { unzipSync } from 'fflate';

export class EpubError extends Error {}

const BLOCK_TAGS =
  'p|div|h[1-6]|li|ul|ol|blockquote|br|hr|tr|td|th|table|section|article|header|footer|aside|figure|figcaption|dt|dd|dl|pre|nav';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '­',
  mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', bdquo: '„', sbquo: '‚', middot: '·', bull: '•', deg: '°',
  ordf: 'ª', ordm: 'º', iexcl: '¡', iquest: '¿', copy: '©', reg: '®', trade: '™',
};
const LATIN1 =
  'Agrave:À Aacute:Á Acirc:Â Atilde:Ã Auml:Ä Aring:Å AElig:Æ Ccedil:Ç Egrave:È Eacute:É Ecirc:Ê Euml:Ë ' +
  'Igrave:Ì Iacute:Í Icirc:Î Iuml:Ï Ntilde:Ñ Ograve:Ò Oacute:Ó Ocirc:Ô Otilde:Õ Ouml:Ö Oslash:Ø ' +
  'Ugrave:Ù Uacute:Ú Ucirc:Û Uuml:Ü Yacute:Ý';
for (const pair of LATIN1.split(' ')) {
  const [name, char] = pair.split(':') as [string, string];
  ENTITIES[name] = char;
  ENTITIES[name.toLowerCase()] = char.toLowerCase();
}
ENTITIES.szlig = 'ß';
ENTITIES.yuml = 'ÿ';

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name] ?? all;
  });
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? decodeEntities(match[2] ?? match[3] ?? '') : undefined;
}

function resolvePath(base: string, href: string): string {
  const parts = base.split('/').slice(0, -1);
  for (const part of decodeURIComponent(href.split('#')[0]!).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

/** Plain text of an XHTML chapter: one paragraph per line, footnote references dropped. */
export function htmlToText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return decodeEntities(
    body
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_, inner: string) =>
        /^[\d*†‡§\s,–-]*$/.test(inner.replace(/<[^>]*>/g, '')) ? '' : inner,
      )
      .replace(/<a\b[^>]*noteref[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/\s+/g, ' ')
      .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[\s ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Reads an EPUB's text in reading order, one paragraph per line. */
export function readEpub(data: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (f) => /^META-INF\/(container|encryption)\.xml$/i.test(f.name) || /\.(opf|x?html?)$/i.test(f.name),
    });
  } catch {
    throw new EpubError("This file isn't an EPUB.");
  }
  const decoder = new TextDecoder();
  const read = (path: string) => (files[path] ? decoder.decode(files[path]) : undefined);

  const container = read('META-INF/container.xml');
  const opfPath = container && attr(container.match(/<rootfile\b[^>]*>/i)?.[0] ?? '', 'full-path');
  const opf = opfPath && read(opfPath);
  if (!opfPath || !opf) throw new EpubError("This file isn't an EPUB.");

  const encryption = read('META-INF/encryption.xml');
  if (encryption && /URI\s*=\s*["'][^"']*\.x?html?["']/i.test(encryption)) {
    throw new EpubError('This EPUB is copy-protected (DRM), so its text can’t be read.');
  }

  const manifest = new Map<string, string>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) manifest.set(id, resolvePath(opfPath, href));
  }
  const spine = (opf.match(/<itemref\b[^>]*>/gi) ?? [])
    .map((tag) => manifest.get(attr(tag, 'idref') ?? ''))
    .filter((p): p is string => !!p);

  const text = spine
    .map((path) => read(path))
    .filter((html): html is string => html !== undefined)
    .map(htmlToText)
    .filter(Boolean)
    .join('\n');
  if (!text) throw new EpubError('No text found in this EPUB.');
  return text;
}
