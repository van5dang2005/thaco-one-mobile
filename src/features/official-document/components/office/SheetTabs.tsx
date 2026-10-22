'use dom';

import { useEffect, useMemo, useRef, useState } from 'react';
import { read, utils, type WorkBook } from 'xlsx';

import { allowPinchZoom, type OfficeDomProps, receiveFile } from './receive';

/**
 * Rows per step. Only these are parsed at first (`sheetRows`): reading all 50,000 rows of a 5 MB workbook took ~20 s
 * on an emulator. "Xem thêm" parses the whole workbook once, then just shows more of it.
 */
const PAGE = 300;

const OPTIONS = { dense: true, cellDates: true } as const;

/**
 * Workbooks (.xlsx is a ZIP, .xls an OLE container) go to SheetJS as bytes, first `sheetRows` only. Anything else is
 * text (.csv): SheetJS would read its bytes as Latin-1 and garble Vietnamese, so it is decoded as UTF-8 (a BOM is
 * dropped) and read whole: text parses fast, and a partial read of it does not record the full size (`!fullref`).
 */
function parse(bytes: Uint8Array, sheetRows?: number): { book: WorkBook; complete: boolean } {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (zip || ole) return { book: read(bytes, { ...OPTIONS, type: 'array', sheetRows }), complete: !sheetRows };
  return { book: read(new TextDecoder('utf-8').decode(bytes), { ...OPTIONS, type: 'string' }), complete: true };
}

/** Native strings: `more` carries `%SHOWN%` / `%TOTAL%`, filled in here as rows are added. */
type Props = OfficeDomProps & { labels: { more: string; loadingMore: string; empty: string } };

/** An .xlsx / .xls / .csv workbook (SheetJS): one sheet at a time, its tabs at the bottom, rows added on demand. */
export default function SheetTabs({ fileUri, size, chunks, readChunk, onProgress, onReady, onFail, colors, labels }: Props) {
  const [book, setBook] = useState<WorkBook>();
  // False while `book` holds only the first PAGE rows of each sheet.
  const [complete, setComplete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const bytes = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    allowPinchZoom();
    (async () => {
      try {
        const data = await receiveFile(fileUri, size, chunks, readChunk, onProgress);
        if (cancelled) return;
        bytes.current = data;
        const first = parse(data, PAGE);
        setBook(first.book);
        setComplete(first.complete);
        await onReady();
      } catch (error) {
        if (!cancelled) await onFail(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // One file per mount: the screen remounts the viewer for another file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMore = () => {
    if (complete || !bytes.current) {
      setLimit((n) => n + PAGE);
      return;
    }
    setLoadingMore(true);
    // Let the button show its busy state before the long parse blocks the page.
    setTimeout(() => {
      try {
        setBook(parse(bytes.current!).book);
        setComplete(true);
        setLimit((n) => n + PAGE);
      } catch (error) {
        void onFail(String(error));
      } finally {
        setLoadingMore(false);
      }
    }, 50);
  };

  const sheet = book ? book.Sheets[book.SheetNames[active]] : undefined;
  const { html, rows } = useMemo(() => {
    if (!sheet?.['!ref']) return { html: '', rows: 0 };
    const full = sheet['!ref'];
    const range = utils.decode_range(full);
    // A partial parse keeps the sheet's real size in `!fullref`.
    const whole = utils.decode_range(sheet['!fullref'] ?? full);
    const rows = whole.e.r - whole.s.r + 1;
    // Only the first `limit` rows: trim the sheet's range for the export, then put it back.
    sheet['!ref'] = utils.encode_range({ s: range.s, e: { c: range.e.c, r: Math.min(range.e.r, range.s.r + limit - 1) } });
    const html = utils.sheet_to_html(sheet, { header: '', footer: '' });
    sheet['!ref'] = full;
    return { html, rows };
  }, [sheet, limit]);

  if (!book) return null;
  const names = book.SheetNames;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.canvas, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        html, body { margin: 0; background: ${colors.canvas}; }
        table { border-collapse: collapse; background: ${colors.surface}; font-size: 13px; color: ${colors.ink}; }
        td { border: 1px solid ${colors.line}; padding: 4px 8px; white-space: nowrap; vertical-align: top; }
        tr:first-child td { font-weight: 600; }
      `}</style>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {rows ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: html }} />
            {rows > limit ? (
              <button
                disabled={loadingMore}
                onClick={showMore}
                style={{ margin: '12px 0', padding: '10px 16px', borderRadius: 12, border: 'none', background: colors.primary, color: colors.onPrimary, fontSize: 14, fontWeight: 600, opacity: loadingMore ? 0.6 : 1 }}
              >
                {loadingMore ? labels.loadingMore : labels.more.replace('%SHOWN%', String(limit)).replace('%TOTAL%', String(rows))}
              </button>
            ) : null}
          </>
        ) : (
          <p style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{labels.empty}</p>
        )}
      </div>
      {names.length > 1 ? (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 8px 12px', borderTop: `1px solid ${colors.line}`, background: colors.surface }}>
          {names.map((name, index) => (
            <button
              key={name}
              onClick={() => {
                setActive(index);
                setLimit(PAGE);
              }}
              style={{
                flex: 'none',
                padding: '7px 12px',
                borderRadius: 999,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                background: index === active ? colors.primary : colors.canvas,
                color: index === active ? colors.onPrimary : colors.ink,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
