"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function AuthSync() {
	const { data: session, status } = useSession();

	useEffect(() => {
		if (session?.user?.backendToken) {
			// Store NextAuth backend token in localStorage
			localStorage.setItem("jwtToken", session.user.backendToken);
			window.dispatchEvent(new CustomEvent("authChange"));
		} else if (status === "unauthenticated") {
			// Clear localStorage if NextAuth session is gone
			const existingToken = localStorage.getItem("jwtToken");
			if (existingToken) {
				localStorage.removeItem("jwtToken");
				window.dispatchEvent(new CustomEvent("authChange"));
			}
		}
	}, [session, status]);

	return null; // This component doesn't render anything
}
