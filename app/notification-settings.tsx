import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface NotifItem {
  key: string;
  title: string;
  desc: string;
}

const NOTIF_ITEMS: NotifItem[] = [
  {
    key: 'recommend',
    title: '맛집 추천 알림',
    desc: '내 주변 새 맛집이 등록되면 알려드려요',
  },
  {
    key: 'library',
    title: '보관함 업데이트',
    desc: '저장한 맛집에 변동사항이 생기면 알려드려요',
  },
  {
    key: 'marketing',
    title: '마케팅 · 이벤트 알림',
    desc: '혜택 및 이벤트 정보를 보내드려요',
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();

  const [settings, setSettings] = useState<Record<string, boolean>>({
    recommend: true,
    library: true,
    marketing: false,
  });

  const toggle = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: PATCH /api/user/notifications { [key]: !prev[key] }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>알림 설정</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Text style={s.sectionDesc}>
          알림은 기기 설정에서 허용한 경우에만 수신돼요.
        </Text>

        <View style={s.card}>
          {NOTIF_ITEMS.map((item, idx) => (
            <React.Fragment key={item.key}>
              {idx > 0 && <View style={s.divider} />}
              <View style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.rowDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: '#E5E7EB', true: '#FF6B35' }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
            </React.Fragment>
          ))}
        </View>

        <Text style={s.footerNote}>
          알림을 모두 끄려면 기기의 [설정 → 앱 → 당매치]에서 변경해주세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  /* 헤더 */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4, minWidth: 36 },
  backIcon: { fontSize: 30, color: '#374151', lineHeight: 34 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' },
  headerRight: { minWidth: 36 },

  /* 스크롤 */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },

  sectionDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 20,
  },

  /* 카드 */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 18 },

  /* 푸터 */
  footerNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
