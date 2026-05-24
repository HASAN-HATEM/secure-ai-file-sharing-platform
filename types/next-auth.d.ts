import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: string;
      keySalt?: string;
    };
  }

  interface User {
    role: string;
    keySalt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    keySalt?: string;
  }
}
