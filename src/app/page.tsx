"use client";

import Link from "next/link";
import {motion} from "framer-motion";
import {
  Users,
  UserCircle,
  Briefcase,
  FileText,
  ChevronRight
} from "lucide-react";

export default function Home() {
  // Just update the roles array hrefs:
  const roles = [
    {
      title: "Client",
      description:
        "Monitor project timelines, milestones, and real-time progress updates",
      icon: Briefcase,
      href: "/signup?role=client",
      color: "#10B981",
      available: true
    },
    {
      title: "Employee",
      description:
        "Access your projects, submit daily updates, and track your progress",
      icon: UserCircle,
      href: "/signup?role=employee",
      color: "#059669",
      available: true
    },
    {
      title: "Admin",
      description:
        "Complete control over projects, employees, clients, and system operations",
      icon: Users,
      href: "/login?role=admin",
      color: "#064E3B",
      available: true
    },
    {
      title: "Applicant",
      description: "Submit your application and track your hiring journey",
      icon: FileText,
      href: "#",
      color: "#34D399",
      available: false
    }
  ];

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50/40 text-emerald-900 antialiased overflow-hidden"
      style={{WebkitFontSmoothing: "antialiased"}}
    >
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 opacity-30">
        <div
          className="absolute top-20 left-10 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "0s"}}
        />
        <div
          className="absolute top-40 right-10 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "4s"}}
        />
      </div>

      {/* Gradient overlay */}
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-emerald-100/20 via-transparent to-teal-100/20" />

      {/* Grid pattern */}
      <div
        className="fixed inset-0 -z-20 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      {/* Header - Mobile Optimized */}
      <motion.header
        initial={{y: -16, opacity: 0}}
        animate={{y: 0, opacity: 1}}
        transition={{duration: 0.5}}
        className="sticky top-2 sm:top-4 z-50 px-3 sm:px-0"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-6 glass-effect rounded-2xl p-3 sm:p-4 border border-white/40 shadow-xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <motion.div
                whileHover={{rotate: 360, scale: 1.1}}
                transition={{duration: 0.6}}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-emerald flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg relative overflow-hidden"
              >
                <span className="relative z-10">WN</span>
                <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
              </motion.div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600">
                  WorkNest
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Clear insights. Natural workflows.
                </p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-sm font-bold tracking-tight text-emerald-900">
                  WorkNest
                </h1>
                <p className="text-xs text-slate-600">Modern workspace</p>
              </div>
            </div>

            <nav className="flex items-center gap-3 sm:gap-4">
              <motion.div whileHover={{scale: 1.05}} whileTap={{scale: 0.95}}>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl gradient-emerald text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  Sign in
                </Link>
              </motion.div>
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Hero - Mobile First */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 lg:pt-24 pb-8 sm:pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.1, duration: 0.6}}
            >
              <motion.div
                initial={{opacity: 0, scale: 0.9}}
                animate={{opacity: 1, scale: 1}}
                transition={{delay: 0.2}}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect border border-emerald-200/50 text-sm font-semibold text-emerald-700 mb-6 shadow-md"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Modern Team Management
              </motion.div>

              <h2 className="mt-4 sm:mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
                <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600">
                  A calm command center
                </span>
                <br />
                <span className="text-slate-800">for teams</span>
              </h2>

              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                Beautiful, professional workflows that feel familiar. Reduce
                friction, increase focus, and let your team move faster —
                without sacrificing clarity.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <motion.div
                  whileHover={{scale: 1.05, y: -2}}
                  whileTap={{scale: 0.95}}
                >
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-3 gradient-emerald hover:opacity-90 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl transition-all text-center text-lg relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                    <span className="relative z-10">Get started</span>
                    <ChevronRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              </div>

              {/* Feature badges - Responsive */}
              <motion.div
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.5}}
                className="mt-8 sm:mt-10 flex flex-wrap gap-3"
              >
                {["Real-time sync", "Secure by default", "Audit trails"].map(
                  (feature, i) => (
                    <motion.div
                      key={i}
                      whileHover={{scale: 1.05, y: -2}}
                      className="px-4 py-2.5 rounded-xl glass-effect border border-white/40 shadow-md text-sm font-semibold text-slate-700 cursor-default"
                    >
                      ✨ {feature}
                    </motion.div>
                  )
                )}
              </motion.div>
            </motion.div>
          </div>

          {/* Visual card cluster - HIDDEN ON MOBILE, visible on desktop only */}
          <motion.div
            initial={{opacity: 0, x: 20}}
            animate={{opacity: 1, x: 0}}
            transition={{delay: 0.3, duration: 0.6}}
            className="relative hidden lg:block"
          >
            <div
              className="glass-effect rounded-3xl p-8 border border-white/40 shadow-2xl"
              style={{transform: "rotate(-1deg)"}}
            >
              <div className="grid grid-cols-2 gap-4">
                {roles.slice(0, 4).map((r, i) => (
                  <motion.div
                    key={i}
                    whileHover={{scale: 1.05, rotate: 2}}
                    className="p-5 rounded-2xl bg-linear-to-br from-white/80 to-emerald-50/80 border border-white/60 shadow-lg backdrop-blur-sm"
                    style={{minHeight: 100}}
                  >
                    <div className="flex flex-col gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                        style={{background: `${r.color}22`, color: r.color}}
                      >
                        <r.icon className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold text-slate-900 truncate">
                          {r.title}
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-2 mt-1">
                          {r.description}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Floating status card */}
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.6}}
              whileHover={{scale: 1.05, y: -5}}
              className="absolute -bottom-6 right-6 w-64 p-5 rounded-2xl glass-effect border border-white/40 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-sm text-emerald-700 font-bold mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Daily summary
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                No urgent tasks. 3 items pending review. All systems
                operational. 🎯
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Role Cards Grid - Mobile Optimized */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.4}}
          className="text-center mb-12"
        >
          <h3 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600 mb-4">
            Choose Your Role
          </h3>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Get started with the role that best fits your needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={idx}
                initial={{y: 30, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                transition={{delay: 0.5 + idx * 0.1, duration: 0.5}}
                whileHover={{y: -8, scale: 1.03}}
                className="group relative"
              >
                <div
                  className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/60 glass-effect p-6 sm:p-7 shadow-xl hover:shadow-2xl transition-all duration-300"
                  style={{minHeight: 240}}
                >
                  {/* Animated gradient background on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${role.color}15, ${role.color}05)`
                    }}
                  />

                  <div className="relative flex flex-col gap-4">
                    {/* Icon */}
                    <motion.div
                      whileHover={{rotate: 360, scale: 1.1}}
                      transition={{duration: 0.6}}
                      className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden"
                      style={{background: `${role.color}22`, color: role.color}}
                    >
                      <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
                      <Icon className="w-8 h-8 relative z-10" />
                    </motion.div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                        {role.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {role.description}
                      </p>
                    </div>

                    {/* Action button */}
                    <div className="mt-auto pt-4">
                      {role.available ? (
                        <motion.div
                          whileHover={{scale: 1.05}}
                          whileTap={{scale: 0.95}}
                        >
                          <Link
                            href={role.href}
                            className="inline-flex items-center justify-center w-full gap-2 px-5 py-3 rounded-xl font-bold text-white shadow-lg transition-all relative overflow-hidden group/btn"
                            style={{
                              background: `linear-gradient(135deg, ${role.color}, ${role.color}dd)`
                            }}
                          >
                            <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/10 transition-colors duration-300" />
                            <span className="relative z-10">Get Started</span>
                            <ChevronRight className="w-4 h-4 relative z-10 transition-transform group-hover/btn:translate-x-1" />
                          </Link>
                        </motion.div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-full gap-2 px-5 py-3 rounded-xl font-semibold text-slate-500 bg-slate-100 cursor-not-allowed">
                          <span>Coming Soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{delay: 0.8}}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-emerald-200/50"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-emerald flex items-center justify-center text-white font-bold shadow-lg">
              WN
            </div>
            <span className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600">
              WorkNest
            </span>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            Modern team management platform built for productivity
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <Link
              href="/terms"
              className="hover:text-emerald-600 transition-colors"
            >
              Terms
            </Link>
            <span>•</span>
            <Link
              href="/privacy"
              className="hover:text-emerald-600 transition-colors"
            >
              Privacy
            </Link>
            <span>•</span>
            <span>© 2025 WorkNest</span>
          </div>
        </div>
      </motion.footer>
    </main>
  );
}
