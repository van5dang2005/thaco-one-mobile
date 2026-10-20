import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { errorMessage } from '@/core/errors/errorMessage';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { CheckCheckIcon, ClipboardListIcon, Undo2Icon } from '@/shared/ui/icons';
import { NoteField } from '@/shared/ui/NoteField';
import { Segmented } from '@/shared/ui/Segmented';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';

import { useIncomingActions } from '../hooks/useIncomingActions';
import type { IncomingDoc } from '../types';
import { teamNames } from '../utils/assignment';
import { joinNames } from '../utils/text';
import { RichText } from './RichText';

const MAX = 500;

type Mode = 'complete' | 'return';

type Props = {
  doc: IncomingDoc;
  meId: string;
  visible: boolean;
  onClose: () => void;
  /** After a successful call (the sheet is already closing). */
  onDone: (mode: Mode) => void;
  initialMode?: Mode;
};

/**
 * "Xử lý văn bản" (8f), opened by the chủ trì: complete with a result, or return to the distributor with a
 * reason. Both are sent at once (the back-end keeps no draft) and require text.
 */
export function ProcessSheet({ doc, meId, visible, onClose, onDone, initialMode = 'complete' }: Props) {
  const { t } = useTranslation();
  const { complete, returnDoc } = useIncomingActions(meId);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [result, setResult] = useState('');
  const [reason, setReason] = useState('');
  const distributor = doc.nguoiPhanPhoi ?? t('documents.process.distributorFallback');
  const team = joinNames([t('documents.you'), ...teamNames(doc.thanhPhan, meId)], t('documents.and'));
  const busy = complete.isPending || returnDoc.isPending;

  const submit = () => {
    const onError = (error: unknown) => toast.error(errorMessage(error, t));
    if (mode === 'complete') {
      complete.mutate(
        { id: doc.id, ketQua: result },
        {
          onSuccess: () => {
            toast.success(t('documents.process.completed', { soDen: doc.soDen }));
            onDone('complete');
          },
          onError,
        },
      );
    } else {
      returnDoc.mutate(
        { id: doc.id, lyDo: reason },
        {
          onSuccess: () => {
            toast.success(t('documents.process.returned', { soDen: doc.soDen }));
            onDone('return');
          },
          onError,
        },
      );
    }
  };

  const text = mode === 'complete' ? result : reason;

  return (
    <BottomSheet
      testID="process-sheet"
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      icon={ClipboardListIcon}
      iconTone="brand"
      title={t('documents.process.title')}
      subtitle={t('documents.process.subtitle', { soDen: doc.soDen })}
      scrollable
      footer={
        mode === 'complete' ? (
          <Button testID="process-complete" icon={CheckCheckIcon} label={t('documents.process.complete')} disabled={!result.trim()} loading={busy} onPress={submit} />
        ) : (
          <Button testID="process-return" variant="danger-solid" icon={Undo2Icon} label={t('documents.process.returnSubmit')} disabled={!reason.trim()} loading={busy} onPress={submit} />
        )
      }
    >
      <Segmented<Mode>
        options={[
          { value: 'complete', label: t('documents.process.complete'), testID: 'process-tab-complete' },
          { value: 'return', label: t('documents.process.return'), testID: 'process-tab-return' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text weight="semibold" style={{ fontSize: 13.5, lineHeight: 18 }}>
            {mode === 'complete' ? t('documents.process.result') : t('documents.process.reason')}
            <Text className="text-danger"> *</Text>
          </Text>
          <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {`${text.length}/${MAX}`}
          </Text>
        </View>
        {mode === 'complete' ? (
          <NoteField testID="process-result" value={result} onChangeText={setResult} maxLength={MAX} placeholder={t('documents.process.resultPlaceholder')} />
        ) : (
          <NoteField testID="process-reason" value={reason} onChangeText={setReason} maxLength={MAX} placeholder={t('documents.process.reasonPlaceholder')} />
        )}
      </View>

      {mode === 'complete' ? (
        <Text className="text-muted" style={{ fontSize: 12.5, lineHeight: 18 }}>
          {t('documents.process.completeNote', { name: distributor })}
        </Text>
      ) : (
        <View className="rounded-[14px] bg-danger-tint p-3" testID="process-return-warning">
          <RichText className="text-danger-deep" style={{ fontSize: 13, lineHeight: 19 }}>
            {t('documents.process.returnWarning', { name: distributor, team })}
          </RichText>
        </View>
      )}
    </BottomSheet>
  );
}
