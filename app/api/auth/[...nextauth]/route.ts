import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { NextAuthOptions } from "next-auth";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Check if the user exists in the database
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          // If no user found with that email, check the admin table (for backward compatibility)
          if (!user) {
            const admin = await prisma.admin.findUnique({
              where: { email: credentials.email }
            });
            
            if (!admin) return null;
            
            const isPasswordValid = await compare(credentials.password, admin.password);
            if (!isPasswordValid) return null;
            
            return {
              id: admin.id,
              name: admin.name || "Admin",
              email: admin.email
            };
          }
          
          // Verify password for regular user
          const isPasswordValid = await compare(credentials.password, user.password);
          if (!isPasswordValid) return null;
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
