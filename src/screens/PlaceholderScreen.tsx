import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import IconPlaceholder from '../components/IconPlaceholder';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'CoachMike' | 'Routes' | 'Plan'
>;

/**
 * Stand-in destination for Home cards whose full screens are out of
 * scope for this beta pass (AI Coach Mike chat, Routes, Plan).
 * Keeps navigation functional end-to-end without dead links.
 */
export default function PlaceholderScreen({ route }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <IconPlaceholder size={64} backgroundColor={colors.surfaceGray} />
        <Text style={[typography.title2, styles.title]}>{route.name}</Text>
        <Text style={[typography.body, styles.body]}>
          This screen is coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.black,
  },
  body: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
