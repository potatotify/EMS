'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, UserCircle, Briefcase, FileText, ChevronRight } from 'lucide-react';

export default function Home() {
  // Just update the roles array hrefs:
const roles = [
  { title: 'Client', description: 'Monitor project timelines, milestones, and real-time progress updates', icon: Briefcase, href: '/signup?role=client', color: '#10B981', available: true },
  { title: 'Employee', description: 'Access your projects, submit daily updates, and track your progress', icon: UserCircle, href: '/signup?role=employee', color: '#059669', available: true },
  { title: 'Admin', description: 'Complete control over projects, employees, clients, and system operations', icon: Users, href: '/login?role=admin', color: '#064E3B', available: true },
  { title: 'Applicant', description: 'Submit your application and track your hiring journey', icon: FileText, href: '#', color: '#34D399', available: false }
];


  return (
    <main className="min-h-screen bg-[#F2FBF5] text-emerald-900 antialiased" style={{ WebkitFontSmoothing: 'antialiased' }}>
      {/* Subtle wood-grain background texture */}
      <div className="fixed inset-0 -z-10 opacity-20 sm:opacity-30" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'grayscale(10%) contrast(95%)' }} />

      {/* Top gradient overlay for depth */}
      <div className="fixed inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-800/10 to-transparent" />
        <div className="absolute -top-1/3 -left-1/4 w-[600px] sm:w-[900px] h-[600px] sm:h-[900px] rounded-full bg-linear-to-br from-emerald-600/8 to-green-500/6 blur-3xl" />
      </div>

      {/* Header - Mobile Optimized */}
      <motion.header 
        initial={{ y: -16, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.5 }} 
        className="sticky top-2 sm:top-4 z-50 px-3 sm:px-0"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-6 bg-white/60 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-emerald-200 shadow-sm shadow-emerald-200/10">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-linear-to-br from-emerald-700 to-emerald-500 flex items-center justify-center text-white font-semibold text-base sm:text-lg shadow-md" style={{ boxShadow: '0 6px 18px rgba(5,118,77,0.12)' }}>
                WN
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight">WorkNest</h1>
                <p className="text-xs text-emerald-700/80">Clear insights. Natural workflows.</p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-sm font-semibold tracking-tight">WN</h1>
                <p className="text-xs text-emerald-700/80">WorkNest</p>
              </div>
            </div>

            <nav className="flex items-center gap-3 sm:gap-6">
              <Link href="/login" className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-700 text-white text-xs sm:text-sm font-medium shadow hover:bg-emerald-800 transition-colors">
                Sign in
              </Link>
            </nav>
          </div>
        </div>
      </motion.header>

      {/* Hero - Mobile First */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 lg:pt-24 pb-8 sm:pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-emerald-900">
                A calm command center for teams — <span className="text-emerald-700">built for people</span>
              </h2>

              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-emerald-800/80 max-w-xl">
                Beautiful, professional workflows that feel familiar. Reduce friction, increase focus, and let your team move faster — without sacrificing clarity.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Link 
                  href="/signup" 
                  className="inline-flex items-center justify-center gap-2 sm:gap-3 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-3 rounded-lg font-semibold shadow-lg transition-colors text-center" 
                  style={{ boxShadow: '0 10px 30px rgba(6,78,59,0.12)' }}
                >
                  Get started
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Bamboo-style divider - Hidden on mobile */}
              <div className="mt-8 sm:mt-10 hidden sm:flex items-center gap-4">
                <div style={{ width: 80, height: 2, backgroundImage: "linear-gradient(90deg, rgba(208,192,167,1), rgba(208,192,167,0.35))", borderRadius: 4 }} />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2v20" stroke="#D1BFA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 6c0 1.333 1.333 2.667 4 2.667S16 7.333 16 6" stroke="#D1BFA7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ width: 80, height: 2, backgroundImage: "linear-gradient(90deg, rgba(208,192,167,0.35), rgba(208,192,167,1))", borderRadius: 4 }} />
              </div>
            </motion.div>

            {/* Feature badges - Responsive */}
            <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-3">
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/70 border border-emerald-100 shadow-sm text-xs sm:text-sm">Real-time sync</div>
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/70 border border-emerald-100 shadow-sm text-xs sm:text-sm">Secure by default</div>
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/70 border border-emerald-100 shadow-sm text-xs sm:text-sm">Audit trails</div>
            </div>
          </div>

          {/* Visual card cluster - HIDDEN ON MOBILE, visible on desktop only */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl p-6 bg-white/70 backdrop-blur-md border border-emerald-100 shadow-lg" style={{ transform: 'rotate(-2deg)' }}>
              <div className="grid grid-cols-2 gap-4">
                {roles.slice(0,4).map((r, i) => (
                  <div key={i} className="p-4 rounded-xl bg-linear-to-br from-white/60 to-emerald-50 border border-emerald-50 shadow-inner" style={{ minHeight: 80 }}>
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${r.color}22`, color: r.color }}>
                        <r.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-emerald-900 truncate">{r.title}</div>
                        <div className="text-xs text-emerald-800/70">{r.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dew-drop glow card */}
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              className="absolute -bottom-8 right-6 w-56 p-4 rounded-2xl bg-emerald-700/10 border border-emerald-100 shadow-lg" 
              style={{ backdropFilter: 'blur(6px)' }}
            >
              <div className="text-sm text-emerald-900 font-semibold">Daily summary</div>
              <div className="mt-2 text-xs text-emerald-800/80">No urgent tasks. 3 items pending review.</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Role Cards Grid - Mobile Optimized */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <motion.div 
                key={idx} 
                initial={{ y: 30, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                transition={{ delay: 0.2 + idx * 0.06 }} 
                whileHover={{ y: -6, scale: 1.02 }} 
                className="group relative"
              >
                <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-emerald-100 bg-white/80 backdrop-blur-md p-5 sm:p-6 shadow-lg transition-transform" style={{ minHeight: 200 }}>
                  <div className="absolute -inset-0.5 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500" style={{ background: `linear-gradient(135deg, ${role.color}33, ${role.color}10)` }} />

                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${role.color}22`, color: role.color }}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-emerald-900">{role.title}</h3>
                      <p className="text-xs sm:text-sm text-emerald-800/80 mt-1 line-clamp-3">{role.description}</p>
                    </div>
                  </div>

                  <div className="relative mt-5 sm:mt-6 flex items-center justify-between">
                    {role.available ? (
                      <Link href={role.href} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors">
                        <span>Open</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <div className="text-sm text-emerald-700/60">Coming soon</div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Footer - Mobile Responsive */}
      <motion.footer 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 0.6 }} 
        className="bg-white/60 border-t border-amber-100 py-8 sm:py-12"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-center md:text-left">
          <div>
            <div className="text-sm font-semibold text-emerald-900">WorkNest</div>
            <div className="text-xs text-emerald-800/70 mt-1">Made with care — © {new Date().getFullYear()}</div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-emerald-800/80">
            <Link href="/privacy" className="hover:text-emerald-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-900 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-emerald-900 transition-colors">Contact</Link>
          </div>
        </div>
      </motion.footer>
    </main>
  );
}
