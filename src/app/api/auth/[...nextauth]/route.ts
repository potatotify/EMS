import NextAuth, {NextAuthOptions} from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import {MongoDBAdapter} from "@auth/mongodb-adapter";
import {Adapter} from "next-auth/adapters";
import clientPromise from "@/lib/mongodb";
import {cookies} from "next/headers";

const ADMIN_EMAIL = "chiragkhati04@gmail.com";

const createCustomAdapter = () => {
  const adapter = MongoDBAdapter(clientPromise);
  const originalCreateUser = adapter.createUser;

  return {
    ...adapter,
    createUser: async (user: any) => {
      const cookieStore = await cookies();
      const roleCookie = cookieStore.get("signup-role");

      if (!roleCookie) {
        throw new Error("Account not found. Please sign up first.");
      }

      const selectedRole = roleCookie.value;
      const isAdmin = user.email === ADMIN_EMAIL;
      const finalRole = isAdmin ? "admin" : selectedRole;

      console.log("Creating new user with role:", finalRole);

      const userWithRole = {
        ...user,
        role: finalRole,
        isApproved: finalRole !== "employee",
        approvedAt: finalRole !== "employee" ? new Date() : null,
        approvedBy: finalRole !== "employee" ? "system" : null,
        profileCompleted: finalRole === "admin" // Admin doesn't need onboarding
      };

      const createdUser = await originalCreateUser!(userWithRole);
      console.log("User created:", createdUser.email, "Role:", finalRole);

      cookieStore.delete("signup-role");

      return createdUser;
    }
  };
};

export const authOptions: NextAuthOptions = {
  adapter: createCustomAdapter() as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async signIn({user, account, profile}) {
      try {
        const client = await clientPromise;
        const db = client.db("worknest");

        const existingUser = await db.collection("users").findOne({
          email: user.email
        });

        const cookieStore = await cookies();
        const isSignupFlow = cookieStore.get("signup-role");

        if (isSignupFlow) {
          if (existingUser) {
            console.log("Signup blocked: User already exists -", user.email);
            cookieStore.delete("signup-role");
            return "/login?error=already_exists";
          }
          console.log("Allowing new user signup:", user.email);
          return true;
        } else {
          if (!existingUser) {
            console.log("Login blocked: User not found -", user.email);
            return "/signup?error=not_registered";
          }
          console.log("Login successful:", user.email);
          return true;
        }
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({token, user, trigger}) {
      // On initial sign in or when manually updating
      if (user || trigger === "update") {
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
          console.log(
            "JWT updated - User:",
            dbUser.email,
            "Profile completed:",
            token.profileCompleted
          );
        }
      }
      return token;
    },

    async session({session, token}) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role =
          (token.role as "admin" | "employee" | "client") || "employee";
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
