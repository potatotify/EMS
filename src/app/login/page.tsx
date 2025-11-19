"use client";

import {motion} from "framer-motion";
import Link from "next/link";
import {signIn, useSession} from "next-auth/react";
import {ArrowLeft, AlertCircle} from "lucide-react";
import {useState, useEffect, Suspense} from "react";
import {useRouter, useSearchParams} from "next/navigation";

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const {data: session, status} = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams?.get("error");

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role;
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "employee") {
        router.push("/employee/dashboard");
      } else if (role === "client") {
        router.push("/client/dashboard");
      }
    }
  }, [status, session, router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn("google", {
        callbackUrl: "/dashboard"
      });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50/40 text-emerald-900 antialiased flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 opacity-30">
        <div
          className="absolute top-20 left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "0s"}}
        />
        <div
          className="absolute top-40 right-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "4s"}}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-100/20 via-transparent to-teal-100/20" />

      {/* Grid Pattern */}
      <div
        className="fixed inset-0 -z-20 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      {/* Card */}
      <motion.div
        initial={{opacity: 0, y: 30, scale: 0.95}}
        animate={{opacity: 1, y: 0, scale: 1}}
        transition={{duration: 0.6, ease: [0.4, 0, 0.2, 1]}}
        className="w-full max-w-md relative z-10"
      >
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 mb-8 transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to home</span>
        </Link>

        <div className="glass-effect rounded-3xl shadow-2xl border border-white/40 p-8 sm:p-10 relative overflow-hidden">
          {/* Decorative gradient blur */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-linear-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-linear-to-br from-teal-400/20 to-cyan-400/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-10">
              <motion.div
                initial={{scale: 0}}
                animate={{scale: 1}}
                transition={{delay: 0.2, type: "spring", stiffness: 200}}
                className="w-20 h-20 rounded-2xl gradient-emerald flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-xl relative"
              >
                <span className="relative z-10">WN</span>
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-white/20 to-transparent" />
              </motion.div>
              <motion.h1
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.3}}
                className="text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600 mb-3"
              >
                Welcome back
              </motion.h1>
              <motion.p
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.4}}
                className="text-sm text-slate-600 font-medium"
              >
                Sign in to continue to WorkNest
              </motion.p>
            </div>

            {/* Error Message for Already Exists */}
            {errorParam === "already_exists" && (
              <motion.div
                initial={{opacity: 0, y: -10}}
                animate={{opacity: 1, y: 0}}
                className="mb-6 p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Account already exists
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    This email is already registered. Please sign in instead.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Google Sign In Button */}
            <motion.button
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.5}}
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-8 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="relative z-10">
                {isLoading ? "Signing in..." : "Continue with Google"}
              </span>
            </motion.button>

            {/* Info box */}
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.6}}
              className="bg-linear-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/50 rounded-2xl p-4 mb-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-br from-emerald-100/10 to-transparent" />
              <p className="text-xs text-emerald-900/80 text-center leading-relaxed font-medium relative z-10">
                🚀 You'll be automatically redirected to your personalized
                dashboard
              </p>
            </motion.div>

            {/* Don't have account */}
            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.7}}
              className="text-center text-sm text-slate-600"
            >
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors relative group"
              >
                Sign up
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-emerald-600 transition-all group-hover:w-full" />
              </Link>
            </motion.p>
          </div>
        </div>

        {/* Terms */}
        <motion.p
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.8}}
          className="text-center text-xs text-slate-500 mt-6"
        >
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="underline hover:text-emerald-700 transition-colors"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline hover:text-emerald-700 transition-colors"
          >
            Privacy Policy
          </Link>
        </motion.p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
