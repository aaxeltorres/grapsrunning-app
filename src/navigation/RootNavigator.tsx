import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import {
  SplashScreen,
  SignInScreen,
  HomeScreen,
  StatsScreen,
  PlaceholderScreen,
  RunModeScreen,
  ActiveRunScreen,
  RunResultsScreen,
  PlanScreen,
  ProfileScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Plan"
          component={PlanScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        {/* Stub destinations so Home cards never dead-end */}
        <Stack.Screen name="CoachMike" component={PlaceholderScreen} />
        <Stack.Screen name="Routes" component={PlaceholderScreen} />
        <Stack.Screen
          name="RunMode"
          component={RunModeScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="ActiveRun"
          component={ActiveRunScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        {/* Fade, so the dark Active Run hands over to the light results. */}
        <Stack.Screen
          name="RunResults"
          component={RunResultsScreen}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
