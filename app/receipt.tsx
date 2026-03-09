import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ReceiptScreen() {
  const router = useRouter();
  const { restaurantName } = useLocalSearchParams<{ restaurantName?: string }>();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>영수증</Text>
        <View style={s.backBtn} />
      </View>

      <View style={s.centerBox}>
        <Text style={s.emoji}>🧾</Text>
        <Text style={s.title}>{restaurantName ?? '영수증'}</Text>
        <Text style={s.desc}>영수증 출력 기능은 준비 중이에요</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 36, justifyContent: 'center' },
  backIcon: { fontSize: 28, color: '#374151', lineHeight: 32 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji: { fontSize: 52, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 14, color: '#9CA3AF' },
});
