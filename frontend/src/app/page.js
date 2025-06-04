"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { getApiUrl } from "@/services/api";
import CreateRoom from "./components/CreateRoom";
import Statistics from "./components/Statistics";

export default function HomePage() {
	const [activeRooms, setActiveRooms] = useState([]);
	const [isLoadingRooms, setIsLoadingRooms] = useState(false);
	const [leaderboard, setLeaderboard] = useState([]);
	const [joinRoomCode, setJoinRoomCode] = useState("");
	const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
	const [loggedInUser, setLoggedInUser] = useState(null);
	const [authMessage, setAuthMessage] = useState("");
	const router = useRouter();
	const [showLeaderboard, setShowLeaderboard] = useState(false);
	const apiUrl = getApiUrl();

	// Add this function to fetch leaderboard
	const fetchLeaderboard = async () => {
		try {
			const response = await fetch(`${apiUrl}/api/leaderboard`);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}

			const data = await response.json();
			if (data.success) {
				setLeaderboard(data.leaderboard);
			}
		} catch (error) {
			console.error("Error fetching leaderboard:", error);
		}
	};

	// Optimize the fetch function to avoid unnecessary re-renders
	const fetchActiveRooms = async () => {
		setIsLoadingRooms(true);
		try {
			const response = await fetch(`${apiUrl}/api/rooms/active`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (data.success) {
				console.log("Retrieved active rooms:", data.rooms);
				setActiveRooms(data.rooms);
			} else {
				console.error("Failed to fetch rooms:", data.message);
			}
		} catch (error) {
			console.error("Error fetching rooms:", error);
		} finally {
			setIsLoadingRooms(false);
		}
	};

	// Replace the existing useEffect with this simpler version
	useEffect(() => {
		// Fetch rooms on mount
		fetchActiveRooms();

		// Set up more frequent polling for room updates
		const interval = setInterval(fetchActiveRooms, 5000); // Every 5 seconds

		// Cleanup
		return () => {
			clearInterval(interval);
		};
	}, []);

	// Update useEffect to fetch statistics when the user logs in
	useEffect(() => {
		if (loggedInUser) {
			fetchLeaderboard();
		}
	}, [loggedInUser]);

	const handleRefreshRooms = () => {
		console.log("Refreshing room list...");
		fetchActiveRooms();
	};

	// Add this function to render the leaderboard
	const renderLeaderboard = () => {
		return (
			<div>
				<div
					style={{
						marginBottom: "16px",
					}}
				>
					<h2>Leaderboard</h2>
					<button
						onClick={() => setShowLeaderboard(!showLeaderboard)}
						style={{
							cursor: "pointer",
						}}
					>
						{showLeaderboard ? "Hide" : "Show"}
					</button>
				</div>

				{showLeaderboard && (
					<div
						style={{
							border: "1px solid",
							borderRadius: "8px",
							padding: "16px",
							marginBottom: "24px",
						}}
					>
						<div
							style={{
								fontWeight: "bold",
								display: "grid",
								gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr",
								padding: "8px 0",
								borderBottom: "2px solid #eee",
							}}
						>
							<div>Rank</div>
							<div>Player</div>
							<div>Points</div>
							<div>Games</div>
							<div>Wins</div>
							<div>Win %</div>
						</div>

						<div
							style={{
								height: "250px",
								overflowY: "auto",
							}}
						>
							{leaderboard.map((user, index) => {
								const isCurrentUser =
									loggedInUser && user.username === loggedInUser.username;

								return (
									<div
										key={user.username}
										style={{
											display: "grid",
											gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr",
											padding: "8px 0",
											borderBottom: "1px solid #eee",
											background: isCurrentUser ? "#f0f9ff" : "transparent",
										}}
									>
										<div style={{ fontWeight: "bold" }}>#{index + 1}</div>
										<div>{user.username}</div>
										<div>{user.totalPoints.toLocaleString()}</div>
										<div>{user.gamesPlayed}</div>
										<div>{user.gamesWon}</div>
										<div>{user.winRate}%</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		);
	};

	useEffect(() => {
		const storedToken = localStorage.getItem("jwtToken");
		if (storedToken) {
			try {
				const decodedToken = jwtDecode(storedToken);
				setLoggedInUser({
					username: decodedToken.username,
					userId: decodedToken.userId,
				});
			} catch (error) {
				console.error("Failed to decode token on homepage", error);
				localStorage.removeItem("jwtToken"); // Clear invalid token
			}
		}
		// Listener for auth changes from other pages (e.g., login, logout in TopBar)
		const handleAuthChange = () => {
			const currentToken = localStorage.getItem("jwtToken");
			if (currentToken) {
				try {
					setLoggedInUser(jwtDecode(currentToken));
				} catch {
					setLoggedInUser(null);
				}
			} else {
				setLoggedInUser(null);
			}
		};
		window.addEventListener("authChange", handleAuthChange);
		return () => window.removeEventListener("authChange", handleAuthChange);
	}, []);

	const handleLogout = () => {
		localStorage.removeItem("jwtToken");
		setLoggedInUser(null);
		setAuthMessage("Logged out.");
		window.dispatchEvent(new CustomEvent("authChange")); // Notify TopBar
		router.push("/login"); // Or stay on page, depending on desired UX
	};

	const handleConfigureRoomClick = () => {
		if (!loggedInUser) {
			router.push("/login?redirect=/"); // Redirect to login if not authenticated
			return;
		}
		setShowCreateRoomModal(true);
	};

	const renderActiveRooms = () => (
		<div className="room-list">
			<h2>Active Games</h2>
			{isLoadingRooms && <div>Loading rooms...</div>}

			{activeRooms.length === 0 && !isLoadingRooms && (
				<div>No active games found. Create one to get started!</div>
			)}

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
					gap: "16px",
					margin: "16px 0",
				}}
			>
				{activeRooms.map((room) => (
					<div key={room.roomId}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								marginBottom: "8px",
							}}
						>
							<span>
								Room: {room.roomId}
								{room.isPrivate && <span>🔒 Private</span>}
							</span>
							<span>
								{room.currentStatus === "playing" ? "In progress" : "Waiting"}
							</span>
						</div>

						<div style={{ margin: "4px 0" }}>
							<div>Host: {room.ownerName || "Unknown"}</div>
							<div>
								Players: {room.playerCount}/{room.maxPlayers}
							</div>
							<div>
								Mode:{" "}
								{room.gameMode === "rounds"
									? `${room.maxRounds} rounds`
									: `First to ${room.pointsToWin} points`}
							</div>
							<div>
								Drawer selection: {getDrawerModeLabel(room.drawerChoice)}
							</div>
						</div>

						<div style={{ marginTop: "12px" }}>
							<button
								onClick={() => handleJoinActiveRoom(room)}
								disabled={room.isFull}
								style={{
									cursor: room.isFull ? "not-allowed" : "pointer",
								}}
							>
								{room.isFull
									? "Room Full"
									: room.isPrivate
									? "Join (Requires Code)"
									: "Join Game"}
							</button>
						</div>
					</div>
				))}
			</div>

			<button
				onClick={handleRefreshRooms}
				style={{
					cursor: "pointer", // Add this to show it's clickable
				}}
			>
				Refresh Room List
			</button>
		</div>
	);

	// Helper function to get a user-friendly label for drawer mode
	const getDrawerModeLabel = (mode) => {
		switch (mode) {
			case "random":
				return "Random";
			case "queue":
				return "Queue";
			case "winner":
				return "Winner → Drawer";
			default:
				return mode;
		}
	};

	// Function to handle joining an active room
	const handleJoinActiveRoom = (room) => {
		if (room.isPrivate) {
			setJoinRoomCode(room.roomId);
			// Open modal for access code if needed
			// You can implement this part
		} else {
			router.push(`/game/${room.roomId}`);
		}
	};

	const handleJoinRoomWithCode = async () => {
		if (!joinRoomCode.trim()) {
			alert("Please enter a room code.");
			return;
		}
		try {
			const response = await fetch(
				`${apiUrl}/api/rooms/validate/${joinRoomCode.trim()}`
			);
			const data = await response.json();
			if (data.success) {
				// Navigate to the dynamic game route
				// If private, game page will need to ask for access code before emitting 'join_room' to socket
				router.push(
					`/game/${data.roomId}${data.isPrivate ? "?private=true" : ""}`
				);
			} else {
				alert("Failed to join room: " + (data.message || "Invalid room code."));
			}
		} catch (error) {
			console.error("Join room fetch error:", error);
			alert("Failed to validate room code. Please try again.");
		}
	};

	return (
		<div>
			
			{loggedInUser && <div>Welcome, {loggedInUser.username}!</div>}
			{authMessage && <div>{authMessage}</div>}
			<Statistics loggedInUser={loggedInUser} />
			<div>
				<h2>Create New Room</h2>
				<button onClick={handleConfigureRoomClick}>
					Configure & Create Room
				</button>
			</div>

			<div>
				<h2>Join Existing Room With Code</h2>
				<input
					type="text"
					value={joinRoomCode}
					onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
					placeholder="Enter room code..."
				/>
				<button onClick={handleJoinRoomWithCode}>Join</button>
			</div>

			<div>{renderActiveRooms()}</div>

			<div>{renderLeaderboard()}</div>

			{showCreateRoomModal && (
				<CreateRoom 
					loggedInUser={loggedInUser}
					onClose={() => setShowCreateRoomModal(false)}
				/>
			)}
		</div>
	);
}
