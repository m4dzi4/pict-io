"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

// let socketClient = null; // Remove

export default function HomePage() {
	const [activeRooms, setActiveRooms] = useState([]);
	const [isLoadingRooms, setIsLoadingRooms] = useState(false);
	const [leaderboard, setLeaderboard] = useState([]);
	const [joinRoomCode, setJoinRoomCode] = useState("");
	const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
	const [newRoomSettings, setNewRoomSettings] = useState({
		maxPlayers: 8,
		isPrivate: false,
		accessCode: "", //new comment
		gameMode: "rounds", // 'rounds' or 'points'
		maxRounds: 5, // Default 5 rounds
		pointsToWin: 25, // Default 3 points to win (for points mode)
		roundDuration: 60, // Default 60 seconds per round
		drawerChoice: "random", // 'random' or 'queue' or 'winner'
	});

	const [loggedInUser, setLoggedInUser] = useState(null);
	const [authMessage, setAuthMessage] = useState("");
	const router = useRouter();
	const [userStatistics, setUserStatistics] = useState(null);
	const [showLeaderboard, setShowLeaderboard] = useState(false);

	// Add this function to fetch user statistics
	const fetchUserStatistics = async () => {
		if (!loggedInUser) return;

		try {
			const token = localStorage.getItem("jwtToken");
			const response = await fetch(
				`${process.env.BACKEND_URL}/api/user/statistics`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}

			const data = await response.json();
			if (data.success) {
				setUserStatistics(data.statistics);
			}
		} catch (error) {
			console.error("Error fetching user statistics:", error);
		}
	};

	// Add this function to fetch leaderboard
	const fetchLeaderboard = async () => {
		try {
			const response = await fetch(
				`${process.env.BACKEND_URL}/api/leaderboard`
			);

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
			const response = await fetch(
				`${process.env.BACKEND_URL}/api/rooms/active`
			);
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
			fetchUserStatistics();
		}

		fetchLeaderboard();
	}, [loggedInUser]);

	const handleRefreshRooms = () => {
		console.log("Refreshing room list...");
		fetchActiveRooms();
	};

	// Add this function to render user statistics
	const renderUserStatistics = () => {
		if (!loggedInUser || !userStatistics) return null;

		return (
			<div>
				<h3>Your Statistics</h3>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
						gap: "16px",
					}}
				>
					<div>
						<div>{userStatistics.gamesPlayed}</div>
						<div style={{ fontSize: "14px" }}>Games Played</div>
					</div>
					<div>
						<div>{userStatistics.gamesWon}</div>
						<div style={{ fontSize: "14px" }}>Games Won</div>
					</div>
					<div>
						<div>{userStatistics.totalPoints.toLocaleString()}</div>
						<div style={{ fontSize: "14px" }}>Total Points</div>
					</div>
					<div>
						<div>{userStatistics.winRate}%</div>
						<div style={{ fontSize: "14px" }}>Win Rate</div>
					</div>
					<div>
						<div>{userStatistics.pointsPerGame}</div>
						<div style={{ fontSize: "14px" }}>Points/Game</div>
					</div>
				</div>
			</div>
		);
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

	const handleCreateRoom = async () => {
		const token = localStorage.getItem("jwtToken");
		if (!token) {
			alert("Please log in to create a room.");
			router.push("/login?redirect=/");
			return;
		}

		// Validate settings before submitting
		if (newRoomSettings.isPrivate && !newRoomSettings.accessCode.trim()) {
			alert("Please enter an access code for private rooms");
			return;
		}

		if (
			newRoomSettings.gameMode === "rounds" &&
			(newRoomSettings.maxRounds < 1 || newRoomSettings.maxRounds > 20)
		) {
			alert("Max rounds must be between 1 and 20");
			return;
		}

		if (
			newRoomSettings.gameMode === "points" &&
			(newRoomSettings.pointsToWin < 25 || newRoomSettings.pointsToWin > 100)
		) {
			alert("Points to win must be between 25 and 100");
			return;
		}

		if (
			newRoomSettings.roundDuration < 30 ||
			newRoomSettings.roundDuration > 300
		) {
			alert("Round duration must be between 30 and 300 seconds");
			return;
		}

		try {
			const response = await fetch(
				`${process.env.BACKEND_URL}/api/rooms/create`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ settings: newRoomSettings }),
				}
			);
			const data = await response.json();
			if (data.success && data.roomId) {
				console.log("Room created via API:", data.roomId);
				// Navigate to the dynamic game route
				router.push(`/game/${data.roomId}`);
			} else {
				alert("Failed to create room: " + (data.message || "Unknown error"));
				if (data.message && data.message.toLowerCase().includes("token")) {
					localStorage.removeItem("jwtToken");
					setLoggedInUser(null);
					window.dispatchEvent(new CustomEvent("authChange"));
					router.push("/login");
				}
			}
		} catch (error) {
			console.error("Create room fetch error:", error);
			alert("Failed to create room. Please try again.");
		}
		setShowCreateRoomModal(false);
	};

	const handleJoinRoomWithCode = async () => {
		if (!joinRoomCode.trim()) {
			alert("Please enter a room code.");
			return;
		}
		try {
			const response = await fetch(
				`${process.env.BACKEND_URL}/api/rooms/validate/${joinRoomCode.trim()}`
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
			<h1>Pict-IO</h1>
			{loggedInUser && <div>Welcome, {loggedInUser.username}!</div>}
			{authMessage && <div>{authMessage}</div>}
			{renderUserStatistics()}
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
				<div>
					<h3>Create Room Settings</h3>
					<div>
						<label>
							Max Players:
							<input
								type="number"
								value={newRoomSettings.maxPlayers}
								onChange={(e) =>
									setNewRoomSettings((prev) => ({
										...prev,
										maxPlayers: parseInt(e.target.value, 10) || 2,
									}))
								}
								min="2"
								max="16"
							/>
						</label>
					</div>
					<div>
						<label>
							Game Mode:
							<select
								value={newRoomSettings.gameMode}
								onChange={(e) =>
									setNewRoomSettings((prev) => ({
										...prev,
										gameMode: e.target.value,
									}))
								}
							>
								<option value="rounds">Fixed Number of Rounds</option>
								<option value="points">First to X Points</option>
							</select>
						</label>
					</div>
					{newRoomSettings.gameMode === "rounds" ? (
						<div>
							<label>
								Number of Rounds:
								<input
									type="number"
									value={newRoomSettings.maxRounds}
									onChange={(e) =>
										setNewRoomSettings((prev) => ({
											...prev,
											maxRounds: parseInt(e.target.value, 10) || 1,
										}))
									}
									min="1"
									max="20"
								/>
							</label>
						</div>
					) : (
						<div>
							<label>
								Points to Win:
								<input
									type="number"
									value={newRoomSettings.pointsToWin}
									onChange={(e) =>
										setNewRoomSettings((prev) => ({
											...prev,
											pointsToWin: parseInt(e.target.value, 10) || 1,
										}))
									}
									min="25"
									max="100"
								/>
							</label>
						</div>
					)}
					<div>
						<label>
							Round Time Limit (seconds):
							<input
								type="number"
								value={newRoomSettings.roundDuration}
								onChange={(e) =>
									setNewRoomSettings((prev) => ({
										...prev,
										roundDuration: parseInt(e.target.value, 10) || 30,
									}))
								}
								min="30"
								max="300"
								step="10"
							/>
						</label>
					</div>
					<div>
						<label>
							Drawer Selection Method:
							<select
								value={newRoomSettings.drawerChoice}
								onChange={(e) =>
									setNewRoomSettings((prev) => ({
										...prev,
										drawerChoice: e.target.value,
									}))
								}
							>
								<option value="random">Random Each Round</option>
								<option value="queue">Take Turns in Queue</option>
								<option value="winner">Winner Becomes Drawer</option>
							</select>
						</label>
					</div>
					<div>
						<label>
							<input
								type="checkbox"
								checked={newRoomSettings.isPrivate}
								onChange={(e) =>
									setNewRoomSettings((prev) => ({
										...prev,
										isPrivate: e.target.checked,
										accessCode: e.target.checked ? prev.accessCode : "",
									}))
								}
							/>
							Private Room
						</label>
					</div>
					{newRoomSettings.isPrivate && (
						<div>
							<label>
								Access Code:
								<input
									type="text"
									value={newRoomSettings.accessCode}
									onChange={(e) =>
										setNewRoomSettings((prev) => ({
											...prev,
											accessCode: e.target.value.toUpperCase(),
										}))
									}
									placeholder="e.g., MYCODE"
								/>
							</label>
						</div>
					)}
					<button onClick={() => setShowCreateRoomModal(false)}>Cancel</button>
					<button onClick={handleCreateRoom}>Create & Start</button>
				</div>
			)}
		</div>
	);
}
