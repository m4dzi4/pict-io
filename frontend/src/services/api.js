export const getApiUrl = () => {
	return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
};

export async function validateRoom(roomCode) {
	try {
		const apiUrl = getApiUrl();
		const response = await fetch(
			`${apiUrl}/api/rooms/validate/${roomCode.trim()}`
		);
		return await response.json();
	} catch (error) {
		console.error("Error validating room:", error);
		return { success: false, message: "Network error" };
	}
}

export async function createRoom(settings, token) {
	try {
		const apiUrl = getApiUrl();
		const response = await fetch(`${apiUrl}/api/rooms/create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ settings }),
		});
		return await response.json();
	} catch (error) {
		console.error("Error creating room:", error);
		return { success: false, message: "Network error" };
	}
}
