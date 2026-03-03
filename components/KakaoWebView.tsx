import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  uri: string;
  placeName?: string;
  category?: string;
  address?: string;
  phone?: string;
}

const ORANGE = '#F57C4A';

export default function KakaoWebView({ uri }: Props) {
  return (
    <WebView
      key={uri}
      source={{ uri }}
      style={styles.webView}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
      renderLoading={() => (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loaderText}>맛집 정보를 불러오는 중...</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  webView: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loaderText: { color: '#666', fontSize: 14 },
});
