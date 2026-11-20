import { parseHHMM } from '../utils/time';
import { builtInCode, t } from '../i18n';
import { LeaveType, leaveCode } from './leaveTypes';

export interface ShiftType {
  code: string;
  label: string;
  color: string;
  startTime: string; // 'HH:MM', or '' for day-off types
  endTime: string;
  dayWeight?: number; // 1 = full day, 0.5 = half day, 0 = day off
  icon: string;
  isDefault: boolean;
}

export const DEFAULT_SHIFTS: ShiftType[] = [
  {
    code: 'F',
    label: 'Full day',
    color: '#10B981',
    startTime: '08:00',
    endTime: '17:00',
    dayWeight: 1,
    icon: 'weather-sunny',
    isDefault: true,
  },
  {
    code: 'H',
    label: 'Half day',
    color: '#F59E0B',
    startTime: '08:00',
    endTime: '12:00',
    dayWeight: 0.5,
    icon: 'weather-sunset-up',
    isDefault: true,
  },
  {
    code: 'O',
    label: 'OFF',
    color: '#6B7280',
    startTime: '',
    endTime: '',
    dayWeight: 0,
    icon: 'home-variant',
    isDefault: true,
  },
];

/** A built-in shift the user hasn't renamed follows the app's language; anything the user typed shows as typed. */
function isBuiltIn(shift: ShiftType) {
  return DEFAULT_SHIFTS.some((d) => d.code === shift.code && d.label === shift.label);
}

export function shiftName(shift: ShiftType): string {
  return isBuiltIn(shift) ? t(shift.label) : shift.label;
}

export function shiftCode(shift: ShiftType): string {
  return (isBuiltIn(shift) && builtInCode(shift.code)) || shift.code;
}

/** Name of what's on a day, a shift or a leave type, in the app's language. */
export function assignmentName(item: ShiftType | LeaveType): string {
  return 'id' in item ? t(item.label) : shiftName(item);
}

export function assignmentCode(item: ShiftType | LeaveType): string {
  return 'id' in item ? leaveCode(item) : shiftCode(item);
}

/** A shift counts as work when it has both a start and an end time (or positive dayWeight). */
export function isWorkingShift(shift: ShiftType | undefined): boolean {
  if (!shift) return false;
  if (typeof shift.dayWeight === 'number') return shift.dayWeight > 0;
  return !!parseHHMM(shift.startTime) && !!parseHHMM(shift.endTime);
}

/** Daily pay weight for a shift: 1 for full day, 0.5 for half day, 0 for day off. */
export function getShiftDayWeight(shift: ShiftType | undefined): number {
  if (!shift || !isWorkingShift(shift)) return 0;
  if (typeof shift.dayWeight === 'number' && Number.isFinite(shift.dayWeight) && shift.dayWeight >= 0) {
    return shift.dayWeight;
  }
  return 1;
}

export function getShiftMinutes(shift: ShiftType): number {
  const start = parseHHMM(shift.startTime);
  const end = parseHHMM(shift.endTime);
  if (!start || !end) return 0;
  const startMin = start[0] * 60 + start[1];
  let endMin = end[0] * 60 + end[1];
  if (endMin <= startMin) endMin += 24 * 60; // overnight shift
  return endMin - startMin;
}

export function getShiftHours(shift: ShiftType): number {
  return getShiftMinutes(shift) / 60;
}

export const AVAILABLE_COLORS = [
  '#6366F1', '#3B82F6', '#0EA5E9', '#06B6D4',
  '#14B8A6', '#10B981', '#84CC16', '#F59E0B',
  '#F97316', '#EF4444', '#F43F5E', '#EC4899',
  '#A855F7', '#8B5CF6', '#78716C', '#6B7280',
];

export const AVAILABLE_ICONS = [
  'weather-sunny', 'weather-sunset-up', 'weather-sunset-down', 'weather-night',
  'home-variant', 'bed', 'palm-tree', 'coffee',
  'briefcase', 'hospital-building', 'stethoscope', 'medical-bag',
  'school', 'store', 'cash-register', 'factory',
  'truck', 'car', 'airplane', 'package-variant',
  'wrench', 'hard-hat', 'chef-hat', 'food',
  'phone', 'headset', 'laptop', 'shield',
  'police-badge', 'fire', 'heart-pulse', 'account-group',
  'star', 'lightning-bolt', 'run', 'book-open-variant',
];
