import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StoreLayout } from './app/StoreLayout'
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages'
import { RequireAdmin, RequireAuth, RequireVerified } from './components/AuthGuards'
import { setLanguage, type i18nLanguage } from './lib/i18n'
import './App.css'
import { HomePage, ListingPage, ProductPage } from './pages/CatalogPages'

function PageStub({ page }: { page: string }) {
  const { t } = useTranslation()
  return <div className="container page-stub"><h1 className="page-heading">{t(`pages.${page}`)}</h1></div>
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
        <Route path="cart" element={<PageStub page="cart" />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireVerified />}><Route path="checkout" element={<PageStub page="checkout" />} /></Route>
        </Route>
        <Route path="checkout/confirmation" element={<PageStub page="confirmation" />} />
        <Route path="account/orders" element={<PageStub page="orders" />} />
        <Route path="account/orders/:id" element={<PageStub page="orderDetails" />} />
        <Route path="account" element={<PageStub page="account" />} />
        <Route path="403" element={<PageStub page="forbidden" />} />
        <Route path="500" element={<PageStub page="serverError" />} />
        <Route path="*" element={<PageStub page="notFound" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/:lang/*" element={<LocalizedRoutes />} /><Route path="/admin/login" element={<LoginPage admin />} /><Route element={<RequireAdmin />}><Route path="/admin/*" element={<PageStub page="adminDashboard" />} /></Route><Route path="*" element={<Navigate to="/ar" replace />} /></Routes></BrowserRouter>
}
