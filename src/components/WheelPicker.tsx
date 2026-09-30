import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, typography } from '../theme';

const NUMBER_WHEEL_WIDTH = 120;

export type WheelItem<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  items: WheelItem<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  /** Shown next to the wheel, e.g. "kg". Narrows the wheel for numbers. */
  unitLabel?: string;
  accessibilityLabel?: string;
};

/** Native iOS wheel picker (UIPickerView). */
export default function WheelPicker<T extends string | number>({
  items,
  selectedValue,
  onValueChange,
  unitLabel,
  accessibilityLabel,
}: Props<T>) {
  const picker = (
    <Picker
      selectedValue={selectedValue}
      onValueChange={(value: T) => onValueChange(value)}
      accessibilityLabel={accessibilityLabel}
      style={unitLabel ? styles.numberWheel : styles.fullWheel}
      itemStyle={unitLabel ? styles.numberItem : styles.textItem}
    >
      {items.map((item) => (
        <Picker.Item
          key={String(item.value)}
          label={item.label}
          value={item.value}
          color={colors.textPrimary}
        />
      ))}
    </Picker>
  );

  if (!unitLabel) return picker;

  // Number centered, unit to its right, like the iOS timer wheels.
  return (
    <View style={styles.numberRow}>
      <View style={styles.side} />
      {picker}
      <View style={styles.side}>
        <Text style={[typography.headline, styles.unit]}>{unitLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullWheel: {
    alignSelf: 'stretch',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
  },
  numberWheel: {
    width: NUMBER_WHEEL_WIDTH,
  },
  textItem: {
    fontSize: typography.headline.fontSize,
    color: colors.textPrimary,
  },
  numberItem: {
    fontSize: typography.title2.fontSize,
    color: colors.textPrimary,
  },
  unit: {
    color: colors.textPrimary,
  },
});
