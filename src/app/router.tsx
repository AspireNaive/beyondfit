// This file is the route table: it necessarily exports `router` alongside the
// lazy page components, which is exactly what the fast-refresh rule flags.
// oxlint-disable react/only-export-components
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Permission, Role } from '@/domain/identity/model'
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
  RequireRole,
} from '@/features/auth/guards'
import { MarketingLayout } from '@/shared/layouts/MarketingLayout'
import { AppLayout } from '@/shared/layouts/AppLayout'
import { AuthLayout } from '@/shared/layouts/AuthLayout'
import { ErrorBoundary } from './ErrorBoundary'
import { RouteFallback } from '@/shared/ui/Feedback'
import { ScrollToTop } from '@/shared/lib/ScrollToTop'

/**
 * Every page is a lazy chunk. The marketing homepage is the only route most
 * visitors ever load, so it must not pay for the dashboard, the charts or the
 * checkout — those arrive only when someone signs in.
 */

// Marketing
const HomePage = lazy(() => import('@/features/marketing/HomePage'))
const CoachingPage = lazy(() => import('@/features/marketing/CoachingPage'))
const ProgramPage = lazy(() => import('@/features/marketing/ProgramPage'))
const TestingPage = lazy(() => import('@/features/marketing/TestingPage'))
const ResultsPage = lazy(() => import('@/features/marketing/ResultsPage'))
const AboutPage = lazy(() => import('@/features/marketing/AboutPage'))
const ContactPage = lazy(() => import('@/features/marketing/ContactPage'))
const BookCallPage = lazy(() => import('@/features/marketing/BookCallPage'))
const PlatformPage = lazy(() => import('@/features/marketing/PlatformPage'))
const NotFoundPage = lazy(() => import('@/features/marketing/NotFoundPage'))

// Commerce (public storefront)
const ShopPage = lazy(() => import('@/features/shop/ShopPage'))
const ProductPage = lazy(() => import('@/features/shop/ProductPage'))
const CheckoutPage = lazy(() => import('@/features/shop/CheckoutPage'))

// Specialists / booking
const SpecialistsPage = lazy(() => import('@/features/booking/SpecialistsPage'))
const BookingPage = lazy(() => import('@/features/booking/BookingPage'))
const SchedulePage = lazy(() => import('@/features/booking/SchedulePage'))

// Auth
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))

// App
const MemberDashboard = lazy(() => import('@/features/dashboard/MemberDashboard'))
const CoachDashboard = lazy(() => import('@/features/dashboard/CoachDashboard'))
const AdminDashboard = lazy(() => import('@/features/dashboard/AdminDashboard'))
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'))
const DirectoryPage = lazy(() => import('@/features/profiles/DirectoryPage'))
const ProfilePage = lazy(() => import('@/features/profiles/ProfilePage'))
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage'))
const MyOrdersPage = lazy(() => import('@/features/orders/MyOrdersPage'))
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'))
const TenantsPage = lazy(() => import('@/features/tenant/TenantsPage'))

/** Per-route wrapper: a boundary so one page's crash stays contained, plus the
 *  suspense fence its lazy chunk streams into. Scroll reset lives on the
 *  layouts, which outlive individual pages. */
function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

const shell = (element: React.ReactNode) => <RouteShell>{element}</RouteShell>

export const router = createBrowserRouter([
  {
    element: (
      <>
        <ScrollToTop />
        <MarketingLayout />
      </>
    ),
    children: [
      { index: true, element: shell(<HomePage />) },
      { path: 'coaching', element: shell(<CoachingPage />) },
      { path: 'coaching/:slug', element: shell(<ProgramPage />) },
      { path: 'testing', element: shell(<TestingPage />) },
      { path: 'results', element: shell(<ResultsPage />) },
      { path: 'about', element: shell(<AboutPage />) },
      { path: 'contact', element: shell(<ContactPage />) },
      { path: 'book', element: shell(<BookCallPage />) },
      { path: 'platform', element: shell(<PlatformPage />) },
      { path: 'specialists', element: shell(<SpecialistsPage />) },
      { path: 'shop', element: shell(<ShopPage />) },
      { path: 'shop/:slug', element: shell(<ProductPage />) },
      { path: '*', element: shell(<NotFoundPage />) },
    ],
  },

  {
    element: (
      <>
        <ScrollToTop />
        <AuthLayout />
      </>
    ),
    children: [
      // One component drives all four portals; the portal prop is what changes
      // the copy, the accepted roles and the endpoint the .NET API sees.
      {
        path: 'login',
        element: shell(
          <RedirectIfAuthenticated>
            <LoginPage portal={Role.Member} variant="general" />
          </RedirectIfAuthenticated>,
        ),
      },
      {
        path: 'login/member',
        element: shell(
          <RedirectIfAuthenticated>
            <LoginPage portal={Role.Member} variant="membership" />
          </RedirectIfAuthenticated>,
        ),
      },
      {
        path: 'login/instructor',
        element: shell(
          <RedirectIfAuthenticated>
            <LoginPage portal={Role.Coach} variant="instructor" />
          </RedirectIfAuthenticated>,
        ),
      },
      {
        path: 'login/admin',
        element: shell(
          <RedirectIfAuthenticated>
            <LoginPage portal={Role.Admin} variant="admin" />
          </RedirectIfAuthenticated>,
        ),
      },
      {
        path: 'register',
        element: shell(
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>,
        ),
      },
      { path: 'forgot-password', element: shell(<ForgotPasswordPage />) },
    ],
  },

  {
    path: 'app',
    element: (
      <RequireAuth>
        <ScrollToTop />
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: shell(
          <RequireRole roles={[Role.Member]}>
            <MemberDashboard />
          </RequireRole>,
        ),
      },
      {
        path: 'coach',
        element: shell(
          <RequireRole roles={[Role.Coach]}>
            <CoachDashboard />
          </RequireRole>,
        ),
      },
      {
        path: 'admin',
        element: shell(
          <RequireRole roles={[Role.Admin, Role.AppManager]}>
            <AdminDashboard />
          </RequireRole>,
        ),
      },
      {
        path: 'progress',
        element: shell(
          <RequireRole roles={[Role.Member]}>
            <ProgressPage />
          </RequireRole>,
        ),
      },
      { path: 'progress/:memberId', element: shell(<ProgressPage />) },
      { path: 'schedule', element: shell(<SchedulePage />) },
      { path: 'specialists', element: shell(<SpecialistsPage />) },
      { path: 'book/:providerId', element: shell(<BookingPage />) },
      { path: 'people', element: shell(<DirectoryPage />) },
      { path: 'people/:userId', element: shell(<ProfilePage />) },
      { path: 'profile', element: shell(<ProfilePage />) },
      {
        path: 'orders',
        element: shell(
          <RequirePermission permission={Permission.ViewOrders}>
            <OrdersPage />
          </RequirePermission>,
        ),
      },
      { path: 'my-orders', element: shell(<MyOrdersPage />) },
      {
        path: 'payments',
        element: shell(
          <RequirePermission permission={Permission.ViewPayments}>
            <PaymentsPage />
          </RequirePermission>,
        ),
      },
      {
        path: 'tenants',
        element: shell(
          <RequirePermission permission={Permission.ManagePlatform}>
            <TenantsPage />
          </RequirePermission>,
        ),
      },
      { path: 'checkout', element: shell(<CheckoutPage />) },
      { path: '*', element: shell(<NotFoundPage />) },
    ],
  },
])
