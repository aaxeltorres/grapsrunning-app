import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, spacing } from '../theme';

const EXIT_MS = 220;
const REDUCED_ENTER_MS = 200;
// Extra sheet surface hidden below the screen, so spring overshoot never
// reveals a gap under the sheet.
const BOTTOM_BLEED = spacing.xxxl;

type Props = {
  visible: boolean;
  /** Backdrop tap or Android back button. */
  onDismiss: () => void;
  /** Called once the exit animation has finished. */
  onClosed?: () => void;
  reduceMotion?: boolean;
  children: React.ReactNode;
};

/**
 * Apple-style bottom sheet: rounded top corners, dimmed backdrop and a
 * spring slide-up. With Reduce Motion it fades instead of sliding.
 */
export default function BottomSheet({
  visible,
  onDismiss,
  onClosed,
  reduceMotion = false,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(visible);

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (visible) {
      setMounted(true);
      return;
    }
    if (!wasVisible) return;

    const exit = Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    });
    exit.start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      onClosedRef.current?.();
    });
    return () => exit.stop();
  }, [visible, progress]);

  useEffect(() => {
    if (!visible || !mounted) return;

    const enter = reduceMotion
      ? Animated.timing(progress, {
          toValue: 1,
          duration: REDUCED_ENTER_MS,
          easing: motion.easeStandard,
          useNativeDriver: true,
        })
      : Animated.spring(progress, {
          toValue: 1,
          ...motion.springSheet,
          useNativeDriver: true,
        });
    enter.start();
    return () => enter.stop();
  }, [visible, mounted, reduceMotion, progress]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const sheetMotion = reduceMotion
    ? { opacity: backdropOpacity }
    : {
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [windowHeight, 0],
            }),
          },
        ],
      };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onDismiss}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + spacing.md + BOTTOM_BLEED,
              marginBottom: -BOTTOM_BLEED,
            },
            sheetMotion,
          ]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: colors.sheetBackdrop,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.sheetGrabber,
    marginBottom: spacing.md,
  },
});
