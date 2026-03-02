import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { placeId, placeUrl } = useLocalSearchParams<{
    placeId: string;
    placeUrl: string;
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
        <WebView
          key={webUrl}
          source={{ uri: webUrl }}
          style={s.webView}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
          renderLoading={() => (
            <View style={s.loader}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={s.loaderTxt}>가게 정보를 불러오는 중...</Text>
            </View>
          )}
        />
      </View>
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
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loaderTxt: { color: '#6B7280', fontSize: 14 },
});
