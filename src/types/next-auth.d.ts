import { DefaultSession } from 'next-auth';
import { DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'employee' | 'client';
      isApproved: boolean;
      profileCompleted: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    role: 'admin' | 'employee' | 'client';
    isApproved: boolean;
    profileCompleted: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'employee' | 'client';
    isApproved: boolean;
    profileCompleted: boolean;
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    role: 'admin' | 'employee' | 'client';
    isApproved: boolean;
    profileCompleted: boolean;
  }
}
