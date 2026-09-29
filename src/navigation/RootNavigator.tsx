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
  ActiveRunScreen,
  RunResultsScreen,
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
        {/* Stub destinations so Home cards never dead-end */}
        <Stack.Screen name="CoachMike" component={PlaceholderScreen} />
        <Stack.Screen name="Routes" component={PlaceholderScreen} />
        <Stack.Screen name="Plan" component={PlaceholderScreen} />
        <Stack.Screen 
          name="ActiveRun" 
          component={ActiveRunScreen} 
          options={{ presentation: 'fullScreenModal' }} 
        />
        <Stack.Screen name="RunResults" component={RunResultsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
