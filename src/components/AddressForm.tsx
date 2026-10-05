import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addressSchema, governorateKeys, type AddressInput } from '../domain/schemas'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

export function AddressForm({ initial, onSubmit, onInteraction, submitting = false }: { initial?: Partial<AddressInput>; onSubmit: (value: AddressInput) => void; onInteraction?: () => void; submitting?: boolean }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AddressInput>({ fullName: '', phone: '', governorate: 'Cairo', city: '', street: '', building: '', notes: null, ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = (key: keyof AddressInput, value: string) => { onInteraction?.(); setForm((current) => ({ ...current, [key]: value })) }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = addressSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }
  const fieldError = (key: string) => errors[key] ? t(errors[key], { field: t(`address.${key}`), min: 2, max: key === 'fullName' ? 80 : 120 }) : undefined
  return <form className="address-form" onSubmit={submit} noValidate>
    <Input id="address-full-name" label={t('address.fullName')} autoComplete="name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} error={fieldError('fullName')} />
    <Input id="address-phone" label={t('address.phone')} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} error={fieldError('phone')} />
    <label className="ui-field"><span className="ui-label">{t('address.governorate')}</span><select value={form.governorate} onChange={(e) => update('governorate', e.target.value)}>{governorateKeys.map((key) => <option key={key} value={key}>{t(`governorates.${key}`)}</option>)}</select>{fieldError('governorate') && <span className="ui-field-error">{fieldError('governorate')}</span>}</label>
    <Input id="address-city" label={t('address.city')} autoComplete="address-level2" value={form.city} onChange={(e) => update('city', e.target.value)} error={fieldError('city')} />
    <Input id="address-street" label={t('address.street')} autoComplete="street-address" value={form.street} onChange={(e) => update('street', e.target.value)} error={fieldError('street')} />
    <Input id="address-building" label={t('address.building')} value={form.building} onChange={(e) => update('building', e.target.value)} error={fieldError('building')} />
    <label className="ui-field"><span className="ui-label">{t('address.notes')}</span><textarea value={form.notes ?? ''} maxLength={200} onChange={(e) => update('notes', e.target.value)} /></label>
    <Button type="submit" loading={submitting}>{t('address.saveAndContinue')}</Button>
  </form>
}
