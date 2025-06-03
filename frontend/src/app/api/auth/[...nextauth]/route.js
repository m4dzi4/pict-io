import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const getBackendUrl = () => {
	// Check if running in development mode (not Docker)
	if (process.env.NODE_ENV === "development") {
		return "http://localhost:4000";
	}

	// Otherwise use the environment variable (Docker)
	return process.env.BACKEND_URL || "http://backend:4000";
};

const handler = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			authorization: {
				params: {
					prompt: "consent",
					access_type: "offline",
					response_type: "code",
				},
			},
		}),
	],
	callbacks: {
		async signIn({ user, account, profile }) {
			if (account?.provider === "google") {
				try {
					const backendUrl = getBackendUrl();
					const response = await fetch(`${backendUrl}/api/auth/google`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							googleId: user.id,
							email: user.email,
							name: user.name,
							image: user.image,
						}),
					});

					const result = await response.json();
					if (result.success) {
						user.id = result.user.id;
						user.username = result.user.username;
						user.backendToken = result.token;
						return true;
					}
					console.error("Backend OAuth failed:", result);
					return false;
				} catch (error) {
					console.error("Google sign-in backend error:", error);
					return false;
				}
			}
			return true;
		},
		async jwt({ token, user }) {
			if (user) {
				token.userId = user.id;
				token.username = user.username;
				token.backendToken = user.backendToken;
			}
			return token;
		},
		async session({ session, token }) {
			if (token) {
				session.user.id = token.userId;
				session.user.username = token.username;
				session.user.backendToken = token.backendToken;
			}
			return session;
		},
	},
	events: {
		// Store backend token in localStorage when session is created
		async session({ session }) {
			if (session?.user?.backendToken && typeof window !== "undefined") {
				localStorage.setItem("jwtToken", session.user.backendToken);
				window.dispatchEvent(new CustomEvent("authChange"));
			}
		},
		// Clear localStorage when signing out
		async signOut() {
			if (typeof window !== "undefined") {
				localStorage.removeItem("jwtToken");
				window.dispatchEvent(new CustomEvent("authChange"));
			}
		},
	},
	pages: {
		signIn: "/login",
	},
	session: {
		strategy: "jwt",
	},
	secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
