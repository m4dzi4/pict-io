// filepath: d:\SUMMER 2025 POLIBUDA\Advanced Web Tech\pict-io\frontend\src\app\components\topbar.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { jwtDecode } from "jwt-decode";

export default function TopBar() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [jwtUser, setJwtUser] = useState(null);

	useEffect(() => {
		// Check for JWT token if no NextAuth session
		const token = localStorage.getItem("jwtToken");
		if (token && !session) {
			try {
				const decoded = jwtDecode(token);
				setJwtUser(decoded);
			} catch {
				localStorage.removeItem("jwtToken");
				setJwtUser(null);
			}
		} else if (session) {
			setJwtUser(null); // Clear JWT user if NextAuth session exists
		}

		// Listen for auth changes
		const handler = () => {
			const token = localStorage.getItem("jwtToken");
			if (token && !session) {
				try {
					setJwtUser(jwtDecode(token));
				} catch {
					setJwtUser(null);
				}
			} else {
				setJwtUser(null);
			}
		};

		window.addEventListener("authChange", handler);
		return () => window.removeEventListener("authChange", handler);
	}, [session]);

	const currentUser = session?.user || jwtUser;
	const isLoggedIn = !!(session || jwtUser);

	const handleSignOut = async () => {
		try {
			// Clear localStorage first
			localStorage.removeItem("jwtToken");
			setJwtUser(null);

			if (session) {
				// Sign out from NextAuth
				await signOut({
					callbackUrl: "/login",
					redirect: false, // Don't auto-redirect, we'll handle it
				});
			}

			// Dispatch auth change event
			window.dispatchEvent(new CustomEvent("authChange"));

			// Force redirect to login
			router.push("/login");
			router.refresh(); // Force page refresh to clear any cached state
		} catch (error) {
			console.error("Logout error:", error);
			// Force clear everything and redirect anyway
			localStorage.clear();
			router.push("/login");
			window.location.reload(); // Nuclear option - full page reload
		}
	};

	// Don't render anything while loading
	if (status === "loading") {
		return (
			<nav>
				<div>Loading...</div>
			</nav>
		);
	}

	return (
		<nav>
			<div>
				<Link href="/">Home</Link>
				{isLoggedIn ? (
					<button onClick={handleSignOut}> Sign Out </button>
				) : (
					<>
						<Link href="/login">Login</Link>
						<Link href="/register">Register</Link>
					</>
				)}
			</div>
		</nav>
	);
}
