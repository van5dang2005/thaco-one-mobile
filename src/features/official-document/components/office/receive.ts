/**
 * Web side of the file hand-over (runs inside the DOM components). Release and OTA builds serve the page from
 * `file://` (Expo's DOM wrapper allows file-to-file reads), so the page reads the downloaded file straight from the
 * app cache. The dev server's `http://` page cannot: there the file comes from native in base64 chunks
 * (`OfficeView`), about 0.5 MB/s on an emulator, fine for development only.
 */
export async function receiveFile(
  fileUri: string,
  size: number,
  chunks: number,
  readChunk: (index: number) => Promise<string>,
  onProgress?: (percent: number) => Promise<void>,
): Promise<Uint8Array> {
  if (location.protocol === 'file:') {
    try {
      return await readLocal(fileUri, onProgress);
    } catch {
      // Fall through to the bridge.
    }
  }
  return readOverBridge(size, chunks, readChunk, onProgress);
}

function readLocal(uri: string, onProgress?: (percent: number) => Promise<void>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // fetch() refuses file:// URLs; XMLHttpRequest reads them.
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'arraybuffer';
    let last = 0;
    xhr.onprogress = (event) => {
      // 100 is reported once, on load.
      const percent = event.lengthComputable ? Math.min(99, Math.round((event.loaded / event.total) * 100)) : 0;
      if (onProgress && percent >= last + 10) {
        last = percent;
        void onProgress(percent);
      }
    };
    xhr.onload = () => {
      if ((xhr.status === 0 || xhr.status === 200) && xhr.response instanceof ArrayBuffer && xhr.response.byteLength) {
        if (onProgress) void onProgress(100);
        resolve(new Uint8Array(xhr.response));
      } else reject(new Error(`file read failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('file read failed'));
    xhr.send();
  });
}

async function readOverBridge(size: number, chunks: number, readChunk: (index: number) => Promise<string>, onProgress?: (percent: number) => Promise<void>) {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (let index = 0; index < chunks; index++) {
    const binary = atob(await readChunk(index));
    for (let i = 0; i < binary.length; i++) bytes[offset + i] = binary.charCodeAt(i);
    offset += binary.length;
    if (onProgress) void onProgress(Math.round(((index + 1) / chunks) * 100));
  }
  return offset === size ? bytes : bytes.subarray(0, offset);
}

/** Colours the DOM components paint with: the app theme, passed in because the web view cannot read it. */
export type OfficeColors = { canvas: string; surface: string; ink: string; muted: string; line: string; primary: string; onPrimary: string };

/** Props every DOM viewer takes (functions are native actions, so they return promises). */
export type OfficeDomProps = {
  /** The downloaded file in the app cache (read directly when the page runs from file://). */
  fileUri: string;
  size: number;
  chunks: number;
  readChunk: (index: number) => Promise<string>;
  onProgress: (percent: number) => Promise<void>;
  onReady: () => Promise<void>;
  onFail: (message: string) => Promise<void>;
  colors: OfficeColors;
  dom?: import('expo/dom').DOMProps;
};

/** Lets the reader pinch to zoom (the DOM template fixes the scale). */
export function allowPinchZoom() {
  const meta = document.querySelector('meta[name="viewport"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'viewport' }));
  meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes');
}
