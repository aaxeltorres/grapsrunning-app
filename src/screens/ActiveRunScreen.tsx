import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Easing, Text, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import Button from '../components/Button';
import { useRunTracking } from '../hooks/useRunTracking';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRun'>;

export default function ActiveRunScreen({ navigation }: Props) {
  // Theme animation
  const themeAnim = useRef(new Animated.Value(0)).current;
  
  const {
    runState,
    permissionState,
    distanceKm,
    durationSeconds,
    paceLabel,
    calories,
    route,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    requestPermissions,
  } = useRunTracking();

  // Initial enter animation logic when permissions are granted and idle
  useEffect(() => {
    if (permissionState === 'granted' && runState === 'idle') {
      const timeout = setTimeout(() => {
        transitionToDark(() => {
          startRun();
        });
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [permissionState, runState]);

  const transitionToDark = (onComplete?: () => void) => {
    Animated.timing(themeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && onComplete) onComplete();
    });
  };

  const transitionToLight = (onComplete?: () => void) => {
    Animated.timing(themeAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && onComplete) onComplete();
    });
  };

  const handlePause = () => {
    pauseRun();
    transitionToLight();
  };

  const handleResume = () => {
    transitionToDark(() => {
      resumeRun();
    });
  };

  const handleFinish = async () => {
    await finishRun();
    navigation.replace('RunResults', {
      distanceKm,
      durationSeconds,
      route: route
        .filter(location => location.coords.altitude !== -9999)
        .map(({ coords }) => ({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })),
    });
  };

  // Interpolations
  const backgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background, colors.runDarkBg],
  });

  const textColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textPrimary, colors.runDarkText],
  });

  const secondaryTextColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.runDarkTextSecondary],
  });

  // Formatting helpers
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (permissionState === 'denied') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Text style={[typography.title2, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Location Access Needed
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
            Graps Running needs location access to track your distance and pace. Please enable "Always" location access in your device settings.
          </Text>
          <Button 
            label="Open Settings" 
            onPress={() => Linking.openSettings()} 
            style={{ width: '100%', marginBottom: spacing.md }}
          />
          <Button 
            label="Go Back" 
            variant="secondary"
            onPress={() => navigation.goBack()} 
            style={{ width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.Text style={[typography.headline, { color: textColor }]}>
            Active Run
          </Animated.Text>
          
          <View style={styles.metricsContainer}>
            <View style={styles.mainMetric}>
              <Animated.Text style={[styles.distanceText, { color: textColor }]}>
                {distanceKm.toFixed(2)}
              </Animated.Text>
              <Animated.Text style={[typography.body, { color: secondaryTextColor }]}>
                Kilometers
              </Animated.Text>
            </View>

            <View style={styles.mainMetric}>
              <Animated.Text style={[styles.timeText, { color: textColor }]}>
                {formatTime(durationSeconds)}
              </Animated.Text>
            </View>

            <View style={styles.secondaryMetricsRow}>
              <View style={styles.secondaryMetric}>
                <View style={styles.paceValueRow}>
                  <Animated.Text
                    style={[typography.title2, styles.metricValue, { color: textColor }]}
                  >
                    {paceLabel}
                  </Animated.Text>
                  <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
                    /km
                  </Animated.Text>
                </View>
                <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
                  Pace
                </Animated.Text>
              </View>

              <View style={styles.secondaryMetric}>
                <Animated.Text style={[typography.title2, styles.metricValue, { color: textColor }]}>
                  {calories}
                </Animated.Text>
                <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
                  Calories
                </Animated.Text>
              </View>
            </View>
          </View>

          <View style={styles.controlsRow}>
            {runState === 'paused' ? (
              <Button
                label="Resume"
                variant="runPause"
                appearanceAnim={themeAnim}
                onPress={handleResume}
                style={styles.controlButton}
              />
            ) : (
              <Button
                label="Pause"
                variant="runPause"
                appearanceAnim={themeAnim}
                onPress={handlePause}
                style={styles.controlButton}
              />
            )}
            
            <Button
              label="Finish"
              variant="runFinish"
              appearanceAnim={themeAnim}
              onPress={handleFinish}
              style={styles.controlButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionContainer: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: spacing.xl,
  },
  mainMetric: {
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timeText: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  secondaryMetricsRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  secondaryMetric: {
    alignItems: 'center',
    minWidth: 80,
  },
  paceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  controlButton: {
    flex: 1,
  },
});
