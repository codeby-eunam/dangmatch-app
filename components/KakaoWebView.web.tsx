import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

interface Props {
  uri: string;
  placeName?: string;
  category?: string;
  address?: string;
  phone?: string;
}

const ORANGE = '#F57C4A';

export default function KakaoWebView({ uri, placeName, category, address, phone }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🍽️</Text>
      </View>

      {!!placeName && <Text style={styles.name}>{placeName}</Text>}

      {!!category && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{category}</Text>
        </View>
      )}

      {!!address && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText}>{address}</Text>
        </View>
      )}

      {!!phone && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📞</Text>
          <Text style={styles.infoText}>{phone}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => Linking.openURL(uri)}
        activeOpacity={0.8}
      >
        <Text style={styles.linkBtnText}>카카오맵에서 보기 →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: { fontSize: 36 },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
  },
  infoIcon: { fontSize: 14, marginTop: 1 },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
  linkBtn: {
    marginTop: 8,
    backgroundColor: ORANGE,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#C9540A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  linkBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
