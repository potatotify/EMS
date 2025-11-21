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
      } else if (role === "hackathon") {
        router.push("/hackathon/dashboard");
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.5}}
        className="w-full max-w-md relative z-10"
      >
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to home</span>
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200/50 p-8 lg:p-10 relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{scale: 0}}
              animate={{scale: 1}}
              transition={{delay: 0.2, type: "spring"}}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 shadow-lg shadow-emerald-500/20"
            >
              WN
            </motion.div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-neutral-600">
              Sign in to continue to WorkNest
            </p>
          </div>

          {/* Error Messages */}
          {errorParam === "already_exists" && (
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Account already exists</p>
                <p className="text-xs text-amber-700 mt-1">This email is already registered. Please sign in instead.</p>
              </div>
            </motion.div>
          )}

          {errorParam === "not_registered" && (
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Account not found</p>
                <p className="text-xs text-red-700 mt-1">Please sign up first before trying to sign in.</p>
              </div>
            </motion.div>
          )}

          {/* Google Sign In Button */}
          <motion.button
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.3}}
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 text-neutral-900 font-semibold py-3.5 px-6 rounded-xl border-2 border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span>Continue with Google</span>
              </>
            )}
          </motion.button>

          {/* Info Box */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-emerald-900 text-center leading-relaxed font-medium">
              🚀 You'll be automatically redirected to your personalized dashboard
            </p>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-neutral-600">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Terms */}
        <p className="text-center text-xs text-neutral-500 mt-6">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-neutral-700">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-neutral-700">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
