import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { toast } from '@/shared/ui/Toast';

import type { DocFile } from '../types';

/**
 * Opens a document file on the in-app viewer (`/documents/file`), never the browser. `canDownload` adds its share
 * button (a shared document's "Tải" right). A file I may not view has no URL: say so instead of failing silently.
 */
export function useOpenDocFile({ canDownload = true }: { canDownload?: boolean } = {}) {
  const { t } = useTranslation();
  return (file: DocFile) => {
    if (!file.url) {
      toast.info(t('documents.fileUnavailable'), file.name);
      return;
    }
    const meta = [file.description, file.pages ? t('documents.filePages', { count: file.pages }) : null, file.size].filter(Boolean).join(' · ');
    router.push({ pathname: '/documents/file', params: { url: file.url, name: file.name, kind: file.kind, meta: meta || undefined, share: canDownload ? '1' : undefined } });
  };
}
