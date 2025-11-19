"use client";

import {LucideIcon} from "lucide-react";
import {motion} from "framer-motion";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor
}: StatCardProps) {
  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -4, scale: 1.02}}
      transition={{duration: 0.3}}
      className="group relative rounded-2xl overflow-hidden border border-white/60 glass-effect p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer"
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(20, 184, 166, 0.08))"
        }}
      />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-600 mb-2.5 tracking-wide uppercase">
            {title}
          </p>
          <motion.p
            initial={{scale: 0.8, opacity: 0}}
            animate={{scale: 1, opacity: 1}}
            transition={{delay: 0.1, type: "spring", stiffness: 200}}
            className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600 leading-tight"
          >
            {value}
          </motion.p>
        </div>
        <motion.div
          whileHover={{rotate: 360, scale: 1.1}}
          transition={{duration: 0.6, ease: "easeInOut"}}
          className={`w-16 h-16 rounded-2xl ${iconBgColor} flex items-center justify-center shadow-lg relative overflow-hidden`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-white/30 to-transparent" />
          <Icon className={`w-8 h-8 ${iconColor} relative z-10`} />
        </motion.div>
      </div>

      {/* Bottom accent line */}
      <motion.div
        initial={{scaleX: 0}}
        animate={{scaleX: 1}}
        transition={{delay: 0.2, duration: 0.5}}
        className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 origin-left"
      />
    </motion.div>
  );
}
