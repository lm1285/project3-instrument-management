import type { User } from './authService';

const SESSION_KEY = 'auth_session';
const SESSION_END_REASON_KEY = 'auth_session_end_reason';
export const AUTH_SESSION_CHANGED_EVENT = 'auth:session-changed';

const NORMAL_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 4 * 60 * 60 * 1000;
const NORMAL_IDLE_MS = 30 * 60 * 1000;
const ADMIN_IDLE_MS = 15 * 60 * 1000;

type SessionState = {
  expiresAt: number;
  lastActivityAt: number;
  idleTimeoutMs: number;
};

const isAdmin = (user?: User | null) => Boolean(user?.is_system_admin || user?.role === 'admin');
const notifySessionChange = () => window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));

const getSession = (): SessionState | null => {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as SessionState;
    return Number.isFinite(session.expiresAt) && Number.isFinite(session.lastActivityAt) && Number.isFinite(session.idleTimeoutMs)
      ? session
      : null;
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem(SESSION_KEY);
  notifySessionChange();
};

export const endSession = (reason: string) => {
  sessionStorage.setItem(SESSION_END_REASON_KEY, reason);
  clearSession();
};

export const consumeSessionEndReason = () => {
  const reason = sessionStorage.getItem(SESSION_END_REASON_KEY) || '';
  sessionStorage.removeItem(SESSION_END_REASON_KEY);
  return reason;
};

export const startSession = (user: User) => {
  const now = Date.now();
  const admin = isAdmin(user);
  const session: SessionState = {
    expiresAt: now + (admin ? ADMIN_SESSION_MS : NORMAL_SESSION_MS),
    lastActivityAt: now,
    idleTimeoutMs: admin ? ADMIN_IDLE_MS : NORMAL_IDLE_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifySessionChange();
};

export const isSessionActive = () => {
  const session = getSession();
  if (!session) return false;
  const now = Date.now();
  return now < session.expiresAt && now - session.lastActivityAt < session.idleTimeoutMs;
};

export const ensureSession = (user: User) => {
  if (!getSession()) startSession(user);
  return isSessionActive();
};

export const recordSessionActivity = () => {
  const session = getSession();
  if (!session || !isSessionActive()) return false;

  const now = Date.now();
  // Avoid a localStorage write for every mouse move or keystroke.
  if (now - session.lastActivityAt >= 10_000) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActivityAt: now }));
  }
  return true;
};
