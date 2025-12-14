import NextAuth, {NextAuthOptions} from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import {MongoDBAdapter} from "@auth/mongodb-adapter";
import {Adapter} from "next-auth/adapters";
import clientPromise from "@/lib/mongodb";
import {cookies} from "next/headers";
import bcrypt from "bcryptjs";

const ADMIN_EMAILS = ["chiragkhati04@gmail.com","zprootech@gmail.com","insightfusionanalytics@gmail.com","piyush31221@gmail.com"];

const createCustomAdapter = () => {
  const adapter = MongoDBAdapter(clientPromise);
  const originalCreateUser = adapter.createUser;

  return {
    ...adapter,
    createUser: async (user: any) => {
      try {
        const cookieStore = await cookies();
        const roleCookie = cookieStore.get("signup-role");

        if (!roleCookie) {
          throw new Error("Account not found. Please sign up first.");
        }

        const selectedRole = roleCookie.value;
        const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");
        const finalRole = isAdmin ? "admin" : selectedRole;

        const userWithRole = {
          ...user,
          role: finalRole,
          isApproved: finalRole !== "employee" && finalRole !== "hackathon",
          approvedAt: finalRole !== "employee" && finalRole !== "hackathon" ? new Date() : null,
          approvedBy: finalRole !== "employee" && finalRole !== "hackathon" ? "system" : null,
          profileCompleted: finalRole === "admin" // Admin doesn't need onboarding, hackathon users need onboarding
        };

        const createdUser = await originalCreateUser!(userWithRole);

        cookieStore.delete("signup-role");

        return createdUser;
      } catch (error) {
        console.error("Error creating user:", error);
        throw error;
      }
    }
  };
};

export const authOptions: NextAuthOptions = {
  adapter: createCustomAdapter() as Adapter,
  providers: [
    // Credentials provider for clients only
    CredentialsProvider({
      id: 'client-credentials',
      name: 'Client Login',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const client = await clientPromise;
        const db = client.db("worknest");

        const user = await db.collection("users").findOne({
          email: credentials.email.toLowerCase(),
          role: 'client'
        });

        if (!user || !user.password) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: user.isApproved,
          profileCompleted: user.profileCompleted
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async signIn({user, account, profile}) {
      try {
        // For credentials (client login), user is already validated
        if (account?.provider === 'client-credentials') {
          return true;
        }

        // For Google login (admin, employee, hackathon)
        const client = await clientPromise;
        const db = client.db("worknest");

        const existingUser = await db.collection("users").findOne({
          email: user.email
        });

        const cookieStore = await cookies();
        const isSignupFlow = cookieStore.get("signup-role");

        if (isSignupFlow) {
          if (existingUser) {
            cookieStore.delete("signup-role");
            return "/login?error=already_exists";
          }
          return true;
        } else {
          if (!existingUser) {
            return "/signup?error=not_registered";
          }
          return true;
        }
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({token, user, trigger, account}) {
      // On initial sign in or when manually updating
      if (user || trigger === "update") {
        // For credentials login, user object already has the data
        if (account?.provider === 'client-credentials' && user) {
          token.id = user.id;
          token.role = (user as any).role;
          token.isApproved = (user as any).isApproved;
          token.profileCompleted = (user as any).profileCompleted;
          return token;
        }

        // For Google login, fetch from database
        const client = await clientPromise;
        const db = client.db("worknest");

        const dbUser = await db.collection("users").findOne({
          email: token.email || user?.email
        });

        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = (dbUser as any).role || "employee";
          token.isApproved = (dbUser as any).isApproved || false;
          token.profileCompleted = (dbUser as any).profileCompleted || false;
        }
      }
      return token;
    },

    async session({session, token}) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role =
          (token.role as "admin" | "employee" | "client" | "hackathon") || "employee";
        (session.user as any).isApproved = token.isApproved || false;
        (session.user as any).profileCompleted =
          token.profileCompleted || false;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login"
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true
};

const handler = NextAuth(authOptions);

export {handler as GET, handler as POST};
