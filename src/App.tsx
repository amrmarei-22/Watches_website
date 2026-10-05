import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StoreLayout } from './app/StoreLayout'
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages'
import { RequireAdmin, RequireAuth, RequireCustomer, RequireVerified } from './components/AuthGuards'
import { setLanguage, type i18nLanguage } from './lib/i18n'
import './App.css'
import { HomePage, ListingPage, ProductPage } from './pages/CatalogPages'
import { CartPage } from './pages/CartPage'
import { OrdersPage, OrderDetailsPage } from './pages/OrderPages'
import { StaticPage } from './pages/StaticPage'

const AdminApp = lazy(() => import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })))
const CheckoutPage = lazy(() => import('./pages/CheckoutPages').then((module) => ({ default: module.CheckoutPage })))
const ConfirmationPage = lazy(() => import('./pages/CheckoutPages').then((module) => ({ default: module.ConfirmationPage })))
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })))

function PageStub({ page }: { page: string }) {
  const { t } = useTranslation()
  return <div className="container page-stub"><h1 className="page-heading">{t(`pages.${page}`)}</h1></div>
}
function LoadingFallback() {
  const { t } = useTranslation()
  return <div className="container auth-loading">{t('ui.loading')}</div>
}

function LocalizedRoutes() {
  const { lang } = useParams()
  useEffect(() => {
    if (lang === 'ar' || lang === 'en') void setLanguage(lang as i18nLanguage)
  }, [lang])
  if (lang !== 'ar' && lang !== 'en') return <Navigate to="/ar" replace />
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ListingPage />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireVerified />}><Route path="checkout" element={<Suspense fallback={<LoadingFallback />}><CheckoutPage /></Suspense>} /></Route>
        </Route>
        <Route path="checkout/confirmation/:orderId" element={<RequireAuth />}><Route element={<RequireVerified />}><Route index element={<Suspense fallback={<LoadingFallback />}><ConfirmationPage /></Suspense>} /></Route></Route>
        <Route path="account/orders" element={<RequireAuth />}><Route element={<RequireVerified />}><Route index element={<OrdersPage />} /></Route></Route>
        <Route path="account/orders/:id" element={<RequireAuth />}><Route element={<RequireVerified />}><Route index element={<OrderDetailsPage />} /></Route></Route>
        <Route element={<RequireCustomer />}><Route path="account" element={<Suspense fallback={<LoadingFallback />}><AccountPage /></Suspense>} /></Route>
        <Route path="contact" element={<StaticPage slug="contact" />} />
        <Route path="shipping" element={<StaticPage slug="shipping" />} />
        <Route path="privacy" element={<StaticPage slug="privacy" />} />
        <Route path="terms" element={<StaticPage slug="terms" />} />
        <Route path="403" element={<PageStub page="forbidden" />} />
        <Route path="500" element={<PageStub page="serverError" />} />
        <Route path="*" element={<PageStub page="notFound" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/:lang/*" element={<LocalizedRoutes />} /><Route path="/admin/login" element={<LoginPage admin />} /><Route element={<RequireAdmin />}><Route path="/admin/*" element={<Suspense fallback={<LoadingFallback />}><AdminApp /></Suspense>} /></Route><Route path="*" element={<Navigate to="/ar" replace />} /></Routes></BrowserRouter>
}
