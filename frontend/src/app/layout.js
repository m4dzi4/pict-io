"use client";
import { SessionProvider } from "next-auth/react";
import TopBar from "./components/topbar"; // Import the TopBar
import AuthSync from "./components/AuthSync";
import "./globals.css"; // Assuming you have global styles

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<head>
				<title>Pict-IO Game</title>
				<meta
					name="description"
					content="Real-time drawing and guessing game."
				/>
			</head>
			<body>
				<SessionProvider>
					<AuthSync />
					<TopBar />
					<main>{children}</main>
					<footer>
						<p>
							&copy; {new Date().getFullYear()} Pict-io. All rights reserved.
						</p>
					</footer>
				</SessionProvider>
			</body>
		</html>
	);
}
