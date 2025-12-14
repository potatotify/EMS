"use client";

import {motion} from "framer-motion";
import {ReactNode} from "react";
import {cn} from "@/lib/utils";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: ReactNode;
}

export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className,
  disabled,
  type = "button",
  icon
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group";
  
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700",
    secondary: "bg-white text-neutral-900 hover:bg-neutral-50 shadow-md hover:shadow-lg border border-neutral-200 hover:border-neutral-300 hover:scale-[1.02] active:scale-[0.98]",
    outline: "border-2 border-neutral-300 text-neutral-700 hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 shadow-sm hover:shadow-md transition-all",
    ghost: "text-neutral-700 hover:bg-neutral-100/80 hover:text-neutral-900 rounded-lg",
    danger: "bg-gradient-to-r from-red-500 via-red-600 to-rose-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-3.5 text-base"
  };

  return (
    <motion.button
      whileHover={disabled ? {} : {scale: 1.02}}
      whileTap={disabled ? {} : {scale: 0.98}}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.button>
  );
}

