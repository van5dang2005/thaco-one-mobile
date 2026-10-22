import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Downloads an authenticated file into the cache and opens the system share / preview sheet. */
export async function downloadAndShare(url: string, fileName: string, headers: Record<string, string>) {
  // Only what file systems refuse goes: Vietnamese names stay readable in the share sheet.
  const safeName = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'tai-lieu';
  const destination = new File(Paths.cache, safeName);
  const file = await File.downloadFileAsync(url, destination, { headers, idempotent: true });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: fileName });
  return file.uri;
}
