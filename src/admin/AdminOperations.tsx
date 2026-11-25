import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog } from '../components/ui/Dialog'
import { Toast } from '../components/ui/Toast'
import { useAuthState } from '../hooks/useAuthState'
import { getLegalActions, type OrderAction } from '../domain/orderStateMachine'
import { formatMoney } from '../domain/money'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '../domain/types'
import { supabase } from '../lib/supabaseClient'
import { RECEIPTS_BUCKET } from '../config/businessConfig'
import {
  adminOrderStatuses,
  cairoDateRange,
  getOrderBadgePresentation,
  logAdminDataError,
  normalizeDashboardCounts,
  parseAddressSnapshot,
  sanitizeAdminText,
  sanitizePostgrestSearch,
  transitionErrorCode,
} from './adminHelpers'

type OrderListRow = {
  id: string
  order_number: string
  status: OrderStatus
  total: number
  customer_name: string
  customer_email: string
  address_snapshot: unknown
  created_at: string
  payment_method?: PaymentMethod
  payment_proof_path?: string | null
  payment_status?: PaymentStatus
  payment_sender_info?: string | null
  payment_rejection_reason?: string | null
}
type OrderLineAdmin = {
  id: string
  product_id: string
  sku_snapshot: string
  name_ar_snapshot: string
  name_en_snapshot: string
  unit_price_snapshot: number
  quantity: number
  line_total: number
  products: Array<{
    specs: Record<string, unknown> | null
    product_images: Array<{ path: string; position: number; is_primary: boolean }>
  }> | null
}
type OrderDetail = OrderListRow & {
  subtotal: number
  shipping_fee: number
  payment_method: PaymentMethod
  payment_proof_path: string | null
  payment_sender_info: string | null
  payment_rejection_reason: string | null
  payment_submitted_at: string | null
  payment_verified_at: string | null
  payment_verified_by: string | null
  tracking_number: string | null
  cancel_reason: string | null
  order_lines: OrderLineAdmin[]
  order_status_history: Array<{ from_status: OrderStatus | null; to_status: OrderStatus; actor_id: string | null; actor_role: string | null; reason: string | null; created_at: string }>
}
type UserRow = { id: string; name: string; email: string; phone: string; role: 'CUSTOMER' | 'ADMIN'; enabled: boolean; email_confirmed: boolean; created_at: string }
type NoteRow = { id: string; note: string; admin_id: string; created_at: string }
type AuditRow = { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; created_at: string }

function apiCode(message: string | undefined): string { return message === '23505' ? 'PRODUCT_SKU_TAKEN' : message ? transitionErrorCode(message) : 'PAGE_500' }
function AdminError({ value, retry }: { value: string; retry?: () => void }) { const { t } = useTranslation(); return <div className="admin-error" role="alert"><p>{t(`messages.${value}`, { defaultValue: t('messages.PAGE_500') })}</p>{retry && <button onClick={retry}>{t('actions.tryAgain')}</button>}</div> }
function Pager({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  const { t } = useTranslation()
  return <nav className="admin-pager" aria-label={t('orders.pagination')}>
    <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('orders.previous')}>← <span>{t('orders.previous')}</span></button>
    <span aria-current="page">{page}</span>
    <button type="button" disabled={!hasNext} onClick={() => onChange(page + 1)} aria-label={t('orders.next')}><span>{t('orders.next')}</span> →</button>
  </nav>
}
function OrderBadge({ kind, value, cancelled = false }: { kind: 'order'; value: OrderStatus; cancelled?: boolean } | { kind: 'payment'; value: PaymentStatus; cancelled?: boolean }) {
  const { t } = useTranslation()
  const presentation = kind === 'order'
    ? getOrderBadgePresentation({ kind: 'order', value, orderCancelled: cancelled })
    : getOrderBadgePresentation({ kind: 'payment', value, orderCancelled: cancelled })
  return <span className={`admin-badge ${presentation.tone}`}>{t(presentation.labelKey)}</span>
}

function OrderThumbnail({ path, orderNumber }: { path?: string | null; orderNumber: string }) {
  const { t } = useTranslation()
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  useEffect(() => {
    const receiptPath = path?.trim()
    if (!receiptPath) {
      setImgUrl(null)
      return
    }
    let active = true
    setImgUrl(null)
    void supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(receiptPath, 3600)
      .then(({ data, error }) => {
        if (error) {
          logAdminDataError('orders.receipt-thumbnail', error)
          if (active) setImgUrl(null)
          return
        }
        if (!error && data?.signedUrl) {
          if (active) setImgUrl(data.signedUrl)
        } else if (active) setImgUrl(null)
      })
      .catch((error: unknown) => {
        console.error('[admin] orders.receipt-thumbnail failed', {
          message: error instanceof Error ? error.message : String(error),
        })
        if (active) setImgUrl(null)
      })
    return () => { active = false }
  }, [path])

  if (!imgUrl) {
    return <span className="admin-order-thumb-empty" title={t('orders.cashOnDelivery')}>—</span>
  }

  return (
    <a
      href={imgUrl}
      target="_blank"
      rel="noreferrer"
      title={`${t('admin.receipt')} - ${orderNumber}`}
      className="admin-order-thumb-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={imgUrl}
        alt={`${t('admin.receipt')} ${orderNumber}`}
        className="admin-order-thumb"
        loading="lazy"
      />
    </a>
  )
}

export function Orders() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<OrderListRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const page = Math.max(Number(params.get('page') ?? '1'), 1)
  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const load = async () => {
    setLoading(true)
    setError(null)
    const range = cairoDateRange(from, to)
    let query = supabase
      .from('orders')
      .select('id,order_number,status,payment_method,payment_status,payment_proof_path,total,customer_name,customer_email,address_snapshot,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * 20, page * 20 - 1)
    if (adminOrderStatuses.includes(status as OrderStatus)) query = query.eq('status', status)
    if (status === 'PENDING_VERIFICATION') query = query.eq('payment_status', 'under_review')
    const safe = sanitizePostgrestSearch(search)
    if (safe) query = query.or(`order_number.ilike.%${safe}%,customer_email.ilike.%${safe}%,address_snapshot->>phone.ilike.%${safe}%`)
    if (range.from) query = query.gte('created_at', range.from)
    if (range.to) query = query.lte('created_at', range.to)
    const result = await query
    if (result.error) {
      logAdminDataError('orders.list', result.error)
      setError(apiCode(result.error.message))
    } else {
      setRows((result.data ?? []) as OrderListRow[])
      setCount(result.count ?? 0)
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [page, status, search, from, to])
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setParams(next)
  }
  return (
    <section className="admin-page">
      <div className="admin-page-title"><h1>{t('admin.orders')}</h1></div>
      <div className="admin-toolbar">
        <input aria-label={t('admin.searchOrders')} placeholder={t('admin.searchOrders')} value={search} onChange={(event) => update('q', event.target.value)} />
        <select aria-label={t('admin.status')} value={status} onChange={(event) => update('status', event.target.value)}>
          <option value="">{t('admin.allStatuses')}</option>
          {adminOrderStatuses.map((item) => <option key={item} value={item}>{t(`orderStatus.${item}`)}</option>)}
        </select>
        <label>{t('admin.from')}<input type="date" value={from} onChange={(event) => update('from', event.target.value)} /></label>
        <label>{t('admin.to')}<input type="date" value={to} onChange={(event) => update('to', event.target.value)} /></label>
      </div>
      {loading ? <div className="admin-skeleton" aria-label={t('ui.loading')} /> : error ? <AdminError value={error} retry={() => void load()} /> : rows.length === 0 ? <div className="admin-empty">{t('admin.emptyOrders')}</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">{t('admin.orderImage')}</th><th scope="col">{t('admin.orderNumber')}</th><th scope="col">{t('admin.customer')}</th><th scope="col">{t('admin.status')}</th><th scope="col">{t('admin.total')}</th><th scope="col">{t('admin.date')}</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td><OrderThumbnail path={row.payment_proof_path} orderNumber={row.order_number} /></td>
                  <td><Link to={`/admin/orders/${row.id}`}><bdi dir="ltr">{row.order_number}</bdi></Link></td>
                  <td>{row.customer_name}<br /><bdi dir="ltr">{row.customer_email}</bdi></td>
                  <td className="admin-order-list-badges">
                    <OrderBadge kind="order" value={row.status} />
                    {row.payment_status && <OrderBadge kind="payment" value={row.payment_status} cancelled={row.status === 'CANCELLED'} />}
                  </td>
                  <td><bdi dir="ltr">{formatMoney(row.total, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></td>
                  <td><time dateTime={row.created_at}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(row.created_at))}</time></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Pager page={page} hasNext={page * 20 < count} onChange={(value) => update('page', String(value))} />
        </>
      )}
    </section>
  )
}

const actionTarget: Record<OrderAction, OrderStatus> = { CONFIRM: 'CONFIRMED', CONFIRM_PAYMENT: 'PAID', START_PROCESSING: 'PROCESSING', MARK_SHIPPED: 'SHIPPED', MARK_DELIVERED: 'DELIVERED', CANCEL: 'CANCELLED' }
function actionLabel(action: OrderAction): string { return `admin.actionMap.${action}` }
function formatAdminDateTime(value: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value))
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="admin-order-detail-row"><dt>{label}</dt><dd>{children}</dd></div>
}

export function ReceiptPreview({ path, uploadedAt }: { path: string | null; uploadedAt: string | null }) {
  const { t, i18n } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const handleImageFailure = () => {
    setLightboxOpen(false)
    setUrl(null)
    setFailed(true)
  }

  useEffect(() => {
    let active = true
    const receiptPath = path?.trim()
    setUrl(null)
    setFailed(false)
    if (!receiptPath) {
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    void supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(receiptPath, 3600)
      .then(({ data, error }) => {
        if (error) {
          logAdminDataError('order-details.receipt-preview', error)
          if (active) setFailed(true)
        } else if (data?.signedUrl) {
          if (active) setUrl(data.signedUrl)
        } else if (active) {
          setFailed(true)
        }
      })
      .catch((error: unknown) => {
        console.error('[admin] order-details.receipt-preview failed', {
          message: error instanceof Error ? error.message : String(error),
        })
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [path, retryCount])

  if (!path?.trim()) return <p className="admin-receipt-empty" role="status">{t('admin.noReceipt')}</p>
  if (loading) return <div className="admin-receipt-skeleton" aria-label={t('ui.loading')} />
  if (failed || !url) {
    return (
      <div className="admin-receipt-error" role="alert">
        <p>{t('admin.receiptLoadFailed')}</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)}>{t('admin.retryReceipt')}</button>
      </div>
    )
  }

  return (
    <div className="admin-receipt-preview">
      <button
        type="button"
        className="admin-receipt-zoom"
        onClick={() => setLightboxOpen(true)}
        aria-label={t('admin.zoomReceipt')}
      >
        <img src={url} alt={t('admin.receipt')} onError={handleImageFailure} />
      </button>
      {uploadedAt && <p>{t('admin.uploadedAt')}: <time dateTime={uploadedAt}>{formatAdminDateTime(uploadedAt, i18n.language)}</time></p>}
      <Dialog open={lightboxOpen} title={t('admin.receipt')} onClose={() => setLightboxOpen(false)}>
        <img className="admin-receipt-lightbox-image" src={url} alt={t('admin.receipt')} onError={handleImageFailure} />
      </Dialog>
    </div>
  )
}

export function OrderDetails({ id }: { id: string }) {
  const { t, i18n } = useTranslation()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [note, setNote] = useState('')
  const [verifiedByName, setVerifiedByName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<OrderAction | null>(null)
  const [reason, setReason] = useState('')
  const [tracking, setTracking] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitAttempted, setRejectSubmitAttempted] = useState(false)
  const rejectTriggerRef = useRef<HTMLButtonElement>(null)
  const rejectionReasonRef = useRef<HTMLTextAreaElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const [orderResult, noteResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id,order_number,status,subtotal,shipping_fee,total,payment_method,payment_status,payment_proof_path,payment_sender_info,payment_rejection_reason,payment_submitted_at,payment_verified_at,payment_verified_by,tracking_number,cancel_reason,customer_name,customer_email,address_snapshot,created_at,order_lines(id,product_id,sku_snapshot,name_ar_snapshot,name_en_snapshot,unit_price_snapshot,quantity,line_total,products(specs,product_images(path,position,is_primary))),order_status_history(from_status,to_status,actor_id,actor_role,reason,created_at)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('order_admin_notes')
        .select('id,note,admin_id,created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (orderResult.error) {
      logAdminDataError('order-details.order', orderResult.error)
      setError(apiCode(orderResult.error.message))
      setOrder(null)
    } else if (!orderResult.data) {
      setError('NOT_FOUND')
      setOrder(null)
    } else {
      const loadedOrder = orderResult.data as OrderDetail
      setOrder(loadedOrder)
      if (loadedOrder.payment_verified_by) {
        const verifier = await supabase
          .from('profiles')
          .select('name')
          .eq('id', loadedOrder.payment_verified_by)
          .maybeSingle()
        if (verifier.error) {
          logAdminDataError('order-details.verifier', verifier.error)
          setError(apiCode(verifier.error.message))
          setVerifiedByName(null)
        } else {
          setVerifiedByName(verifier.data?.name?.trim() || t('admin.unknownValue'))
        }
      } else {
        setVerifiedByName(null)
      }
    }
    if (noteResult.error) {
      logAdminDataError('order-details.notes', noteResult.error)
      setError(apiCode(noteResult.error.message))
      setNotes([])
    } else {
      setNotes((noteResult.data ?? []) as NoteRow[])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [id])

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    const value = sanitizeAdminText(note)
    if (value.length < 1 || value.length > 1000) return
    const result = await supabase.from('order_admin_notes').insert({ order_id: id, note: value })
    if (result.error) {
      setError(apiCode(result.error.message))
    } else {
      setNote('')
      await load()
    }
  }

  const submitAction = async () => {
    if (!order || !action) return
    setSubmitting(true)
    const result = order.status === 'PAID' && action === 'START_PROCESSING'
      ? await supabase.rpc('admin_transition_paid_order', { p_order_id: id })
      : await supabase.rpc('admin_transition_order', {
          p_order_id: id,
          p_expected_from: order.status,
          p_to: actionTarget[action],
          p_reason: sanitizeAdminText(reason) || null,
          p_tracking: tracking.trim() || null,
        })
    if (result.error) {
      setError(apiCode(result.error.message))
      if (result.error.message === 'ORDER_STATUS_CHANGED') await load()
    } else {
      setAction(null)
      setReason('')
      setTracking('')
      setToast(true)
      await load()
    }
    setSubmitting(false)
  }

  const confirmPayment = async () => {
    if (!canReviewPayment) return
    setSubmitting(true)
    const result = await supabase.rpc('admin_confirm_manual_payment', { p_order_id: id })
    if (result.error) {
      setError(apiCode(result.error.message))
      if (result.error.message === 'ORDER_STATUS_CHANGED') await load()
    } else {
      setToast(true)
      await load()
    }
    setSubmitting(false)
  }

  const rejectPayment = async () => {
    const cleanReason = sanitizeAdminText(rejectReason)
    if (!canReviewPayment || cleanReason.length < 3 || cleanReason.length > 500) {
      setRejectSubmitAttempted(true)
      return
    }
    setSubmitting(true)
    const result = await supabase.rpc('admin_reject_manual_payment', {
      p_order_id: id,
      p_reason: cleanReason,
    })
    if (result.error) {
      setError(apiCode(result.error.message))
      if (result.error.message === 'ORDER_STATUS_CHANGED') await load()
    } else {
      setRejectOpen(false)
      setRejectReason('')
      setToast(true)
      await load()
    }
    setSubmitting(false)
  }

  const openRejectDialog = () => {
    setRejectReason('')
    setRejectSubmitAttempted(false)
    setRejectOpen(true)
  }

  if (loading) return <section className="admin-page"><div className="admin-skeleton" aria-label={t('ui.loading')} /></section>
  if (error && !order) return <section className="admin-page"><AdminError value={error} retry={() => void load()} /></section>
  if (!order) return null

  const address = parseAddressSnapshot(order.address_snapshot)
  const cancelled = order.status === 'CANCELLED'
  const receiptPath = order.payment_proof_path?.trim() || null
  const canReviewPayment = order.payment_method === 'MANUAL'
    && order.payment_status === 'under_review'
    && order.status === 'PENDING_VERIFICATION'
    && !cancelled
    && Boolean(receiptPath)
  const paymentActionMessage = cancelled
    ? 'admin.paymentActionsCancelled'
    : order.payment_status === 'under_review' && !receiptPath
      ? 'admin.receiptRequiredForReview'
      : 'admin.paymentActionsUnavailable'
  const actions = getLegalActions(order.status, 'ADMIN').filter((item) => item !== 'CONFIRM_PAYMENT')
  const governorate = address.governorate
    ? t(`governorates.${address.governorate}`, { defaultValue: t('admin.unknownValue') })
    : t('admin.notProvided')

  return (
    <section className="admin-page admin-order-page">
      <header className="admin-order-header">
        <div className="admin-order-heading">
          <Link to="/admin/orders" className="admin-back-link">{t('admin.backToOrders')}</Link>
          <h1><bdi dir="ltr">{order.order_number}</bdi></h1>
          <p>{t('admin.orderDateTime')}: <time dateTime={order.created_at}>{formatAdminDateTime(order.created_at, i18n.language)}</time></p>
        </div>
        <div className="admin-order-statuses" aria-label={t('admin.status')}>
          <OrderBadge kind="order" value={order.status} />
          {order.payment_status && <OrderBadge kind="payment" value={order.payment_status} cancelled={cancelled} />}
        </div>
      </header>

      {cancelled && (
        <div className="admin-order-cancelled-banner" role="status">
          <p>{t('admin.cancelledOrderBanner')}</p>
          {order.payment_status === 'paid' && <p>{t('admin.refundMayBeNeeded')}</p>}
          {order.cancel_reason && <p>{t('admin.cancelReason')}: {sanitizeAdminText(order.cancel_reason)}</p>}
        </div>
      )}
      {error && <AdminError value={error} retry={() => void load()} />}
      {toast && <Toast onDismiss={() => setToast(false)}>{t('messages.ORDER_STATUS_UPDATED')}</Toast>}

      <div className="admin-order-grid">
        <section className="admin-card admin-order-card">
          <h2>{t('admin.customerDetails')}</h2>
          <dl className="admin-order-detail-list">
            <DetailRow label={t('admin.customerName')}>{sanitizeAdminText(order.customer_name) || t('admin.notProvided')}</DetailRow>
            <DetailRow label={t('admin.email')}><bdi dir="ltr">{order.customer_email || t('admin.notProvided')}</bdi></DetailRow>
            <DetailRow label={t('admin.phone')}><bdi dir="ltr">{address.phone || t('admin.notProvided')}</bdi></DetailRow>
            <DetailRow label={t('admin.governorate')}>{governorate}</DetailRow>
            <DetailRow label={t('admin.cityArea')}>{sanitizeAdminText(address.city ?? '') || t('admin.notProvided')}</DetailRow>
            <DetailRow label={t('address.street')}>{sanitizeAdminText(address.street ?? '') || t('admin.notProvided')}</DetailRow>
            <DetailRow label={t('address.building')}>{sanitizeAdminText(address.building ?? '') || t('admin.notProvided')}</DetailRow>
            <DetailRow label={t('admin.customerNotes')}>{sanitizeAdminText(address.notes ?? '') || t('admin.notProvided')}</DetailRow>
            <DetailRow label={t('admin.paymentMethod')}>
              {order.payment_method === 'COD' ? t('orders.cashOnDelivery') : t('orders.manualPayment')}
            </DetailRow>
            <DetailRow label={t('admin.tracking')}><bdi dir="ltr">{order.tracking_number || t('admin.notProvided')}</bdi></DetailRow>
          </dl>
        </section>

        <section className="admin-card admin-order-card admin-payment-card">
          <h2>{t('admin.paymentDetails')}</h2>
          <div className="admin-payment-status">
            <span>{t('admin.paymentStatus')}</span>
            {order.payment_status && <OrderBadge kind="payment" value={order.payment_status} cancelled={cancelled} />}
          </div>
          <h3>{t('admin.receipt')}</h3>
          <ReceiptPreview path={receiptPath} uploadedAt={order.payment_submitted_at} />
          <dl className="admin-order-detail-list">
            {order.payment_sender_info && (
              <DetailRow label={t('admin.senderInfo')}>{sanitizeAdminText(order.payment_sender_info)}</DetailRow>
            )}
            {order.payment_rejection_reason && (
              <DetailRow label={t('admin.rejectionReason')}>{sanitizeAdminText(order.payment_rejection_reason)}</DetailRow>
            )}
            {order.payment_status === 'paid' && (
              <DetailRow label={t('admin.verifiedBy')}>{verifiedByName || t('admin.unknownValue')}</DetailRow>
            )}
            {order.payment_status === 'paid' && (
              <DetailRow label={t('admin.verifiedAt')}>
                {order.payment_verified_at
                  ? <time dateTime={order.payment_verified_at}>{formatAdminDateTime(order.payment_verified_at, i18n.language)}</time>
                  : t('admin.unknownValue')}
              </DetailRow>
            )}
          </dl>
          {order.payment_method === 'MANUAL' && canReviewPayment ? (
            <div className="admin-payment-actions">
              <button type="button" className="admin-primary" disabled={submitting} onClick={() => void confirmPayment()}>
                {t('admin.confirmPayment')}
              </button>
              <button ref={rejectTriggerRef} type="button" className="admin-danger" disabled={submitting} onClick={openRejectDialog}>
                {t('admin.rejectPayment')}
              </button>
            </div>
          ) : order.payment_method === 'MANUAL' ? (
            <p className="admin-muted">{t(paymentActionMessage)}</p>
          ) : null}
        </section>

        <section className="admin-card admin-order-card admin-order-items-card">
          <h2>{t('admin.lines')}</h2>
          {order.order_lines.length === 0 ? <p className="admin-muted">{t('admin.noItems')}</p> : (
            <div className="admin-order-items-wrap">
              <table className="admin-order-items-table">
                <thead>
                  <tr>
                    <th scope="col">{t('admin.product')}</th>
                    <th scope="col">{t('admin.variantDetails')}</th>
                    <th scope="col">{t('admin.quantity')}</th>
                    <th scope="col">{t('admin.unitPrice')}</th>
                    <th scope="col">{t('admin.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_lines.map((line) => {
                    const name = i18n.language === 'ar' ? line.name_ar_snapshot : line.name_en_snapshot
                    const product = line.products?.[0]
                    const images = product?.product_images ?? []
                    const image = images.slice().sort((first, second) => Number(second.is_primary) - Number(first.is_primary) || first.position - second.position)[0]
                    const imageUrl = image
                      ? image.path.startsWith('/')
                        ? image.path
                        : supabase.storage.from('product-images').getPublicUrl(image.path).data.publicUrl
                      : null
                    const specs = product?.specs
                    const material = typeof specs?.material === 'string' ? t(`specs.material.${specs.material}`, { defaultValue: '' }) : ''
                    const caseSize = typeof specs?.caseSize === 'number' ? specs.caseSize : null
                    const details = [
                      { key: 'sku', text: t('admin.skuValue', { value: line.sku_snapshot }), ltr: true },
                      ...(material ? [{ key: 'material', text: t('admin.itemMaterial', { value: material }), ltr: false }] : []),
                      ...(caseSize !== null ? [{ key: 'caseSize', text: t('admin.itemCaseSize', { size: caseSize }), ltr: false }] : []),
                    ]
                    return (
                      <tr key={line.id}>
                        <td data-label={t('admin.product')}>
                          <div className="admin-order-product">
                            {imageUrl
                              ? <img src={imageUrl} alt={name} loading="lazy" />
                              : <span className="admin-order-product-empty" role="img" aria-label={t('admin.noProductImage')} />}
                            <strong>{sanitizeAdminText(name)}</strong>
                          </div>
                        </td>
                        <td data-label={t('admin.variantDetails')} className="admin-order-variant">
                          {details.map((detail) => <span key={detail.key}>{detail.ltr ? <bdi dir="ltr">{detail.text}</bdi> : detail.text}</span>)}
                        </td>
                        <td data-label={t('admin.quantity')}><bdi dir="ltr">{line.quantity}</bdi></td>
                        <td data-label={t('admin.unitPrice')}><bdi dir="ltr">{formatMoney(line.unit_price_snapshot, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></td>
                        <td data-label={t('admin.lineTotal')}><bdi dir="ltr">{formatMoney(line.line_total, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card admin-order-card admin-order-totals-card">
          <h2>{t('admin.totals')}</h2>
          <dl className="admin-order-totals">
            <div><dt>{t('cart.subtotal')}</dt><dd><bdi dir="ltr">{formatMoney(order.subtotal, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></dd></div>
            <div><dt>{t('admin.shipping')}</dt><dd><bdi dir="ltr">{formatMoney(order.shipping_fee, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></dd></div>
            <div className="admin-order-total"><dt>{t('admin.total')}</dt><dd><bdi dir="ltr">{formatMoney(order.total, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></dd></div>
          </dl>
        </section>
      </div>

      {actions.length > 0 && (
        <div className="admin-action-bar">
          {actions.map((item) => <button type="button" key={item} disabled={submitting} onClick={() => setAction(item)}>{t(actionLabel(item))}</button>)}
        </div>
      )}

      <section className="admin-card admin-order-section">
        <h2>{t('admin.timeline')}</h2>
        {order.order_status_history.length === 0 ? <p className="admin-muted">{t('admin.noTimeline')}</p> : (
          <ol className="timeline">
            {order.order_status_history.map((entry) => (
              <li key={`${entry.created_at}-${entry.to_status}`}>
                <span>
                  {entry.from_status ? `${t(`orderStatus.${entry.from_status}`)} → ` : ''}
                  {t(`orderStatus.${entry.to_status}`)}
                  {entry.reason ? ` — ${sanitizeAdminText(entry.reason)}` : ''}
                </span>
                <time dateTime={entry.created_at}>{formatAdminDateTime(entry.created_at, i18n.language)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-card admin-order-section">
        <h2>{t('admin.internalNotes')}</h2>
        {notes.length === 0 ? <p className="admin-muted">{t('admin.noNotes')}</p> : notes.map((item) => (
          <p key={item.id}>{sanitizeAdminText(item.note)} <small>· {formatAdminDateTime(item.created_at, i18n.language)}</small></p>
        ))}
        <form className="admin-order-note-form" onSubmit={(event) => void addNote(event)}>
          <label htmlFor="admin-order-note">{t('admin.note')}</label>
          <textarea id="admin-order-note" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          <button type="submit" disabled={!sanitizeAdminText(note)}>{t('admin.addNote')}</button>
        </form>
      </section>

      <Dialog open={action !== null} title={action ? t(actionLabel(action)) : ''} onClose={() => setAction(null)}>
        <p>{action === 'CANCEL' ? t('admin.cancelWarning') : t('admin.confirmAction')}</p>
        {action === 'CANCEL' && <label className="ui-field"><span className="ui-label">{t('admin.reason')}</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} aria-label={t('admin.reason')} placeholder={t('admin.reason')} /></label>}
        {action === 'MARK_SHIPPED' && <label className="ui-field"><span className="ui-label">{t('admin.tracking')}</span><input maxLength={50} value={tracking} onChange={(event) => setTracking(event.target.value)} aria-label={t('admin.tracking')} placeholder={t('admin.tracking')} /></label>}
        <button type="button" disabled={submitting || (action === 'CANCEL' && !reason.trim())} onClick={() => void submitAction()}>{t('admin.confirm')}</button>
      </Dialog>
      <Dialog
        open={rejectOpen}
        title={t('admin.rejectPayment')}
        onClose={() => setRejectOpen(false)}
        initialFocusRef={rejectionReasonRef}
        returnFocusRef={rejectTriggerRef}
        className="admin-reject-dialog"
      >
        <form
          className="admin-reject-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            void rejectPayment()
          }}
        >
          <label className="ui-field">
            <span className="ui-label">{t('admin.rejectionReason')}</span>
            <textarea
              ref={rejectionReasonRef}
              maxLength={500}
              minLength={3}
              value={rejectReason}
              dir="auto"
              aria-invalid={rejectSubmitAttempted && sanitizeAdminText(rejectReason).length < 3}
              aria-describedby="admin-rejection-reason-hint admin-rejection-reason-count"
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </label>
          <div className="admin-reject-meta">
            <p
              id="admin-rejection-reason-hint"
              className={`ui-hint${rejectSubmitAttempted && sanitizeAdminText(rejectReason).length < 3 ? ' is-invalid' : ''}`}
            >
              {t('admin.rejectionReasonHint')}
            </p>
            <span id="admin-rejection-reason-count" className="ui-hint" aria-live="polite">
              {t('admin.rejectionReasonCount', { count: rejectReason.length })}
            </span>
          </div>
          <div className="admin-reject-actions">
            <button type="button" className="ui-button ui-button-secondary" disabled={submitting} onClick={() => setRejectOpen(false)}>
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              className="ui-button admin-reject-submit"
              disabled={submitting || rejectReason.length < 3}
            >
              {submitting && <span className="ui-spinner" aria-hidden="true" />}
              {t('admin.rejectPayment')}
            </button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}

export function Users() {
  const { t } = useTranslation(); const { userEmail } = useAuthState(); const [rows, setRows] = useState<UserRow[]>([]); const [query, setQuery] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const result = await supabase.rpc('admin_users'); if (result.error) setError(apiCode(result.error.message)); else setRows((result.data ?? []) as UserRow[]); setLoading(false) }; useEffect(() => { void load() }, [])
  const visible = useMemo(() => rows.filter((row) => `${row.name} ${row.email} ${row.phone}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [rows, query])
  const toggle = async (row: UserRow) => { if (!window.confirm(t(row.enabled ? 'admin.disableConfirm' : 'admin.enableConfirm'))) return; const result = await supabase.rpc('admin_set_user_enabled', { p_user_id: row.id, p_enabled: !row.enabled }); if (result.error) setError(apiCode(result.error.message)); else await load() }
  return <section className="admin-page"><div className="admin-page-title"><h1>{t('admin.users')}</h1></div><div className="admin-toolbar"><input aria-label={t('admin.searchUsers')} placeholder={t('admin.searchUsers')} value={query} onChange={(event) => setQuery(event.target.value)} /></div>{loading ? <div className="admin-skeleton" /> : error ? <AdminError value={error} retry={() => void load()} /> : visible.length === 0 ? <div className="admin-empty">{t('admin.emptyUsers')}</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">{t('admin.name')}</th><th scope="col">{t('admin.email')}</th><th scope="col">{t('admin.phone')}</th><th scope="col">{t('admin.role')}</th><th scope="col">{t('admin.verified')}</th><th scope="col">{t('admin.enabled')}</th><th scope="col">{t('admin.actions')}</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><Link to={`/admin/users/${row.id}`}>{row.name}</Link></td><td>{row.email}</td><td>{row.phone}</td><td>{row.role}</td><td>{row.email_confirmed ? t('admin.yes') : t('admin.no')}</td><td>{row.enabled ? t('admin.yes') : t('admin.no')}</td><td><button disabled={row.email === userEmail} onClick={() => void toggle(row)}>{row.enabled ? t('admin.disable') : t('admin.enable')}</button></td></tr>)}</tbody></table></div>}</section>
}

export function UserDetails({ id }: { id: string }) {
  const { t } = useTranslation(); const { userEmail } = useAuthState(); const [user, setUser] = useState<UserRow | null>(null); const [orders, setOrders] = useState<Array<{ id: string; order_number: string; status: OrderStatus; created_at: string }>>([]); const [error, setError] = useState<string | null>(null)
  useEffect(() => { void (async () => { const users = await supabase.rpc('admin_users'); const orderResult = await supabase.from('orders').select('id,order_number,status,created_at').eq('user_id', id).order('created_at', { ascending: false }); const found = (users.data as UserRow[] | null)?.find((row) => row.id === id); if (users.error || orderResult.error || !found) setError('NOT_FOUND'); else { setUser(found); setOrders(orderResult.data ?? []) } })() }, [id])
  if (error) return <section className="admin-page"><AdminError value={error} /></section>; if (!user) return <section className="admin-page"><div className="admin-skeleton" /></section>
  const toggle = async () => { if (!user || user.email === userEmail || !window.confirm(t(user.enabled ? 'admin.disableConfirm' : 'admin.enableConfirm'))) return; const result = await supabase.rpc('admin_set_user_enabled', { p_user_id: user.id, p_enabled: !user.enabled }); if (result.error) setError(apiCode(result.error.message)); else setUser({ ...user, enabled: !user.enabled }) }
  return <section className="admin-page"><div className="admin-page-title"><h1>{user.name}</h1></div><div className="admin-card"><p>{user.email}</p><p>{user.phone}</p><p>{t('admin.enabled')}: {user.enabled ? t('admin.yes') : t('admin.no')}</p><button disabled={user.email === userEmail} onClick={() => void toggle()}>{user.enabled ? t('admin.disable') : t('admin.enable')}</button></div><div className="admin-card"><h2>{t('admin.orders')}</h2>{orders.map((order) => <p key={order.id}><Link to={`/admin/orders/${order.id}`}><bdi dir="ltr">{order.order_number}</bdi></Link> · <OrderBadge kind="order" value={order.status} /></p>)}</div></section>
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<{ orders: Record<OrderStatus, number>; lowStock: number; outOfStock: number } | null>(null)
  const [latest, setLatest] = useState<OrderListRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    const [counts, orders] = await Promise.all([
      supabase.rpc('admin_dashboard_counts'),
      supabase.from('orders')
        .select('id,order_number,status,payment_method,payment_status,payment_proof_path,total,customer_name,customer_email,address_snapshot,created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    if (counts.error || orders.error) {
      if (orders.error) logAdminDataError('dashboard.latest-orders', orders.error)
      setError(apiCode(counts.error?.message ?? orders.error?.message))
    } else {
      setData(normalizeDashboardCounts(counts.data))
      setLatest((orders.data ?? []) as OrderListRow[])
    }
  }
  useEffect(() => { void load() }, [])
  if (error) return <section className="admin-page"><AdminError value={error} retry={() => void load()} /></section>
  if (!data) return <section className="admin-page"><div className="admin-skeleton" aria-label={t('ui.loading')} /></section>
  return (
    <section className="admin-page">
      <div className="admin-page-title"><h1>{t('admin.dashboard')}</h1></div>
      <div className="admin-dashboard-grid">
        {adminOrderStatuses.map((status) => <Link className={status === 'PENDING' ? 'admin-stat pending' : 'admin-stat'} key={status} to={`/admin/orders?status=${status}`}><strong>{data.orders[status]}</strong><span>{t(`orderStatus.${status}`)}</span></Link>)}
        <Link className="admin-stat" to="/admin/inventory?availability=LOW_STOCK"><strong>{data.lowStock}</strong><span>{t('admin.lowStock')}</span></Link>
        <Link className="admin-stat" to="/admin/inventory?availability=OUT_OF_STOCK"><strong>{data.outOfStock}</strong><span>{t('admin.outOfStock')}</span></Link>
      </div>
      <div className="admin-card admin-latest-orders">
        <div className="admin-section-heading"><h2>{t('admin.latestOrders')}</h2><Link to="/admin/orders">{t('admin.viewAll')}</Link></div>
        {latest.length === 0 ? <p className="admin-muted">{t('admin.emptyOrders')}</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">{t('admin.orderImage')}</th><th scope="col">{t('admin.orderNumber')}</th><th scope="col">{t('admin.customer')}</th><th scope="col">{t('admin.status')}</th><th scope="col">{t('admin.total')}</th><th scope="col">{t('admin.date')}</th></tr></thead>
              <tbody>{latest.map((row) => (
                <tr key={row.id}>
                  <td><OrderThumbnail path={row.payment_proof_path} orderNumber={row.order_number} /></td>
                  <td><Link to={`/admin/orders/${row.id}`}><bdi dir="ltr">{row.order_number}</bdi></Link></td>
                  <td><span>{row.customer_name}</span><small><bdi dir="ltr">{row.customer_email}</bdi></small></td>
                  <td className="admin-order-list-badges">
                    <OrderBadge kind="order" value={row.status} />
                    {row.payment_status && <OrderBadge kind="payment" value={row.payment_status} cancelled={row.status === 'CANCELLED'} />}
                  </td>
                  <td><bdi dir="ltr">{formatMoney(row.total, i18n.language === 'ar' ? 'ar' : 'en')}</bdi></td>
                  <td><time dateTime={row.created_at}>{formatAdminDateTime(row.created_at, i18n.language)}</time></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export function AuditTrail() {
  const { t } = useTranslation(); const [params, setParams] = useSearchParams(); const [rows, setRows] = useState<AuditRow[]>([]); const [users, setUsers] = useState<UserRow[]>([]); const [count, setCount] = useState(0); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const page = Math.max(Number(params.get('page') ?? '1'), 1); const action = params.get('action') ?? ''; const entity = params.get('entity') ?? ''; const from = params.get('from') ?? ''; const to = params.get('to') ?? ''
  const load = async () => { setLoading(true); const range = cairoDateRange(from, to); const query = supabase.from('audit_log').select('id,actor_id,action,entity,entity_id,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * 25, page * 25 - 1).ilike('action', action ? `%${sanitizePostgrestSearch(action)}%` : '%').ilike('entity', entity ? `%${sanitizePostgrestSearch(entity)}%` : '%'); const filtered = range.from ? query.gte('created_at', range.from) : query; const dated = range.to ? filtered.lte('created_at', range.to) : filtered; const [result, userResult] = await Promise.all([dated, supabase.rpc('admin_users')]); if (result.error) setError(apiCode(result.error.message)); else { setRows((result.data ?? []) as AuditRow[]); setCount(result.count ?? 0) } if (!userResult.error) setUsers((userResult.data ?? []) as UserRow[]); setLoading(false) }; useEffect(() => { void load() }, [page, action, entity, from, to]); const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.set('page', '1'); setParams(next) }; const actorName = (id: string | null) => users.find((user) => user.id === id)?.name ?? id ?? '—'
  return <section className="admin-page"><div className="admin-page-title"><h1>{t('admin.audit')}</h1></div><div className="admin-toolbar"><input placeholder={t('admin.action')} value={action} onChange={(e) => update('action', e.target.value)} /><input placeholder={t('admin.entity')} value={entity} onChange={(e) => update('entity', e.target.value)} /><input type="date" value={from} onChange={(e) => update('from', e.target.value)} /><input type="date" value={to} onChange={(e) => update('to', e.target.value)} /></div>{loading ? <div className="admin-skeleton" /> : error ? <AdminError value={error} retry={() => void load()} /> : <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">{t('admin.date')}</th><th scope="col">{t('admin.actor')}</th><th scope="col">{t('admin.action')}</th><th scope="col">{t('admin.entity')}</th><th scope="col">{t('admin.entityId')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{actorName(row.actor_id)}</td><td>{t(`auditActions.${row.action}`, { defaultValue: row.action })}</td><td>{row.entity}</td><td>{row.entity_id ?? '—'}</td></tr>)}</tbody></table></div><Pager page={page} hasNext={page * 25 < count} onChange={(value) => update('page', String(value))} /></>}</section>
}
