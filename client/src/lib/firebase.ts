import { initializeApp, getApps } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes, uploadString } from 'firebase/storage'
import type { ClaimData, FileItem } from '@/types/claim'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCCvL7obUcXMQLwLl89NY1SD_X2PHWfHh8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'claim-tracker-54d78.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'claim-tracker-54d78',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'claim-tracker-54d78.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '670381252396',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:670381252396:web:5d4b219e1747e334de5689',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-GP0L9JLJJ4',
}

const app = getApps()[0] ?? initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export function getUid(): string | null {
  return auth.currentUser?.uid ?? null
}

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function logout() {
  return signOut(auth)
}

export async function createAccount(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)]),
    ) as T
  }
  return value
}

export async function loadClaim(uid = getUid()): Promise<ClaimData | null> {
  if (!uid) return null
  const snapshot = await getDoc(doc(db, 'claims', uid))
  return snapshot.exists() ? (snapshot.data() as ClaimData) : null
}

export async function saveClaim(claim: ClaimData, uid = getUid()) {
  if (!uid) throw new Error('auth/unauthenticated')
  await setDoc(doc(db, 'claims', uid), stripUndefined(claim), { merge: true })
}

function makeStoragePath(filename: string, folder: string) {
  const safeName = filename.replaceAll(/\s+/g, '-').replaceAll(/[^a-zA-Z0-9._-]/g, '')
  return `${folder}/${Date.now()}-${safeName}`
}

export async function uploadFile(file: File, folder = 'uploads'): Promise<FileItem> {
  const path = makeStoragePath(file.name, folder)
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
    url,
    path,
    uploadedAt: new Date().toISOString(),
  }
}

export async function storeMediaFile(file: File, meta?: { folder?: string }) {
  return uploadFile(file, meta?.folder || 'media')
}

export async function storeDataUrl(dataUrl: string, meta?: { filename?: string; folder?: string }) {
  const filename = meta?.filename || 'image.jpg'
  const path = makeStoragePath(filename, meta?.folder || 'media')
  const fileRef = ref(storage, path)
  await uploadString(fileRef, dataUrl, 'data_url')
  const url = await getDownloadURL(fileRef)
  return {
    name: filename,
    type: 'image/jpeg',
    url,
    path,
    uploadedAt: new Date().toISOString(),
  } satisfies FileItem
}
