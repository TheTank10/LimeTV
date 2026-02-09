import { requireNativeModule } from 'expo-modules-core';
import { HomeIndicatorControllerModule } from './HomeIndicatorController.types';

const NativeModule: HomeIndicatorControllerModule = requireNativeModule('HomeIndicatorController');

export function setAutoHidden(autoHidden: boolean): void {
  NativeModule.setAutoHidden(autoHidden);
}