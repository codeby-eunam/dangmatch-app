import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useUser } from '@/context/UserContext';

const API_BASE = 'https://dangmatch.vercel.app';

interface Props {
  bottomOffset?: number;
}

export function FloatingContactButton({ bottomOffset = 0 }: Props) {
  const { user } = useUser();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const closeModal = () => {
    setModalVisible(false);
    setMessage('');
  };

  const handleSubmit = async () => {
    if (message.trim().length < 5) {
      Alert.alert('알림', '문의 내용을 5자 이상 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feedback',
          message: message.trim(),
          nickname: user?.nickname ?? null,
          uid: user?.userId ?? null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('전송 완료', '문의가 접수되었습니다. 빠르게 답변 드릴게요!');
        closeModal();
      } else {
        Alert.alert('오류', '전송에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      Alert.alert('오류', '네트워크 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + bottomOffset }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>!</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kvAware}
          >
            <View style={styles.sheet}>
              <View style={styles.handle} />

              <Text style={styles.sheetTitle}>문의하기</Text>
              <Text style={styles.sheetSub}>
                불편한 점이나 개선 의견을 알려주세요.{'\n'}빠르게 검토하겠습니다!
              </Text>

              <TextInput
                style={styles.textArea}
                placeholder="문의 내용을 입력해주세요..."
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{message.length} / 500</Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    message.trim().length < 5 && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={sending || message.trim().length < 5}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitText}>보내기</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 100,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  kvAware: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  sheetSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#FCA98C',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
