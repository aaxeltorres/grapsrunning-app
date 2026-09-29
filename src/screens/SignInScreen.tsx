import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import Button from '../components/Button';
import SocialButton from '../components/SocialButton';
import TextField from '../components/TextField';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');

  const handleContinue = () => {
    // Mock flow — no auth wired up in this beta.
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.title1, styles.brand]}>Graps Running</Text>

          <View style={styles.headerBlock}>
            <Text style={[typography.headline, styles.subtitle]}>
              Create an account
            </Text>
            <Text style={[typography.subheadline, styles.description]}>
              Enter your email to register for this application
            </Text>
          </View>

          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="email@domain.com"
            keyboardType="email-address"
            style={styles.input}
          />

          <Button
            label="Continue"
            onPress={handleContinue}
            style={styles.continueButton}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={[typography.caption, styles.dividerText]}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <SocialButton
            label="Continue with Google"
            onPress={() => navigation.replace('Home')}
          />
          <SocialButton
            label="Continue with Apple"
            onPress={() => navigation.replace('Home')}
          />

          <Text style={[typography.caption, styles.legalText]}>
            By clicking continue, you agree to our{' '}
            <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  brand: {
    color: colors.black,
    marginBottom: spacing.lg,
  },
  headerBlock: {
    marginBottom: spacing.lg,
    gap: spacing.xxs,
  },
  subtitle: {
    color: colors.black,
  },
  description: {
    color: colors.textSecondary,
  },
  input: {
    marginBottom: spacing.sm,
  },
  continueButton: {
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  dividerText: {
    color: colors.textMuted,
  },
  legalText: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    textAlign: 'left',
  },
  legalLink: {
    color: colors.black,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
