import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Animated, Easing } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import MetricCard from '../components/MetricCard';
import IconPlaceholder from '../components/IconPlaceholder';
import Button from '../components/Button';
import RunMap from '../components/RunMap';
import GoalResultsSection from '../components/GoalResultsSection';
import { formatPace } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'RunResults'>;

export default function RunResultsScreen({ route, navigation }: Props) {
  const { distanceKm, durationSeconds, route: routeCoordinates, goal } = route.params;
  const paceLabel = formatPace(durationSeconds, distanceKm);

  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const s = durationSeconds % 60;
  const timeLabel = h > 0 
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anim4 = useRef(new Animated.Value(0)).current;

  const [displayDistance, setDisplayDistance] = useState(0);

  useEffect(() => {
    // 1. Entrance animation sequence
    Animated.stagger(100, [
      Animated.timing(anim1, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(anim2, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(anim3, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(anim4, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Distance counter animation (Stretch goal)
    const duration = 450;
    const startTime = Date.now();
    let frame: number;

    const animateNumber = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // Apple-style easeOutQuad
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      setDisplayDistance(distanceKm * easeProgress);

      if (progress < 1) {
        frame = requestAnimationFrame(animateNumber);
      } else {
        setDisplayDistance(distanceKm);
      }
    };
    frame = requestAnimationFrame(animateNumber);

    return () => cancelAnimationFrame(frame);
  }, [anim1, anim2, anim3, anim4, distanceKm]);

  const handleDone = () => {
    navigation.popToTop();
  };

  const getAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar title="Run complete" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main metric card for distance */}
        <Animated.View style={[styles.mainCard, getAnimStyle(anim1)]}>
          <IconPlaceholder
            size={36}
            backgroundColor="rgba(255,255,255,0.35)"
          />
          <Text style={[typography.metricBig, styles.mainValue]}>
            {displayDistance.toFixed(2)}
          </Text>
          <Text style={[typography.body, styles.mainUnit]}>Kilometers</Text>
        </Animated.View>

        {/* Small metric cards row */}
        <Animated.View style={[styles.metricsRow, getAnimStyle(anim2)]}>
          <MetricCard
            value={paceLabel}
            unit="min/km"
            accentColor={colors.statPurple}
            backgroundColor={colors.statPurpleBg}
          />
          <MetricCard
            value={timeLabel}
            unit="time"
            accentColor={colors.statGreen}
            backgroundColor={colors.statGreenBg}
          />
        </Animated.View>

        {goal && (
          <Animated.View style={[styles.goalsContainer, getAnimStyle(anim2)]}>
            <GoalResultsSection
              goal={goal}
              distanceKm={distanceKm}
              durationSeconds={durationSeconds}
            />
          </Animated.View>
        )}

        <Animated.View style={[styles.mapContainer, getAnimStyle(anim3)]}>
          <RunMap coordinates={routeCoordinates} />
        </Animated.View>

        <Animated.View style={[styles.buttonContainer, getAnimStyle(anim4)]}>
          <Button label="Done" onPress={handleDone} variant="primary" />
        </Animated.View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
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
    fontVariant: ['tabular-nums'],
  },
  mainUnit: {
    color: 'rgba(255,255,255,0.9)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  goalsContainer: {
    marginBottom: spacing.md,
  },
  mapContainer: {
    marginBottom: spacing.md,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
});
