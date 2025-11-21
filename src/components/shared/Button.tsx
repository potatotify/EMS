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
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]",
    secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 shadow-sm hover:shadow-md",
    outline: "border-2 border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
    ghost: "text-neutral-700 hover:bg-neutral-100",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
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

