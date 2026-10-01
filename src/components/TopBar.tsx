import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  /** Left side: pass a title string OR leave undefined to show the logo mark */
  title?: string;
  showLogo?: boolean;
  /** Long-press on the title, e.g. for dev-only shortcuts. */
  onTitleLongPress?: () => void;
  /** Replaces the profile placeholder on the right; `null` leaves it empty. */
  right?: React.ReactNode;
  /** Shows a back button before the title. */
  onBack?: () => void;
};

const BACK_BUTTON_SIZE = 34;

export default function TopBar({
  title,
  showLogo = false,
  onTitleLongPress,
  right,
  onBack,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backPressed,
            ]}
          >
            <Text
              importantForAccessibility="no"
              maxFontSizeMultiplier={1.2}
              style={[typography.title2, styles.backIcon]}
            >
              ‹
            </Text>
          </Pressable>
        )}
        {showLogo && (
          <IconPlaceholder
            size={28}
            backgroundColor={colors.primaryBlue}
            style={styles.logo}
          />
        )}
        {title ? (
          <Text
            style={typography.title1}
            onLongPress={onTitleLongPress}
            suppressHighlighting
          >
            {title}
          </Text>
        ) : (
          <Text style={[typography.headline, styles.brand]}>
            Graps Running
          </Text>
        )}
      </View>
      {right === undefined ? (
        <IconPlaceholder
          size={30}
          backgroundColor={colors.surfaceGray}
          style={styles.profileIcon}
        />
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    marginRight: spacing.xxs,
  },
  brand: {
    color: colors.black,
  },
  profileIcon: {},
  backButton: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  backPressed: {
    opacity: 0.6,
  },
  backIcon: {
    color: colors.textPrimary,
    // The glyph sits low in its line box.
    marginTop: -2,
  },
});
