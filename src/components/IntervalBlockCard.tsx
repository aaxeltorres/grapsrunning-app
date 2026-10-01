import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ZONES, ZONE_INFO, zonePace } from '../coach/zones';
import type { Zone } from '../coach/plan';
import {
  REST_ZONES,
  blockNote,
  blockTitle,
  formatRest,
  formatWork,
  type IntervalBlock,
} from '../run/intervalSetup';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact } from '../utils/haptics';
import Chip from './Chip';
import type { IntervalPickerKind } from './IntervalPickerSheet';
import SegmentedControl from './SegmentedControl';
import { formatPace } from './WorkoutCard';

type Props = {
  block: IntervalBlock;
  /** 0-based position in the list. */
  index: number;
  canRemove: boolean;
  /** The runner's easy pace (s/km): the zone paces come from it. */
  easyPace: number;
  onChange: (block: IntervalBlock) => void;
  onRemove: () => void;
  onPick: (kind: IntervalPickerKind) => void;
  reduceMotion?: boolean;
};

/**
 * One block of the interval setup: what the work is (a distance or a time),
 * its reps and zone, the rest between reps with its zone, and the sets with
 * the rest between them. Every value opens its wheel sheet through `onPick`.
 */
export default function IntervalBlockCard({
  block,
  index,
  canRemove,
  easyPace,
  onChange,
  onRemove,
  onPick,
  reduceMotion,
}: Props) {
  const note = blockNote(block);
  const workKind = block.work.by === 'distance' ? 'workDistance' : 'workTime';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.headline, styles.title]}>{`Block ${index + 1}`}</Text>
          <Text style={[typography.subheadline, styles.secondary]}>{blockTitle(block)}</Text>
        </View>
        {canRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove block ${index + 1}`}
            hitSlop={8}
            onPress={() => {
              lightImpact();
              onRemove();
            }}
          >
            <Text style={[typography.subheadline, styles.remove]}>Remove</Text>
          </Pressable>
        )}
      </View>

      <SegmentedControl
        options={[
          { value: 'distance', label: 'By distance' },
          { value: 'time', label: 'By time' },
        ]}
        value={block.work.by}
        onChange={(by) => onChange({ ...block, work: { ...block.work, by } })}
        reduceMotion={reduceMotion}
      />

      <View style={styles.rows}>
        <ValueRow label="Work" value={formatWork(block.work)} onPress={() => onPick(workKind)} />
        <ValueRow label="Reps" value={String(block.reps)} onPress={() => onPick('reps')} />
      </View>

      <ZoneChips
        label="Work zone"
        zones={ZONES}
        selected={block.zone}
        onSelect={(zone) => onChange({ ...block, zone })}
        caption={zoneCaption(block.zone, easyPace)}
      />

      {note !== null && <Text style={[typography.subheadline, styles.note]}>{note}</Text>}

      <View style={styles.rows}>
        <ValueRow
          label="Rest between reps"
          value={formatRest(block.rest)}
          onPress={() => onPick('rest')}
        />
      </View>

      {!block.rest.manual && (
        <ZoneChips
          label="Rest zone"
          zones={REST_ZONES}
          selected={block.rest.zone}
          onSelect={(zone) => onChange({ ...block, rest: { ...block.rest, zone } })}
          caption={zoneCaption(block.rest.zone, easyPace)}
        />
      )}

      <View style={styles.rows}>
        <ValueRow label="Sets" value={String(block.sets)} onPress={() => onPick('sets')} />
        {block.sets > 1 && (
          <ValueRow
            label="Rest between sets"
            value={formatRest(block.setRest)}
            onPress={() => onPick('setRest')}
          />
        )}
      </View>
    </View>
  );
}

/** "Intense · 4:45–5:15 /km" */
function zoneCaption(zone: Zone, easyPace: number) {
  return `${ZONE_INFO[zone].name} · ${formatPace(zonePace(easyPace, zone))} /km`;
}

/** A label with its value and a chevron; tapping opens the value's wheel sheet. */
export function ValueRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        lightImpact();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[typography.body, styles.rowLabel]}>{label}</Text>
      <Text style={[typography.body, styles.rowValue]}>{value}</Text>
      <Text importantForAccessibility="no" style={[typography.title2, styles.chevron]}>
        ›
      </Text>
    </Pressable>
  );
}

function ZoneChips({
  label,
  zones,
  selected,
  onSelect,
  caption,
}: {
  label: string;
  zones: readonly Zone[];
  selected: Zone;
  onSelect: (zone: Zone) => void;
  caption: string;
}) {
  return (
    <View style={styles.zones}>
      <Text style={[typography.subheadline, styles.secondary]}>{label}</Text>
      <View style={styles.chips}>
        {zones.map((zone) => (
          <Chip
            key={zone}
            label={`Z${zone}`}
            accessibilityLabel={`${label} ${zone}, ${ZONE_INFO[zone].name}`}
            selected={zone === selected}
            onPress={() => onSelect(zone)}
          />
        ))}
      </View>
      <Text style={[typography.subheadline, styles.secondary]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
  },
  secondary: {
    color: colors.textSecondary,
  },
  remove: {
    color: colors.alertRedLight,
    fontWeight: '600',
  },
  rows: {
    gap: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  rowLabel: {
    flex: 1,
    color: colors.textPrimary,
  },
  rowValue: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    color: colors.textMuted,
  },
  zones: {
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  note: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
