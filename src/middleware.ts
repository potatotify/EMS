import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const { pathname } = req.nextUrl;

  // Allow access to auth-related routes and API routes
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // If user is authenticated
  if (token) {
    const role = token.role as 'admin' | 'employee' | 'client' | 'hackathon';
    
    // Redirect from login/signup to their dashboard
    if (pathname === '/login' || pathname === '/signup') {
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
      } else if (role === 'employee') {
        return NextResponse.redirect(new URL('/employee/dashboard', req.url));
      } else if (role === 'client') {
        return NextResponse.redirect(new URL('/client/dashboard', req.url));
      } else if (role === 'hackathon') {
        return NextResponse.redirect(new URL('/hackathon/dashboard', req.url));
      }
    }

    // Redirect from /dashboard to role-specific dashboard
    if (pathname === '/dashboard') {
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
      } else if (role === 'employee') {
        return NextResponse.redirect(new URL('/employee/dashboard', req.url));
      } else if (role === 'client') {
        return NextResponse.redirect(new URL('/client/dashboard', req.url));
      } else if (role === 'hackathon') {
        return NextResponse.redirect(new URL('/hackathon/dashboard', req.url));
      }
    }

    // Allow authenticated users to access their role-specific routes
    return NextResponse.next();
  }

  // If user is NOT authenticated
  if (!token) {
    // Protect dashboard routes - redirect to login
    if (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/employee') ||
      pathname.startsWith('/client') ||
      pathname.startsWith('/hackathon') ||
      pathname === '/dashboard'
    ) {
      // Allow hackathon signup/login pages
      if (pathname.startsWith('/hackathon/signup') || pathname.startsWith('/hackathon/login')) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Allow access to public routes (home, login, signup)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
};
