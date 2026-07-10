import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { ensureAdminUser, findUserByEmail } from '@/lib/users';
import { verifyPassword } from '@/lib/auth';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  pages: {
    signIn: '/login'
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!process.env.DATABASE_URL) {
          throw new Error('Server misconfigured: DATABASE_URL not set');
        }

        await ensureAdminUser();
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await findUserByEmail(email);
        if (!user) return null;
        if (user.disabled) return null;

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          keySalt: Buffer.from(user.key_salt).toString('base64')
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.keySalt = (user as any).keySalt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).keySalt = token.keySalt;
      }
      return session;
    }
  }
};
