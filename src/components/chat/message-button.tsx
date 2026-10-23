import { Loader2, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { toErrorMessage } from '@/lib/api/errors'
import { useChatStore } from '@/stores/chat-store'

/** Opens the thread with someone, which the server creates only once. */
export function MessageButton({ username }: { username: string }) {
  const startWith = useChatStore((state) => state.startWith)
  const [opening, setOpening] = useState(false)
  const navigate = useNavigate()

  async function open() {
    setOpening(true)
    try {
      const conversation = await startWith(username)
      navigate(`/messages/${conversation.id}`)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not open a conversation.'))
    } finally {
      setOpening(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void open()} disabled={opening}>
      {opening ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      Message
    </Button>
  )
}
