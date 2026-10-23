import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toErrorMessage, toFieldErrors } from '@/lib/api/errors'
import { useAuthStore } from '@/stores/auth-store'

const FIELDS = [
  {
    name: 'display_name',
    label: 'Display name',
    type: 'text',
    autoComplete: 'name',
    required: false,
    hint: 'Optional. Shown instead of your username.',
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    autoComplete: 'username',
    required: true,
    hint: '3-30 characters: lowercase letters, numbers, "_" or ".".',
  },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    required: true,
    hint: 'At least 8 characters, and not a common password.',
  },
] as const

export function RegisterPage() {
  const register = useAuthStore((state) => state.register)
  const navigate = useNavigate()

  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(toErrorMessage(caught, 'Could not create your account.'))
      setFieldErrors(toFieldErrors(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Sparkles className="mx-auto size-6 text-primary" />
          <CardTitle className="text-xl">Join Social Media</CardTitle>
          <CardDescription>Share photos, video, and sound with your people.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {FIELDS.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required={field.required}
                  value={form[field.name]}
                  onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                  aria-invalid={Boolean(fieldErrors[field.name])}
                />
                {fieldErrors[field.name] ? (
                  <p className="text-xs text-destructive">{fieldErrors[field.name]}</p>
                ) : (
                  'hint' in field && <p className="text-xs text-muted-foreground">{field.hint}</p>
                )}
              </div>
            ))}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
