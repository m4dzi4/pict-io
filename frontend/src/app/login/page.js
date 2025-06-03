"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { getApiUrl } from "@/services/api";
import Link from "next/link";
import styles from "./Login.module.css";

// Create a client component that uses search params
function LoginForm() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session, status } = useSession();
	const apiUrl = getApiUrl();

	useEffect(() => {
		if (searchParams.get("registered") === "true") {
			setMessage("Registration successful! Please log in.");
		}
		if (searchParams.get("redirect")) {
			setMessage("Please log in to continue.");
		}

		// Check if already logged in
		const checkAuth = async () => {
			// Don't proceed if NextAuth is still loading
			if (status === "loading") return;

			const jwtToken = localStorage.getItem("jwtToken");

			if (session || jwtToken) {
				console.log("User is logged in, redirecting...");
				const redirectUrl = searchParams.get("redirect") || "/";
				router.push(redirectUrl);
			}
		};

		checkAuth();
	}, [searchParams, router, session, status]);

	// Handle successful Google sign-in
	useEffect(() => {
		if (session && session.user) {
			console.log("Google sign-in successful:", session.user);
			setMessage("Google sign-in successful! Redirecting...");

			// Trigger auth change event for other components
			window.dispatchEvent(new CustomEvent("authChange"));

			const redirectUrl = searchParams.get("redirect") || "/";
			router.push(redirectUrl);
		}
	}, [session, router, searchParams]);

	const handleLogin = async (e) => {
		e.preventDefault();
		setMessage("");
		if (!username || !password) {
			setMessage("Username and password are required.");
			return;
		}
	const handleLogin = async (e) => {
		e.preventDefault();
		setMessage("");
		if (!username || !password) {
			setMessage("Username and password are required.");
			return;
		}

		try {
			const response = await fetch(`${apiUrl}/api/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			const data = await response.json();
			setMessage(data.message);
			if (data.success && data.token) {
				localStorage.setItem("jwtToken", data.token);
				window.dispatchEvent(new CustomEvent("authChange"));
				const redirectUrl = searchParams.get("redirect") || "/";
				router.push(redirectUrl);
			}
		} catch (error) {
			console.error("Login fetch error:", error);
			setMessage("Login failed. Please try again.");
		}
	};

	const handleGoogleSignIn = async () => {
		try {
			setMessage("Signing in with Google...");
			const redirectUrl = searchParams.get("redirect") || "/";
			const result = await signIn("google", {
				callbackUrl: redirectUrl,
				redirect: true,
			});

			if (result?.error) {
				console.error("Google sign-in error:", result.error);
				setMessage("Google sign-in failed. Please try again.");
			}
		} catch (error) {
			console.error("Google sign-in error:", error);
			setMessage("Google sign-in failed. Please try again.");
		}
	};
	const handleGoogleSignIn = async () => {
		try {
			setMessage("Signing in with Google...");
			const redirectUrl = searchParams.get("redirect") || "/";
			const result = await signIn("google", {
				callbackUrl: redirectUrl,
				redirect: true,
			});

			if (result?.error) {
				console.error("Google sign-in error:", result.error);
				setMessage("Google sign-in failed. Please try again.");
			}
		} catch (error) {
			console.error("Google sign-in error:", error);
			setMessage("Google sign-in failed. Please try again.");
		}
	};

	// Show loading state while NextAuth is loading
	if (status === "loading") {
		return <div>Loading...</div>;
	}

	return (
		<div className={styles.container}>
			<div className={styles.loginCard}>
				<h1 className={styles.title}>Welcome Back</h1>

				<button onClick={handleGoogleSignIn} className={styles.googleButton}>
					<span className={styles.googleIcon}>🔗</span>
					Sign in with Google
				</button>

				<div className={styles.divider}>
					<span>or</span>
				</div>

				<form onSubmit={handleLogin} className={styles.form}>
					<div className={styles.field}>
						<label htmlFor="username" className={styles.label}>
							Username
						</label>
						<input
							type="text"
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Enter your username"
							className={styles.input}
							required
						/>
					</div>

					<div className={styles.field}>
						<label htmlFor="password" className={styles.label}>
							Password
						</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							className={styles.input}
							required
						/>
					</div>

					<button type="submit" className={styles.loginButton}>
						Login
					</button>
				</form>

				{message && <p className={styles.message}>{message}</p>}

				<p className={styles.registerLink}>
					Don't have an account?{" "}
					<Link href="/register">Register here</Link>
				</p>
			</div>
		</div>
	);
}// Main login page component with suspense boundary
export default function LoginPage() {
	return (
		<div>
			<Suspense fallback={<div>Loading...</div>}>
				<LoginForm />
			</Suspense>
		</div>
	);
}

