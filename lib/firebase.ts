/**
 * Firebase 초기화
 *
 * 사용 방법:
 *  1. Firebase Console (https://console.firebase.google.com) → 프로젝트 생성
 *  2. 웹 앱 추가 → firebaseConfig 값 아래에 채워 넣기
 *  3. Firestore Database 생성 (테스트 모드로 시작)
 *  4. Analytics 활성화 (선택)
 *
 * 설정값을 채우면 바로 동작합니다.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ─── Firebase 프로젝트 설정 ──────────────────────────────────────────────────
// Firebase Console → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성에서 복사
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId:             'YOUR_APP_ID',
  measurementId:     'YOUR_MEASUREMENT_ID', // Analytics G-XXXXXXXXXX
};

// ─── 앱 초기화 (중복 방지) ────────────────────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Firestore 인스턴스 ───────────────────────────────────────────────────────
export const db = getFirestore(app);

export default app;
