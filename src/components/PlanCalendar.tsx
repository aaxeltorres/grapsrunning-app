import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { displayName, isFinished, type Workout } from '../coach/plan';
import {
  dayOfMonth,
  formatLongDate,
  formatMonthLabel,
  isSameMonth,
  monthGrid,
  weekDates,
  WEEKDAY_LETTERS,
  type ISODate,
} from '../utils/dates';
import { lightImpact } from '../utils/haptics';
import { colors, spacing, typography } from '../theme';
import { WORKOUT_TYPE_COLORS } from './WorkoutCard';

const DAY_SIZE = 36;
const DOT_SIZE = 6;
// Finished days: a type-colored circle with a check, in a slot as tall as the marker.
const MARKER_SIZE = 14;
const NAV_BUTTON_SIZE = 36;
// Seven columns must fit on an iPhone SE, even with large text.
const DAY_MAX_FONT_SCALE = 1.4;

// One entry per category; the calendar shows only the category color, the
// session name (Fartlek, HIIT...) is on the workout card.
const LEGEND = [
  { type: 'easy', label: 'Easy' },
  { type: 'aerobic', label: 'Aerobic' },
  { type: 'tempo', label: 'Tempo' },
  { type: 'long', label: 'Long' },
  { type: 'intervals', label: 'Intervals' },
  { type: 'speed', label: 'Speed' },
] as const;

type WorkoutLookup = (date: ISODate) => Workout | undefined;

function dayAccessibilityLabel(
  date: ISODate,
  today: ISODate,
  workout?: Workout,
) {
  const parts = [
    date === today ? `Today, ${formatLongDate(date)}` : formatLongDate(date),
  ];
  if (workout) {
    parts.push(displayName(workout));
    if (workout.status === 'completed') parts.push('completed');
    if (workout.status === 'partial') parts.push('partially completed');
  }
  return parts.join('. ');
}

type DayCircleProps = {
  date: ISODate;
  today: ISODate;
  selected: boolean;
  muted?: boolean;
};

/** Day number: filled blue for today, soft blue when selected. */
function DayCircle({ date, today, selected, muted }: DayCircleProps) {
  const isToday = date === today;
  const isSelected = selected && !isToday;
  return (
    <View
      style={[
        styles.dayCircle,
        isSelected && styles.selectedCircle,
        isToday && styles.todayCircle,
      ]}
    >
      <Text
        maxFontSizeMultiplier={DAY_MAX_FONT_SCALE}
        style={[
          typography.headline,
          styles.dayNumber,
          muted && styles.mutedNumber,
          isSelected && styles.selectedNumber,
          isToday && styles.todayNumber,
        ]}
      >
        {dayOfMonth(date)}
      </Text>
    </View>
  );
}

/** A finished day: filled circle with a check (completed) or a ring (partial). */
function FinishedMarker({
  color,
  partial,
  faded,
}: {
  color: string;
  partial: boolean;
  faded?: boolean;
}) {
  return (
    <View
      style={[
        styles.marker,
        partial
          ? { borderWidth: 1.5, borderColor: color }
          : { backgroundColor: color },
        faded && styles.markerFaded,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1}
        style={[styles.markerCheck, { color: partial ? color : colors.white }]}
      >
        ✓
      </Text>
    </View>
  );
}

/** Keeps every day's marker row the same height. */
function MarkerSlot({ children }: { children: React.ReactNode }) {
  return <View style={styles.markerSlot}>{children}</View>;
}

function WeekdayHeader() {
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants">
      {WEEKDAY_LETTERS.map((letter, index) => (
        <Text
          key={index}
          maxFontSizeMultiplier={DAY_MAX_FONT_SCALE}
          style={[typography.caption, styles.weekday]}
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}

type WeekStripProps = {
  selectedDate: ISODate;
  today: ISODate;
  workoutFor: WorkoutLookup;
  onSelect: (date: ISODate) => void;
};

/**
 * The seven days of the selected week. Markers: finished = a check in the
 * workout color (a ring when partial), planned = outlined, rest = none.
 */
export function PlanWeekStrip({
  selectedDate,
  today,
  workoutFor,
  onSelect,
}: WeekStripProps) {
  return (
    <View>
      <WeekdayHeader />
      <View style={styles.row}>
        {weekDates(selectedDate).map((date) => {
          const workout = workoutFor(date);
          const isTraining = workout !== undefined && workout.type !== 'rest';
          const selected = date === selectedDate;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={dayAccessibilityLabel(date, today, workout)}
              onPress={() => {
                if (selected) return;
                lightImpact();
                onSelect(date);
              }}
              style={styles.cell}
            >
              <DayCircle
                date={date}
                today={today}
                selected={selected}
                muted={date < today}
              />
              <MarkerSlot>
                {workout && workout.type !== 'rest' && isFinished(workout) ? (
                  <FinishedMarker
                    color={WORKOUT_TYPE_COLORS[workout.type]}
                    partial={workout.status === 'partial'}
                  />
                ) : (
                  <View style={[styles.dot, isTraining && styles.plannedDot]} />
                )}
              </MarkerSlot>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type MonthProps = {
  /** Any date in the month shown. */
  month: ISODate;
  selectedDate: ISODate;
  today: ISODate;
  workoutFor: WorkoutLookup;
  onSelect: (date: ISODate) => void;
  onChangeMonth: (delta: -1 | 1) => void;
};

/** Monday-first month grid with a colored dot per workout type. */
export function PlanMonthCalendar({
  month,
  selectedDate,
  today,
  workoutFor,
  onSelect,
  onChangeMonth,
}: MonthProps) {
  return (
    <View>
      <View style={styles.monthHeader}>
        <Text
          accessibilityRole="header"
          style={[typography.title2, styles.monthTitle]}
        >
          {formatMonthLabel(month)}
        </Text>
        <View style={styles.monthNav}>
          <NavButton
            label="‹"
            accessibilityLabel="Previous month"
            onPress={() => onChangeMonth(-1)}
          />
          <NavButton
            label="›"
            accessibilityLabel="Next month"
            onPress={() => onChangeMonth(1)}
          />
        </View>
      </View>

      <WeekdayHeader />
      {monthGrid(month).map((week) => (
        <View key={week[0]} style={styles.row}>
          {week.map((date) => {
            const workout = workoutFor(date);
            const inMonth = isSameMonth(date, month);
            const selected = date === selectedDate;
            const dotColor =
              workout && workout.type !== 'rest'
                ? WORKOUT_TYPE_COLORS[workout.type]
                : undefined;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={dayAccessibilityLabel(date, today, workout)}
                onPress={() => {
                  if (selected) return;
                  lightImpact();
                  onSelect(date);
                }}
                style={styles.cell}
              >
                <DayCircle
                  date={date}
                  today={today}
                  selected={selected}
                  muted={!inMonth}
                />
                <MarkerSlot>
                  {dotColor !== undefined && workout && isFinished(workout) ? (
                    <FinishedMarker
                      color={dotColor}
                      partial={workout.status === 'partial'}
                      faded={!inMonth}
                    />
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        dotColor !== undefined && {
                          backgroundColor: dotColor,
                          opacity: inMonth ? 1 : 0.4,
                        },
                      ]}
                    />
                  )}
                </MarkerSlot>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View
        style={styles.legend}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {LEGEND.map(({ type, label }) => (
          <View key={type} style={styles.legendItem}>
            <View
              style={[
                styles.dot,
                { backgroundColor: WORKOUT_TYPE_COLORS[type] },
              ]}
            />
            <Text style={[typography.caption, styles.legendText]}>
              {label}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <FinishedMarker color={colors.textSecondary} partial={false} />
          <Text style={[typography.caption, styles.legendText]}>Done</Text>
        </View>
      </View>
    </View>
  );
}

function NavButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
    >
      <Text
        maxFontSizeMultiplier={DAY_MAX_FONT_SCALE}
        style={[typography.title2, styles.navLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  dayCircle: {
    minWidth: DAY_SIZE,
    minHeight: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: colors.iosBlue,
  },
  selectedCircle: {
    backgroundColor: colors.planSelectedDayBg,
  },
  dayNumber: {
    color: colors.textPrimary,
  },
  mutedNumber: {
    color: colors.textMuted,
  },
  selectedNumber: {
    color: colors.iosBlue,
  },
  todayNumber: {
    color: colors.white,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  plannedDot: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  markerSlot: {
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerFaded: {
    opacity: 0.4,
  },
  markerCheck: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    color: colors.textPrimary,
  },
  monthNav: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  navButton: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  navPressed: {
    opacity: 0.6,
  },
  navLabel: {
    color: colors.textPrimary,
    marginTop: -2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  legendText: {
    color: colors.textSecondary,
  },
});
