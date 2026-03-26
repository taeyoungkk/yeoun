import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CalendarDay = {
  date: Date;
  currentMonth: boolean;
};

type PickerMode = 'month' | 'year' | null;

type TripStartCalendarProps = {
  monthLabels: string[];
  weekLabels: string[];
  calendarMonth: Date;
  days: CalendarDay[];
  pickerMode: PickerMode;
  startDate: Date | null;
  endDate: Date | null;
  minDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPickDay: (date: Date) => void;
  onConfirm: () => void;
  onTogglePicker: (mode: PickerMode) => void;
  onSelectMonth: (monthIndex: number) => void;
  onSelectYear: (year: number) => void;
};

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateBetween(target: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const time = target.getTime();
  return time > start.getTime() && time < end.getTime();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function TripStartCalendar({
  monthLabels,
  weekLabels,
  calendarMonth,
  days,
  pickerMode,
  startDate,
  endDate,
  minDate,
  onPrevMonth,
  onNextMonth,
  onPickDay,
  onConfirm,
  onTogglePicker,
  onSelectMonth,
  onSelectYear,
}: TripStartCalendarProps) {
  const years = Array.from({ length: 11 }, (_, index) => minDate.getFullYear() + index);
  const minDay = startOfDay(minDate);
  const visibleMonthLabels =
    calendarMonth.getFullYear() === minDay.getFullYear()
      ? monthLabels.slice(minDay.getMonth())
      : monthLabels;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.navButton} onPress={onPrevMonth} activeOpacity={0.8}>
          <MaterialIcons name="chevron-left" size={22} color="#2B2F2D" />
        </TouchableOpacity>

        <View style={styles.selectorRow}>
          <TouchableOpacity
            style={[styles.selectorPill, pickerMode === 'year' && styles.selectorPillActive]}
            onPress={() => onTogglePicker(pickerMode === 'year' ? null : 'year')}
            activeOpacity={0.8}
          >
            <Text style={styles.selectorText}>{calendarMonth.getFullYear()}</Text>
            <MaterialIcons name="expand-more" size={16} color="#5A645E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.selectorPill, pickerMode === 'month' && styles.selectorPillActive]}
            onPress={() => onTogglePicker(pickerMode === 'month' ? null : 'month')}
            activeOpacity={0.8}
          >
            <Text style={styles.selectorText}>{monthLabels[calendarMonth.getMonth()]}</Text>
            <MaterialIcons name="expand-more" size={16} color="#5A645E" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.navButton} onPress={onNextMonth} activeOpacity={0.8}>
          <MaterialIcons name="chevron-right" size={22} color="#2B2F2D" />
        </TouchableOpacity>
      </View>

      {pickerMode ? (
        <View style={styles.verticalPickerOverlay}>
          <View style={styles.verticalPickerCard}>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.verticalPickerScroll}>
              {(pickerMode === 'month' ? visibleMonthLabels : years).map((item) => {
                const label = String(item);
                const active =
                  pickerMode === 'month'
                    ? calendarMonth.getMonth() === monthLabels.indexOf(label)
                    : calendarMonth.getFullYear() === Number(label);

                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.pickerOption, active && styles.pickerOptionActive]}
                    onPress={() =>
                      pickerMode === 'month'
                        ? onSelectMonth(monthLabels.indexOf(label))
                        : onSelectYear(Number(label))
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}

      <View style={styles.weekRow}>
        {weekLabels.map((label) => (
          <View key={label} style={styles.weekCell}>
            <Text style={styles.weekLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map(({ date, currentMonth }) => {
          const selected = isSameDay(date, startDate) || isSameDay(date, endDate);
          const inRange = isDateBetween(date, startDate, endDate);
          const disabled = startOfDay(date) < minDay;

          return (
            <View key={date.toISOString()} style={styles.dayCell}>
              <TouchableOpacity
                style={[
                  styles.dayButton,
                  selected && styles.dayButtonSelected,
                  inRange && styles.dayButtonInRange,
                  disabled && styles.dayButtonDisabled,
                ]}
                onPress={() => onPickDay(date)}
                activeOpacity={0.9}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.dayText,
                    !currentMonth && styles.dayTextDim,
                    selected && styles.dayTextSelected,
                    inRange && styles.dayTextInRange,
                    disabled && styles.dayTextDisabled,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.confirmButton} onPress={onConfirm} activeOpacity={0.85}>
        <Text style={styles.confirmButtonText}>선택 완료</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: '#F7F8F5',
    borderRadius: 28,
    padding: 18,
    position: 'relative',
    shadowColor: '#AAB5AA',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorPill: {
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  selectorPillActive: {
    backgroundColor: '#E9EEE7',
  },
  selectorText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#38413C',
  },
  verticalPickerOverlay: {
    position: 'absolute',
    top: 62,
    left: 18,
    right: 18,
    zIndex: 10,
  },
  verticalPickerCard: {
    height: 160,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#8E9A8D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  verticalPickerScroll: {
    paddingVertical: 8,
  },
  pickerOption: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionActive: {
    backgroundColor: '#EEF2ED',
  },
  pickerOptionText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#506058',
  },
  pickerOptionTextActive: {
    color: '#1E2720',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 4,
  },
  weekCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  weekLabel: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#8E978F',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonDisabled: {
    opacity: 0.35,
  },
  dayButtonSelected: {
    backgroundColor: '#2C2E31',
  },
  dayButtonInRange: {
    backgroundColor: '#E8ECE6',
  },
  dayText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#313632',
  },
  dayTextDim: {
    color: '#C1C8C1',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextInRange: {
    color: '#4C564E',
  },
  dayTextDisabled: {
    color: '#B9C0B9',
  },
  confirmButton: {
    marginTop: 18,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DDE8DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#273026',
  },
});
