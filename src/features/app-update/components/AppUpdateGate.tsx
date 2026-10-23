import { useRequiredStoreUpdate } from '../hooks/useRequiredStoreUpdate';
import { StoreUpdateDialog } from './StoreUpdateDialog';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Both kinds of update: a newer store version locks the app (`StoreUpdateDialog`); otherwise an OTA patch for this
 * version is offered (`UpdatePrompt`). Never both, since an OTA patch cannot replace the binary the store asks for.
 */
export function AppUpdateGate() {
  const release = useRequiredStoreUpdate();
  return release ? <StoreUpdateDialog release={release} /> : <UpdatePrompt />;
}
