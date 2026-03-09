import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { API_BASE } from '@/lib/constants';

const RATING_LABELS = ['', '별로예요', '그냥 그래요', '괜찮아요', '맛있어요', '최고예요!'];

export default function ReviewScreen() {
  const router = useRouter();
  const { restaurantId, restaurantName } = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
  }>();
  const { user } = useUser();

  const [comment, setComment] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pricePerPerson =
    peopleCount && totalPrice && Number(peopleCount) > 0
      ? Math.round(Number(totalPrice) / Number(peopleCount))
      : null;

  async function handleSubmit() {
    if (comment.trim().length < 5) {
      Alert.alert('한 줄 후기를 5자 이상 작성해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.kakaoId ?? '',
          restaurantId,
          restaurantName: restaurantName ?? '',
          comment: comment.trim(),
          peopleCount: peopleCount ? Number(peopleCount) : null,
          totalPrice: totalPrice ? Number(totalPrice) : null,
          pricePerPerson: pricePerPerson ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('등록 실패', data.error ?? '잠시 후 다시 시도해주세요.');
        return;
      }
      router.replace('/my-selections');
    } catch {
      Alert.alert('등록 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>리뷰 작성</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* 식당명 */}
          <View style={s.restaurantBox}>
            <Text style={s.restaurantEmoji}>🍽️</Text>
            <Text style={s.restaurantName}>{restaurantName ?? restaurantId}</Text>
          </View>

          {/* 사진 업로드 (준비 중) */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>사진</Text>
            <View style={s.photoPlaceholder}>
              <Text style={s.photoPlaceholderText}>📷 사진 업로드 준비 중</Text>
            </View>
          </View>

          {/* 한 줄 후기 */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>한 줄 후기</Text>
            <TextInput
              style={s.textInput}
              placeholder="예) 매운 떡볶이가 최고였어요! (5자 이상)"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={200}
              value={comment}
              onChangeText={setComment}
            />
            <Text style={s.charCount}>{comment.length} / 200</Text>
          </View>

          {/* 인원 / 가격 */}
          <View style={s.row}>
            <View style={[s.section, { flex: 1 }]}>
              <Text style={s.sectionLabel}>인원 수</Text>
              <View style={s.inputWithUnit}>
                <TextInput
                  style={s.inlineInput}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={peopleCount}
                  onChangeText={setPeopleCount}
                />
                <Text style={s.unit}>명</Text>
              </View>
            </View>

            <View style={[s.section, { flex: 1 }]}>
              <Text style={s.sectionLabel}>총 가격</Text>
              <View style={s.inputWithUnit}>
                <TextInput
                  style={s.inlineInput}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                />
                <Text style={s.unit}>원</Text>
              </View>
            </View>
          </View>

          {/* 1인 평균 자동 계산 */}
          {pricePerPerson !== null && (
            <View style={s.avgBox}>
              <Text style={s.avgLabel}>1인 평균</Text>
              <Text style={s.avgValue}>{pricePerPerson.toLocaleString()}원</Text>
            </View>
          )}

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.submitBtnText}>리뷰 등록하기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  /* 헤더 */
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

  content: { padding: 20, gap: 24 },

  /* 식당 */
  restaurantBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  restaurantEmoji: { fontSize: 36 },
  restaurantName: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },

  /* 섹션 */
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  /* 별점 */
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 36, color: '#E5E7EB' },
  starFilled: { color: '#FBBF24' },
  ratingLabel: { fontSize: 14, fontWeight: '600', color: '#D97706' },

  /* 사진 */
  photoPlaceholder: {
    height: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 14, color: '#9CA3AF' },

  /* 텍스트 입력 */
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#374151',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },

  /* 인원/가격 행 */
  row: { flexDirection: 'row', gap: 12 },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  inlineInput: { flex: 1, fontSize: 15, color: '#374151' },
  unit: { fontSize: 14, color: '#9CA3AF' },

  /* 1인 평균 */
  avgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  avgLabel: { fontSize: 14, color: '#6B7280' },
  avgValue: { fontSize: 15, fontWeight: '700', color: '#FF6B35' },

  /* 제출 */
  submitBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
