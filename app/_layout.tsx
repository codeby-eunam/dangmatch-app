import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Platform } from 'react-native';
import { Analytics } from '@vercel/analytics/react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LibraryProvider } from '@/context/LibraryContext';
import { UserProvider } from '@/context/UserContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <UserProvider>
      <LibraryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="landing" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="setup-profile" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="mode-select" options={{ headerShown: false }} />
            <Stack.Screen name="swipe" options={{ headerShown: false }} />
            <Stack.Screen name="tournament" options={{ headerShown: false }} />
            <Stack.Screen name="result" options={{ headerShown: false }} />
            <Stack.Screen name="library-detail" options={{ headerShown: false }} />
            <Stack.Screen name="restaurant-detail" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
			<Stack.Screen name="share" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
          {Platform.OS === 'web' && <Analytics />}
        </ThemeProvider>
      </LibraryProvider>
    </UserProvider>
  );
}
