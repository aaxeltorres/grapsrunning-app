import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidLocation } from '../utils/location';

export const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
export const ACTIVE_RUN_DATA_KEY = 'ACTIVE_RUN_DATA';

// Ensure task is defined in the global scope
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('LOCATION_TASK_NAME error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    if (locations && locations.length > 0) {
      try {
        const storedData = await AsyncStorage.getItem(ACTIVE_RUN_DATA_KEY);
        let parsedData: Location.LocationObject[] = storedData ? JSON.parse(storedData) : [];
        
        let previous = parsedData.length > 0 ? parsedData[parsedData.length - 1] : null;

        for (const loc of locations) {
          if (previous?.coords?.altitude === -9999 || isValidLocation(loc, previous)) {
            parsedData.push(loc);
            previous = loc;
          }
        }
        
        await AsyncStorage.setItem(ACTIVE_RUN_DATA_KEY, JSON.stringify(parsedData));
      } catch (e) {
        console.error('Failed to save location data to AsyncStorage', e);
      }
    }
  }
});
