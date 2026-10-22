import type { FileKind } from '../types';

/**
 * Name to store a downloaded file under: the document's own name (Vietnamese kept, it shows in the share sheet)
 * without path separators or characters iOS / Android refuse, and with `.pdf` when a PDF's name lost its extension
 * (the iOS viewer picks its renderer by extension).
 */
export function localFileName(name: string, kind: FileKind): string {
  const clean = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/^[\s.]+|\s+$/g, '');
  const base = clean || 'tai-lieu';
  return kind === 'pdf' && !/\.pdf$/i.test(base) ? `${base}.pdf` : base;
}

/** The SSO token only goes to the Văn thư API, never to a file URL on another host. */
export function isOnHost(url: string, baseUrl: string): boolean {
  return url === baseUrl || url.startsWith(`${baseUrl}/`);
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
};

/**
 * MIME type by extension: Android's "Mở bằng" chooser lists only the apps for that type (the file system reports
 * none for a downloaded file, and a wildcard type offers every app). Unknown extensions stay undefined.
 */
export function mimeOf(name: string): string | undefined {
  const ext = name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  return ext ? MIME[ext] : undefined;
}

/**
 * Which in-app Office viewer renders a file on Android, by extension. Old binary .doc and PowerPoint (not supported,
 * by decision) have none: they get "Mở bằng ứng dụng khác".
 */
export type OfficeFormat = 'docx' | 'sheet';

export function officeFormat(name: string): OfficeFormat | undefined {
  const ext = name.trim().match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'sheet';
  return undefined;
}
