import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/data/types'

interface Session {
  userId: string | null
  role: Role | null
  login: (userId: string, role: Role) => void
  logout: () => void
}

export const useSession = create<Session>()(persist((set) => ({
  userId: 'u-buyer-1',
  role: 'buyer',
  login: (userId, role) => set({ userId, role }),
  logout: () => set({ userId: null, role: null }),
}), { name: 'plam-session-v1' }))

interface Toast { id: number; text: string; type: 'success' | 'error' | 'info' }
interface UI { toasts: Toast[]; toast: (text: string, type?: Toast['type']) => void; dismiss: (id: number) => void }
let tid = 0
export const useUI = create<UI>()((set) => ({
  toasts: [],
  toast: (text, type = 'success') => {
    const id = ++tid
    set(s => ({ toasts: [...s.toasts, { id, text, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 2400)
  },
  dismiss: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
export const toast = (text: string, type?: Toast['type']) => useUI.getState().toast(text, type)
