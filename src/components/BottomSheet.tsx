import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
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

// Swipe down to dismiss: the grabber area is a full-width touch zone.
const GRABBER_HEIGHT = 5;
const DRAG_ZONE_HEIGHT = 32;
// Dragged past this share of the sheet's height, or flicked down fast
// enough, a release closes the sheet; otherwise it springs back.
const CLOSE_FRACTION = 0.25;
const CLOSE_VELOCITY = 0.8;
const MIN_FLICK_DISTANCE = 16;
// Downward move (px) before a drag-anywhere gesture takes over from taps.
const DRAG_START_DISTANCE = 4;
// How long to wait for the parent to hide the sheet after a swipe before
// assuming it refused and springing back.
const KEEP_OPEN_CHECK_MS = 100;

type Props = {
  visible: boolean;
  /** Backdrop tap, swipe down, or Android back button. */
  onDismiss: () => void;
  /**
   * Let the whole sheet be dragged down to dismiss, not just the grabber
   * area. Only for sheets without scrolling, wheels or their own gestures.
   */
  dragAnywhere?: boolean;
  /** Called once the exit animation has finished. */
  onClosed?: () => void;
  reduceMotion?: boolean;
  children: React.ReactNode;
};

/**
 * Apple-style bottom sheet: rounded top corners, dimmed backdrop and a
 * spring slide-up. With Reduce Motion it fades instead of sliding. It can
 * be swiped down from the grabber (or anywhere, with `dragAnywhere`), which
 * calls `onDismiss` exactly like a backdrop tap.
 */
export default function BottomSheet({
  visible,
  onDismiss,
  dragAnywhere = false,
  onClosed,
  reduceMotion = false,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(visible);
  // How far the finger has pulled the sheet down from its resting place.
  const dragY = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(windowHeight);
  const sheetHeightRef = useRef(windowHeight);

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const keepOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Back to the resting position (a refused or too-short swipe, a reopen). */
  const settleDrag = useCallback(() => {
    dragY.stopAnimation();
    const settle = reduceMotionRef.current
      ? Animated.timing(dragY, {
          toValue: 0,
          duration: REDUCED_ENTER_MS,
          easing: motion.easeStandard,
          useNativeDriver: true,
        })
      : Animated.spring(dragY, {
          toValue: 0,
          ...motion.springSheet,
          useNativeDriver: true,
        });
    settle.start();
  }, [dragY]);

  /** Same path as a backdrop tap; ignored once the sheet is already closing. */
  const requestDismiss = useCallback(() => {
    if (!visibleRef.current) return;
    onDismissRef.current();
  }, []);

  useEffect(
    () => () => {
      if (keepOpenTimerRef.current) clearTimeout(keepOpenTimerRef.current);
    },
    [],
  );

  const makePanResponder = useCallback(
    (immediate: boolean) => {
      // With drag-anywhere the gesture is claimed a few px in: start from
      // there so the sheet doesn't jump under the finger.
      let origin = 0;
      const pull = (dy: number) => Math.max(0, dy - origin);
      return PanResponder.create({
        onStartShouldSetPanResponder: () => immediate && visibleRef.current,
        onMoveShouldSetPanResponder: (_, g) =>
          visibleRef.current &&
          g.dy > DRAG_START_DISTANCE &&
          g.dy > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_, g) => {
          origin = immediate ? 0 : g.dy;
          dragY.stopAnimation();
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, g) => dragY.setValue(pull(g.dy)),
        onPanResponderRelease: (_, g) => {
          const dy = pull(g.dy);
          const shouldClose =
            visibleRef.current &&
            (dy > sheetHeightRef.current * CLOSE_FRACTION ||
              (g.vy > CLOSE_VELOCITY && dy > MIN_FLICK_DISTANCE));
          if (!shouldClose) {
            settleDrag();
            return;
          }
          requestDismiss();
          // A parent can refuse to close (e.g. while saving): if the sheet
          // is still open shortly after, bring it back up.
          if (keepOpenTimerRef.current) clearTimeout(keepOpenTimerRef.current);
          keepOpenTimerRef.current = setTimeout(() => {
            keepOpenTimerRef.current = null;
            if (visibleRef.current) settleDrag();
          }, KEEP_OPEN_CHECK_MS);
        },
        onPanResponderTerminate: () => settleDrag(),
      });
    },
    [dragY, requestDismiss, settleDrag],
  );
  const grabberPan = useMemo(() => makePanResponder(true), [makePanResponder]);
  const sheetPan = useMemo(() => makePanResponder(false), [makePanResponder]);

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
      dragY.setValue(0);
      setMounted(false);
      onClosedRef.current?.();
    });
    return () => exit.stop();
  }, [visible, progress, dragY]);

  useEffect(() => {
    if (!visible || !mounted) return;

    // Reopening never starts from a stale drag offset.
    settleDrag();
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
  }, [visible, mounted, reduceMotion, progress, settleDrag]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // The backdrop fades out as the sheet is pulled down.
  const dragFade = dragY.interpolate({
    inputRange: [0, Math.max(sheetHeight, 1)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backdropStyle = {
    opacity: Animated.multiply(backdropOpacity, dragFade),
  };
  const sheetMotion = reduceMotion
    ? { opacity: backdropOpacity, transform: [{ translateY: dragY }] }
    : {
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [windowHeight, 0],
            }),
          },
          { translateY: dragY },
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
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={requestDismiss}
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
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            sheetHeightRef.current = height;
            setSheetHeight(height);
          }}
          {...(dragAnywhere ? sheetPan.panHandlers : null)}
        >
          <View style={styles.dragZone} {...grabberPan.panHandlers}>
            <View style={styles.grabber} />
          </View>
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
  // Full-width touch zone around the grabber. The margins keep the grabber
  // and the content exactly where the bare grabber used to put them.
  dragZone: {
    alignItems: 'center',
    height: DRAG_ZONE_HEIGHT,
    paddingTop: spacing.xs,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs + GRABBER_HEIGHT + spacing.md - DRAG_ZONE_HEIGHT,
  },
  grabber: {
    width: 36,
    height: GRABBER_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.sheetGrabber,
  },
});
