'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserCircle, Briefcase, ArrowLeft, AlertCircle } from 'lucide-react';

function SignupContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const errorParam = searchParams.get('error');
  
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [activeRole, setActiveRole] = useState<'employee' | 'client'>(
    roleParam === 'client' ? 'client' : 'employee'
  );
  const [isLoading, setIsLoading] = useState(false);
  
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const roles = [
    { id: 'employee', label: 'Employee', icon: UserCircle, color: '#059669' },
    { id: 'client', label: 'Client', icon: Briefcase, color: '#10B981' }
  ];

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const role = session.user.role;
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'employee') {
        router.push('/employee/dashboard');
      } else if (role === 'client') {
        router.push('/client/dashboard');
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    updateIndicator();
  }, [activeRole]);

  const updateIndicator = () => {
    if (tabsRef.current) {
      const activeButton = tabsRef.current.querySelector(`[data-role="${activeRole}"]`) as HTMLElement;
      if (activeButton) {
        setIndicatorStyle({
          left: activeButton.offsetLeft,
          width: activeButton.offsetWidth
        });
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      
      // Store selected role in cookie before OAuth redirect
      await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole }),
      });

      // Now proceed with Google OAuth
      await signIn('google', { 
        callbackUrl: '/dashboard'
      });
    } catch (error) {
      console.error('Sign up error:', error);
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render signup form if already authenticated
  if (status === 'authenticated') {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F2FBF5] text-emerald-900 antialiased flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10 opacity-20" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'grayscale(10%) contrast(95%)' }} />
      
      <div className="fixed inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-800/10 to-transparent" />
        <div className="absolute -top-1/3 -left-1/4 w-[900px] h-[900px] rounded-full bg-linear-to-br from-emerald-600/8 to-green-500/6 blur-3xl" />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-emerald-100 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-linear-to-br from-emerald-700 to-emerald-500 flex items-center justify-center text-white font-semibold text-xl mx-auto mb-4 shadow-lg">
              WN
            </div>
            <h1 className="text-3xl font-bold text-emerald-900 mb-2">Welcome to WorkNest</h1>
            <p className="text-sm text-emerald-700/70">Sign up to get started</p>
          </div>

          {/* Error Message */}
          {errorParam === 'not_registered' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Account not found</p>
                <p className="text-xs text-red-700 mt-1">Please sign up first before trying to sign in.</p>
              </div>
            </motion.div>
          )}

          {/* Animated Tab Slider */}
          <div className="mb-8">
            <div className="relative bg-emerald-50/50 rounded-2xl p-1.5" ref={tabsRef}>
              {/* Animated indicator */}
              <motion.div
                className="absolute top-1.5 bottom-1.5 bg-white rounded-xl shadow-md"
                initial={false}
                animate={indicatorStyle}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />

              {/* Tabs */}
              <div className="relative grid grid-cols-2 gap-1">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isActive = activeRole === role.id;
                  
                  return (
                    <button
                      key={role.id}
                      data-role={role.id}
                      onClick={() => setActiveRole(role.id as 'employee' | 'client')}
                      className={`relative z-10 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                        isActive ? 'text-emerald-900' : 'text-emerald-700/60 hover:text-emerald-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Role description */}
          <motion.div
            key={activeRole}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100"
          >
            <p className="text-sm text-emerald-800/80 text-center">
              {activeRole === 'employee'
                ? 'Access your projects, submit daily updates, and track your progress'
                : 'Monitor project timelines, milestones, and real-time progress updates'}
            </p>
          </motion.div>

          {/* Google Sign Up Button */}
          <button
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3.5 px-6 rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {isLoading ? 'Signing up...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-emerald-200"></div>
            <span className="text-xs text-emerald-700/60">or</span>
            <div className="flex-1 h-px bg-emerald-200"></div>
          </div>

          {/* Already have account */}
          <p className="text-center text-sm text-emerald-700/70">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-700 font-semibold hover:text-emerald-900 transition-colors">
              Sign in
            </Link>
          </p>

          {/* Admin link */}
          <div className="mt-6 pt-6 border-t border-emerald-100">
            <p className="text-center text-xs text-emerald-700/60">
              Are you an admin?{' '}
              <Link href="/login?role=admin" className="text-emerald-700 font-semibold hover:text-emerald-900 transition-colors">
                Admin Login
              </Link>
            </p>
          </div>
        </div>

        {/* Terms */}
        <p className="text-center text-xs text-emerald-700/60 mt-6">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-emerald-900">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-emerald-900">Privacy Policy</Link>
        </p>
      </motion.div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}
