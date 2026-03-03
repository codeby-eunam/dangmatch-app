import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FloatingContactButton } from '@/components/floating-contact-button';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KakaoWebView from '@/components/KakaoWebView';

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { placeId, placeUrl, placeName, category, address, phone } = useLocalSearchParams<{
    placeId: string;
    placeUrl: string;
    placeName?: string;
    category?: string;
    address?: string;
    phone?: string;
  }>();

  const webUrl =
    placeUrl && placeUrl !== 'undefined' && placeUrl !== ''
      ? placeUrl
      : `https://place.map.kakao.com/${placeId}`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* 뒤로가기 버튼 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={s.webWrap}>
        <KakaoWebView
          uri={webUrl}
          placeName={placeName}
          category={category}
          address={address}
          phone={phone}
        />
      </View>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 36,
    color: '#1F2937',
    lineHeight: 42,
    fontWeight: '300',
  },

  webWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: { flex: 1 },
});
