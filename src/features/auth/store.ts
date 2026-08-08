import { create } from 'zustand'
import {
  can,
  Permission,
  Role,
  type AuthSession,
  type LoginRequest,
  type RegisterRequest,
  type UserProfile,
} from '@/domain/identity/model'
import { container } from '@/infrastructure/container'

/**
 * Session state.
 *
 * Zustand rather than Context because auth is read by nearly every screen and
 * a Context value re-renders its whole subtree on any change; selectors here
 * mean a nav badge update doesn't re-render the booking calendar.
 */

type AuthState = {
  session: AuthSession | null
  status: 'idle' | 'restoring' | 'authenticated' | 'anonymous'
  error: string | null
  pending: boolean

  restore: () => Promise<void>
  login: (request: LoginRequest) => Promise<AuthSession>
  register: (request: RegisterRequest) => Promise<AuthSession>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'idle',
  error: null,
  pending: false,

  restore: async () => {
    set({ status: 'restoring' })
    const session = await container.auth.restore()
    set({ session, status: session ? 'authenticated' : 'anonymous' })
  },

  login: async (request) => {
    set({ pending: true, error: null })
    try {
      const session = await container.auth.login(request)
      set({ session, status: 'authenticated', pending: false })
      return session
    } catch (error) {
      set({ pending: false, error: (error as Error).message })
      throw error
    }
  },

  register: async (request) => {
    set({ pending: true, error: null })
    try {
      const session = await container.auth.register(request)
      set({ session, status: 'authenticated', pending: false })
      return session
    } catch (error) {
      set({ pending: false, error: (error as Error).message })
      throw error
    }
  },

  logout: async () => {
    await container.auth.logout()
    set({ session: null, status: 'anonymous', error: null })
  },

  clearError: () => set({ error: null }),
}))

// --- Selectors -------------------------------------------------------------
// Exported as stable function references so components subscribe to the
// narrowest slice they need.

export const useSession = () => useAuthStore((s) => s.session)
export const useCurrentUser = (): UserProfile | null => useAuthStore((s) => s.session?.user ?? null)
export const useAuthStatus = () => useAuthStore((s) => s.status)
export const useTenant = () => useAuthStore((s) => s.session?.tenant ?? null)

export const useCan = (permission: Permission) =>
  useAuthStore((s) => (s.session ? can(s.session.user.role, permission) : false))

/** The landing screen for each role after sign-in. */
export const homeRouteFor = (role: Role): string => {
  switch (role) {
    case Role.Member:
      return '/app'
    case Role.Coach:
      return '/app/coach'
    case Role.Admin:
    case Role.AppManager:
      return '/app/admin'
  }
}

export { Permission, Role }
