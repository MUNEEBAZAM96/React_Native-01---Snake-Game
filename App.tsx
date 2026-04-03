import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Game from './src/Components/Game';

export default function App(): React.ReactElement {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Game />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
