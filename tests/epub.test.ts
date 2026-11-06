import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { EpubError, htmlToText, readEpub } from '../src/core/epub.ts';
import { makeEpub } from './helpers.ts';

describe('htmlToText', () => {
  it('puts each block on its own line and joins inline tags', () => {
    expect(htmlToText('<h1>One</h1>\n<p>The <i>light</i>house\n  keeper.</p><p>Second<br/>line</p>')).toBe(
      'One\nThe lighthouse keeper.\nSecond\nline',
    );
  });

  it('drops footnote references but keeps other superscripts', () => {
    expect(htmlToText('<p>Jung said so.<sup><a href="#n1">12</a></sup> Then 1<sup>o</sup> place.</p>')).toBe(
      'Jung said so. Then 1o place.',
    );
    expect(htmlToText('<p>Here<a epub:type="noteref" href="#n">*</a> it is.</p>')).toBe('Here it is.');
  });

  it('decodes entities', () => {
    expect(htmlToText('<p>Caf&eacute; &amp; p&atilde;o&nbsp;&#8212; &#x201C;ok&#8221; &hellip;</p>')).toBe(
      'Café & pão — “ok” …',
    );
  });
});

describe('readEpub', () => {
  it('reads chapters in spine order', () => {
    const text = readEpub(makeEpub(['<p>First chapter.</p>', '<p>Second chapter.</p>']));
    expect(text).toBe('First chapter.\nSecond chapter.');
  });

  it('rejects files that are not an EPUB', () => {
    expect(() => readEpub(strToU8('plain text'))).toThrow(EpubError);
    expect(() => readEpub(zipSync({ 'a.txt': strToU8('x') }))).toThrow("This file isn't an EPUB.");
  });

  it('rejects DRM-protected text but not obfuscated fonts', () => {
    const encryption = (uri: string) =>
      `<encryption><EncryptedData><CipherData><CipherReference URI="${uri}"/></CipherData></EncryptedData></encryption>`;
    const locked = makeEpub(['<p>x</p>'], { 'META-INF/encryption.xml': encryption('OEBPS/Text/ch1.xhtml') });
    expect(() => readEpub(locked)).toThrow(/DRM/);
    const fonts = makeEpub(['<p>Readable.</p>'], { 'META-INF/encryption.xml': encryption('OEBPS/font.otf') });
    expect(readEpub(fonts)).toBe('Readable.');
  });

  it('fails when there is no text', () => {
    expect(() => readEpub(makeEpub(['<img src="a.png"/>']))).toThrow('No text found in this EPUB.');
  });
});
