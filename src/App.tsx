import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { RedirectIfAuthenticated, RequireAuth } from '@/components/auth/require-auth'
import { AppShell } from '@/components/layout/app-shell'
import { Toaster } from '@/components/ui/sonner'
import { ConversationPage } from '@/pages/conversation-page'
import { FeedPage } from '@/pages/feed-page'
import { FollowListPage } from '@/pages/follow-list-page'
import { LoginPage } from '@/pages/login-page'
import { MessagesPage } from '@/pages/messages-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { PostPage } from '@/pages/post-page'
import { ProfilePage } from '@/pages/profile-page'
import { RegisterPage } from '@/pages/register-page'
import { useAuthStore } from '@/stores/auth-store'

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate)

  // Confirms a persisted token still works before the router commits to a route.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/p/:postId" element={<PostPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/u/:username/followers" element={<FollowListPage relation="followers" />} />
            <Route path="/u/:username/following" element={<FollowListPage relation="following" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  )
}
