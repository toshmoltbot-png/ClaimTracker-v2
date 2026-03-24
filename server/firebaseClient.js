/**
 * Single Firebase init for browser. Import from index.html.
 * Guarded with getApps().length so we never double-initialize.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

export const auth = getAuth(app);
