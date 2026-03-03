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
import { Stack, useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { FloatingContactButton } from '@/components/floating-contact-button';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateNickname } = useUser();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const isChanged = nickname.trim() !== user.nickname;
  const isReady = nickname.trim().length > 0 && isChanged;

  const handleSave = async () => {
    if (!isReady) return;
    setSaving(true);
    try {
      await updateNickname(nickname.trim());
      Alert.alert('저장 완료', '닉네임이 변경되었어요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('오류', err instanceof Error ? err.message : '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>프로필 수정</Text>
          <View style={s.headerRight} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 아바타 */}
          <View style={s.avatarSection}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarEmoji}>🐻</Text>
            </View>
            <Text style={s.avatarHint}>프로필 사진 변경 (준비 중)</Text>
          </View>

          {/* 아이디 (읽기 전용) */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>아이디</Text>
            <View style={s.readonlyInput}>
              <Text style={s.readonlyText}>{user.userId}</Text>
              <Text style={s.readonlyBadge}>변경 불가</Text>
            </View>
            <Text style={s.hintText}>아이디는 고유 식별자로 변경이 어려워요</Text>
          </View>

          {/* 닉네임 */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              닉네임 <Text style={s.labelRequired}>*</Text>
            </Text>
            <TextInput
              style={s.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임을 입력해주세요"
              placeholderTextColor="#C4C9D1"
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <View style={s.hintRow}>
              <Text style={s.hintText}>중복 가능 · 최대 20자</Text>
              <Text style={s.charCount}>{nickname.length}/20</Text>
            </View>
          </View>

          {/* 미리보기 */}
          <View style={s.previewCard}>
            <Text style={s.previewLabel}>미리보기</Text>
            <View style={s.previewProfile}>
              <View style={s.previewAvatar}>
                <Text style={s.previewAvatarEmoji}>🐻</Text>
              </View>
              <View style={s.previewInfo}>
                <Text style={s.previewNickname}>{nickname.trim() || user.nickname}</Text>
                <Text style={s.previewUserId}>{user.userId}</Text>
              </View>
            </View>
          </View>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[s.saveBtn, (!isReady || saving) && s.btnDisabled]}
            onPress={handleSave}
            disabled={!isReady || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.saveBtnText}>저장하기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  /* 헤더 */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4, minWidth: 36 },
  backIcon: { fontSize: 30, color: '#374151', lineHeight: 34 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' },
  headerRight: { minWidth: 36 },

  /* 스크롤 */
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  /* 아바타 */
  avatarSection: { alignItems: 'center', marginBottom: 36 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
    marginBottom: 10,
  },
  avatarEmoji: { fontSize: 48 },
  avatarHint: { fontSize: 13, color: '#9CA3AF' },

  /* 필드 */
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
  readonlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    backgroundColor: '#F9FAFB',
  },
  readonlyText: { fontSize: 16, color: '#9CA3AF' },
  readonlyBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  hintText: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  charCount: { fontSize: 12, color: '#9CA3AF' },

  /* 미리보기 */
  previewCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
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

  /* 저장 버튼 */
  saveBtn: {
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
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
