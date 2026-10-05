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

type OrderRow = { id: string; order_number: string; status: OrderStatus; total: number; created_at: string }
type OrderData = OrderRow & { subtotal: number; shipping_fee: number; payment_method: 'COD'; address_snapshot: Record<string, string>; cancel_reason: string | null; order_lines: Array<{ id: string; sku_snapshot: string; name_ar_snapshot: string; name_en_snapshot: string; unit_price_snapshot: number; quantity: number; line_total: number }>; order_status_history: Array<{ from_status: OrderStatus | null; to_status: OrderStatus; actor_id: string; actor_role: 'CUSTOMER' | 'ADMIN'; reason: string | null; created_at: string }> }

function PageError({ onRetry }: { onRetry: () => void }) { const { t } = useTranslation(); return <ErrorState message={t('messages.PAGE_500')} action={t('actions.tryAgain')} onAction={onRetry} /> }
function date(value: string, language: string) { return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(value)) }

export function OrdersPage() {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const [rows, setRows] = useState<OrderRow[]>([]); const [page, setPage] = useState(0); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false)
  const load = () => { setLoading(true); setFailed(false); void supabase.from('orders').select('id,order_number,status,total,created_at').order('created_at', { ascending: false }).range(page * 10, page * 10 + 9).then(({ data, error }) => { if (error) setFailed(true); else setRows((data ?? []) as OrderRow[]) }).then(() => setLoading(false)) }
  useEffect(load, [page])
  if (loading) return <section className="container order-page"><Skeleton className="listing-skeleton" /></section>
  if (failed) return <PageError onRetry={load} />
  if (!rows.length && page === 0) return <EmptyState message={t('messages.ORDERS_EMPTY')} action={t('actions.startShopping')} onAction={() => navigate(`/${i18n.language}/shop`)} />
  return <section className="container order-page"><h1 className="page-heading">{t('pages.orders')}</h1><div className="order-list">{rows.map((row) => <Link className="order-card" key={row.id} to={`/${i18n.language}/account/orders/${row.id}`}><strong>{row.order_number}</strong><span>{date(row.created_at, i18n.language)}</span><span className="status-badge">{t(`orderStatus.${row.status}`)}</span><strong>{formatMoney(row.total, i18n.language as 'ar' | 'en')}</strong></Link>)}</div><nav className="pagination" aria-label={t('orders.pagination')}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{t('orders.previous')}</Button><span>{page + 1}</span><Button variant="secondary" disabled={rows.length < 10} onClick={() => setPage((value) => value + 1)}>{t('orders.next')}</Button></nav></section>
}

export function OrderDetailsPage() {
  const { t, i18n } = useTranslation(); const { id } = useParams(); const [order, setOrder] = useState<OrderData | null>(null); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [dialog, setDialog] = useState(false); const [reason, setReason] = useState(''); const [message, setMessage] = useState<string | null>(null)
  const load = () => { if (!id) return; setLoading(true); setFailed(false); void supabase.from('orders').select('*, order_lines(*), order_status_history(*)').eq('id', id).maybeSingle().then(({ data, error }) => { if (error || !data) setFailed(true); else setOrder(data as OrderData) }).then(() => setLoading(false)) }
  useEffect(load, [id])
  const cancel = async () => { if (!id) return; const result = await supabase.rpc('cancel_my_order', { p_order_id: id, p_reason: reason || null }); if (result.error) { setMessage(result.error.message === 'ORDER_CANCEL_TOO_LATE' ? 'ORDER_CANCEL_TOO_LATE' : 'PAGE_500'); load() } else { setMessage('ORDER_CANCELLED'); setDialog(false); load() } }
  if (loading) return <section className="container order-page"><Skeleton className="listing-skeleton" /></section>
  if (failed || !order) return <PageError onRetry={load} />
  const lines = order.order_lines; const history = buildStatusTimeline(order.order_status_history.map((entry) => ({ from: entry.from_status, to: entry.to_status, actorId: entry.actor_id, actorRole: entry.actor_role, reason: entry.reason, timestamp: entry.created_at })))
  return <section className="container order-page"><div className="order-detail-header"><span>{t('pages.orderDetails')}</span><h1 className="page-heading">{order.order_number}</h1></div>{message && <div className={message === 'ORDER_CANCELLED' ? 'form-success' : 'form-alert'} role="alert">{t(`messages.${message}`)}</div>}<div className="order-detail-grid"><div className="order-detail-card"><section><h2>{t('orders.items')}</h2>{lines.map((line) => <div className="order-line" key={line.id}><span>{i18n.language === 'ar' ? line.name_ar_snapshot : line.name_en_snapshot}</span><span>{line.quantity} × {formatMoney(line.unit_price_snapshot, i18n.language as 'ar' | 'en')}</span><strong>{formatMoney(line.line_total, i18n.language as 'ar' | 'en')}</strong></div>)}</section><section><h2>{t('orders.shippingAddress')}</h2><address>{order.address_snapshot.full_name}<br />{order.address_snapshot.phone}<br />{t(`governorates.${order.address_snapshot.governorate}`)}, {order.address_snapshot.city}<br />{order.address_snapshot.street}, {order.address_snapshot.building}</address></section><dl className="totals"><div><dt>{t('cart.subtotal')}</dt><dd>{formatMoney(order.subtotal, i18n.language as 'ar' | 'en')}</dd></div><div><dt>{t('orders.shippingFee')}</dt><dd>{formatMoney(order.shipping_fee, i18n.language as 'ar' | 'en')}</dd></div><div className="order-total"><dt>{t('orders.total')}</dt><dd>{formatMoney(order.total, i18n.language as 'ar' | 'en')}</dd></div></dl></div><aside className="order-detail-card order-status-card"><div className="order-status-heading"><span>{t('orders.payment')}</span><p className="status-badge">{t(`orderStatus.${order.status}`)}</p></div><p>{t('orders.cashOnDelivery')}</p>{order.cancel_reason && order.status === 'CANCELLED' && <p>{t('orders.cancelReason')}: {order.cancel_reason}</p>}<h2>{t('orders.timeline')}</h2><ol className="timeline">{history.map((entry) => <li key={`${entry.timestamp}-${entry.to}`}><strong>{t(`orderStatus.${entry.to}`)}</strong><time>{date(entry.timestamp, i18n.language)}</time></li>)}</ol>{order.status === 'SHIPPED' && <p>{t('orders.tracking')}: —</p>}{canCustomerCancel(order.status) && <Button variant="secondary" onClick={() => setDialog(true)}>{t('orders.cancel')}</Button>}</aside></div><Dialog open={dialog} title={t('orders.cancelConfirm')} onClose={() => setDialog(false)}><label className="ui-field"><span className="ui-label">{t('orders.cancelReasonOptional')}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label><Button onClick={() => void cancel()}>{t('orders.confirmCancel')}</Button></Dialog></section>
}
