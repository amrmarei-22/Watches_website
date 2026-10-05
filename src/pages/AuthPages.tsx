import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../domain/schemas'
import { useAuthState } from '../hooks/useAuthState'
import { isExistingEmailResponse } from '../domain/auth'

function internalReturnTo(value: string | null, fallback: string): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback
}

function errorCode(error: { message?: string } | null): string {
  const message = error?.message ?? ''
  if (/rate limit|too many/i.test(message)) return 'AUTH_LOCKED'
  if (/expired|invalid.*token|otp/i.test(message)) return 'AUTH_RESET_INVALID'
  if (/invalid login|invalid.*credentials/i.test(message)) return 'AUTH_INVALID_CREDENTIALS'
  return message || 'PAGE_500'
}

function FormError({ code }: { code: string | null }) {
  const { t } = useTranslation()
  return code ? <div className="form-alert" role="alert">{t(`messages.${code}`, { defaultValue: t('messages.PAGE_500') })}</div> : null
}

function AuthShell({ children, title }: { children: ReactNode; title: string }) {
  return <section className="container auth-page"><div className="auth-card"><h1 className="page-heading">{title}</h1>{children}</div></section>
}

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useAuthState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const returnTo = internalReturnTo(new URLSearchParams(location.search).get('returnTo'), admin ? '/admin' : `/${i18n.language}`)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return }
    setLoading(true); setError(null)
    const result = await supabase.auth.signInWithPassword(parsed.data)
    if (result.error || !result.data.user) { setError(errorCode(result.error)); setLoading(false); return }
    const profile = await supabase.from('profiles').select('role, enabled').eq('id', result.data.user.id).maybeSingle()
    if (profile.error || !profile.data?.enabled || (admin && profile.data.role !== 'ADMIN') || (!admin && profile.data.role === 'ADMIN')) {
      await supabase.auth.signOut(); setError(profile.data?.enabled === false ? 'AUTH_DISABLED' : 'AUTH_INVALID_CREDENTIALS'); setLoading(false); return
    }
    await refresh(); navigate(returnTo, { replace: true })
  }
  return <AuthShell title={t(admin ? 'auth.adminLogin.title' : 'auth.login.title')}><form onSubmit={submit} noValidate>
    <FormError code={error} />
    <Input id="login-email" label={t('auth.email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email && t(fieldErrors.email)} />
    <Input id="login-password" label={t('auth.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password && t(fieldErrors.password)} />
    <Button type="submit" loading={loading}>{t('auth.submitLogin')}</Button>
    {!admin && <p><Link to={`/${i18n.language}/forgot-password`}>{t('auth.forgot')}</Link> · <Link to={`/${i18n.language}/register`}>{t('auth.register')}</Link></p>}
  </form></AuthShell>
}

export function RegisterPage() {
  const { t, i18n } = useTranslation(); const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' }); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const parsed = registerSchema.safeParse(form); if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return }; setLoading(true); setError(null)
    const result = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { name: parsed.data.name, phone: parsed.data.phone }, emailRedirectTo: `${window.location.origin}/${i18n.language}/verify-email` } })
    if (result.error) setError(errorCode(result.error)); else if (isExistingEmailResponse(result.data.user)) setError('AUTH_EMAIL_TAKEN'); else if (result.data.user) navigate(`/${i18n.language}/verify-email`, { replace: true }); else setError('PAGE_500')
    setLoading(false)
  }
  return <AuthShell title={t('pages.register')}><form onSubmit={submit} noValidate><FormError code={error} />
    <Input id="register-name" label={t('auth.name')} autoComplete="name" value={form.name} onChange={update('name')} error={fieldErrors.name && t(fieldErrors.name, { field: t('auth.name'), min: 2, max: 60 })} />
    <Input id="register-email" label={t('auth.email')} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={update('email')} error={fieldErrors.email && t(fieldErrors.email)} />
    <Input id="register-phone" label={t('auth.phone')} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} error={fieldErrors.phone && t(fieldErrors.phone)} />
    <Input id="register-password" label={t('auth.password')} type="password" autoComplete="new-password" value={form.password} onChange={update('password')} error={fieldErrors.password && t(fieldErrors.password)} />
    <Input id="register-confirm" label={t('auth.confirmPassword')} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} error={fieldErrors.confirmPassword && t(fieldErrors.confirmPassword)} />
    <Button type="submit" loading={loading}>{t('auth.submitRegister')}</Button>
  </form></AuthShell>
}

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation(); const [email, setEmail] = useState(''); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const parsed = forgotPasswordSchema.safeParse({ email }); if (!parsed.success) { setError(parsed.error.issues[0].message); return }; setLoading(true); const result = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${window.location.origin}/${i18n.language}/reset-password` }); setError(result.error ? errorCode(result.error) : null); setSent(true); setLoading(false) }
  return <AuthShell title={t('pages.forgotPassword')}>{sent ? <div className="form-success" role="status">{t('messages.AUTH_RESET_SENT')}</div> : <form onSubmit={submit} noValidate><FormError code={error} /><Input id="forgot-email" label={t('auth.email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error?.startsWith('validation') ? t(error) : undefined} /><Button type="submit" loading={loading}>{t('auth.submitForgot')}</Button></form>}</AuthShell>
}

export function ResetPasswordPage() {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const parsed = resetPasswordSchema.safeParse({ password, confirmPassword }); if (!parsed.success) { setError(parsed.error.issues[0].message); return }; setLoading(true); const result = await supabase.auth.updateUser({ password: parsed.data.password }); if (result.error) setError('AUTH_RESET_INVALID'); else { await supabase.auth.signOut({ scope: 'others' }); navigate(`/${i18n.language}/login`, { replace: true }) }; setLoading(false) }
  return <AuthShell title={t('pages.resetPassword')}><form onSubmit={submit} noValidate><FormError code={error && (error.startsWith('validation') ? null : error)} /><Input id="reset-password" label={t('auth.password')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error?.startsWith('validation') ? t(error) : undefined} /><Input id="reset-confirm" label={t('auth.confirmPassword')} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /><Button type="submit" loading={loading}>{t('auth.submitReset')}</Button></form></AuthShell>
}

export function VerifyEmailPage() {
  const { t, i18n } = useTranslation(); const [error, setError] = useState<string | null>(null); const [verified, setVerified] = useState(false); const [loading, setLoading] = useState(false)
  const resend = async () => { setLoading(true); const { data } = await supabase.auth.getUser(); if (data.user?.email) { const result = await supabase.auth.resend({ type: 'signup', email: data.user.email }); setError(result.error ? 'AUTH_VERIFY_EXPIRED' : null) }; setLoading(false) }
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get('error') || params.get('error_code')) setError('AUTH_VERIFY_EXPIRED'); else void supabase.auth.getUser().then(({ data }) => setVerified(Boolean(data.user?.email_confirmed_at))) }, [])
  return <AuthShell title={t('pages.verifyEmail')}><FormError code={error} />{verified && !error && <div className="form-success" role="status">{t('messages.AUTH_VERIFIED')}</div>}{(!verified || error) && <p>{t('auth.checkEmail')}</p>}<Button type="button" variant="secondary" loading={loading} onClick={resend}>{t('actions.resendLink')}</Button><p><Link to={`/${i18n.language}/login`}>{t('nav.login')}</Link></p></AuthShell>
}
