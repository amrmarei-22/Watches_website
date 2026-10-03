import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AddressForm } from '../components/AddressForm'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Toast } from '../components/ui/Toast'
import { MAX_ADDRESSES_PER_USER } from '../config/businessConfig'
import { changePasswordSchema, profileSchema, type AddressInput } from '../domain/schemas'
import { reauthenticateAndChangePassword, profileUpdatePayload } from '../features/account/accountLogic'
import { supabase } from '../lib/supabaseClient'

type AccountAddress = AddressInput & { id: string; is_default: boolean }

function codeFor(error: { message?: string } | null): string {
  return error?.message || 'PAGE_500'
}

export function AccountPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: '', phone: '', email: '', verified: false })
  const [addresses, setAddresses] = useState<AccountAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<'profile' | 'addresses' | 'password'>('profile')
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addressEditor, setAddressEditor] = useState<AccountAddress | 'new' | null>(null)
  const [deleteAddress, setDeleteAddress] = useState<AccountAddress | null>(null)

  const load = async () => {
    setLoading(true); setFailed(false)
    const userResult = await supabase.auth.getUser()
    if (userResult.error || !userResult.data.user?.email) { setFailed(true); setLoading(false); return }
    const user = userResult.data.user
    const email = user.email
    if (!email) { setFailed(true); setLoading(false); return }
    const [profileResult, addressesResult] = await Promise.all([
      supabase.from('profiles').select('name, phone').eq('id', user.id).maybeSingle(),
      supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    ])
    if (profileResult.error || addressesResult.error) { setFailed(true); setLoading(false); return }
    const nextProfile = { name: profileResult.data?.name ?? '', phone: profileResult.data?.phone ?? '', email, verified: user.email_confirmed_at !== null }
    setProfile(nextProfile); setProfileForm({ name: nextProfile.name, phone: nextProfile.phone }); setAddresses((addressesResult.data ?? []) as AccountAddress[]); setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError(null); setMessage(null)
    const parsed = profileSchema.safeParse(profileForm)
    if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return }
    setSaving(true)
    const user = (await supabase.auth.getUser()).data.user
    const result = user ? await supabase.from('profiles').update(profileUpdatePayload(parsed.data)).eq('id', user.id) : { error: { message: 'AUTH_SESSION_EXPIRED' } }
    if (result.error) setFormError(codeFor(result.error)); else { setProfile((current) => ({ ...current, ...parsed.data })); setMessage('ACCOUNT_SAVED') }
    setSaving(false)
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError(null); setMessage(null)
    const parsed = changePasswordSchema.safeParse(passwordForm)
    if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return }
    setSaving(true)
    const result = await reauthenticateAndChangePassword(supabase, profile.email, parsed.data)
    if (result) setFormError(result); else { setPasswordForm({ currentPassword: '', password: '', confirmPassword: '' }); setMessage('PASSWORD_CHANGED') }
    setSaving(false)
  }

  const saveAddress = async (value: AddressInput) => {
    setSaving(true); setFormError(null)
    const editor = addressEditor
    const result = editor !== 'new' && editor ? await supabase.from('addresses').update({ full_name: value.fullName, phone: value.phone, governorate: value.governorate, city: value.city, street: value.street, building: value.building, notes: value.notes }).eq('id', editor.id) : await supabase.from('addresses').insert({ full_name: value.fullName, phone: value.phone, governorate: value.governorate, city: value.city, street: value.street, building: value.building, notes: value.notes }).select('*').single()
    if (result.error) setFormError(codeFor(result.error)); else { setAddressEditor(null); setMessage('ACCOUNT_SAVED'); await load() }
    setSaving(false)
  }

  const removeAddress = async () => {
    if (!deleteAddress) return
    setSaving(true); const result = await supabase.from('addresses').delete().eq('id', deleteAddress.id)
    if (result.error) setFormError(codeFor(result.error)); else { setDeleteAddress(null); setMessage('ACCOUNT_SAVED'); await load() }
    setSaving(false)
  }

  const setDefault = async (id: string) => {
    setSaving(true); const result = await supabase.rpc('set_default_address', { p_address_id: id })
    if (result.error) setFormError(codeFor(result.error)); else { setMessage('ACCOUNT_SAVED'); await load() }
    setSaving(false)
  }

  if (loading) return <section className="container account-page"><Skeleton className="account-skeleton" /><Skeleton className="account-skeleton" /><Skeleton className="account-skeleton" /></section>
  if (failed) return <ErrorState message={t('messages.PAGE_500')} action={t('actions.tryAgain')} onAction={() => void load()} />
  const errorMessage = formError ? t(`messages.${formError}`, { defaultValue: t('messages.PAGE_500') }) : null
  return <section className="container account-page">
    <div className="account-heading"><div><h1 className="page-heading">{t('pages.account')}</h1><Link to={`/${i18n.language}/account/orders`}>{t('pages.orders')}</Link></div>{message && <Toast onDismiss={() => setMessage(null)}>{t(`messages.${message}`)}</Toast>}</div>
    <nav className="account-tabs" aria-label={t('pages.account')}><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>{t('account.profile')}</button><button className={tab === 'addresses' ? 'active' : ''} onClick={() => setTab('addresses')}>{t('account.addresses')}</button><button className={tab === 'password' ? 'active' : ''} onClick={() => setTab('password')}>{t('account.password')}</button></nav>
    {errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
    {tab === 'profile' && <form className="account-section address-form" onSubmit={saveProfile} noValidate>
      <Input id="account-email" label={t('auth.email')} type="email" value={profile.email} readOnly hint={profile.verified ? t('account.verified') : t('account.unverified')} />
      {!profile.verified && <Button type="button" variant="text" onClick={() => navigate(`/${i18n.language}/verify-email`)}>{t('actions.resendLink')}</Button>}
      <Input id="account-name" label={t('auth.name')} autoComplete="name" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} error={fieldErrors.name && t(fieldErrors.name, { field: t('auth.name'), min: 2, max: 60 })} />
      <Input id="account-phone" label={t('auth.phone')} type="tel" inputMode="tel" autoComplete="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} error={fieldErrors.phone && t(fieldErrors.phone)} />
      <Button type="submit" loading={saving}>{t('account.save')}</Button>
    </form>}
    {tab === 'addresses' && <section className="account-section"><div className="account-section-heading"><h2>{t('account.addresses')}</h2><Button disabled={addresses.length >= MAX_ADDRESSES_PER_USER} onClick={() => setAddressEditor('new')}>{t('account.addAddress')}</Button></div>{addresses.length >= MAX_ADDRESSES_PER_USER && <p className="ui-hint">{t('messages.ADDRESS_LIMIT')}</p>}{addresses.length === 0 ? <EmptyState message={t('account.addressesEmpty')} action={t('account.addAddress')} onAction={() => setAddressEditor('new')} /> : <div className="account-addresses">{addresses.map((address) => <article className="address-option" key={address.id}><strong>{address.fullName}</strong>{address.is_default && <span className="status-badge">{t('account.default')}</span>}<p>{address.phone} · {address.city}, {address.governorate}<br />{address.street} {address.building}</p><div className="account-actions"><Button variant="text" onClick={() => setAddressEditor(address)}>{t('account.edit')}</Button>{!address.is_default && <Button variant="text" onClick={() => void setDefault(address.id)} disabled={saving}>{t('account.setDefault')}</Button>}<Button variant="text" onClick={() => setDeleteAddress(address)}>{t('account.delete')}</Button></div></article>)}</div>}</section>}
    {tab === 'password' && <form className="account-section address-form" onSubmit={savePassword} noValidate><Input id="current-password" label={t('account.currentPassword')} type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} error={fieldErrors.currentPassword && t(fieldErrors.currentPassword, { field: t('account.currentPassword') })} /><Input id="new-password" label={t('auth.password')} type="password" autoComplete="new-password" value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} error={fieldErrors.password && t(fieldErrors.password)} /><Input id="confirm-password" label={t('auth.confirmPassword')} type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} error={fieldErrors.confirmPassword && t(fieldErrors.confirmPassword)} /><Button type="submit" loading={saving}>{t('account.changePassword')}</Button></form>}
    <Dialog open={addressEditor !== null} title={t(addressEditor === 'new' ? 'account.addAddress' : 'account.edit')} onClose={() => setAddressEditor(null)}>{addressEditor && <AddressForm key={addressEditor === 'new' ? 'new' : addressEditor.id} initial={addressEditor === 'new' ? undefined : addressEditor} onSubmit={(value) => void saveAddress(value)} submitting={saving} />}</Dialog>
    <Dialog open={deleteAddress !== null} title={t('account.deleteConfirm')} onClose={() => setDeleteAddress(null)}><p>{t('account.deleteWarning')}</p><div className="account-actions"><Button variant="secondary" onClick={() => setDeleteAddress(null)}>{t('account.cancel')}</Button><Button onClick={() => void removeAddress()} loading={saving}>{t('account.delete')}</Button></div></Dialog>
  </section>
}
