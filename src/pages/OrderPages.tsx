import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { formatMoney } from '../domain/money'
import { canCustomerCancel, buildStatusTimeline } from '../features/orders/orderLogic'
import { supabase } from '../lib/supabaseClient'
import type { OrderStatus } from '../domain/types'
import type { PaymentStatus } from '../domain/types'
import { MAX_RECEIPT_MB, RECEIPTS_BUCKET } from '../config/businessConfig'
import { validateReceiptFile } from '../features/checkoutLogic'
import { businessConfig } from '../config/businessConfig'

type OrderRow = { id: string; order_number: string; status: OrderStatus; total: number; created_at: string }
type OrderData = OrderRow & { subtotal: number; shipping_fee: number; payment_method: 'COD' | 'MANUAL'; payment_status?: PaymentStatus; payment_proof_path?: string | null; payment_sender_info?: string | null; payment_rejection_reason?: string | null; payment_upload_count?: number; address_snapshot: Record<string, string>; cancel_reason: string | null; order_lines: Array<{ id: string; sku_snapshot: string; name_ar_snapshot: string; name_en_snapshot: string; unit_price_snapshot: number; quantity: number; line_total: number }>; order_status_history: Array<{ from_status: OrderStatus | null; to_status: OrderStatus; actor_id: string; actor_role: 'CUSTOMER' | 'ADMIN'; reason: string | null; created_at: string }> }

function PageError({ onRetry }: { onRetry: () => void }) { const { t } = useTranslation(); return <ErrorState message={t('messages.PAGE_500')} action={t('actions.tryAgain')} onAction={onRetry} /> }
function date(value: string, language: string) { return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(value)) }

export function OrdersPage() {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const [rows, setRows] = useState<OrderRow[]>([]); const [page, setPage] = useState(0); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false)
  const load = () => { setLoading(true); setFailed(false); void supabase.from('orders').select('id,order_number,status,total,created_at').order('created_at', { ascending: false }).range(page * 10, page * 10 + 9).then(({ data, error }) => { if (error) setFailed(true); else setRows((data ?? []) as OrderRow[]) }).then(() => setLoading(false)) }
  useEffect(load, [page])
  if (loading) return <section className="container order-page"><Skeleton className="listing-skeleton" /></section>
  if (failed) return <PageError onRetry={load} />
  if (!rows.length && page === 0) return <EmptyState message={t('messages.ORDERS_EMPTY')} action={t('actions.startShopping')} onAction={() => navigate(`/${i18n.language}/shop`)} />
  return <section className="container order-page"><h1 className="page-heading">{t('pages.orders')}</h1><div className="order-list">{rows.map((row) => <Link className="order-card" key={row.id} to={`/${i18n.language}/account/orders/${row.id}`}><strong><bdi dir="ltr">{row.order_number}</bdi></strong><span>{date(row.created_at, i18n.language)}</span><span className="status-badge">{t(`orderStatus.${row.status}`)}</span><strong><bdi dir="ltr">{formatMoney(row.total, i18n.language as 'ar' | 'en')}</bdi></strong></Link>)}</div><nav className="pagination" aria-label={t('orders.pagination')}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{t('orders.previous')}</Button><span>{page + 1}</span><Button variant="secondary" disabled={rows.length < 10} onClick={() => setPage((value) => value + 1)}>{t('orders.next')}</Button></nav></section>
}

export function OrderDetailsPage() {
  const { t, i18n } = useTranslation(); const { id } = useParams(); const [order, setOrder] = useState<OrderData | null>(null); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [dialog, setDialog] = useState(false); const [reason, setReason] = useState(''); const [message, setMessage] = useState<string | null>(null); const [replacement, setReplacement] = useState<File | null>(null); const [senderInfo, setSenderInfo] = useState(''); const [uploading, setUploading] = useState(false)
  const load = () => { if (!id) return; setLoading(true); setFailed(false); void supabase.from('orders').select('*, order_lines(*), order_status_history(*)').eq('id', id).maybeSingle().then(({ data, error }) => { if (error || !data) setFailed(true); else setOrder(data as OrderData) }).then(() => setLoading(false)) }
  useEffect(load, [id])
  const cancel = async () => { if (!id) return; const result = await supabase.rpc('cancel_my_order', { p_order_id: id, p_reason: reason || null }); if (result.error) { setMessage(result.error.message === 'ORDER_CANCEL_TOO_LATE' ? 'ORDER_CANCEL_TOO_LATE' : 'PAGE_500'); load() } else { setMessage('ORDER_CANCELLED'); setDialog(false); load() } }
  const uploadReplacement = async () => {
    if (!id || !replacement) return
    const validation = validateReceiptFile(replacement, MAX_RECEIPT_MB)
    if (!validation.valid) {
      setMessage(validation.error)
      return
    }
    setUploading(true)
    setMessage(null)
    const extension = replacement.type === 'image/png' ? 'png' : replacement.type === 'image/webp' ? 'webp' : 'jpg'
    const safeName = replacement.name.normalize('NFKD').replace(/[^a-zA-Z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || `receipt.${extension}`
    const newPath = `${id}/${Date.now()}-${safeName}`
    const upload = await supabase.storage.from(RECEIPTS_BUCKET).upload(newPath, replacement, { contentType: replacement.type, upsert: false })
    if (upload.error) {
      setMessage('RECEIPT_UPLOAD_FAILED')
      setUploading(false)
      return
    }
    const submit = await supabase.rpc('submit_payment_proof', {
      p_order_id: id,
      p_proof_path: newPath,
      p_sender_info: senderInfo.trim() || null,
    })
    if (submit.error) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([newPath])
      setMessage(submit.error.message)
    } else {
      if (order?.payment_proof_path) await supabase.storage.from(RECEIPTS_BUCKET).remove([order.payment_proof_path])
      setReplacement(null)
      setSenderInfo('')
      setMessage('PAYMENT_RECEIPT_SUBMITTED')
      load()
    }
    setUploading(false)
  }
  if (loading) return <section className="container order-page"><Skeleton className="listing-skeleton" /></section>
  if (failed || !order) return <PageError onRetry={load} />
  const lines = order.order_lines; const history = buildStatusTimeline(order.order_status_history.map((entry) => ({ from: entry.from_status, to: entry.to_status, actorId: entry.actor_id, actorRole: entry.actor_role, reason: entry.reason, timestamp: entry.created_at })))
  return <section className="container order-page"><div className="order-detail-header"><span>{t('pages.orderDetails')}</span><h1 className="page-heading"><bdi dir="ltr">{order.order_number}</bdi></h1></div>{message && <div className={message === 'ORDER_CANCELLED' || message === 'PAYMENT_RECEIPT_SUBMITTED' ? 'form-success' : 'form-alert'} role="alert">{t(`messages.${message}`, { defaultValue: message })}</div>}<div className="order-detail-grid"><div className="order-detail-card"><section><h2>{t('orders.items')}</h2>{lines.map((line) => <div className="order-line" key={line.id}><span>{i18n.language === 'ar' ? line.name_ar_snapshot : line.name_en_snapshot}</span><span><bdi dir="ltr">{line.quantity} × {formatMoney(line.unit_price_snapshot, i18n.language as 'ar' | 'en')}</bdi></span><strong><bdi dir="ltr">{formatMoney(line.line_total, i18n.language as 'ar' | 'en')}</bdi></strong></div>)}</section><section><h2>{t('orders.shippingAddress')}</h2><address>{order.address_snapshot.full_name}<br /><bdi dir="ltr">{order.address_snapshot.phone}</bdi><br />{t(`governorates.${order.address_snapshot.governorate}`)}, {order.address_snapshot.city}<br />{order.address_snapshot.street}, {order.address_snapshot.building}</address></section><dl className="totals"><div><dt>{t('cart.subtotal')}</dt><dd><bdi dir="ltr">{formatMoney(order.subtotal, i18n.language as 'ar' | 'en')}</bdi></dd></div><div><dt>{t('orders.shippingFee')}</dt><dd><bdi dir="ltr">{formatMoney(order.shipping_fee, i18n.language as 'ar' | 'en')}</bdi></dd></div><div className="order-total"><dt>{t('orders.total')}</dt><dd><bdi dir="ltr">{formatMoney(order.total, i18n.language as 'ar' | 'en')}</bdi></dd></div></dl></div><aside className="order-detail-card order-status-card"><div className="order-status-heading"><span>{t('orders.payment')}</span><p className="status-badge">{t(`orderStatus.${order.status}`)}</p></div><p>{order.payment_method === 'MANUAL' ? t('orders.manualPayment') : t('orders.cashOnDelivery')}</p>{order.payment_status && <p>{t('admin.paymentStatus')}: {t(`paymentStatus.${order.payment_status}`)}</p>}{order.payment_rejection_reason && <p>{t('admin.rejectionReason')}: {order.payment_rejection_reason}</p>}<h2>{t('orders.timeline')}</h2><ol className="timeline">{history.map((entry) => <li key={`${entry.timestamp}-${entry.to}`}><strong>{t(`orderStatus.${entry.to}`)}</strong><time>{date(entry.timestamp, i18n.language)}</time></li>)}</ol>{order.status === 'SHIPPED' && <p>{t('orders.tracking')}: —</p>}{order.payment_method === 'MANUAL' && (order.payment_status === 'awaiting_payment' || order.payment_status === 'rejected') && <div className="payment-reupload"><label className="ui-field"><span className="ui-label">{t('checkout.senderInfo')}</span><input type="text" maxLength={80} value={senderInfo} onChange={(event) => setSenderInfo(event.target.value)} /></label><label className="ui-field"><span className="ui-label">{t('checkout.receiptUploadTitle')}</span><input type="file" accept="image/*" onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} /></label><Button disabled={!replacement || uploading} loading={uploading} onClick={() => void uploadReplacement()}>{t('checkout.receiptUploadTitle')}</Button></div>  }{order.payment_method === 'MANUAL' && businessConfig.contact.whatsapp && <a className="ui-button ui-button-secondary" href={`https://wa.me/${businessConfig.contact.whatsapp}?text=${encodeURIComponent(`${order.order_number} ${(order.total / 100).toFixed(2)} EGP`)}`} target="_blank" rel="noreferrer">{t('checkout.contactWhatsApp')}</a>}{canCustomerCancel(order.status) && <Button variant="secondary" onClick={() => setDialog(true)}>{t('orders.cancel')}</Button>}</aside></div><Dialog open={dialog} title={t('orders.cancelConfirm')} onClose={() => setDialog(false)}><label className="ui-field"><span className="ui-label">{t('orders.cancelReasonOptional')}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label><Button onClick={() => void cancel()}>{t('orders.confirmCancel')}</Button></Dialog></section>
}
