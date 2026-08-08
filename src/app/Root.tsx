import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './query-client'
import { useAuthStore } from '@/features/auth/store'

export function Root() {
  const restore = useAuthStore((s) => s.restore)

  // Revalidate any persisted session once, before the first guarded route
  // resolves — otherwise a refresh on /app bounces the user to /login.
  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
