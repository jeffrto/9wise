export const num = (n: number) => n.toLocaleString('en-US');

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}

/** Audio position: `m:ss`, or `h:mm:ss` past the first hour. */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** `[3,4,5,9]` → `#3–#5, #9` */
export function ranges(indexes: number[]): string {
  const sorted = [...indexes].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    parts.push(j > i ? `#${sorted[i]}–#${sorted[j]}` : `#${sorted[i]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

export function download(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
