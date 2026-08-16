import { create } from 'zustand';
import { STORAGE_KEYS } from '@/lib/env';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

export interface Notification {
  id: string;
  title: string;
  description?: string;
  at: number;
  read: boolean;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  notifications: Notification[];
  pushNotification: (notification: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  markNotificationsRead: () => void;
}

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1',

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, next ? '1' : '0');
      return { sidebarCollapsed: next };
    }),

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? '1' : '0');
    set({ sidebarCollapsed: collapsed });
  },

  toasts: [],

  pushToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { ...toast, id: uid() }].slice(-4) })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  notifications: [],

  pushNotification: (notification) =>
    set((state) => ({
      notifications: [
        { ...notification, id: uid(), at: Date.now(), read: false },
        ...state.notifications,
      ].slice(0, 30),
    })),

  markNotificationsRead: () =>
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),
}));

/** Fire-and-forget toast helper usable outside React. */
export const toast = {
  success: (title: string, description?: string) =>
    useUiStore.getState().pushToast({ title, variant: 'success', ...(description && { description }) }),
  error: (title: string, description?: string) =>
    useUiStore.getState().pushToast({ title, variant: 'error', ...(description && { description }) }),
  info: (title: string, description?: string) =>
    useUiStore.getState().pushToast({ title, variant: 'info', ...(description && { description }) }),
  warning: (title: string, description?: string) =>
    useUiStore.getState().pushToast({ title, variant: 'warning', ...(description && { description }) }),
};
