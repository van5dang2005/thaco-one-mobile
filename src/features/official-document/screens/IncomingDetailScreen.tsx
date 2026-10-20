import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDate, formatKey, formatTime, parseServerDate, todayKey } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Avatar } from '@/shared/ui/Avatar';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Card, Divider, FloatingCard } from '@/shared/ui/Card';
import { CheckCheckIcon, ForwardIcon, InboxIcon, Undo2Icon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { onBlue, useHeaderColors } from '@/shared/ui/ScreenShell';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';

import { DocPersonLine } from '../components/DocPersonLine';
import { FileRow } from '../components/FileRow';
import { ProcessSheet } from '../components/ProcessSheet';
import { RoleBadge } from '../components/RoleBadge';
import { useDocumentMe } from '../hooks/useDocumentMe';
import { useIncomingActions } from '../hooks/useIncomingActions';
import { useIncomingDoc } from '../hooks/useIncomingDoc';
import { useOpenDocFile } from '../hooks/useOpenDocFile';
import type { DocRole, IncomingDoc } from '../types';
import { deadlineOf } from '../utils/deadline';
import { needsDistribution } from '../utils/incoming';

const ROLES: DocRole[] = ['chu_tri', 'phoi_hop', 'de_biet'];

/**
 * Incoming document (8d). The footer follows the back-end's rights: a distributor assigns it (`canPhanPhoiXuLy`),
 * the chủ trì completes or returns it (`canHoanTat` / `canTraLai`); phối hợp and để biết only read. Opening it
 * marks it read for a distributor.
 */
export function IncomingDetailScreen() {
  const { t } = useTranslation();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useIncomingDoc(id);
  const me = useDocumentMe();
  const meId = me.data?.id ?? '';
  const { markRead } = useIncomingActions(meId);
  const pull = usePullRefresh(() => query.refetch());
  const [sheet, setSheet] = useState<'complete' | 'return' | null>(null);
  const doc = query.data;

  const unread = doc && !doc.daXem;
  useEffect(() => {
    if (unread) markRead.mutate(id);
    // Once per opening: the mutation object changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unread]);

  const header = (content?: ReactNode, bottom = 18) => (
    <ModuleHeader
      testID="incoming-detail-header"
      icon={InboxIcon}
      title={t('documents.detail.title')}
      subtitle={doc ? t('documents.detail.subtitle', { soDen: doc.soDen, soHieu: doc.soHieu }) : undefined}
      subtitleMono
      bottom={bottom}
    >
      {content}
    </ModuleHeader>
  );

  if (!doc) {
    return <ModuleScreen header={header(undefined, 24)}>{query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <ListSkeleton count={3} />}</ModuleScreen>;
  }

  const processing = doc.trangThai === 'dang_xu_ly' && !doc.daHuy;
  const footer: ReactNode[] = [];
  if (needsDistribution(doc)) {
    footer.push(
      <Button
        key="assign"
        testID="detail-assign"
        className="flex-1"
        icon={ForwardIcon}
        label={doc.trangThai === 'bi_tra_lai' ? t('documents.incoming.redistribute') : t('documents.incoming.distribute')}
        onPress={() => router.push({ pathname: '/documents/incoming/[id]/assign', params: { id: doc.id } })}
      />,
    );
  } else if (processing && doc.coTheXuLy) {
    footer.push(<Button key="return" testID="detail-return" variant="danger-outline" icon={Undo2Icon} label={t('documents.process.return')} onPress={() => setSheet('return')} />);
    footer.push(<Button key="complete" testID="detail-complete" className="flex-1" icon={CheckCheckIcon} label={t('documents.process.complete')} onPress={() => setSheet('complete')} />);
  }

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/documents/incoming'));

  return (
    <ModuleScreen
      header={header(<DetailHero doc={doc} />)}
      floating={doc.han && !doc.daHuy ? <DeadlineCard doc={doc} /> : undefined}
      floatingScrolls
      footer={footer.length ? footer : undefined}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
    >
      {doc.daHuy ? <Banner tone="off">{t('documents.detail.cancelledNote')}</Banner> : null}
      {doc.trangThai === 'bi_tra_lai' && doc.lyDoTraLai ? <Banner tone="danger">{t('documents.detail.returnedNote', { reason: doc.lyDoTraLai })}</Banner> : null}
      {doc.vaiTro === 'de_biet' && processing ? <Banner tone="info">{t('documents.detail.readOnly')}</Banner> : null}
      {doc.vaiTro === 'phoi_hop' && processing ? <Banner tone="info">{t('documents.detail.coordinate')}</Banner> : null}

      {doc.ketQua ? (
        <Card className="gap-1.5 p-3.5" testID="detail-result">
          <SectionTitle right={doc.ngayHoanTat ? t('documents.detail.completedOn', { date: formatKey(doc.ngayHoanTat) }) : undefined}>{t('documents.detail.result')}</SectionTitle>
          <Text style={{ fontSize: 14, lineHeight: 20 }}>{doc.ketQua}</Text>
        </Card>
      ) : null}

      {doc.nguoiPhanPhoi ? <DistributionCard doc={doc} meName={me.data?.name} /> : null}

      {doc.thanhPhan.length ? <TeamCard doc={doc} meId={meId} /> : null}

      <FilesCard doc={doc} />

      {sheet === 'complete' || sheet === 'return' ? (
        <ProcessSheet
          doc={doc}
          meId={meId}
          visible
          initialMode={sheet}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            leave();
          }}
        />
      ) : null}
    </ModuleScreen>
  );
}

/** On the header: "Cần xử lý · chủ trì" (white) and "Khẩn" (red), the summary, then agency · received date. */
function DetailHero({ doc }: { doc: IncomingDoc }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fg, text2 } = useHeaderColors();
  const actionable = doc.trangThai === 'dang_xu_ly' && !doc.daHuy && (doc.coTheXuLy || doc.vaiTro === 'phoi_hop');
  const status = doc.daHuy
    ? t('documents.incoming.cancelled')
    : doc.trangThai === 'bi_tra_lai'
      ? t('documents.incoming.returned')
      : doc.trangThai === 'cho_phan_phoi'
        ? t('documents.incoming.waitingDistribution')
        : doc.trangThai === 'da_xu_ly'
          ? t('documents.incoming.done')
          : doc.trangThai === 'khong_xu_ly'
            ? t('documents.incoming.noProcessing')
            : doc.vaiTro
              ? actionable
                ? t('documents.detail.needsAction', { role: t(`documents.role.${doc.vaiTro}`).toLocaleLowerCase('vi') })
                : t('documents.detail.yourRole', { role: t(`documents.role.${doc.vaiTro}`).toLocaleLowerCase('vi') })
              : null;

  return (
    <View className="gap-2 pb-2">
      <View className="flex-row flex-wrap gap-2">
        {status ? (
          <View className="h-[26px] justify-center rounded-full px-2.5" style={{ backgroundColor: actionable ? fg : onBlue(0.14) }}>
            <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 16, color: actionable ? colors.primary : fg }}>
              {status}
            </Text>
          </View>
        ) : null}
        {doc.khan ? (
          <View className="h-[26px] justify-center rounded-full px-2.5" style={{ backgroundColor: colors.danger }}>
            <Text weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 16, color: '#FFFFFF' }}>
              {t('documents.urgent')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text weight="bold" accessibilityRole="header" style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: fg }}>
        {doc.trichYeu}
      </Text>
      <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17, color: text2 }}>
        {t('documents.detail.receivedFrom', { coQuan: doc.coQuan, date: formatKey(doc.ngayNhan) })}
      </Text>
    </View>
  );
}

/** Floating card: the deadline in mono and how far away it is. */
function DeadlineCard({ doc }: { doc: IncomingDoc }) {
  const { t } = useTranslation();
  const deadline = deadlineOf(doc.han, todayKey());
  const done = doc.trangThai === 'da_xu_ly' || doc.trangThai === 'khong_xu_ly';
  const overdue = !done && deadline?.state === 'overdue';
  const rest =
    done || !deadline
      ? null
      : deadline.state === 'overdue'
        ? t('documents.deadline.overdue', { count: deadline.days })
        : deadline.state === 'today'
          ? t('documents.deadline.today')
          : deadline.state === 'left'
            ? t('documents.deadline.leftLower', { count: deadline.days })
            : null;
  return (
    <FloatingCard className="mx-4 flex-row items-center justify-between gap-3 px-4 py-3.5" radius={20}>
      <Text weight="semibold" className="text-muted" style={{ fontSize: 13, lineHeight: 17 }}>
        {t('documents.detail.deadline')}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text mono weight="bold" className={overdue ? 'text-danger' : undefined} style={{ fontSize: 16, lineHeight: 21 }}>
          {doc.han ? formatKey(doc.han) : '–'}
        </Text>
        {rest ? (
          <Text weight="semibold" className={overdue ? 'text-danger' : 'text-muted'} style={{ fontSize: 12.5, lineHeight: 16 }}>
            {`· ${rest}`}
          </Text>
        ) : null}
      </View>
    </FloatingCard>
  );
}

/** Who assigned the processing, when, and their instruction. */
function DistributionCard({ doc, meName }: { doc: IncomingDoc; meName?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = doc.nguoiPhanPhoi!;
  const at = parseServerDate(doc.phanPhoiLuc ?? null);
  return (
    <Card className="gap-3 p-3.5" testID="detail-distribution">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} size={38} />
        <View className="min-w-0 flex-1">
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>
            {name === meName ? t('documents.youName', { name }) : name}
          </Text>
          {at ? (
            <Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
              {t('documents.detail.distributedAt', { time: formatTime(at), date: formatDate(at).slice(0, 5) })}
            </Text>
          ) : null}
        </View>
      </View>
      {doc.yKienPhanPhoi ? (
        <View className="rounded-[12px] bg-panel px-3 py-2.5" style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}>
          <Text style={{ fontSize: 13.5, lineHeight: 19 }}>{doc.yKienPhanPhoi}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** "Thành phần xử lý" grouped by role; my own row reads "Bạn · …". */
function TeamCard({ doc, meId }: { doc: IncomingDoc; meId: string }) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3 p-3.5" testID="detail-team">
      <SectionTitle>{t('documents.detail.team')}</SectionTitle>
      {ROLES.map((role) => {
        const people = doc.thanhPhan.filter((a) => a.role === role);
        if (!people.length) return null;
        return (
          <View key={role} className="gap-2">
            <RoleBadge role={role} />
            {people.map((a, i) => (
              <View key={a.person.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <DocPersonLine person={a.person} isMe={a.person.id === meId} />
              </View>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

/** "Tệp N": the stamped document first, then attachments. */
function FilesCard({ doc }: { doc: IncomingDoc }) {
  const { t } = useTranslation();
  const open = useOpenDocFile();
  if (!doc.tep.length) return null;
  return (
    <Card className="gap-1 p-3.5" testID="detail-files">
      <SectionTitle>{t('documents.detail.files', { count: doc.tep.length })}</SectionTitle>
      {doc.tep.map((file, i) => (
        <View key={file.id}>
          {i > 0 ? <Divider inset={52} /> : null}
          <FileRow file={file} onPress={() => open(file)} testID={`detail-file-${i}`} />
        </View>
      ))}
    </Card>
  );
}
