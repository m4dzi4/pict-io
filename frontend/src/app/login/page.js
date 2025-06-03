"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react"; // Add useSession import
import Link from "next/link";

export default function LoginPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();

	// Add the useSession hook
	const { data: session, status } = useSession();

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
	}, [searchParams, router, session, status]); // Add session and status as dependencies

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

		try {
			const response = await fetch(`${process.env.BACKEND_URL}/api/login`, {
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

	// Show loading state while NextAuth is loading
	if (status === "loading") {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<div>
				<h1>Login</h1>

				<button onClick={handleGoogleSignIn}>Sign in with Google</button>

				<p>or</p>

				<form onSubmit={handleLogin}>
					<div className="mb-4">
						<label htmlFor="username">Username</label>
						<input
							type="text"
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Enter your username"
							required
						/>
					</div>
					<div className="mb-6">
						<label htmlFor="password">Password</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							required
						/>
					</div>
					<button type="submit">Login</button>
				</form>

				{message && <p>{message}</p>}

				<p>
					<Link href="/register">Register here</Link>
				</p>
			</div>
		</div>
	);
}
