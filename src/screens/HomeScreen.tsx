import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import FeatureCard from '../components/FeatureCard';
import { mockHomeFeatures, APP_VERSION } from '../utils/mockData';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar showLogo />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {mockHomeFeatures.map((feature) => (
          <FeatureCard
            key={feature.id}
            title={feature.title}
            subtitle={feature.subtitle}
            backgroundColor={colors[feature.backgroundColorToken]}
            onPress={() => navigation.navigate(feature.route)}
          />
        ))}

        <Text style={[typography.caption, styles.version]}>
          Version {APP_VERSION}
        </Text>
      </ScrollView>

      <Pressable 
        style={styles.fab}
        onPress={() => navigation.navigate('RunMode')}
      >
        <View style={styles.fabIconPlay} />
        <Text style={styles.fabText}>Start run</Text>
      </Pressable>
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
    paddingBottom: spacing.xl + 80, // Extra padding for FAB
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.iosBlue,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIconPlay: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 16,
    borderRightWidth: 0,
    borderBottomWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: colors.white,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 4, // optical centering
    marginBottom: 4,
  },
  fabText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
});
