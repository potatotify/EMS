'use client';

import { signOut } from 'next-auth/react';
import { LogOut, Bell, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeaderProps {
  title: string;
  userName: string;
}

export default function Header({ title, userName }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/', redirect: true });
  };

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-md border-b border-emerald-100/50 shadow-sm' 
          : 'bg-white/60 backdrop-blur-md border-b border-emerald-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                WN
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-emerald-900">{title}</h1>
                <p className="text-xs text-emerald-700/70">Welcome, {userName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
           
            
            

            <div className="h-8 w-px bg-gray-200/50"></div>

            <div className="flex items-center gap-3">
              
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="ml-2 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
