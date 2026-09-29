import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import MetricCard from '../components/MetricCard';
import ProgressBar from '../components/ProgressBar';
import IconPlaceholder from '../components/IconPlaceholder';
import { mockDailyStats } from '../utils/mockData';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

export default function StatsScreen({}: Props) {
  const stats = mockDailyStats;
  const goalProgress = stats.distanceKm / stats.distanceGoalKm;

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar title="Stats" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dateBlock}>
          <Text style={[typography.title1, styles.dateLabel]}>
            {stats.dateLabel}
          </Text>
          <Text style={[typography.subheadline, styles.fullDateLabel]}>
            {stats.fullDateLabel}
          </Text>
        </View>

        {/* Main metric card */}
        <View style={styles.mainCard}>
          <IconPlaceholder
            size={36}
            backgroundColor="rgba(255,255,255,0.35)"
          />
          <Text style={[typography.metricBig, styles.mainValue]}>
            {stats.distanceKm}
          </Text>
          <Text style={[typography.body, styles.mainUnit]}>Kilometers</Text>
        </View>

        {/* Small metric cards row */}
        <View style={styles.metricsRow}>
          <MetricCard
            value={String(stats.calories)}
            unit="kcal"
            accentColor={colors.statOrange}
            backgroundColor={colors.statOrangeBg}
          />
          <MetricCard
            value={String(stats.minutes)}
            unit="minutes"
            accentColor={colors.statPurple}
            backgroundColor={colors.statPurpleBg}
          />
          <MetricCard
            value={stats.steps}
            unit="Steps"
            accentColor={colors.statGreen}
            backgroundColor={colors.statGreenBg}
          />
        </View>

        {/* Daily goal */}
        <View style={styles.goalCard}>
          <Text style={[typography.headline, styles.goalTitle]}>
            Daily Goal
          </Text>
          <ProgressBar progress={goalProgress} style={styles.progressBar} />
          <Text style={[typography.subheadline, styles.goalText]}>
            {stats.distanceKm} / {stats.distanceGoalKm} km
          </Text>
          <Text style={[typography.subheadline, styles.motivationText]}>
            {stats.motivationText}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  dateBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dateLabel: {
    color: colors.black,
  },
  fullDateLabel: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  mainCard: {
    alignItems: 'center',
    backgroundColor: colors.statBlueEnd,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    gap: spacing.xxs,
    marginBottom: spacing.md,
  },
  mainValue: {
    color: colors.white,
  },
  mainUnit: {
    color: 'rgba(255,255,255,0.9)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  goalCard: {
    backgroundColor: colors.surfaceGray,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalTitle: {
    color: colors.black,
  },
  progressBar: {
    marginTop: spacing.xxs,
  },
  goalText: {
    color: colors.textSecondary,
  },
  motivationText: {
    color: colors.success,
    fontWeight: '600',
  },
});
