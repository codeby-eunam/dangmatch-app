/**
 * Firebase 초기화
 * 설정값은 lib/firebase.config.ts 에서 관리 (git 제외)
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from './firebase.config';

// ─── 앱 초기화 (중복 방지) ────────────────────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Firestore 인스턴스 ───────────────────────────────────────────────────────
export const db = getFirestore(app);

// ─── Firebase Auth 인스턴스 ───────────────────────────────────────────────────
export const auth = getAuth(app);

export default app;
