/** "A", "A và B", "A, B và C": `and` is the locale's conjunction. */
export function joinNames(names: readonly string[], and: string) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/** Splits a translated sentence on `**` markers into plain / bold runs ("quay về **{{name}}** để…"). */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}

/** Lower case without Vietnamese diacritics ("Hoàng Gia Bảo" → "hoang gia bao"), so searches match unaccented typing. */
export function foldVi(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Whether any of `fields` contains `query`, ignoring case and diacritics; an empty query matches. */
export function matchesQuery(query: string, ...fields: (string | undefined | null)[]) {
  const q = foldVi(query.trim());
  return !q || fields.some((field) => !!field && foldVi(field).includes(q));
}

/** People with their searchable text folded once: pickers search the whole staff list on every keystroke. */
export type PersonIndex<P> = { person: P; key: string }[];

export function indexPeople<P extends { name: string; code: string; unit: string; position?: string }>(people: readonly P[]): PersonIndex<P> {
  return people.map((person) => ({ person, key: foldVi([person.name, person.code, person.unit, person.position].filter(Boolean).join(' ')) }));
}

/** Up to `limit` people whose name, MSNV, unit or position contains `query` (folded), in list order. */
export function searchPeople<P>(index: PersonIndex<P>, query: string, limit: number, skip?: (person: P) => boolean): P[] {
  const q = foldVi(query.trim());
  const found: P[] = [];
  for (const entry of index) {
    if (found.length >= limit) break;
    if (q && !entry.key.includes(q)) continue;
    if (skip?.(entry.person)) continue;
    found.push(entry.person);
  }
  return found;
}

/** HRM units come as a path ("THACO GROUP/Các Ban NVQT/Ban CNTT"): the last level names the unit. */
export function shortUnit(unit: string) {
  return (
    unit
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ?? ''
  );
}
