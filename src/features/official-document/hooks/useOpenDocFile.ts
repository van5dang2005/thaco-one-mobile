import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { toast } from '@/shared/ui/Toast';

import type { DocFile } from '../types';

/**
 * Opens a document file in the in-app browser (PDF, Word and Excel preview there; the API serves them without a
 * token). A file I may not view has no URL: say so instead of failing silently.
 */
export function useOpenDocFile() {
  const { t } = useTranslation();
  return (file: DocFile) => {
    if (!file.url) {
      toast.info(t('documents.fileUnavailable'), file.name);
      return;
    }
    void WebBrowser.openBrowserAsync(file.url);
  };
}
