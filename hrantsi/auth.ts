import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Մուտք Google հաշվով։ Պահանջում է AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (տես README)։
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
});
