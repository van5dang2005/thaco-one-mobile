import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Card, Divider } from '@/shared/ui/Card';
import { CountBadge } from '@/shared/ui/CountBadge';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import {
  type AppIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  ClockAlertIcon,
  FileDownIcon,
  MailIcon,
  ScrollTextIcon,
  SearchIcon,
  Share2Icon,
  StampIcon,
  UserCheckIcon,
} from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen, OVERLAP } from '@/shared/ui/ModuleScreen';
import { RoundIcon } from '@/shared/ui/RoundIcon';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import { StatTile } from '@/shared/ui/StatTile';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';

import { DocumentsHeaderArt } from '../components/DocumentsHeaderArt';
import { TaskCard } from '../components/TaskCard';
import { useDocumentMe } from '../hooks/useDocumentMe';
import { useDocumentSummary } from '../hooks/useDocumentSummary';
import { useDocumentTasks } from '../hooks/useDocumentTasks';
import { byUrgency, tasksOnDay } from '../utils/tasks';
import { shortUnit } from '../utils/text';

const TODAY_TASKS = 3;

/** Văn thư home (8a): how much waits for me, four counters that open the matching list, the incoming and shared lists, today's tasks. */
export function DocumentsHomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fg, text2, text3 } = useHeaderColors();
  const me = useDocumentMe();
  const { summary, isLoading, isError, error, refetch } = useDocumentSummary();
  const tasks = useDocumentTasks();
  const pull = usePullRefresh(refetch);
  const today = todayKey();
  const openToday = tasksOnDay(tasks.data ?? [], today, today)
    .filter((task) => !task.cancelled && !task.done)
    .sort(byUrgency);
  const todayTasks = openToday.slice(0, TODAY_TASKS);
  const moreToday = openToday.length - todayTasks.length;

  const header = (
    <ModuleHeader
      testID="documents-header"
      icon={ScrollTextIcon}
      art={<DocumentsHeaderArt />}
      title={t('documents.title')}
      subtitle={shortUnit(me.data?.unit ?? '') || t('documents.home.subtitleFallback')}
      right={<HeaderIconButton testID="documents-search" icon={SearchIcon} label={t('documents.search')} onPress={() => router.push({ pathname: '/documents/incoming', params: { search: '1' } })} />}
      bottom={12 + OVERLAP}
    >
      {/* Equal blue above the date and under the count (to the cards' top edge): the block sits mid-header. */}
      <Text weight="bold" className="mt-3.5" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.66, color: text3 }}>
        {t('documents.home.date', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) }).toLocaleUpperCase()}
      </Text>
      <View className="mt-1.5 flex-row items-center gap-3" accessible accessibilityLabel={t('documents.home.pendingA11y', { count: summary?.pending ?? 0 })}>
        {/* Proportional digits: mono ones sit centered in a wide cell, so "1" or "7" would start right of the date. */}
        <Text weight="bold" maxFontSizeMultiplier={1.1} style={{ marginLeft: -1, fontSize: 52, lineHeight: 58, letterSpacing: -1, color: fg }}>
          {summary ? String(summary.pending) : '–'}
        </Text>
        <View className="flex-1">
          <Text weight="bold" style={{ fontSize: 17, lineHeight: 22, color: fg }}>
            {t('documents.home.heroUnit')}
          </Text>
          <Text weight="medium" style={{ fontSize: 13, lineHeight: 18, color: text2 }}>
            {t('documents.home.heroWaiting')}
          </Text>
        </View>
      </View>
    </ModuleHeader>
  );

  const goIncoming = (tab: 'phan_phoi' | 'xu_ly') => router.push({ pathname: '/documents/incoming', params: { tab } });

  return (
    <ModuleScreen header={header} overlap refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}>
      {isError && !summary ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <View className="mt-2 gap-2.5" testID="documents-stats">
            <View className="flex-row gap-2.5">
              <StatTile
                testID="documents-stat-handle"
                icon={ClipboardListIcon}
                tone="wait"
                label={t('documents.home.toHandle')}
                value={summary?.toHandle}
                hint={summary ? (summary.toHandle ? t('documents.home.toHandleHint', { distribute: summary.toDistribute, process: summary.toProcess }) : t('documents.home.toHandleNone')) : undefined}
                onPress={() => goIncoming(summary && !summary.toDistribute && summary.toProcess ? 'xu_ly' : 'phan_phoi')}
              />
              <StatTile
                testID="documents-stat-unread"
                icon={MailIcon}
                tone="warn"
                label={t('documents.home.unread')}
                value={summary?.unread}
                hint={summary ? (summary.unread ? t('documents.home.unreadHint') : t('documents.home.unreadNone')) : undefined}
                onPress={() => router.push({ pathname: '/documents/incoming', params: { tab: 'phan_phoi', unread: summary?.unread ? '1' : undefined } })}
              />
            </View>
            <View className="flex-row gap-2.5">
              <StatTile
                testID="documents-stat-stamp"
                icon={StampIcon}
                color={{ tint: colors['document-tint'], solid: colors.document }}
                label={t('documents.home.toStamp')}
                value={summary?.toStamp}
                hint={summary ? (summary.toStamp ? t('documents.home.toStampHint', { di: summary.toStampDi, noiBo: summary.toStampNoiBo }) : t('documents.home.toStampNone')) : undefined}
                onPress={() => router.push('/documents/stamp')}
              />
              <StatTile
                testID="documents-stat-overdue"
                icon={ClockAlertIcon}
                tone="danger"
                label={t('documents.home.overdue')}
                value={summary?.overdue}
                hint={summary ? (summary.overdue ? t('documents.home.overdueHint', { count: summary.worstOverdueDays }) : t('documents.home.overdueNone')) : undefined}
                hintTone={summary?.overdue ? 'danger' : undefined}
                onPress={() => router.push({ pathname: '/documents/tasks', params: { tab: 'qua_han' } })}
              />
            </View>
          </View>

          <Card testID="documents-links">
            <LinkRow
              testID="documents-link-incoming"
              icon={FileDownIcon}
              label={t('documents.home.incoming')}
              hint={summary ? (summary.toHandle ? t('documents.home.incomingHint', { distribute: summary.toDistribute, process: summary.toProcess }) : t('documents.home.incomingNone')) : undefined}
              onPress={() => router.push('/documents/incoming')}
            />
            <Divider inset={64} />
            <LinkRow
              testID="documents-link-shared"
              icon={Share2Icon}
              label={t('documents.home.shared')}
              hint={summary ? (summary.unreadShared ? t('documents.home.sharedUnread', { count: summary.unreadShared }) : t('documents.home.sharedNone')) : undefined}
              badge={summary?.unreadShared}
              onPress={() => router.push('/documents/shared')}
            />
          </Card>

          <SectionTitle
            className="mt-2"
            right={
              <Pressable testID="documents-calendar-link" accessibilityRole="link" hitSlop={10} onPress={() => router.push('/documents/tasks')} className="flex-row items-center gap-0.5 active:opacity-70">
                <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
                  {t('documents.home.calendar')}
                </Text>
                <Icon icon={ChevronRightIcon} size={15} color="primary" weight="bold" />
              </Pressable>
            }
          >
            {openToday.length ? t('documents.home.todayCount', { count: openToday.length }) : t('documents.home.today')}
          </SectionTitle>
          {isLoading ? (
            <CardSkeleton lines={3} />
          ) : todayTasks.length ? (
            <>
              {todayTasks.map((task) => (
                <TaskCard key={task.id} task={task} today={today} compact onPress={() => router.push({ pathname: '/documents/incoming/[id]', params: { id: task.docId } })} />
              ))}
              {moreToday > 0 ? (
                <Pressable testID="documents-today-more" accessibilityRole="link" onPress={() => router.push('/documents/tasks')} className="flex-row items-center justify-center gap-1 py-1 active:opacity-70">
                  <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
                    {t('documents.home.todayMore', { count: moreToday })}
                  </Text>
                  <Icon icon={ChevronRightIcon} size={15} color="primary" weight="bold" />
                </Pressable>
              ) : null}
            </>
          ) : (
            <EmptyState testID="documents-today-empty" icon={UserCheckIcon} message={t('documents.home.todayEmpty')} />
          )}
        </>
      )}
    </ModuleScreen>
  );
}

type LinkRowProps = {
  icon: AppIcon;
  label: string;
  hint?: string;
  /** Red count before the chevron (unread shared documents). */
  badge?: number;
  onPress: () => void;
  testID?: string;
};

/** A row of the list-links card: icon, label, one-line status, optional count, chevron. */
function LinkRow({ icon, label, hint, badge, onPress, testID }: LinkRowProps) {
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={`${label}. ${hint ?? ''}`} onPress={onPress} className="flex-row items-center gap-3 px-3.5 py-3 active:opacity-70">
      <RoundIcon icon={icon} size={38} />
      <View className="flex-1 gap-0.5">
        <Text weight="semibold" numberOfLines={1} className="text-ink" style={{ fontSize: 15, lineHeight: 20 }}>
          {label}
        </Text>
        {hint ? (
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {badge ? <CountBadge count={badge} /> : null}
      <Icon icon={ChevronRightIcon} size={18} color="subtle" />
    </Pressable>
  );
}
