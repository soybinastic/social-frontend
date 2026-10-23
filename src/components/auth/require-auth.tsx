import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth-store'

export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  // Waiting on hydration, otherwise a refresh would bounce a signed-in user
  // to the login page before the stored token has been checked.
  if (status === 'hydrating') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectIfAuthenticated() {
  const status = useAuthStore((state) => state.status)

  if (status === 'hydrating') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />
}
