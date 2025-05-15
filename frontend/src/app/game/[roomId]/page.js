'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import { jwtDecode } from 'jwt-decode';

export default function GamePage() {
    // define state variables
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [eraseMode, setEraseMode] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(5);
    const [eraserWidth, setEraserWidth] = useState(10);
    const [strokeColor, setStrokeColor] = useState("#000000");
    const [canvasColor, setCanvasColor] = useState("#ffffff");
    
    const [gameStatus, setGameStatus] = useState('playing'); // 'waiting', 'playing', 'ended'
    const [canStartGame, setCanStartGame] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [playersInRoom, setPlayersInRoom] = useState([]);
    const [currentSocketId, setCurrentSocketId] = useState(null); // Tracks socket connection status

    const router = useRouter();
    const params = useParams();
    const queryParams = useSearchParams();

    const [roomId, setRoomId] = useState(null);
    const [isDrawer, setIsDrawer] = useState(false);
    const [isRoomOwner, setIsRoomOwner] = useState(false);
    const isDrawerRef = useRef(isDrawer); // Ref to hold the latest isDrawer state for callbacks
    const [currentKeyword, setCurrentKeyword] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [accessCodeInput, setAccessCodeInput] = useState('');
    const [requiresAccessCode, setRequiresAccessCode] = useState(false);
    const [joinedRoom, setJoinedRoom] = useState(false);

    // Update isDrawerRef whenever isDrawer state changes
    useEffect(() => {
        isDrawerRef.current = isDrawer;
    }, [isDrawer]);

    // Effect 1: Socket Connection Management and Core Event Listeners
    useEffect(() => {
        const rIdFromParams = params.roomId;
        if (!rIdFromParams) {
            alert('Room ID is missing!');
            router.push('/');
            return;
        }
        setRoomId(rIdFromParams); // Set roomId state for other effects

        console.log("GamePage Effect 1: Setting up socket for roomId", rIdFromParams);
        // Disconnect previous socket if any (e.g. if params.roomId changes for a new room)

        if (socketRef.current) {
                socketRef.current.disconnect();
        }

        const newSocket = io('http://localhost:4000');
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            setCurrentSocketId(newSocket.id); // Signal that socket is connected and ready
        });

        newSocket.on('disconnect', (reason) => {
            setCurrentSocketId(null);
            setJoinedRoom(false); // Reset joined status on disconnect
            // Potentially show a message or attempt reconnect based on reason
        });

        newSocket.on('game_started', () => {
            console.log("Game has started!");
            setGameStatus('playing');

            // Only add one system message - don't add messages about the word here
            setChatMessages(prev => [...prev, {
                user: 'System', 
                text: 'The game has started! First round beginning.',
                type: 'game_event'
            }]);
        });

        newSocket.on('new_chat_message', (data) => {
                setChatMessages((prevMessages) => [...prevMessages, data]);
            });
        
        newSocket.on('new_keyword_for_drawer', (data) => {
                if (isDrawerRef.current) { 
                    console.log("Received word as drawer:", data.keyword);
                    setCurrentKeyword(data.keyword);
                }
            });
        
            // Modified handler for keyword_guessed - end of a round, transition to next
        newSocket.on('keyword_guessed', (data) => {
            console.log("Word guessed, round ending:", data);
            setRoundCount(prev => prev + 1);

            // Add only one chat message for keyword guessed
            setChatMessages(prevMessages => [
                ...prevMessages, 
                { 
                    user: 'System', 
                    text: data.message, 
                    type: 'keyword_event' 
                }
            ]);

            // Reset the drawer's UI
            if (isDrawerRef.current && canvasRef.current) {
                canvasRef.current.clearCanvas();
            }

            // Briefly show "between rounds" status
            setGameStatus('between_rounds');

            // After a delay, go back to playing state
            setTimeout(() => {
                if (socketRef.current?.connected) {
                    setGameStatus('playing');
                }
            }, 3000);
        });

        newSocket.on('drawing_data_broadcast', (data) => {
            if (!isDrawerRef.current && canvasRef.current) { // Use ref for current isDrawer status
                canvasRef.current.clearCanvas();
                canvasRef.current.loadPaths(data.paths);
            }
        });

        newSocket.on('game_update', (data) => {
            const thisClientIsNowDrawer = data.drawerId === socketRef.current?.id;
            const wasPreviouslyDrawer = isDrawerRef.current;

            // Update isDrawer state based on game_update
            setIsDrawer(thisClientIsNowDrawer);

            // Update players list
            setPlayersInRoom(data.players || []);

            // Update canStartGame state
            setCanStartGame(thisClientIsNowDrawer && (data.players?.length >= 2) && gameStatus === 'waiting');

            // Clear canvas and handle transitions when drawer changes
            if (thisClientIsNowDrawer !== wasPreviouslyDrawer) {
                if (thisClientIsNowDrawer) {
                    console.log("You are now the drawer - waiting for word");
                    if (canvasRef.current) canvasRef.current.clearCanvas();
                    // Don't set current keyword here - wait for new_keyword_for_drawer
                } else {
                    console.log("You are now a guesser");
                    if (canvasRef.current) canvasRef.current.clearCanvas();
                }
            }

            // Load existing drawings if we're a guesser
            if (data.drawingPaths && canvasRef.current && !thisClientIsNowDrawer) {
                // Clear first, then load
                canvasRef.current.clearCanvas()
                canvasRef.current.loadPaths(data.drawingPaths);
            }
        });

        newSocket.on('new_keyword_for_drawer', (data) => {
            if (isDrawerRef.current) { // Use ref for current isDrawer status
                setCurrentKeyword(data.keyword);
                setChatMessages(prev => [...prev, {user: 'System', text: `Your new word is: ${data.keyword}`}]);
            }
        });

        return () => {
            if (newSocket) {
                console.log('GamePage: Disconnecting socket on unmount/roomId change (Effect 1 cleanup)', newSocket.id);
                newSocket.disconnect();
                socketRef.current = null;
                setCurrentSocketId(null);
                setJoinedRoom(false);
            }
        };
    }, [params.roomId, router]); // Only re-run if roomId changes or on mount/unmount

    // Effect 2: Handle Joining Logic
    useEffect(() => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setLoggedInUser({ username: decoded.username, userId: decoded.userId });
            } catch (e) { console.error("Failed to decode token on game page", e); localStorage.removeItem('jwtToken'); }
        }

        // Determine if access code is required
        const isPrivateRoom = queryParams.get('private') === 'true';
        if (roomId && isPrivateRoom && !joinedRoom && !accessCodeInput.trim()) { // If private, not joined, and no code entered yet
            setRequiresAccessCode(true);
        } else {
            setRequiresAccessCode(false); // Not private, or already joined, or code has been input
        }
        
        // Attempt to join if conditions are met
        if (currentSocketId && roomId && !joinedRoom) { // Check currentSocketId to ensure socket is connected
            if (!isPrivateRoom || (isPrivateRoom && accessCodeInput.trim())) { // If not private, or private and code is provided
                console.log("GamePage Effect 2: Attempting to join room", roomId);
                attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
            }
        }
    }, [roomId, currentSocketId, joinedRoom, accessCodeInput, queryParams]);

    const handleStartGame = () => {
        if (isRoomOwner && socketRef.current && socketRef.current.connected && roomId) {
            console.log("Requesting to start the game as room owner");
            socketRef.current.emit('start_game', { roomId });
            setCanStartGame(false);
        }
    };

    const attemptJoinRoom = (socketInstance, rId, token, code) => {
        if (!socketInstance || !socketInstance.connected) {
            console.warn("AttemptJoinRoom called but socket not connected.");
            return;
        }
        socketInstance.emit('join_room', { 
            roomId: rId, 
            token: token,
            accessCode: code 
        }, (response) => {
            if (response.success) {
                console.log(`Successfully joined room ${rId}.`);
                setJoinedRoom(true);
                setRequiresAccessCode(false); 
                setIsRoomOwner(response.isRoomOwner);
                setChatMessages(prev => [...prev, {user: 'System', text: `You joined room ${rId}.`}]);
                if (response.drawingPaths && canvasRef.current) {
                    canvasRef.current.loadPaths(response.drawingPaths);
                }
            } else {
                alert(`Failed to join room: ${response.message}`);
                setJoinedRoom(false); // Ensure joinedRoom is false on failure
                if (!token && response.message?.toLowerCase().includes("token")) {
                    router.push(`/login?redirect=/game/${rId}`);
                } else if (response.message?.toLowerCase().includes("access code")) {
                    setRequiresAccessCode(true); // Re-prompt if code was wrong
                    setAccessCodeInput(''); // Clear wrong code
                } else if (response.message?.toLowerCase().includes("full")) {
                    router.push('/'); // Room is full, go to homepage
                } else if (response.message?.toLowerCase().includes("not found") || response.message?.toLowerCase().includes("not exist")) {
                    router.push('/'); // Room doesn't exist or not active
                }
            }
        });
    };

    const handleAccessCodeSubmit = (e) => {
        e.preventDefault();
        // Access code input is now a dependency of Effect 2, which will trigger attemptJoinRoom
        // No direct call to attemptJoinRoom here, just update state.
        // The useEffect will pick up the change in accessCodeInput.
        // However, for immediate feedback, we can call it if conditions are right.
        if (socketRef.current && socketRef.current.connected && roomId && accessCodeInput.trim()) {
            const token = localStorage.getItem('jwtToken');
            attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
        } else if (!accessCodeInput.trim()){
            alert("Please enter an access code.");
        } else {
            alert("Not connected to server or room ID missing. Please wait or refresh.");
        }
    };
    
    // Debounced function for sending drawing updates
    const debouncedSendDrawing = useCallback(
        debounce(async (pathsToEmit) => {
            console.log("[Debounce] Executing. isDrawer:", isDrawerRef.current, "roomId:", roomId, "socketConnected:", !!(socketRef.current && socketRef.current.connected));
            console.log("[Debounce] Received pathsToEmit from onChange, count:", pathsToEmit?.length);

            if (isDrawerRef.current && roomId && socketRef.current && socketRef.current.connected) {
                const paths = pathsToEmit;

                if (Array.isArray(paths)) { // Changed condition to handle both empty and non-empty arrays
                    console.log(`[Debounce] Drawer (${socketRef.current?.id}) emitting drawing_update for room ${roomId}: ${paths.length} paths`);
                    socketRef.current.emit('drawing_update', { roomId, paths });
                } else {
                    console.log("[Debounce] Paths from onChange is not a valid array. Not emitting. Paths value:", paths);
                }
            } else {
                console.log("[Debounce] Conditions not met for emitting drawing_update (drawer, roomId, socket).");
            }
        }, 200),
        [roomId]
    );

    function debounce(func, delay) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, delay);
        };
    }

    // Modified to accept updatedPaths from the onUpdate prop
    const handleCanvasChange = (updatedPaths) => {
        // This log is crucial to see if onChange is firing and what paths it provides
        console.log("handleCanvasChange called by onChange. isDrawerRef.current:", isDrawerRef.current, "Received updatedPaths count:", updatedPaths?.length);
        if (isDrawerRef.current) {
            debouncedSendDrawing(updatedPaths);
        }
    };

    const handleSendChatMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !roomId || !socketRef.current || !socketRef.current.connected) return;
        const token = localStorage.getItem('jwtToken');
        // Send the chat message
        socketRef.current.emit('send_chat_message', { roomId, text: chatInput, token });
        setChatInput('');
    };

    const effectiveReadOnly = !isDrawer;

    // Tool handlers (simplified)
    const handleEraserClick = () => { if (!effectiveReadOnly && canvasRef.current) { setEraseMode(true); canvasRef.current.eraseMode(true); }};
    const handlePenClick = () => { if (!effectiveReadOnly && canvasRef.current) { setEraseMode(false); canvasRef.current.eraseMode(false); }};
    const handleStrokeWidthChange = (event) => { if (!effectiveReadOnly) setStrokeWidth(+event.target.value); };
    const handleEraserWidthChange = (event) => { if (!effectiveReadOnly) setEraserWidth(+event.target.value); };
    const handleStrokeColorChange = (event) => { if (!effectiveReadOnly) setStrokeColor(event.target.value); };
    
    const handleUndoClick = async () => {
        if (!effectiveReadOnly && canvasRef.current) {
            await canvasRef.current.undo();
            
            // Since undo might not trigger onChange, manually get paths and send them
            if (isDrawerRef.current && socketRef.current && socketRef.current.connected) {
                try {
                    const paths = await canvasRef.current.exportPaths();
                    console.log("After undo operation, manually fetched paths count:", paths?.length);
                    debouncedSendDrawing(paths);
                } catch (error) {
                    console.error("Error getting paths after undo:", error);
                }
            }
        }
    };

    const handleRedoClick = async () => {
        if (!effectiveReadOnly && canvasRef.current) {
            await canvasRef.current.redo();
            
            // Since redo might not trigger onChange, manually get paths and send them
            if (isDrawerRef.current && socketRef.current && socketRef.current.connected) {
                try {
                    const paths = await canvasRef.current.exportPaths();
                    console.log("After redo operation, manually fetched paths count:", paths?.length);
                    debouncedSendDrawing(paths);
                } catch (error) {
                    console.error("Error getting paths after redo:", error);
                }
            }
        }
    };

    const handleClearClick = async () => {
        if (!effectiveReadOnly && canvasRef.current) {
            await canvasRef.current.clearCanvas();
            
            // Since clearCanvas might not trigger onChange, manually send empty paths
            if (isDrawerRef.current && socketRef.current && socketRef.current.connected) {
                console.log("After clear operation, sending empty paths array");
                debouncedSendDrawing([]);
            }
        }
    };

    if (!roomId) return <div className="flex justify-center items-center h-screen">Loading room ID...</div>;
    
    if (requiresAccessCode && !joinedRoom) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-md text-black">
                    <h2 className="text-2xl font-semibold mb-4">Enter Access Code for Room {roomId}</h2>
                    <form onSubmit={handleAccessCodeSubmit}>
                        <input 
                            type="text" 
                            value={accessCodeInput}
                            onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                            placeholder="Access Code"
                            className="w-full px-4 py-3 border border-gray-300 rounded-md mb-4"
                        />
                        <button type="submit" className="w-full py-3 bg-blue-500 text-white rounded-lg">Enter Room</button>
                    </form>
                </div>
            </div>
        );
    }

    if (!currentSocketId && !joinedRoom) { // If socket not connected yet and not joined
         return <div className="flex justify-center items-center h-screen">Connecting to game server...</div>;
    }
    if (currentSocketId && !joinedRoom && !requiresAccessCode) { // Connected, but not joined, and not waiting for access code
        return <div className="flex justify-center items-center h-screen">Joining room {roomId}...</div>;
    }
    
    // Main Game UI (only render if joinedRoom is true, or if not requiring access code and socket is connected - though join should happen quickly)
    if (!joinedRoom) {
        // This case should ideally be covered by the above loading/access code states.
        // If it reaches here, it means conditions to join haven't been met or join failed silently.
        return <div className="flex justify-center items-center h-screen">Preparing game... Please wait.</div>;
    }

    // Boilerplate version of the UI, keeping all functionalities, buttons, and layout (2/3 canvas, 1/3 chat)
    return (
        <div style={{ display: 'flex', height: '100vh', gap: '8px', background: '#eee', padding: '8px', boxSizing: 'border-box' }}>
            {/* Left: Canvas Area (2/3) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #ccc', borderRadius: 4, padding: 8, minWidth: 0 }}>
                {/* Room and Status */}
                <div style={{ marginBottom: 8 }}>
                    <div>Room: {roomId}</div>
                    <div>
                        {gameStatus === 'waiting' && (<span>Wait for game start.</span>)}
                    </div>
                    <div>
                        {isRoomOwner && playersInRoom.length >= 2 && canStartGame && (
                            <button onClick={handleStartGame}>Start Game</button>
                        )}
                    </div>
                    <div>
                        {isDrawer ? (
                            <div>
                                <div>You are the Drawer!</div>
                                {gameStatus === 'waiting' && <div>Waiting for game to start...</div>}
                                {gameStatus === 'between_rounds' && <div>Get ready to draw a new word...</div>}
                                {gameStatus === 'playing' && currentKeyword && <div>Your word: <b>{currentKeyword}</b></div>}
                                {gameStatus === 'playing' && !currentKeyword && <div>Waiting for a word...</div>}
                            </div>
                        ) : (
                            <div>
                                You are Guessing!
                                {gameStatus === 'between_rounds' && ' New round starting soon...'}
                                {gameStatus === 'playing' && ' Try to guess what is being drawn!'}
                            </div>
                        )}
                    </div>
                    <div>
                        Players: {playersInRoom.join(', ')} {playersInRoom.length < 2 ? '(Need at least 2 players to start)' : ''}
                    </div>
                </div>
                {/* Drawing Tools */}
                {isDrawer && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <button onClick={handlePenClick} disabled={!eraseMode || !isDrawer}>Pen</button>
                        <button onClick={handleEraserClick} disabled={eraseMode || !isDrawer}>Eraser</button>
                        <label>
                            Color:
                            <input type="color" value={strokeColor} onChange={handleStrokeColorChange} disabled={!isDrawer} />
                        </label>
                        <label>
                            Size:
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={eraseMode ? eraserWidth : strokeWidth}
                                onChange={eraseMode ? handleEraserWidthChange : handleStrokeWidthChange}
                                disabled={!isDrawer}
                            />
                        </label>
                        <button onClick={handleUndoClick} disabled={!isDrawer}>Undo</button>
                        <button onClick={handleRedoClick} disabled={!isDrawer}>Redo</button>
                        <button onClick={handleClearClick} disabled={!isDrawer}>Clear</button>
                    </div>
                )}
                {/* Canvas */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden' }}>
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
                        style={{ border: 'none', width: '100%', height: '100%' }}
                    />
                    {!isDrawer && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'not-allowed' }} />
                    )}
                </div>
            </div>
            {/* Right: Chat Area (1/3) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #ccc', borderRadius: 4, padding: 8, minWidth: 0 }}>
                <div style={{ marginBottom: 8 }}>Chat & Guesses</div>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
                    {chatMessages.map((msg, idx) => (
                        <div key={idx} style={{
                            marginBottom: 4,
                            padding: 4,
                            borderRadius: 4,
                            background: msg.user === 'System'
                                ? (msg.type === 'keyword_event' ? '#e6fffa' : '#eee')
                                : (msg.user === loggedInUser?.username ? '#e0ffe0' : '#f8f8f8'),
                            fontWeight: msg.user === 'System' ? 'bold' : 'normal'
                        }}>
                            <span>{msg.user === loggedInUser?.username && msg.user !== 'System' ? 'You' : msg.user}:</span> {msg.text}
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: 4 }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={isDrawer ? "You are drawing, can't guess!" : "Type your guess or chat..."}
                        disabled={isDrawer}
                        style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                    <button type="submit" disabled={isDrawer}>Send</button>
                </form>
            </div>
        </div>
    );
}
