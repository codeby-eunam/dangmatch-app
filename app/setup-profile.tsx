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
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';

// @로 시작, 영문 첫 글자, 이후 영문/숫자/./_ 조합, 2~20자 (@포함 총 3~21자)
const USER_ID_REGEX = /^@[a-zA-Z][a-zA-Z0-9._]{1,19}$/;

export default function SetupProfileScreen() {
  const router = useRouter();
  const { setupProfile, checkUserIdAvailable } = useUser();

  const [userId, setUserId] = useState('@');
  const [nickname, setNickname] = useState('');
  const [userIdError, setUserIdError] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validateUserIdFormat = (value: string): string => {
    if (!value || value === '@') return '아이디를 입력해주세요';
    if (value.length < 3) return '@로 시작하는 2자 이상 입력해주세요';
    if (!USER_ID_REGEX.test(value)) {
      return '영문자로 시작하고 영문/숫자/. /_ 만 사용 가능해요 (2~20자)';
    }
    return '';
  };

  const handleUserIdChange = (value: string) => {
    // @ 제거 방지
    if (!value.startsWith('@')) return;
    // 대문자 자동 소문자 변환
    setUserId(value.toLowerCase());
    setUserIdError('');
  };

  const handleSubmit = async () => {
    const formatError = validateUserIdFormat(userId);
    if (formatError) {
      setUserIdError(formatError);
      return;
    }
    if (!nickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return;
    }

    setChecking(true);
    try {
      const available = await checkUserIdAvailable(userId);
      if (!available) {
        setUserIdError('이미 사용 중인 아이디예요. 다른 아이디를 입력해주세요.');
        return;
      }
    } finally {
      setChecking(false);
    }

    setSubmitting(true);
    try {
      await setupProfile(userId, nickname.trim());
      router.replace('/(tabs)');
    } catch {
      Alert.alert('오류', '프로필 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormReady = USER_ID_REGEX.test(userId) && nickname.trim().length > 0;
  const isLoading = checking || submitting;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 헤더 */}
          <View style={s.header}>
            <View style={s.stepBadge}>
              <Text style={s.stepBadgeText}>프로필 설정</Text>
            </View>
            <Text style={s.title}>당매치에서 사용할{'\n'}아이디와 닉네임을 만들어요</Text>
            <Text style={s.subtitle}>아이디는 한 번 설정하면 변경이 어려워요</Text>
          </View>

          {/* 아이디 입력 */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              아이디 <Text style={s.labelRequired}>*</Text>
            </Text>
            <TextInput
              style={[s.input, userIdError ? s.inputError : null]}
              value={userId}
              onChangeText={handleUserIdChange}
              placeholder="@your_id"
              placeholderTextColor="#C4C9D1"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={21}
              returnKeyType="next"
            />
            {userIdError ? (
              <View style={s.errorRow}>
                <Text style={s.errorIcon}>⚠️</Text>
                <Text style={s.errorText}>{userIdError}</Text>
              </View>
            ) : (
              <Text style={s.hintText}>
                @로 시작 · 영문/숫자/. /_ 사용 가능 · 2~20자
              </Text>
            )}
          </View>

          {/* 닉네임 입력 */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              닉네임 <Text style={s.labelRequired}>*</Text>
            </Text>
            <TextInput
              style={s.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="예: 맛집헌터, 고민쟁이"
              placeholderTextColor="#C4C9D1"
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <View style={s.hintRow}>
              <Text style={s.hintText}>중복 가능 · 최대 20자</Text>
              <Text style={s.charCount}>{nickname.length}/20</Text>
            </View>
          </View>

          {/* 미리보기 카드 */}
          {(userId.length > 1 || nickname.length > 0) && (
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>미리보기</Text>
              <View style={s.previewProfile}>
                <View style={s.previewAvatar}>
                  <Text style={s.previewAvatarEmoji}>🐻</Text>
                </View>
                <View style={s.previewInfo}>
                  <Text style={s.previewNickname}>
                    {nickname.trim() || '닉네임'}
                  </Text>
                  <Text style={s.previewUserId}>
                    {userId.length > 1 ? userId : '@아이디'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 완료 버튼 */}
          <TouchableOpacity
            style={[s.submitBtn, (!isFormReady || isLoading) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!isFormReady || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.submitBtnText}>완료</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: { marginBottom: 36 },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  stepBadgeText: { fontSize: 13, fontWeight: '700', color: '#FF6B35' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: '#9CA3AF' },

  fieldGroup: { marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  labelRequired: { color: '#FF6B35' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  errorIcon: { fontSize: 12 },
  errorText: { fontSize: 12, color: '#EF4444', flex: 1 },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  hintText: { fontSize: 12, color: '#9CA3AF' },
  charCount: { fontSize: 12, color: '#9CA3AF' },

  previewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  previewLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 12 },
  previewProfile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  previewAvatarEmoji: { fontSize: 26 },
  previewInfo: { gap: 4 },
  previewNickname: { fontSize: 17, fontWeight: '700', color: '#111827' },
  previewUserId: { fontSize: 13, color: '#9CA3AF' },

  submitBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  btnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
