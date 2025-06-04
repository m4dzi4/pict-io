"use client";
import { SessionProvider } from "next-auth/react";
import TopBar from "./components/TopBar.jsx"; // Import the TopBar
import AuthSync from "./components/AuthSync";
import "./globals.css"; // Assuming you have global styles
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
})

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
