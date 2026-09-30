import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  /** Left side: pass a title string OR leave undefined to show the logo mark */
  title?: string;
  showLogo?: boolean;
  /** Long-press on the title, e.g. for dev-only shortcuts. */
  onTitleLongPress?: () => void;
};

export default function TopBar({
  title,
  showLogo = false,
  onTitleLongPress,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
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
      <IconPlaceholder
        size={30}
        backgroundColor={colors.surfaceGray}
        style={styles.profileIcon}
      />
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
});
