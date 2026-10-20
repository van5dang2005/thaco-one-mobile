import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { formatKey } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Banner } from '@/shared/ui/Banner';
import { Card } from '@/shared/ui/Card';
import { StampIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import { useStampQueue } from '../hooks/useStampQueue';
import type { StampDoc } from '../types';

/** "Chờ đóng dấu": registered outgoing / internal documents of my unit, newest first. Read-only: stamping is done on the web. */
export function StampQueueScreen() {
  const { t } = useTranslation();
  const query = useStampQueue();
  const pull = usePullRefresh(() => query.refetch());
  const docs = [...(query.data ?? [])].sort((a, b) => b.ngayVaoSo.localeCompare(a.ngayVaoSo) || b.soHieu.localeCompare(a.soHieu));

  const header = <ModuleHeader testID="stamp-header" icon={StampIcon} title={t('documents.stamp.title')} subtitle={t('documents.stamp.subtitle')} bottom={18} />;

  return (
    <ModuleScreen header={header} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}>
      {query.isLoading ? (
        <ListSkeleton count={2} lines={3} />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : docs.length ? (
        <>
          <Banner tone="info" icon={StampIcon}>
            {t('documents.stamp.webNote')}
          </Banner>
          {docs.map((doc) => (
            <StampDocRow key={doc.id} doc={doc} />
          ))}
        </>
      ) : (
        <EmptyState testID="stamp-empty" icon={StampIcon} message={t('documents.stamp.empty')} />
      )}
    </ModuleScreen>
  );
}

/** Số hiệu · loại · registered date, the summary, the signer, then kind and "Từ E-sign". */
function StampDocRow({ doc }: { doc: StampDoc }) {
  const { t } = useTranslation();
  return (
    <Card testID={`stamp-${doc.id}`} className="gap-1.5 p-3.5">
      <View className="flex-row items-center gap-2">
        <Text mono weight="bold" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>
          {doc.soHieu}
        </Text>
        <Text numberOfLines={1} className="flex-1 text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {doc.loai}
        </Text>
        <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {formatKey(doc.ngayVaoSo, false)}
        </Text>
      </View>
      <Text weight="semibold" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
        {doc.trichYeu}
      </Text>
      {doc.nguoiKy ? (
        <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {t('documents.stamp.signer', { name: doc.nguoiKy })}
        </Text>
      ) : null}
      <View className="mt-0.5 flex-row flex-wrap gap-2">
        <StatusBadge kind="wait" label={t(`documents.shared.kind.${doc.kind}`)} />
        {doc.tuEsign ? <StatusBadge kind="ok" label={t('documents.stamp.esign')} /> : null}
      </View>
    </Card>
  );
}
