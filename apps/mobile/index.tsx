import '@expo/metro-runtime';
import React from 'react';
import { ExpoRoot } from 'expo-router';
import { Head } from 'expo-router/build/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import 'expo-router/build/fast-refresh';

// Statically define the context to './app' to bypass EXPO_ROUTER_APP_ROOT replacement issues
const ctx = (require as any).context(
  './app',
  true,
  /\.(t|j)sx?$/
);

export function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} />
    </Head.Provider>
  );
}

renderRootComponent(App);
