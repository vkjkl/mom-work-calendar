import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShifts } from '../hooks/ShiftContext';
import { useAppSettings } from '../hooks/SettingsContext';
import { AssignmentSnapshot } from '../hooks/useShiftData';
import { ShiftType, getShiftDayWeight, isWorkingShift, shiftCode, shiftName } from '../constants/shifts';
import { formatDate, t } from '../i18n';
import { ThemeColors } from '../constants/colors';
import { Radius } from '../constants/theme';
import { fromDateKey, todayKey } from '../utils/dates';
import { formatWorkDays } from '../utils/time';
import { readableTextColor, withAlpha } from '../utils/color';
import { haptic } from '../utils/haptics';
import { Tap } from './ui/Tap';
import { Button, SectionLabel } from './ui/primitives';
import { useSheetBackdrop, useSheetChrome } from './ui/sheet';

interface Props {
  dateKey: string | null;
  onDismiss: () => void;
  onToast: (message: string, undo?: () => void) => void;
}

function shiftWeightLabel(shift: ShiftType): string {
  const weight = getShiftDayWeight(shift);
  if (weight <= 0) return t('Day off');
  return formatWorkDays(weight);
}

function ShiftOption({
  shift,
  selected,
  onPress,
  colors,
}: {
  shift: ShiftType;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const fg = selected ? readableTextColor(shift.color) : colors.text;
  const name = shiftName(shift);
  const detail = shiftWeightLabel(shift);
  return (
    <Tap
      onPress={onPress}
      scale
      accessibilityLabel={[name, detail].join(t(', '))}
      accessibilityState={{ selected }}
      style={[
        styles.shiftOption,
        {
          backgroundColor: selected ? shift.color : withAlpha(shift.color, 0.1),
          borderColor: selected ? shift.color : withAlpha(shift.color, 0.28),
        },
      ]}
    >
      <View style={[styles.shiftCode, { backgroundColor: selected ? withAlpha(readableTextColor(shift.color), 0.18) : shift.color }]}>
        <Text style={[styles.shiftCodeText, { color: selected ? fg : readableTextColor(shift.color) }]}>{shiftCode(shift)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.shiftLabel, { color: fg }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.shiftTime, { color: selected ? withAlpha(fg, 0.8) : colors.textSecondary }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {selected && <MaterialCommunityIcons name="check-circle" size={18} color={fg} />}
    </Tap>
  );
}

function DayContent({ dateKey, onToast, onClose }: { dateKey: string; onToast: Props['onToast']; onClose: () => void }) {
  const { colors } = useAppSettings();
  const {
    shiftData, notesData, allShifts, getShiftByCode,
    setShift, clearShift, clearDay, restoreAssignments, setNote,
  } = useShifts();
  const { width } = useWindowDimensions();

  const shift = shiftData[dateKey] ? getShiftByCode(shiftData[dateKey]) : undefined;
  const date = fromDateKey(dateKey);
  const isToday = dateKey === todayKey();
  const columns = width >= 600 ? 3 : 2;

  // --- Note: autosaved shortly after typing stops, and flushed when the day changes or the sheet closes.
  const savedNote = notesData[dateKey] ?? '';
  const [noteText, setNoteText] = useState(savedNote);
  const [noteOpen, setNoteOpen] = useState(!!savedNote);
  const noteRef = useRef({ text: savedNote, dirty: false });
  const setNoteRef = useRef(setNote);
  setNoteRef.current = setNote;

  const flushNote = useCallback(() => {
    if (noteRef.current.dirty) {
      noteRef.current.dirty = false;
      setNoteRef.current(dateKey, noteRef.current.text);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!noteRef.current.dirty) return;
    const timer = setTimeout(flushNote, 700);
    return () => clearTimeout(timer);
  }, [noteText, flushNote]);

  useEffect(() => flushNote, [flushNote]);

  const onNoteChange = (text: string) => {
    noteRef.current = { text, dirty: true };
    setNoteText(text);
  };

  const working = isWorkingShift(shift);

  const pickShift = (code: string) => {
    if (shift?.code === code) {
      haptic.light();
      clearShift(dateKey);
      return;
    }
    haptic.medium();
    setShift(dateKey, code);
  };

  const handleClearDay = () => {
    const snap: AssignmentSnapshot = clearDay(dateKey);
    haptic.light();
    // Close first: the sheet would otherwise sit on top of the undo toast.
    onClose();
    onToast(t('Shift cleared'), () => restoreAssignments(snap));
  };

  const status = shift
    ? {
        color: shift.color,
        icon: shift.icon,
        title: shiftName(shift),
        detail: working ? shiftWeightLabel(shift) : t('Day off'),
      }
    : null;

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.flex}>
          <View style={styles.headerTop}>
            <Text style={[styles.weekday, { color: colors.textMuted }]}>{formatDate(date, 'EEEE')}</Text>
            {isToday && (
              <View style={[styles.todayBadge, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                <Text style={[styles.todayBadgeText, { color: colors.primaryText }]}>{t('Today')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.dateTitle, { color: colors.text }]}>{formatDate(date, 'd MMMM yyyy')}</Text>
        </View>
        <Tap onPress={onClose} accessibilityLabel={t('Close')} style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="close" size={20} color={colors.text} />
        </Tap>
      </View>

      <View
        style={[
          styles.statusCard,
          status
            ? { backgroundColor: withAlpha(status.color, 0.12), borderColor: withAlpha(status.color, 0.3) }
            : { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderStyle: 'dashed' },
        ]}
      >
        <View style={[styles.statusIcon, { backgroundColor: status ? status.color : colors.surface }]}>
          <MaterialCommunityIcons
            name={(status?.icon ?? 'calendar-blank-outline') as any}
            size={22}
            color={status ? readableTextColor(status.color) : colors.textMuted}
          />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>{status ? status.title : t('Nothing assigned')}</Text>
          <Text style={[styles.statusDetail, { color: colors.textSecondary }]}>
            {status ? status.detail : t('Pick a shift below')}
          </Text>
        </View>
      </View>

      <SectionLabel colors={colors} style={styles.firstSection}>{t('Shift')}</SectionLabel>
      <View style={styles.grid}>
        {allShifts.map((s) => (
          <View key={s.code} style={{ width: `${100 / columns}%`, padding: 4 }}>
            <ShiftOption
              shift={s}
              selected={shift?.code === s.code}
              onPress={() => pickShift(s.code)}
              colors={colors}
            />
          </View>
        ))}
      </View>

      <SectionLabel
        colors={colors}
        right={
          !noteOpen ? null : savedNote !== noteText.trim() ? (
            <Text style={[styles.saving, { color: colors.textMuted }]}>{t('Saving…')}</Text>
          ) : savedNote ? (
            <Text style={[styles.saving, { color: colors.success }]}>{t('Saved')}</Text>
          ) : null
        }
      >
        {t('Note')}
      </SectionLabel>
      {noteOpen ? (
        <BottomSheetTextInput
          value={noteText}
          onChangeText={onNoteChange}
          onBlur={flushNote}
          placeholder={t('Add a note for this day…')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('Note')}
          autoFocus={!savedNote}
          style={[styles.noteInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: withAlpha(colors.noteAccent, 0.4) }]}
        />
      ) : (
        <Tap
          onPress={() => {
            haptic.light();
            setNoteOpen(true);
          }}
          accessibilityLabel={t('Add a note')}
          style={[styles.addRow, { borderColor: withAlpha(colors.noteAccent, 0.4), backgroundColor: withAlpha(colors.noteAccent, 0.08) }]}
        >
          <MaterialCommunityIcons name="note-plus-outline" size={20} color={colors.noteAccent} />
          <Text style={[styles.addRowText, { color: colors.noteAccent }]}>{t('Add a note')}</Text>
        </Tap>
      )}

      {shift && (
        <Button
          label={t('Clear shift')}
          icon="close-circle-outline"
          variant="danger"
          onPress={handleClearDay}
          colors={colors}
          style={styles.clearBtn}
        />
      )}
    </View>
  );
}

/** Day details: assign full day / half day / off, write a note. */
export const DaySheet = forwardRef<BottomSheetModal, Props>(function DaySheet({ dateKey, onDismiss, onToast }, ref) {
  const { colors } = useAppSettings();
  const chrome = useSheetChrome(colors);
  const backdrop = useSheetBackdrop(1);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['64%', '92%'], []);
  const close = useCallback(() => {
    if (ref && typeof ref !== 'function') ref.current?.dismiss();
  }, [ref]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onDismiss={onDismiss}
      backdropComponent={backdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      {...chrome}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {dateKey ? <DayContent key={dateKey} dateKey={dateKey} onToast={onToast} onClose={close} /> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekday: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  todayBadgeText: { fontSize: 11, fontWeight: '800' },
  dateTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.lg, borderWidth: 1 },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 17, fontWeight: '800' },
  statusDetail: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  firstSection: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  shiftOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 58,
  },
  shiftCode: { minWidth: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  shiftCodeText: { fontSize: 13, fontWeight: '800' },
  shiftLabel: { fontSize: 14, fontWeight: '700' },
  shiftTime: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  otRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  otLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  stepBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  otInput: { width: 56, textAlign: 'center', fontSize: 20, fontWeight: '800', paddingVertical: 4 },
  saving: { fontSize: 11, fontWeight: '700' },
  noteInput: { minHeight: 88, borderRadius: Radius.md, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 21 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addRowText: { fontSize: 14, fontWeight: '700' },
  swapCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 14, gap: 10 },
  swapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swapTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  swapBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  swapBadgeText: { fontSize: 11, fontWeight: '800' },
  swapDetail: { fontSize: 13, lineHeight: 19 },
  swapPrompt: { fontSize: 13, fontWeight: '600' },
  swapInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  swapActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { marginTop: 24 },
});
