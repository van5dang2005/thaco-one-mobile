import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { documentApi } from '@/core/api/clients';

import type { FileKind } from '../types';
import { isOnHost, localFileName } from '../utils/files';

type State = { status: 'loading' } | { status: 'ready'; file: File; folder: Directory } | { status: 'error'; error: unknown };

/**
 * Downloads a document file into a folder of its own in the app cache for the viewer, and deletes it when the
 * screen leaves: internal documents never land in Downloads or stay on the phone.
 */
export function useDocFileDownload(url: string, name: string, kind: FileKind) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const folder = new Directory(Paths.cache, 'van-thu', `${Date.now()}-${attempt}`);
    setState({ status: 'loading' });
    (async () => {
      try {
        folder.create({ intermediates: true });
        const headers = isOnHost(url, documentApi.baseUrl) ? documentApi.authHeaders() : {};
        const file = await File.downloadFileAsync(url, new File(folder, localFileName(name, kind)), { headers, idempotent: true });
        if (alive) setState({ status: 'ready', file, folder });
      } catch (error) {
        if (alive) setState({ status: 'error', error });
      }
    })();
    return () => {
      alive = false;
      try {
        if (folder.exists) folder.delete();
      } catch {
        // The OS clears the cache anyway.
      }
    };
  }, [url, name, kind, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
