"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import io from "socket.io-client";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { jwtDecode } from "jwt-decode";
import GameEndPopup from "../../components/GameEndPopup";

export default function GamePage() {
	// TODO: Change logic to rely on the game object in memory.
	// Game state variables stored inside a copy of the game object from backend
	const [game, setGame] = useState({});
	const [currentSocketId, setCurrentSocketId] = useState(null);

	// Canvas variables
	const canvasRef = useRef(null);
	const socketRef = useRef(null);
	const [eraseMode, setEraseMode] = useState(false);
	const [strokeWidth, setStrokeWidth] = useState(5);
	const [eraserWidth, setEraserWidth] = useState(10);
	const [strokeColor, setStrokeColor] = useState("#000000");
	const [canvasColor, setCanvasColor] = useState("#ffffff");

	// Routing variables
	const router = useRouter();
	const params = useParams();
	const queryParams = useSearchParams();

	// Game and chat variables
	const [roomId, setRoomId] = useState(null);
	const [isDrawer, setIsDrawer] = useState(false);
	const [isRoomOwner, setIsRoomOwner] = useState(false);
	const [roomOwner, setRoomOwner] = useState(null);
	const isDrawerRef = useRef(isDrawer); // Ref to hold the latest isDrawer state for callbacks
	const [loggedInUser, setLoggedInUser] = useState(null);
	const [accessCodeInput, setAccessCodeInput] = useState("");
	const [requiresAccessCode, setRequiresAccessCode] = useState(false);
	const [joinedRoom, setJoinedRoom] = useState(false);
	const [chatMessages, setChatMessages] = useState([]);
	const [chatInput, setChatInput] = useState("");
	const [canStartGame, setCanStartGame] = useState(true);
	const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
	const [roundEndTime, setRoundEndTime] = useState(null);
	const [secondsLeft, setSecondsLeft] = useState(null);
	const timerIntervalRef = useRef(null);
	const [nextRoundSeconds, setNextRoundSeconds] = useState(null);
	const nextRoundTimerRef = useRef(null);
	const [drawerQueue, setDrawerQueue] = useState([]);
	const [isInQueue, setIsInQueue] = useState(false);
	const [queueMessage, setQueueMessage] = useState("");
	const [gameEndData, setGameEndData] = useState(null);
	const [wordChoices, setWordChoices] = useState([]);
	const [wordChoiceDeadline, setWordChoiceDeadline] = useState(null);
	const [wordChoiceTimeLeft, setWordChoiceTimeLeft] = useState(null);
	const wordChoiceTimerRef = useRef(null);

	// function to retrieve roomID
	useEffect(() => {
		setRoomId(params.roomId);
		const newSocket = io("http://localhost:4000");
		socketRef.current = newSocket;

		newSocket.on("connect", () => {
			setCurrentSocketId(newSocket.id); // Signal that socket is connected and ready
		});

		newSocket.on("disconnect", () => {
			socketRef.current = null;
			setCurrentSocketId(null);
		});

		// connect, disconnect
		// game started, new round, time is over
		// chat message
		// join room, leave room

		newSocket.on("game_started", () => {
			// Only add one system message - don't add messages about the word here
			setChatMessages((prev) => [
				...prev,
				{
					user: "System",
					text: "The game has started!",
					type: "game_event",
				},
			]);
		});

		newSocket.on("update_game", (data) => {
			setGame((prev) => ({
				...prev,
				players: data.players,
				drawerId: data.drawerId,
				drawingPaths: data.drawingPaths,
			}));
		});

		newSocket.on("end_round", (data) => {
			setRoundEndTime(null);
			setSecondsLeft(null);
			clearInterval(timerIntervalRef.current);
			setGame((prev) => ({
				...prev,
				gameStatus: data.gameStatus,
			}));
			setNextRoundSeconds(3); // 3 seconds until next round
			nextRoundTimerRef.current = setInterval(() => {
				setNextRoundSeconds((prev) => {
					if (prev === 1) {
						clearInterval(nextRoundTimerRef.current);
						return null;
					}
					return prev - 1;
				});
			}, 1000);
		});

		newSocket.on("new_round", (data) => {
			if (nextRoundTimerRef.current) {
				clearInterval(nextRoundTimerRef.current);
				setNextRoundSeconds(null);
			}
			// Clear word choice state
			setWordChoices([]);
			setWordChoiceDeadline(null);
			setWordChoiceTimeLeft(null);

			setGame((prev) => ({
				...prev,
				drawingPaths: [],
				currentRound: data.currentRound,
				drawerId: data.drawerId,
				keyword: data.keyword,
				maxRounds: data.maxRounds,
				gameStatus: data.gameStatus,
			}));
			data.drawerId === newSocket.id ? setIsDrawer(true) : setIsDrawer(false);
			setHasGuessedCorrectly(false);
			setRoundEndTime(data.roundEndTime);
			if (canvasRef.current) {
				canvasRef.current.resetCanvas();
			}
		});

		newSocket.on("choose_word", (data) => {
			setWordChoices(data.wordChoices);
			setWordChoiceDeadline(data.deadline);
			setGame((prev) => ({ ...prev, gameStatus: "choosing_word" }));
		});

		newSocket.on("round_preparation", (data) => {
			setGame((prev) => ({
				...prev,
				currentRound: data.currentRound,
				maxRounds: data.maxRounds,
				drawerId: data.drawerId,
				gameStatus: data.gameStatus,
			}));

			const newIsDrawer = data.drawerId === newSocket.id;
			setIsDrawer(newIsDrawer);
			isDrawerRef.current = newIsDrawer;

			// Clear previous word choices if not the drawer
			if (!newIsDrawer) {
				setWordChoices([]);
				setWordChoiceDeadline(null);
			}
		});

		newSocket.on("new_keyword", (data) => {
			setGame((prev) => ({
				...prev,
				keyword: data.keyword,
			}));
		});

		// OK
		newSocket.on("new_chat_message", (data) => {
			setChatMessages((prevMessages) => [...prevMessages, data]);
		});

		newSocket.on("update_guessed", () => {
			setHasGuessedCorrectly(true);
		});

		// OK
		newSocket.on("drawing_data_broadcast", (data) => {
			if (!isDrawerRef.current && canvasRef.current) {
				// Use ref for current isDrawer status
				canvasRef.current.clearCanvas();
				canvasRef.current.loadPaths(data.paths);
			}
		});

		newSocket.on("drawer_queue_updated", (data) => {
			setDrawerQueue(data.drawerQueue);

			// Check if current player is in queue
			const currentPlayerInQueue = data.drawerQueue.some(
				(player) => player.socketId === currentSocketId
			);
			setIsInQueue(currentPlayerInQueue);
		});

		newSocket.on("game_ended", (data) => {
			console.log("Game ended with data:", data);
			setGameEndData(data);
		});

		newSocket.on("room_destroyed", () => {
			alert(
				"The room owner has closed this room. You will be redirected to the home page."
			);
			router.push("/");
		});

		// Cleanup all event listeners and disconnect socket
		return () => {
			newSocket.off("game_started");
			newSocket.off("update_game");
			newSocket.off("end_round");
			newSocket.off("new_round");
			newSocket.off("new_keyword");
			newSocket.off("new_chat_message");
			newSocket.off("update_guessed");
			newSocket.off("drawing_data_broadcast");
			newSocket.off("game_ended");
			newSocket.off("room_destroyed");
			newSocket.off("drawer_queue_updated");
			newSocket.off("choose_word");
			newSocket.off("round_preparation");

			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
				setCurrentSocketId(null);
			}
		};
	}, [params.roomId]); // Only re-run if roomId changes or on mount/unmount

	// Add word choice timer effect
	useEffect(() => {
		if (!wordChoiceDeadline) {
			setWordChoiceTimeLeft(null);
			if (wordChoiceTimerRef.current) {
				clearInterval(wordChoiceTimerRef.current);
			}
			return;
		}

		function updateWordChoiceTimer() {
			const now = Date.now();
			const diff = Math.max(0, Math.floor((wordChoiceDeadline - now) / 1000));
			setWordChoiceTimeLeft(diff);

			if (diff === 0) {
				clearInterval(wordChoiceTimerRef.current);
			}
		}

		updateWordChoiceTimer();
		wordChoiceTimerRef.current = setInterval(updateWordChoiceTimer, 1000);

		return () => {
			if (wordChoiceTimerRef.current) {
				clearInterval(wordChoiceTimerRef.current);
			}
		};
	}, [wordChoiceDeadline]);

	// Local timer for countdown display
	useEffect(() => {
		if (!roundEndTime) {
			setSecondsLeft(null);
			return;
		}
		function updateTimer() {
			const now = Date.now();
			const diff = Math.max(0, Math.floor((roundEndTime - now) / 1000));
			setSecondsLeft(diff);
		}
		updateTimer();
		timerIntervalRef.current = setInterval(updateTimer, 250);
		return () => clearInterval(timerIntervalRef.current);
	}, [roundEndTime]);

	useEffect(() => {
		if (!isDrawer) {
			setGame((prev) => ({
				...prev,
				drawingPaths: [],
				keyword: null,
			}));
		}
		isDrawerRef.current = isDrawer;
	}, [isDrawer]); // Only re-run if isDrawer changes

	useEffect(() => {
		// Only update for guessers (not the drawer)
		if (!isDrawer && canvasRef.current && game.drawingPaths) {
			canvasRef.current.clearCanvas();
			if (game.drawingPaths.length > 0) {
				canvasRef.current.loadPaths(game.drawingPaths);
			}
		}
	}, [game.drawingPaths, isDrawer]);

	// should be handled by backend?
	useEffect(() => {
		const token = localStorage.getItem("jwtToken");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				setLoggedInUser({ username: decoded.username, userId: decoded.userId });
				decoded.userId === game.ownerId
					? setIsRoomOwner(true)
					: setIsRoomOwner(false);
			} catch (e) {
				console.error("Failed to decode token on game page", e);
				localStorage.removeItem("jwtToken");
			}
		}

		// Determine if access code is required
		const isPrivateRoom = queryParams.get("private") === "true";
		if (roomId && isPrivateRoom && !joinedRoom && !accessCodeInput.trim()) {
			// If private, not joined, and no code entered yet
			setRequiresAccessCode(true);
		} else {
			setRequiresAccessCode(false); // Not private, or already joined, or code has been input
		}

		// Attempt to join if conditions are met
		if (currentSocketId && roomId && !joinedRoom) {
			// Check currentSocketId to ensure socket is connected
			if (!isPrivateRoom || (isPrivateRoom && accessCodeInput.trim())) {
				// If not private, or private and code is provided
				attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
			}
		}
	}, [roomId, currentSocketId, joinedRoom, queryParams]);

	// OK
	const handleStartGame = () => {
		if (
			isRoomOwner &&
			socketRef.current &&
			socketRef.current.connected &&
			roomId
		) {
			socketRef.current.emit("start_game", { roomId }, (response) => {
				setGame((prev) => ({
					...prev,
					gameStatus: response.gameStatus,
				}));
			});
			setCanStartGame(false);
		}
	};

	// Add word selection handler
	const handleWordSelection = (selectedWord) => {
		if (!socketRef.current || !roomId) return;

		socketRef.current.emit(
			"select_word",
			{ roomId, selectedWord },
			(response) => {
				if (!response.success) {
					console.error("Failed to select word:", response.message);
				}
			}
		);
	};

	// Helper function to get difficulty label
	const getDifficultyLabel = (difficulty) => {
		const labels = {
			1: "Easy",
			2: "Medium",
			3: "Hard",
			4: "Very Hard",
			5: "Expert",
		};
		return labels[difficulty] || "Unknown";
	};

	// Helper function to get difficulty color
	const getDifficultyColor = (difficulty) => {
		const colors = {
			1: "#4caf50", // Green
			2: "#ff9800", // Orange
			3: "#f44336", // Red
			4: "#9c27b0", // Purple
			5: "#e91e63", // Pink
		};
		return colors[difficulty] || "#666";
	};

	const attemptJoinRoom = (socketInstance, rId, token, code) => {
		if (!socketInstance || !socketInstance.connected) {
			console.warn("AttemptJoinRoom called but socket not connected.");
			return;
		}
		socketInstance.emit(
			"join_room",
			{
				roomId: rId,
				token: token,
				accessCode: code,
			},
			(response) => {
				if (response.success) {
					setJoinedRoom(true);
					setRequiresAccessCode(false);
					setChatMessages((prev) => [
						...prev,
						{ user: "System", text: `You joined room ${rId}.` },
					]);
					setGame(response.game);
					if (response.game.gameStatus === "playing") {
						setRoundEndTime(response.game.roundEndTime);
						if (canvasRef.current && response.game.drawingPaths) {
							canvasRef.current.clearCanvas();
							if (response.game.drawingPaths.length > 0) {
								canvasRef.current.loadPaths(response.game.drawingPaths);
							}
						}
					}
				} else {
					alert(`Failed to join room: ${response.message}`);
					setJoinedRoom(false); // Ensure joinedRoom is false on failure
					if (!token && response.message?.toLowerCase().includes("token")) {
						router.push(`/login?redirect=/game/${rId}`);
					} else if (response.message?.toLowerCase().includes("access code")) {
						setRequiresAccessCode(true); // Re-prompt if code was wrong
						setAccessCodeInput(""); // Clear wrong code
					} else if (response.message?.toLowerCase().includes("full")) {
						router.push("/"); // Room is full, go to homepage
					} else if (
						response.message?.toLowerCase().includes("not found") ||
						response.message?.toLowerCase().includes("not exist")
					) {
						router.push("/"); // Room doesn't exist or not active
					}
				}
			}
		);
	};

	const handleAccessCodeSubmit = (e) => {
		e.preventDefault();
		if (
			socketRef.current &&
			socketRef.current.connected &&
			roomId &&
			accessCodeInput.trim()
		) {
			const token = localStorage.getItem("jwtToken");
			attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
		} else if (!accessCodeInput.trim()) {
			alert("Please enter an access code.");
		} else {
			alert(
				"Not connected to server or room ID miss  g. Please wait or refresh."
			);
		}
	};

	// Add this function to handle queue joining/leaving
	const handleJoinDrawerQueue = () => {
		if (!socketRef.current || !roomId) return;

		const token = localStorage.getItem("jwtToken");

		socketRef.current.emit(
			"join_drawer_queue",
			{ roomId, token },
			(response) => {
				if (response.success) {
					setQueueMessage(response.message);
					setTimeout(() => setQueueMessage(""), 3000); // Clear message after 3 seconds
				} else {
					alert(response.message);
				}
			}
		);
	};

	// Calculate rounds left for display
	const getRoundsLeft = () => {
		if (!game.maxRounds || !game.currentRound) return 0;
		return Math.max(0, game.maxRounds - game.currentRound);
	};

	// OK
	const sendDrawing = (pathsToEmit) => {
		if (
			isDrawerRef.current &&
			roomId &&
			socketRef.current &&
			socketRef.current.connected
		) {
			if (Array.isArray(pathsToEmit)) {
				socketRef.current.emit("drawing_update", {
					roomId,
					paths: pathsToEmit,
				});
			} else {
				console.error(
					"[sendDrawing] Paths from onChange is not a valid array. Not emitting. Paths value:",
					pathsToEmit
				);
			}
		} else {
			console.error(
				"[sendDrawing] Conditions not met for emitting drawing_update (drawer, roomId, socket)."
			);
		}
	};

	// OK
	const handleCanvasChange = (updatedPaths) => {
		if (isDrawerRef.current) {
			//debouncedSendDrawing(updatedPaths);
			sendDrawing(updatedPaths);
		}
	};

	// OK
	const handleSendChatMessage = (e) => {
		e.preventDefault();
		if (
			!chatInput.trim() ||
			!roomId ||
			!socketRef.current ||
			!socketRef.current.connected
		)
			return;
		const token = localStorage.getItem("jwtToken");
		// Send the chat message
		socketRef.current.emit("send_chat_message", {
			roomId: roomId,
			text: chatInput,
			token: token,
		});
		setChatInput("");
	};

	const effectiveReadOnly = !isDrawer;

	// OK
	const handleEraserClick = () => {
		if (!effectiveReadOnly && canvasRef.current) {
			setEraseMode(true);
			canvasRef.current.eraseMode(true);
		}
	};
	const handlePenClick = () => {
		if (!effectiveReadOnly && canvasRef.current) {
			setEraseMode(false);
			canvasRef.current.eraseMode(false);
		}
	};
	const handleStrokeWidthChange = (event) => {
		if (!effectiveReadOnly) setStrokeWidth(+event.target.value);
	};
	const handleEraserWidthChange = (event) => {
		if (!effectiveReadOnly) setEraserWidth(+event.target.value);
	};
	const handleStrokeColorChange = (event) => {
		if (!effectiveReadOnly) setStrokeColor(event.target.value);
	};

	// OK
	const handleUndoClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.undo();

			// Since undo might not trigger onChange, manually get paths and send them
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				try {
					const paths = await canvasRef.current.exportPaths();
					// debouncedSendDrawing(paths);
					sendDrawing(paths);
				} catch (error) {
					console.error("Error getting paths after undo:", error);
				}
			}
		}
	};

	// OK
	const handleRedoClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.redo();

			// Since redo might not trigger onChange, manually get paths and send them
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				try {
					const paths = await canvasRef.current.exportPaths();
					// debouncedSendDrawing(paths);
					sendDrawing(paths);
				} catch (error) {
					console.error("Error getting paths after redo:", error);
				}
			}
		}
	};

	// OK
	const handleClearClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.clearCanvas();

			// Since clearCanvas might not trigger onChange, manually send empty paths
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				// debouncedSendDrawing([]);
				sendDrawing([]);
			}
		}
	};

	// Add this function with your other handler functions in GamePage component
	const handleDestroyRoom = () => {
		if (
			window.confirm(
				"Are you sure you want to destroy this room? All players will be disconnected."
			)
		) {
			if (socketRef.current && socketRef.current.connected && roomId) {
				socketRef.current.emit("destroy_room", { roomId }, (response) => {
					if (response && response.success) {
						console.log("Room successfully destroyed");
						router.push("/");
					} else {
						alert(
							"Failed to destroy room: " +
								(response?.message || "Unknown error")
						);
					}
				});
			} else {
				alert("Not connected to the server. Please try again.");
			}
		}
	};

	const handleLeaveGame = () => {
		if (window.confirm("Are you sure you want to leave this game?")) {
			if (socketRef.current && socketRef.current.connected && roomId) {
				socketRef.current.emit("leave_game", { roomId }, (response) => {
					if (response && response.success) {
						console.log("Successfully left game");
						router.push("/");
					} else {
						const errorMsg = response?.message || "Unknown error";
						alert("Failed to leave game: " + errorMsg);

						// Jeśli próbujemy wyjść jako owner, zasugeruj użycie Destroy Room
						if (errorMsg.includes("owner cannot leave")) {
							alert(
								'As the room owner, please use "Destroy Room" button to close the room.'
							);
						}
					}
				});
			} else {
				router.push("/");
			}
		}
	};

	const getOwnerUsername = () => {
		const ownerPlayer = game.players.find((p) => p.dbUserId === game.ownerId);
		return ownerPlayer ? ownerPlayer.username : "Unknown";
	};

	// JSX
	if (!roomId)
		return (
			<div className="flex justify-center items-center h-screen">
				Loading room ID...
			</div>
		);

	if (requiresAccessCode && !joinedRoom) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-100">
				<div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-md text-black">
					<h2 className="text-2xl font-semibold mb-4">
						Enter Access Code for Room {roomId}
					</h2>
					<form onSubmit={handleAccessCodeSubmit}>
						<input
							type="text"
							value={accessCodeInput}
							onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
							placeholder="Access Code"
							className="w-full px-4 py-3 border border-gray-300 rounded-md mb-4"
						/>
						<button
							type="submit"
							className="w-full py-3 bg-blue-500 text-white rounded-lg"
						>
							Enter Room
						</button>
					</form>
				</div>
			</div>
		);
	}

	if (!currentSocketId && !joinedRoom) {
		// If socket not connected yet and not joined
		return (
			<div className="flex justify-center items-center h-screen">
				Connecting to game server...
			</div>
		);
	}
	if (currentSocketId && !joinedRoom && !requiresAccessCode) {
		// Connected, but not joined, and not waiting for access code
		return (
			<div className="flex justify-center items-center h-screen">
				Joining room {roomId}...
			</div>
		);
	}

	// Main Game UI (only render if joinedRoom is true, or if not requiring access code and socket is connected - though join should happen quickly)
	if (!joinedRoom) {
		// This case should ideally be covered by the above loading/access code states.
		// If it reaches here, it means conditions to join haven't been met or join failed silently.
		return (
			<div className="flex justify-center items-center h-screen">
				Preparing game... Please wait.
			</div>
		);
	}

	// Boilerplate version of the UI, keeping all functionalities, buttons, and layout (2/3 canvas, 1/3 chat)
	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				gap: "8px",
				background: "#eee",
				padding: "8px",
				boxSizing: "border-box",
			}}
		>
			{/* Left: Canvas Area (2/3) */}
			<div
				style={{
					flex: 2,
					display: "flex",
					flexDirection: "column",
					background: "#fff",
					border: "1px solid #ccc",
					borderRadius: 4,
					padding: 8,
					minWidth: 0,
				}}
			>
				{/* Room and Status */}
				<div style={{ marginBottom: 8 }}>
					{/* Pierwsza linia: Room info + Destroy button */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "4px",
						}}
					>
						<div>
							Room: {game.roomId}, Owner: {getOwnerUsername()}
						</div>
						<div>
							{/* Przycisk "Leave Game" tylko dla graczy, którzy NIE są właścicielami */}
							{!isRoomOwner && (
								<button
									onClick={handleLeaveGame}
									style={{
										marginRight: "8px",
										background: "#f0ad4e",
										color: "white",
										border: "none",
										padding: "5px 10px",
										borderRadius: "4px",
										fontSize: "14px",
									}}
								>
									Leave Game
								</button>
							)}

							{/* Przycisk "Destroy Room" tylko dla właściciela */}
							{isRoomOwner && (
								<button
									onClick={handleDestroyRoom}
									style={{
										background: "#ff4d4d",
										color: "white",
										border: "none",
										padding: "5px 10px",
										borderRadius: "4px",
										fontSize: "14px",
									}}
								>
									Destroy Room
								</button>
							)}
						</div>
					</div>

					{/* Druga linia: Start Game button (jeśli potrzebny) */}
					<div>
						{isRoomOwner && game.players.length >= 2 && canStartGame && (
							<button onClick={handleStartGame}>Start Game</button>
						)}
					</div>

					{isDrawer &&
						game.gameStatus === "choosing_word" &&
						wordChoices.length > 0 && (
							<div
								style={{
									position: "fixed",
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -50%)",
									background: "white",
									border: "2px solid #333",
									borderRadius: "10px",
									padding: "20px",
									boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
									zIndex: 1000,
									textAlign: "center",
									minWidth: "400px",
								}}
							>
								<h3 style={{ marginBottom: "16px" }}>
									Choose Your Word to Draw
								</h3>
								{wordChoiceTimeLeft !== null && (
									<div
										style={{
											marginBottom: "16px",
											fontSize: "14px",
											color: wordChoiceTimeLeft <= 5 ? "#f44336" : "#666",
										}}
									>
										Time to choose: <strong>{wordChoiceTimeLeft}</strong>{" "}
										seconds
									</div>
								)}
								<div
									style={{
										display: "flex",
										gap: "12px",
										justifyContent: "center",
										flexWrap: "wrap",
									}}
								>
									{wordChoices.map((wordChoice, index) => (
										<button
											key={index}
											onClick={() => handleWordSelection(wordChoice)}
											style={{
												padding: "12px 16px",
												border: `2px solid ${getDifficultyColor(
													wordChoice.difficulty
												)}`,
												borderRadius: "8px",
												background: "white",
												cursor: "pointer",
												minWidth: "120px",
												transition: "all 0.2s ease",
											}}
											onMouseOver={(e) => {
												e.target.style.background = getDifficultyColor(
													wordChoice.difficulty
												);
												e.target.style.color = "white";
											}}
											onMouseOut={(e) => {
												e.target.style.background = "white";
												e.target.style.color = "black";
											}}
										>
											<div style={{ fontWeight: "bold", fontSize: "16px" }}>
												{wordChoice.word}
											</div>
											<div
												style={{
													fontSize: "12px",
													color: getDifficultyColor(wordChoice.difficulty),
													fontWeight: "bold",
												}}
											>
												{getDifficultyLabel(wordChoice.difficulty)}
											</div>
										</button>
									))}
								</div>
								<div
									style={{
										marginTop: "12px",
										fontSize: "12px",
										color: "#666",
									}}
								>
									If you dont choose, the first word will be automatically
									selected.
								</div>
							</div>
						)}

					<div>
						{game.gameStatus === "playing" ? (
							isDrawer ? (
								<div>
									{game.keyword && (
										<div>
											You are the drawer. Your word: <b>{game.keyword}</b>
										</div>
									)}
								</div>
							) : (
								<div>
									<div>You are guessing. Try to guess what is being drawn!</div>
								</div>
							)
						) : game.gameStatus === "choosing_word" ? (
							<div>
								{isDrawer ? (
									<div>Choose your word to draw!</div>
								) : (
									<div>
										The drawer is choosing a word...
										{wordChoiceTimeLeft !== null && (
											<span> ({wordChoiceTimeLeft}s)</span>
										)}
									</div>
								)}
							</div>
						) : (
							<div>
								{game.gameStatus === "betweenRounds" && (
									<div>
										Waiting for next round...
										{nextRoundSeconds !== null && (
											<span> ({nextRoundSeconds})</span>
										)}
									</div>
								)}
							</div>
						)}
					</div>
					<div>
						{game.gameStatus === "playing" &&
							game.currentRound &&
							game.maxRounds && (
								<div>
									Round {game.currentRound} / {game.maxRounds}
								</div>
							)}
						{secondsLeft !== null && game.gameStatus === "playing" && (
							<div>
								Time left: <b>{secondsLeft}</b> seconds
							</div>
						)}
					</div>
					<div>
						Players: {game.players.map((player) => player.username).join(", ")}{" "}
						{game.players.length < 2
							? "(Need at least 2 players to start)"
							: ""}
					</div>

					{game.drawerChoice === "queue" && game.gameStatus === "playing" && (
						<div style={{ marginTop: 4, fontSize: "14px" }}>
							<strong>Drawing Queue:</strong>
							{drawerQueue.length > 0 ? (
								<div style={{ marginLeft: 8 }}>
									{drawerQueue.map((queuedPlayer, index) => (
										<div key={queuedPlayer.socketId} style={{ color: "#666" }}>
											{index + 1}. {queuedPlayer.username}
											{queuedPlayer.socketId === currentSocketId && " (You)"}
										</div>
									))}
								</div>
							) : (
								<span style={{ color: "#999", marginLeft: 8 }}>
									No one in queue
								</span>
							)}
							<div style={{ fontSize: "12px", color: "#666", marginTop: 2 }}>
								Rounds remaining: {getRoundsLeft()}
							</div>
						</div>
					)}
				</div>
				{/* Drawing Tools */}
				{isDrawer && game.gameStatus === "playing" && (
					<div
						style={{
							display: "flex",
							gap: 8,
							marginBottom: 8,
							flexWrap: "wrap",
						}}
					>
						<button onClick={handlePenClick} disabled={!eraseMode || !isDrawer}>
							Pen
						</button>
						<button
							onClick={handleEraserClick}
							disabled={eraseMode || !isDrawer}
						>
							Eraser
						</button>
						<label>
							Color:
							<input
								type="color"
								value={strokeColor}
								onChange={handleStrokeColorChange}
								disabled={!isDrawer}
							/>
						</label>
						<label>
							Size:
							<input
								type="range"
								min="1"
								max="50"
								value={eraseMode ? eraserWidth : strokeWidth}
								onChange={
									eraseMode ? handleEraserWidthChange : handleStrokeWidthChange
								}
								disabled={!isDrawer}
							/>
						</label>
						<button onClick={handleUndoClick} disabled={!isDrawer}>
							Undo
						</button>
						<button onClick={handleRedoClick} disabled={!isDrawer}>
							Redo
						</button>
						<button onClick={handleClearClick} disabled={!isDrawer}>
							Clear
						</button>
					</div>
				)}
				{/* Canvas */}
				<div
					style={{
						flex: 1,
						minHeight: 0,
						position: "relative",
						border: "1px solid #ddd",
						borderRadius: 4,
						overflow: "hidden",
					}}
				>
					<ReactSketchCanvas
						ref={canvasRef}
						strokeWidth={eraseMode ? eraserWidth : strokeWidth}
						eraserWidth={eraserWidth}
						strokeColor={strokeColor}
						canvasColor={canvasColor}
						height="100%"
						width="100%"
						readOnly={effectiveReadOnly}
						onChange={handleCanvasChange}
						style={{ border: "none", width: "100%", height: "100%" }}
					/>
					{(!isDrawer || game.gameStatus !== "playing") && (
						<div
							style={{
								position: "absolute",
								inset: 0,
								zIndex: 10,
								cursor: "not-allowed",
							}}
						/>
					)}
				</div>
			</div>
			{/* Right: Chat Area (1/3) */}
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					background: "#fff",
					border: "1px solid #ccc",
					borderRadius: 4,
					padding: 8,
					minWidth: 0,
				}}
			>
				<div style={{ marginBottom: 8 }}>Chat & Guesses</div>
				<div style={{ flex: 1, overflowY: "auto", marginBottom: 8 }}>
					{chatMessages.map((msg, idx) => (
						<div
							key={idx}
							style={{
								marginBottom: 4,
								padding: 4,
								borderRadius: 4,
								background:
									msg.user === "System"
										? msg.type === "keyword_event"
											? "#e6fffa"
											: "#eee"
										: msg.user === loggedInUser?.username
										? "#e0ffe0"
										: "#f8f8f8",
								fontWeight: msg.user === "System" ? "bold" : "normal",
							}}
						>
							<span>
								{msg.user === loggedInUser?.username && msg.user !== "System"
									? "You"
									: msg.user}
								:
							</span>{" "}
							{msg.text}
						</div>
					))}
				</div>
				<form
					onSubmit={handleSendChatMessage}
					style={{ display: "flex", gap: 4 }}
				>
					<input
						type="text"
						value={chatInput}
						onChange={(e) => setChatInput(e.target.value)}
						placeholder={
							isDrawer
								? "You are drawing, can't guess!"
								: hasGuessedCorrectly
								? "You already guessed correctly!"
								: "Type your guess or chat..."
						}
						disabled={isDrawer || hasGuessedCorrectly}
						style={{
							flex: 1,
							padding: 6,
							borderRadius: 4,
							border: "1px solid #ccc",
						}}
					/>
					<button type="submit" disabled={isDrawer}>
						Send
					</button>
					{/* Drawer Queue Button - only show if drawerChoice is queue and game is playing */}
					{game.drawerChoice === "queue" &&
						game.gameStatus === "playing" &&
						!isDrawer &&
						getRoundsLeft() > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<button
									type="button"
									onClick={handleJoinDrawerQueue}
									style={{
										padding: "6px 12px",
										borderRadius: 4,
										border: "1px solid #ccc",
										background: isInQueue ? "#ffebee" : "#e3f2fd",
										color: isInQueue ? "#c62828" : "#1976d2",
										fontSize: "14px",
										cursor: "pointer",
									}}
									disabled={getRoundsLeft() === 0}
								>
									{isInQueue ? "Leave Drawing Queue" : "Join Drawing Queue"}
								</button>
								{queueMessage && (
									<div
										style={{
											fontSize: "12px",
											color: "#666",
											textAlign: "center",
											padding: "2px",
										}}
									>
										{queueMessage}
									</div>
								)}
								{getRoundsLeft() === 0 && (
									<div
										style={{
											fontSize: "12px",
											color: "#999",
											textAlign: "center",
										}}
									>
										No more rounds left
									</div>
								)}
							</div>
						)}
				</form>
			</div>
			{gameEndData && (
				<GameEndPopup
					winner={gameEndData.winner}
					scores={gameEndData.scores}
					gameStats={gameEndData.gameStats}
					socket={socketRef.current}
					roomId={roomId}
				/>
			)}
		</div>
	);
}
