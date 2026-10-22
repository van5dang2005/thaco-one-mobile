import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { documentApi } from '@/core/api/clients';
import { downloadAndShare } from '@/shared/lib/download';
import { toast } from '@/shared/ui/Toast';

import type { DocFile } from '../types';
import { isOnHost, localFileName } from '../utils/files';

/** "Tải về": downloads a document file and hands it to the system share sheet (Lưu vào Tệp, Drive, Zalo…). */
export function useDownloadDocFile() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const download = async (file: DocFile) => {
    if (!file.url) {
      toast.info(t('documents.fileUnavailable'), file.name);
      return;
    }
    setPending(true);
    try {
      await downloadAndShare(file.url, localFileName(file.name, file.kind), isOnHost(file.url, documentApi.baseUrl) ? documentApi.authHeaders() : {});
    } catch {
      toast.error(t('documents.viewer.downloadFailed'), file.name);
    } finally {
      setPending(false);
    }
  };
  return { download, pending };
}
