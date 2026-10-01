import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { RunSegment, SegmentTone } from '../run/workoutSegments';
import { colors, radius } from '../theme';

// Same bar as the Plan card's segment bar.
const BAR_HEIGHT = 8;
const BAR_GAP = 3;
/** Many short segments (long run/walk sessions) get a thinner gap. */
const TIGHT_GAP = 2;
const TIGHT_FROM = 24;
const DONE_OPACITY = 0.4;
const MARKER_WIDTH = 4;
const MARKER_HEIGHT = 18;

/** Segment colors on the run screen, readable on dark and on light. */
export const SEGMENT_TONE_COLORS: Record<SegmentTone, string> = {
  fast: colors.workoutIntervals,
  recovery: colors.segmentRecovery,
  easy: colors.workoutEasy,
  long: colors.workoutLong,
  warm: colors.planSegmentMuted,
};

type Props = {
  segments: RunSegment[];
  /** Segments before this one are done and drawn dimmed. */
  currentIndex: number;
  /** Position in the whole workout, 0 to 1. */
  overall: number;
  markerColor: Animated.AnimatedInterpolation<string | number>;
};

/**
 * The whole workout as one bar, a part per segment sized by its expected
 * time and colored by its type, with a marker at the current position.
 */
export default function WorkoutProgressBar({
  segments,
  currentIndex,
  overall,
  markerColor,
}: Props) {
  const position = Math.max(0, Math.min(1, overall));
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Workout progress"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(position * 100) }}
    >
      <View
        style={[styles.track, { gap: segments.length >= TIGHT_FROM ? TIGHT_GAP : BAR_GAP }]}
      >
        {segments.map((segment) => (
          <View
            key={segment.index}
            style={[
              styles.part,
              {
                flex: Math.max(1, segment.estimatedSeconds),
                backgroundColor: SEGMENT_TONE_COLORS[segment.tone],
                opacity: segment.index < currentIndex ? DONE_OPACITY : 1,
              },
            ]}
          />
        ))}
      </View>
      <Animated.View
        style={[
          styles.marker,
          { left: `${position * 100}%`, backgroundColor: markerColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: MARKER_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  part: {
    borderRadius: BAR_HEIGHT / 2,
  },
  marker: {
    position: 'absolute',
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    marginLeft: -MARKER_WIDTH / 2,
    borderRadius: radius.pill,
  },
});
