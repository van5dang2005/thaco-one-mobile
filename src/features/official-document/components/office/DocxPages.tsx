'use dom';

import { renderAsync } from 'docx-preview';
import { useEffect, useRef } from 'react';

import { allowPinchZoom, type OfficeDomProps, receiveFile } from './receive';

const GUTTER = 8;

/** A .docx rendered as its pages (docx-preview), each page scaled down to the screen width; pinch to read closer. */
export default function DocxPages({ fileUri, size, chunks, readChunk, onProgress, onReady, onFail, colors }: OfficeDomProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    allowPinchZoom();
    const fit = () => {
      const wrapper = host.current?.querySelector<HTMLElement>('.docx-wrapper');
      if (!wrapper) return;
      wrapper.style.zoom = '1';
      const pages = Array.from(wrapper.querySelectorAll<HTMLElement>('section.docx'));
      const widest = Math.max(1, ...pages.map((page) => page.offsetWidth));
      wrapper.style.zoom = String(Math.min(1, (window.innerWidth - GUTTER * 2) / widest));
    };
    (async () => {
      try {
        const bytes = await receiveFile(fileUri, size, chunks, readChunk, onProgress);
        if (cancelled || !host.current) return;
        await renderAsync(bytes, host.current, undefined, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          experimental: true,
        });
        if (cancelled) return;
        fit();
        window.addEventListener('resize', fit);
        await onReady();
      } catch (error) {
        if (!cancelled) await onFail(String(error));
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fit);
    };
    // One file per mount: the screen remounts the viewer for another file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        html, body { margin: 0; background: ${colors.canvas}; }
        .docx-wrapper { background: ${colors.canvas} !important; padding: ${GUTTER}px !important; align-items: center; }
        .docx-wrapper > section.docx { margin-bottom: ${GUTTER * 2}px !important; box-shadow: 0 1px 4px rgba(15, 27, 45, 0.18) !important; }
      `}</style>
      <div ref={host} />
    </>
  );
}
