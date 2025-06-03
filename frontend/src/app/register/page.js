"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const router = useRouter();

	const handleRegister = async (e) => {
		e.preventDefault();
		setMessage("");
		if (!username || !password) {
			setMessage("Username and password are required.");
			return;
		}
		if (password.length < 6) {
			setMessage("Password must be at least 6 characters long.");
			return;
		}

		try {
			const response = await fetch(`${process.env.BACKEND_URL}/api/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			const data = await response.json();
			setMessage(data.message);
			if (data.success) {
				console.log("Registration successful:", data.user);
				setTimeout(() => {
					router.push("/login?registered=true");
				}, 1500);
			}
		} catch (error) {
			console.error("Registration fetch error:", error);
			setMessage("Registration failed. Please try again.");
		}
	};

	return (
		<div>
			<div>
				<h1>Create Account</h1>
				<form onSubmit={handleRegister}>
					<div className="mb-4">
						<label htmlFor="username">Username</label>
						<input
							type="text"
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Choose a username"
							required
						/>
					</div>
					<div>
						<label htmlFor="password">Password</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Choose a password (min. 6 characters)"
							required
						/>
					</div>
					<button
						type="submit"
						className="w-full py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors duration-150"
					>
						Register
					</button>
				</form>
				{message && <p>{message}</p>}
				<p>
					Already have an account? <Link href="/login">Login here</Link>
				</p>
			</div>
		</div>
	);
}
