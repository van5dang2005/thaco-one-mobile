import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { formatKey } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Card, Divider, FloatingCard } from '@/shared/ui/Card';
import { HeaderPill } from '@/shared/ui/HeaderPill';
import { Icon } from '@/shared/ui/Icon';
import { ChevronDownIcon, ChevronUpIcon, DownloadIcon, EyeIcon, FileTextIcon, Share2Icon } from '@/shared/ui/icons';
import { KeyValueRow } from '@/shared/ui/KeyValueRow';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';

import { FileRow } from '../components/FileRow';
import { PermissionChips } from '../components/PermissionChips';
import { ShareSheet } from '../components/ShareSheet';
import { useDocumentMe } from '../hooks/useDocumentMe';
import { useDownloadDocFile } from '../hooks/useDownloadDocFile';
import { useOpenDocFile } from '../hooks/useOpenDocFile';
import { useSharedActions } from '../hooks/useSharedActions';
import { useSharedDoc } from '../hooks/useSharedDoc';
import type { DocFile, SharedDoc } from '../types';

/** A document shared with me (8h): main file, attachments, other versions, details, my rights; download and re-share by right. */
export function SharedDetailScreen() {
  const { t } = useTranslation();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useSharedDoc(id);
  const me = useDocumentMe();
  const { markRead } = useSharedActions();
  const doc = query.data;
  const open = useOpenDocFile({ canDownload: !!doc?.quyen.tai });
  const save = useDownloadDocFile();
  const pull = usePullRefresh(() => query.refetch());
  const [sharing, setSharing] = useState(false);

  const unread = doc && !doc.daXem;
  useEffect(() => {
    if (unread) markRead.mutate(id);
    // Once per opening: the mutation object changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unread]);

  const header = (content?: ReactNode, bottom = 18) => (
    <ModuleHeader
      testID="shared-detail-header"
      icon={FileTextIcon}
      title={doc ? t(`documents.sharedDetail.title.${doc.kind}`) : t('documents.shared.title')}
      subtitle={doc?.soHieu}
      subtitleMono
      bottom={bottom}
    >
      {content}
    </ModuleHeader>
  );

  if (!doc) {
    return <ModuleScreen header={header(undefined, 24)}>{query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <ListSkeleton count={3} />}</ModuleScreen>;
  }

  const canShare = doc.quyen.chiaSe && !doc.daHuy;
  const footer = [
    <Button
      key="download"
      testID="shared-download"
      className="flex-1"
      variant="ghost"
      icon={DownloadIcon}
      label={t('documents.sharedDetail.download')}
      disabled={!doc.quyen.tai || !doc.vanBan}
      loading={save.pending}
      onPress={() => doc.vanBan && void save.download(doc.vanBan)}
    />,
    <Button key="share" testID="shared-share" className="flex-1" icon={Share2Icon} label={t('documents.sharedDetail.shareOn')} disabled={!canShare} onPress={() => setSharing(true)} />,
  ];

  return (
    <ModuleScreen
      header={header(<SharedHero doc={doc} />)}
      floating={doc.vanBan ? <MainFileCard doc={doc} file={doc.vanBan} onOpen={open} /> : undefined}
      floatingScrolls
      footer={footer}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
    >
      {doc.daHuy ? <Banner tone="off">{doc.lyDoHuy ? t('documents.sharedDetail.cancelledReason', { reason: doc.lyDoHuy }) : t('documents.sharedDetail.cancelled')}</Banner> : null}

      {doc.tep.length ? (
        <Card className="gap-1 p-3.5" testID="shared-attachments">
          <SectionTitle>{t('documents.sharedDetail.attachments', { count: doc.tep.length })}</SectionTitle>
          {doc.tep.map((file, i) => (
            <View key={file.id}>
              {i > 0 ? <Divider inset={52} /> : null}
              <FileRow file={file} onPress={doc.quyen.xem ? () => open(file) : undefined} />
            </View>
          ))}
        </Card>
      ) : null}

      {doc.phienBan.length ? <VersionsCard doc={doc} onOpen={open} /> : null}

      <Card className="px-3.5 py-1.5" testID="shared-info">
        <KeyValueRow label={t('documents.sharedDetail.signer')} value={doc.nguoiKy ?? '–'} />
        <KeyValueRow divider label={t('documents.sharedDetail.drafter')} value={doc.nguoiDuThao ?? '–'} />
        <KeyValueRow divider label={t('documents.sharedDetail.urgency')} value={doc.doKhan ?? '–'} />
        <KeyValueRow divider label={t('documents.sharedDetail.secrecy')} value={doc.doMat ?? '–'} />
        <KeyValueRow divider mono label={t('documents.sharedDetail.sentOn')} value={formatKey(doc.ngayGui)} />
        {doc.hanPhanHoi ? <KeyValueRow divider mono label={t('documents.sharedDetail.replyBy')} value={formatKey(doc.hanPhanHoi)} /> : null}
      </Card>

      <Card className="gap-2.5 p-3.5">
        <SectionTitle>{t('documents.sharedDetail.yourRights')}</SectionTitle>
        <PermissionChips quyen={doc.quyen} />
      </Card>

      {sharing && me.data ? <ShareSheet doc={doc} meId={me.data.id} visible onClose={() => setSharing(false)} /> : null}
    </ModuleScreen>
  );
}

/** On the header: the document type pill, the summary, issuing unit · date. */
function SharedHero({ doc }: { doc: SharedDoc }) {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  return (
    <View className="gap-2 pb-2">
      <View className="flex-row">
        <HeaderPill label={doc.loai} />
      </View>
      <Text weight="bold" accessibilityRole="header" className={doc.daHuy ? 'line-through' : undefined} style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: fg }}>
        {doc.trichYeu}
      </Text>
      <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17, color: text2 }}>
        {t('documents.sharedDetail.issuedBy', { donVi: doc.donVi, date: formatKey(doc.ngayGui) })}
      </Text>
    </View>
  );
}

/** Floating card: the stamped main file with "Xem". */
function MainFileCard({ doc, file, onOpen }: { doc: SharedDoc; file: DocFile; onOpen: (file: DocFile) => void }) {
  const { t } = useTranslation();
  return (
    <FloatingCard radius={20} className="px-3.5 py-3">
      <FileRow
        file={file}
        testID="shared-main-file"
        trailing={<Button testID="shared-view" size="sm" variant="soft" icon={EyeIcon} label={t('documents.view')} disabled={!doc.quyen.xem} onPress={() => onOpen(file)} />}
      />
    </FloatingCard>
  );
}

/** "Phiên bản khác · N", collapsed by default. */
function VersionsCard({ doc, onOpen }: { doc: SharedDoc; onOpen: (file: DocFile) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-3.5" testID="shared-versions">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} className="min-h-[32px] flex-row items-center justify-between active:opacity-70">
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>
          {t('documents.sharedDetail.versions', { count: doc.phienBan.length })}
        </Text>
        <Icon icon={open ? ChevronUpIcon : ChevronDownIcon} size={18} color="muted" />
      </Pressable>
      {open
        ? doc.phienBan.map((file) => (
            <View key={file.id} className="mt-2">
              <FileRow file={file} onPress={doc.quyen.xem ? () => onOpen(file) : undefined} />
            </View>
          ))
        : null}
    </Card>
  );
}
