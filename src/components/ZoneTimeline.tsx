import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { Zone } from '../coach/plan';
import type { TimelineBlock } from '../run/stepBehavior';
import { colors, radius, spacing, typography } from '../theme';

/** One color per training zone, easy (cyan) to hard (red). */
export const ZONE_COLORS: Record<Zone, string> = {
  1: colors.zone1,
  2: colors.zone2,
  3: colors.zone3,
  4: colors.zone4,
  5: colors.zone5,
};

const TRACK_HEIGHT = 10;
const CURRENT_HEIGHT = 16;
const DONE_OPACITY = 0.35;
// Blocks narrower than this share of the session get no label (it wouldn't fit).
const MIN_LABEL_SHARE = 0.08;

type Props = {
  blocks: TimelineBlock[];
  /** Label color, animated with the run theme. */
  labelColor: Animated.AnimatedInterpolation<string | number>;
};

/**
 * The zones of a consecutive-zone session (tempo, progressive) as one row
 * of blocks sized by duration: done blocks fade, the current one stands
 * taller, the ones to come keep their color. Plain Views.
 */
export default function ZoneTimeline({ blocks, labelColor }: Props) {
  const total = blocks.reduce((sum, block) => sum + Math.max(1, block.seconds), 0);
  const upcoming = blocks
    .filter((block) => block.state === 'next' && block.zone !== null)
    .map((block) => `Z${block.zone}`);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={
        upcoming.length > 0 ? `Zones to come: ${upcoming.join(', ')}` : 'Last block'
      }
    >
      <View style={styles.track}>
        {blocks.map((block) => (
          <View
            key={block.index}
            style={[
              styles.block,
              {
                flex: Math.max(1, block.seconds),
                backgroundColor: block.zone ? ZONE_COLORS[block.zone] : colors.textMuted,
                opacity: block.state === 'done' ? DONE_OPACITY : 1,
              },
              block.state === 'current' && styles.current,
            ]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {blocks.map((block) => (
          <View key={block.index} style={{ flex: Math.max(1, block.seconds) }}>
            <Animated.Text
              numberOfLines={1}
              style={[
                typography.caption,
                block.state === 'current' && styles.currentLabel,
                { color: labelColor },
              ]}
            >
              {block.zone && Math.max(1, block.seconds) / total >= MIN_LABEL_SHARE
                ? `Z${block.zone}`
                : ''}
            </Animated.Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xxs,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: CURRENT_HEIGHT,
  },
  block: {
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  current: {
    height: CURRENT_HEIGHT,
  },
  labels: {
    flexDirection: 'row',
    gap: 3,
  },
  currentLabel: {
    fontWeight: '700',
  },
});
