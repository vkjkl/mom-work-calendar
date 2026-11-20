import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSettings } from '../../hooks/SettingsContext';
import { useShifts } from '../../hooks/ShiftContext';
import { useToday } from '../../hooks/useToday';
import { isWorkingShift, shiftName } from '../../constants/shifts';
import { formatDate, isRTL, plural, t } from '../../i18n';
import { formatMoney } from '../../constants/currencies';
import { ThemeColors } from '../../constants/colors';
import { Type } from '../../constants/theme';
import { computeStats, monthRange, yearRange } from '../../utils/statsCalculation';
import { fromDateKey, monthFromIndex, monthIndexOf } from '../../utils/dates';
import { formatWorkDays } from '../../utils/time';
import { withAlpha } from '../../utils/color';
import { haptic } from '../../utils/haptics';
import { CalendarSwitcher } from '../../components/CalendarSwitcher';
import { YearlyOverview } from '../../components/YearlyOverview';
import { DistributionBar, Segment } from '../../components/stats/DistributionBar';
import { MonthlyHoursChart } from '../../components/stats/MonthlyHoursChart';
import { Card, Divider, EmptyState, Button, Segmented, SectionLabel } from '../../components/ui/primitives';
import { Tap } from '../../components/ui/Tap';

type Period = 'month' | 'year';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function StatTile({ icon, iconColor, label, value, sub, colors }: { icon: IconName; iconColor: string; label: string; value: string; sub?: string; colors: ThemeColors }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={`${label}: ${value}${sub ? ', ' + sub : ''}`}>
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: withAlpha(iconColor, 0.14) }]}>
          <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      {sub ? <Text style={[styles.tileSub, { color: colors.textMuted }]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

function Row({ label, value, colors, strong, swatch, note }: { label: string; value: string; colors: ThemeColors; strong?: boolean; swatch?: string; note?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      {swatch && <View style={[styles.rowSwatch, { backgroundColor: swatch }]} />}
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color: strong ? colors.text : colors.textSecondary }, strong && styles.rowStrong]}>{label}</Text>
        {note ? <Text style={[styles.rowNote, { color: colors.textMuted }]}>{note}</Text> : null}
      </View>
      <Text style={[styles.rowValue, { color: colors.text }, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { colors, baseRate, overtimeRate, paidLeaveHours, currencyCode, weekStart, language } = useAppSettings();
  const {
    shiftData, overtimeData, leaveData, notesData, allShifts, leaveTypes, calendars, activeCalendarId, switchCalendar,
  } = useShifts();
  const router = useRouter();
  const today = useToday();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const todayMonthIdx = monthIndexOf(fromDateKey(today));

  const [period, setPeriod] = useState<Period>('month');
  const [monthIdx, setMonthIdx] = useState(todayMonthIdx);
  const month = monthFromIndex(monthIdx);
  const year = month.getFullYear();

  const base = { shifts: shiftData, overtime: overtimeData, leave: leaveData, notes: notesData, allShifts, leaveTypes, baseRate, overtimeRate, paidLeaveHours };
  const stats = useMemo(
    () => computeStats({ ...base, ...(period === 'month' ? monthRange(year, month.getMonth()) : yearRange(year)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, monthIdx, shiftData, overtimeData, leaveData, notesData, allShifts, leaveTypes, baseRate, overtimeRate, paidLeaveHours]
  );
  const monthlyDays = useMemo(
    () => (period === 'year' ? Array.from({ length: 12 }, (_, m) => computeStats({ ...base, ...monthRange(year, m) }).workingDays) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, year, shiftData, overtimeData, leaveData, allShifts, leaveTypes, paidLeaveHours]
  );

  const hasRates = baseRate > 0;
  const isCurrent = period === 'month' ? monthIdx === todayMonthIdx : year === fromDateKey(today).getFullYear();
  const periodTitle = period === 'month' ? formatDate(month, 'MMMM yyyy') : String(year);
  const empty = stats.assignedDays === 0;

  const segments: Segment[] = [
    ...allShifts.filter(isWorkingShift).map((s) => ({ key: s.code, label: shiftName(s), color: s.color, value: stats.counts[s.code] })),
    ...allShifts.filter((s) => !isWorkingShift(s)).map((s) => ({ key: s.code, label: shiftName(s), color: s.color, value: stats.counts[s.code] })),
  ];

  const step = (dir: 1 | -1) => {
    haptic.selection();
    setMonthIdx((i) => i + dir * (period === 'month' ? 1 : 12));
  };

  const openMonth = (m: number) => {
    haptic.selection();
    setMonthIdx(year * 12 + m);
    setPeriod('month');
  };

  const half = wide ? styles.half : undefined;

  return (
    <SafeAreaView key={language} edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, wide && styles.scrollWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[Type.display, { color: colors.text }]} accessibilityRole="header">
            {t('Stats')}
          </Text>
          <Segmented
            options={[
              { value: 'month', label: t('Month') },
              { value: 'year', label: t('Year') },
            ]}
            value={period}
            onChange={(p) => {
              haptic.selection();
              setPeriod(p as Period);
            }}
            colors={colors}
            style={styles.segmented}
          />
        </View>

        <View style={[styles.nav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Tap onPress={() => step(-1)} accessibilityLabel={period === 'month' ? t('Previous month') : t('Previous year')} style={styles.navBtn}>
            <MaterialCommunityIcons name={isRTL ? 'chevron-right' : 'chevron-left'} size={24} color={colors.text} />
          </Tap>
          <View style={styles.navCenter}>
            <Text style={[styles.navTitle, { color: colors.text }]}>{periodTitle}</Text>
            {!isCurrent && (
              <Tap onPress={() => setMonthIdx(todayMonthIdx)} accessibilityLabel={t('Back to current period')}>
                <Text style={[styles.navToday, { color: colors.primaryText }]}>
                  {period === 'month' ? t('Back to this month') : t('Back to this year')}
                </Text>
              </Tap>
            )}
          </View>
          <Tap onPress={() => step(1)} accessibilityLabel={period === 'month' ? t('Next month') : t('Next year')} style={styles.navBtn}>
            <MaterialCommunityIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={24} color={colors.text} />
          </Tap>
        </View>

        <View style={styles.switcher}>
          <CalendarSwitcher calendars={calendars} activeCalendarId={activeCalendarId} onSwitch={switchCalendar} colors={colors} />
        </View>

        {empty ? (
          <Card colors={colors} style={styles.section}>
            <EmptyState
              icon="chart-box-outline"
              title={t('Nothing scheduled in {period}', { period: periodTitle })}
              message={t('Assign shifts on the calendar and your work days and pay estimate will show up here.')}
              colors={colors}
              action={<Button label={t('Open calendar')} icon="calendar-month" onPress={() => router.navigate('/')} colors={colors} style={styles.emptyBtn} />}
            />
          </Card>
        ) : (
          <>
            <Card colors={colors} style={styles.section}>
              <View style={styles.heroTop}>
                <View style={styles.flex}>
                  <Text style={[Type.overline, { color: colors.textMuted }]}>{t('Worked days')}</Text>
                  <Text style={[styles.hero, { color: colors.text }]} accessibilityLabel={`${t('Worked days')} ${formatWorkDays(stats.workingDays)}`}>
                    {formatWorkDays(stats.workingDays)}
                  </Text>
                </View>
                {hasRates && (
                  <View style={styles.heroPay}>
                    <Text style={[Type.overline, { color: colors.textMuted }]}>{t('Est. pay')}</Text>
                    <Text style={[styles.heroPayValue, { color: colors.text }]}>{formatMoney(stats.totalPay, currencyCode)}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                {[
                  stats.fullDays > 0 ? t('Full day {n}', { n: stats.fullDays }) : '',
                  stats.halfDays > 0 ? t('Half day {n}', { n: stats.halfDays }) : '',
                  stats.offDays > 0 ? t('Day off {n}', { n: stats.offDays }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <View style={styles.distribution}>
                <DistributionBar segments={segments} colors={colors} unit={t('days')} />
              </View>
            </Card>

            <View style={styles.tiles}>
              <StatTile
                icon="weather-sunny"
                iconColor={colors.success}
                label={t('Full day')}
                value={`${stats.fullDays}`}
                sub={formatWorkDays(stats.fullDays)}
                colors={colors}
              />
              <StatTile
                icon="weather-sunset-up"
                iconColor={colors.primaryText}
                label={t('Half day')}
                value={`${stats.halfDays}`}
                sub={formatWorkDays(stats.halfDays * 0.5)}
                colors={colors}
              />
              <StatTile
                icon="home-variant"
                iconColor={colors.textSecondary}
                label={t('Days off')}
                value={`${stats.offDays}`}
                sub={
                  stats.totalDays === stats.assignedDays
                    ? t('Every day planned')
                    : t('{n} not planned', { n: stats.totalDays - stats.assignedDays })
                }
                colors={colors}
              />
              <StatTile
                icon="note-text-outline"
                iconColor={colors.noteAccent}
                label={t('Notes')}
                value={`${stats.notesCount}`}
                sub={t('of {n} days', { n: stats.totalDays })}
                colors={colors}
              />
            </View>

            {period === 'year' && (
              <>
                <SectionLabel colors={colors}>{t('Days by month')}</SectionLabel>
                <Card colors={colors}>
                  <MonthlyHoursChart
                    hours={monthlyDays}
                    colors={colors}
                    highlightMonth={year === fromDateKey(today).getFullYear() ? fromDateKey(today).getMonth() : null}
                    onMonthPress={openMonth}
                    formatValue={formatWorkDays}
                    emptyText={t('No work days logged this year yet')}
                  />
                </Card>
              </>
            )}

            <View style={wide ? styles.columns : undefined}>
              <View style={half}>
                <SectionLabel colors={colors}>{t('Work summary')}</SectionLabel>
                <Card colors={colors}>
                  <Row label={t('Full day')} note={plural(stats.fullDays, '1 shift', '{n} shifts')} value={formatWorkDays(stats.fullDays)} colors={colors} />
                  <Divider colors={colors} />
                  <Row label={t('Half day')} note={plural(stats.halfDays, '1 shift', '{n} shifts')} value={formatWorkDays(stats.halfDays * 0.5)} colors={colors} />
                  <Divider colors={colors} />
                  <Row label={t('Total')} value={formatWorkDays(stats.workingDays)} colors={colors} strong />
                </Card>
              </View>

              <View style={half}>
                <SectionLabel colors={colors}>{t('Pay estimate')}</SectionLabel>
                {hasRates ? (
                  <Card colors={colors}>
                    <Row
                      label={t('Daily pay')}
                      note={`${formatWorkDays(stats.workingDays)} × ${formatMoney(baseRate, currencyCode)}`}
                      value={formatMoney(stats.basePay, currencyCode)}
                      colors={colors}
                    />
                    <Divider colors={colors} />
                    <Row label={t('Total')} value={formatMoney(stats.totalPay, currencyCode)} colors={colors} strong />
                  </Card>
                ) : (
                  <Tap
                    onPress={() => router.navigate('/settings')}
                    accessibilityLabel={t('Set your daily rate in Settings')}
                    style={[styles.prompt, { backgroundColor: withAlpha(colors.primary, 0.08), borderColor: withAlpha(colors.primary, 0.3) }]}
                  >
                    <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primaryText} />
                    <View style={styles.flex}>
                      <Text style={[styles.promptTitle, { color: colors.text }]}>{t('See what you’ll earn')}</Text>
                      <Text style={[styles.promptText, { color: colors.textSecondary }]}>
                        {t('Add your daily rate in Settings to get pay estimates.')}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={20} color={colors.textMuted} />
                  </Tap>
                )}
              </View>
            </View>

            <SectionLabel colors={colors}>{t('By shift')}</SectionLabel>
            <Card colors={colors}>
              {allShifts.map((s, i) => (
                <View key={s.code}>
                  {i > 0 && <Divider colors={colors} />}
                  <Row
                    label={shiftName(s)}
                    swatch={s.color}
                    note={isWorkingShift(s) ? t('{days} total', { days: formatWorkDays(stats.daysByCode[s.code] ?? 0) }) : t('Day off')}
                    value={`${stats.counts[s.code]}`}
                    colors={colors}
                  />
                </View>
              ))}
            </Card>
          </>
        )}

        <SectionLabel colors={colors}>{t('{year} at a glance', { year })}</SectionLabel>
        <Card colors={colors}>
          <YearlyOverview
            year={year}
            selectedMonth={period === 'month' ? month.getMonth() : null}
            todayKey={today}
            weekStart={weekStart}
            shiftData={shiftData}
            leaveData={{}}
            allShifts={allShifts}
            leaveTypes={leaveTypes}
            onMonthPress={openMonth}
            colors={colors}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  scrollWide: { maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 12, gap: 12 },
  segmented: { width: 170 },
  nav: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  navBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800' },
  navToday: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  switcher: { marginHorizontal: -16, marginTop: 6 },
  section: { marginTop: 12 },
  emptyBtn: { marginTop: 8, alignSelf: 'stretch' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hero: { fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 2 },
  heroPay: { alignItems: 'flex-end' },
  heroPayValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  heroSub: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  distribution: { marginTop: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  tileValue: { fontSize: 26, fontWeight: '800', marginTop: 10, letterSpacing: -0.5 },
  tileSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  columns: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  rowSwatch: { width: 10, height: 10, borderRadius: 3 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowStrong: { fontWeight: '800' },
  rowNote: { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowValueStrong: { fontSize: 17, fontWeight: '800' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  promptTitle: { fontSize: 15, fontWeight: '800' },
  promptText: { fontSize: 13, marginTop: 2, lineHeight: 18 },
});
