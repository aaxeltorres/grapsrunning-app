import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Text, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, motion, spacing, typography } from '../theme';
import Button from '../components/Button';
import BasicRunView from '../components/BasicRunView';
import GoalRunView from '../components/GoalRunView';
import PlanRunView from '../components/PlanRunView';
import { useRunTracking } from '../hooks/useRunTracking';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { DEFAULT_RUN_MODE } from '../run/runModes';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRun'>;

/**
 * Active Run shell. Owns the run tracking and the dark theme, and renders
 * the view for the chosen run mode. The screen turns dark when it opens,
 * fades back to light while the run is paused and dark again on resume.
 */
export default function ActiveRunScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? DEFAULT_RUN_MODE;
  const reduceMotion = useReduceMotion();

  // Theme progress (0 = light, 1 = dark) drives the background, the text and
  // the run buttons. The content fades in with it.
  const themeAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [statusBarStyle, setStatusBarStyle] = useState<'dark' | 'light'>('dark');
  const [entered, setEntered] = useState(false);

  const {
    runState,
    permissionState,
    distanceKm,
    durationSeconds,
    paceLabel,
    calories,
    route: runRoute,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
  } = useRunTracking();

  useEffect(() => {
    const listenerId = themeAnim.addListener(({ value }) => {
      const nextStyle = value >= 0.5 ? 'light' : 'dark';
      setStatusBarStyle((currentStyle) =>
        currentStyle === nextStyle ? currentStyle : nextStyle,
      );
    });
    return () => themeAnim.removeListener(listenerId);
  }, [themeAnim]);

  // Fade to dark when the screen opens. Reduce Motion skips the animation.
  useEffect(() => {
    if (reduceMotion) {
      themeAnim.setValue(1);
      contentOpacity.setValue(1);
      setEntered(true);
      return;
    }

    const enter = Animated.parallel([
      Animated.timing(themeAnim, {
        toValue: 1,
        duration: motion.durationRunTheme,
        easing: motion.easeStandard,
        useNativeDriver: false, // colors can't use the native driver
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: motion.durationRunTheme,
        easing: motion.easeStandard,
        useNativeDriver: true,
      }),
    ]);
    enter.start(({ finished }) => {
      if (finished) setEntered(true);
    });
    return () => enter.stop();
  }, [reduceMotion, themeAnim, contentOpacity]);

  // Start tracking once the screen is dark and location access is granted.
  useEffect(() => {
    if (entered && permissionState === 'granted' && runState === 'idle') {
      startRun();
    }
  }, [entered, permissionState, runState]);

  // Pause and resume fade the theme; the run state changes right away.
  const fadeTheme = (toValue: 0 | 1) => {
    if (reduceMotion) {
      themeAnim.setValue(toValue);
      return;
    }
    Animated.timing(themeAnim, {
      toValue,
      duration: motion.durationRunTheme,
      easing: motion.easeStandard,
      useNativeDriver: false,
    }).start();
  };

  const handlePause = () => {
    pauseRun();
    fadeTheme(0);
  };

  const handleResume = () => {
    resumeRun();
    fadeTheme(1);
  };

  const handleFinish = async () => {
    await finishRun();
    navigation.replace('RunResults', {
      distanceKm,
      durationSeconds,
      route: runRoute
        .filter(location => location.coords.altitude !== -9999)
        .map(({ coords }) => ({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })),
    });
  };

  const backgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background, colors.runDarkBg],
  });

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

  const viewProps = {
    runState,
    distanceKm,
    durationSeconds,
    paceLabel,
    calories,
    themeAnim,
    onPause: handlePause,
    onResume: handleResume,
    onFinish: handleFinish,
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.safeArea, { opacity: contentOpacity }]}>
          {mode === 'goal' ? (
            <GoalRunView {...viewProps} />
          ) : mode === 'plan' ? (
            <PlanRunView {...viewProps} />
          ) : (
            <BasicRunView {...viewProps} />
          )}
        </Animated.View>
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
  permissionContainer: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
