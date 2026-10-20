import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { errorMessage } from '@/core/errors/errorMessage';
import { addDays, formatKey, todayKey, type DateKey } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card, Divider } from '@/shared/ui/Card';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';
import { FieldBox } from '@/shared/ui/FieldBox';
import { Icon } from '@/shared/ui/Icon';
import { CheckIcon, ForwardIcon, LockIcon, SearchIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { NoteField } from '@/shared/ui/NoteField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegmentedToggle } from '@/shared/ui/SegmentedToggle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StateViews';
import { SwitchRow } from '@/shared/ui/SwitchRow';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { toast } from '@/shared/ui/Toast';

import { DocPersonLine } from '../components/DocPersonLine';
import { useDocumentMe } from '../hooks/useDocumentMe';
import { useDistributionPeople } from '../hooks/useDistributionPeople';
import { useIncomingActions } from '../hooks/useIncomingActions';
import { useIncomingDoc } from '../hooks/useIncomingDoc';
import type { Assignment, DocPerson, DocRole, IncomingDoc } from '../types';
import { indexPeople, matchesQuery, searchPeople } from '../utils/text';
import { assignmentError, MAX_CHU_TRI, roleCounts, roleOf, toggleRole, withoutProcessing } from '../utils/assignment';

const MAX_OPINION = 500;
/** Default deadline when the document has none yet. */
const DEFAULT_DAYS = 7;
const ROLES: DocRole[] = ['chu_tri', 'phoi_hop', 'de_biet'];
/** Rows listed below the chosen people: the whole staff list is too long to render. */
const MAX_LISTED = 30;

function matches(person: DocPerson, query: string) {
  return matchesQuery(query, person.name, person.code, person.position);
}

/**
 * "Chuyển người xử lý" (8e): deadline, urgency, importance, the distributor's instruction, then each person's
 * role (one per person, at most two chủ trì). "Không yêu cầu xử lý" leaves only "để biết".
 */
export function AssignProcessingScreen() {
  const { t } = useTranslation();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useIncomingDoc(id);
  const doc = query.data;

  const header = (
    <ModuleHeader
      testID="assign-header"
      icon={ForwardIcon}
      title={t('documents.assign.title')}
      subtitle={doc ? t('documents.detail.subtitle', { soDen: doc.soDen, soHieu: doc.soHieu }) : undefined}
      subtitleMono
      bottom={20}
    />
  );

  if (!doc) {
    return <ModuleScreen header={header}>{query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <ListSkeleton count={3} />}</ModuleScreen>;
  }
  return <AssignForm doc={doc} header={header} />;
}

/** The form itself, mounted once the document is known so its fields start from the document's values. */
function AssignForm({ doc, header }: { doc: IncomingDoc; header: ReactNode }) {
  const { t } = useTranslation();
  const me = useDocumentMe();
  const people = useDistributionPeople(doc.id);
  const { assign } = useIncomingActions(me.data?.id);
  const today = todayKey();

  const [han, setHan] = useState<DateKey>(() => (doc.han && doc.han >= today ? doc.han : addDays(today, DEFAULT_DAYS)));
  const [khan, setKhan] = useState(doc.khan);
  const [quanTrong, setQuanTrong] = useState(doc.quanTrong);
  const [noProcessing, setNoProcessing] = useState(false);
  const [yKien, setYKien] = useState('');
  const [guiEmail, setGuiEmail] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState('');
  const [pickingDate, setPickingDate] = useState(false);

  const counts = roleCounts(assignments);
  const error = assignmentError(assignments, noProcessing);
  const unit = me.data?.unit;
  const index = useMemo(() => indexPeople(people.data ?? []), [people.data]);
  // Without a search, my own unit (the people a leader usually assigns).
  const colleagues = useMemo(() => (unit ? indexPeople((people.data ?? []).filter((p) => p.unit === unit)) : index), [people.data, unit, index]);

  const onRole = (person: DocPerson, role: DocRole) => {
    const result = toggleRole(assignments, person, role);
    if (result.rejected === 'max_chu_tri') {
      toast.error(t('documents.assign.maxChuTri'));
      return;
    }
    setAssignments(result.assignments);
  };

  const onNoProcessing = (value: boolean) => {
    setNoProcessing(value);
    if (value) setAssignments((list) => withoutProcessing(list));
  };

  const submit = () =>
    assign.mutate(
      { id: doc.id, han: noProcessing ? undefined : han, khan, quanTrong, khongYeuCauXuLy: noProcessing, yKien, guiEmail, thanhPhan: assignments },
      {
        onSuccess: () => {
          toast.success(t('documents.assign.success', { soDen: doc.soDen }));
          if (router.canGoBack()) router.back();
          else router.replace('/documents/incoming');
        },
        onError: (e) => toast.error(errorMessage(e, t)),
      },
    );

  // Chosen people first, in the order they were picked; then search results, or my unit, a screenful at most.
  const chosen = assignments.map((a) => a.person).filter((p) => matches(p, search));
  const others = searchPeople(search.trim() || !colleagues.length ? index : colleagues, search, MAX_LISTED + 1, (p) => !!roleOf(assignments, p.id));
  const more = others.length > MAX_LISTED;
  const roles = noProcessing ? (['de_biet'] as DocRole[]) : ROLES;

  const footer = [
    <Pressable
      key="email"
      testID="assign-email"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: guiEmail }}
      onPress={() => setGuiEmail((v) => !v)}
      className="min-h-[52px] flex-row items-center gap-2 pr-1 active:opacity-70"
    >
      <View className={cn('h-[22px] w-[22px] items-center justify-center rounded-[7px]', guiEmail ? 'bg-primary' : 'border-[1.5px] border-input-border')}>
        {guiEmail ? <Icon icon={CheckIcon} size={14} weight="bold" color="on-primary" /> : null}
      </View>
      <Text weight="medium" style={{ fontSize: 13.5, lineHeight: 18 }}>
        {t('documents.assign.email')}
      </Text>
    </Pressable>,
    <Button key="submit" testID="assign-submit" className="flex-1" icon={ForwardIcon} label={t('documents.assign.submit')} disabled={!!error} loading={assign.isPending} onPress={submit} />,
  ];

  return (
    <ModuleScreen
      header={header}
      footer={footer}
      footerNote={
        error ? (
          <Text testID="assign-error" className="text-danger" style={{ fontSize: 12.5, lineHeight: 17 }}>
            {t(`documents.assign.${error}`)}
          </Text>
        ) : undefined
      }
    >
      <Card className="gap-3 p-3.5" testID="assign-settings">
        {!noProcessing ? (
          <FieldBox testID="assign-deadline" className="flex-none" label={t('documents.assign.deadline')} value={formatKey(han)} mono onPress={() => setPickingDate(true)} />
        ) : null}
        <View className="gap-1.5">
          <Text weight="semibold" className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 16 }}>
            {t('documents.assign.urgency')}
          </Text>
          <SegmentedToggle
            testID="assign-urgency"
            options={[
              { value: 'normal', label: t('documents.assign.normal') },
              { value: 'urgent', label: t('documents.urgent') },
            ]}
            value={khan ? 'urgent' : 'normal'}
            onChange={(v) => setKhan(v === 'urgent')}
          />
        </View>
        <View className="gap-1.5">
          <Text weight="semibold" className="text-ink-2" style={{ fontSize: 12.5, lineHeight: 16 }}>
            {t('documents.assign.importance')}
          </Text>
          <SegmentedToggle
            testID="assign-importance"
            options={[
              { value: 'normal', label: t('documents.assign.normal') },
              { value: 'important', label: t('documents.important') },
            ]}
            value={quanTrong ? 'important' : 'normal'}
            onChange={(v) => setQuanTrong(v === 'important')}
          />
        </View>
        <Divider />
        <SwitchRow testID="assign-no-processing" label={t('documents.assign.noProcessing')} hint={t('documents.assign.noProcessingHint')} value={noProcessing} onChange={onNoProcessing} />
      </Card>

      <Card className="gap-2 p-3.5">
        <SectionTitle right={<Text mono className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>{`${yKien.length}/${MAX_OPINION}`}</Text>}>{t('documents.assign.opinion')}</SectionTitle>
        <NoteField testID="assign-opinion" value={yKien} onChangeText={setYKien} maxLength={MAX_OPINION} placeholder={t('documents.assign.opinionPlaceholder')} />
      </Card>

      <Card className="gap-3 p-3.5" testID="assign-team">
        <View className="gap-0.5">
          <SectionTitle>{t('documents.assign.team')}</SectionTitle>
          <Text testID="assign-counts" mono weight="semibold" className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {noProcessing ? t('documents.assign.countsNoProcessing', { deBiet: counts.de_biet }) : t('documents.assign.counts', { chuTri: counts.chu_tri, max: MAX_CHU_TRI, phoiHop: counts.phoi_hop, deBiet: counts.de_biet })}
          </Text>
        </View>
        <TextField testID="assign-search" leftIcon={SearchIcon} value={search} onChangeText={setSearch} placeholder={t('documents.assign.search')} autoCorrect={false} />

        {people.isLoading ? (
          <ListSkeleton count={3} lines={2} />
        ) : people.isError ? (
          <ErrorState compact error={people.error} onRetry={() => void people.refetch()} />
        ) : (
          [...chosen, ...others.slice(0, MAX_LISTED)].map((person, i) => (
            <View key={person.id}>
              {i > 0 ? <Divider /> : null}
              <View className="gap-2 py-1">
                <DocPersonLine person={person} isMe={person.id === me.data?.id} testID={`assign-person-${person.code}`} />
                <View className="flex-row gap-2">
                  {roles.map((role) => {
                    const selected = roleOf(assignments, person.id) === role;
                    const full = role === 'chu_tri' && !selected && counts.chu_tri >= MAX_CHU_TRI;
                    return <RoleButton key={role} label={t(`documents.role.${role}`)} selected={selected} locked={full} onPress={() => onRole(person, role)} testID={`assign-${person.code}-${role}`} />;
                  })}
                </View>
              </View>
            </View>
          ))
        )}
        {!people.isLoading && !chosen.length && !others.length ? (
          <Text className="py-2 text-center text-muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t('documents.noPeople')}
          </Text>
        ) : null}
        {more ? (
          <Text testID="assign-more" className="py-1 text-center text-muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
            {t('documents.assign.searchMore')}
          </Text>
        ) : null}
      </Card>

      <DatePickerSheet testID="assign-date" visible={pickingDate} onClose={() => setPickingDate(false)} title={t('documents.assign.pickDeadline')} value={han} minDate={today} onSelect={(value) => { setHan(value); setPickingDate(false); }} />
    </ModuleScreen>
  );
}

/** One role choice on a person's row: tap to give it, tap again to take it back. A full chủ trì list shows a lock but still explains on tap. */
function RoleButton({ label, selected, locked, onPress, testID }: { label: string; selected: boolean; locked: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        'h-11 flex-1 flex-row items-center justify-center gap-1 rounded-[12px] active:opacity-80',
        selected ? 'bg-primary' : locked ? 'bg-disabled' : 'border border-input-border bg-elevated',
      )}
    >
      {selected ? <Icon icon={CheckIcon} size={14} weight="bold" color="on-primary" /> : locked ? <Icon icon={LockIcon} size={13} color="disabled-text" /> : null}
      <Text weight="semibold" numberOfLines={1} className={selected ? 'text-on-primary' : locked ? 'text-disabled-text' : 'text-ink-2'} style={{ fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}
