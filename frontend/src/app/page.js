'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// import io from 'socket.io-client'; // No longer needed here
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';

// let socketClient = null; // Remove

export default function HomePage() {
  const [rooms, setRooms] = useState([]); // Example state
  const [leaderboard, setLeaderboard] = useState([]); // Example state
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomSettings, setNewRoomSettings] = useState({
      maxPlayers: 8,
      isPrivate: false,
      accessCode: '',
      gameMode: 'rounds',    // 'rounds' or 'points'
      maxRounds: 5,          // Default 5 rounds
      pointsToWin: 3,        // Default 3 points to win (for points mode)
      roundDuration: 60,      // Default 60 seconds per round
      drawerChoice: 'random' // 'random' or 'queue' or 'winner'
  });
  
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authMessage, setAuthMessage] = useState(''); 
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('jwtToken');
    if (storedToken) {
      try {
        const decodedToken = jwtDecode(storedToken);
        setLoggedInUser({ username: decodedToken.username, userId: decodedToken.userId });
      } catch (error) {
        console.error("Failed to decode token on homepage", error);
        localStorage.removeItem('jwtToken'); // Clear invalid token
      }
    }
    // Listener for auth changes from other pages (e.g., login, logout in TopBar)
    const handleAuthChange = () => {
        const currentToken = localStorage.getItem('jwtToken');
        if (currentToken) {
            try {
                setLoggedInUser(jwtDecode(currentToken));
            } catch { setLoggedInUser(null); }
        } else {
            setLoggedInUser(null);
        }
    };
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwtToken');
    setLoggedInUser(null);
    setAuthMessage('Logged out.');
    window.dispatchEvent(new CustomEvent('authChange')); // Notify TopBar
    router.push('/login'); // Or stay on page, depending on desired UX
  };

  const handleConfigureRoomClick = () => {
    if (!loggedInUser) {
        router.push('/login?redirect=/'); // Redirect to login if not authenticated
        return;
    }
    setShowCreateRoomModal(true);
  };

  const handleCreateRoom = async () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        alert("Please log in to create a room.");
        router.push('/login?redirect=/');
        return;
    }

    // Validate settings before submitting
    if (newRoomSettings.isPrivate && !newRoomSettings.accessCode.trim()) {
      alert("Please enter an access code for private rooms");
      return;
    }
    
    if (newRoomSettings.gameMode === 'rounds' && 
        (newRoomSettings.maxRounds < 1 || newRoomSettings.maxRounds > 20)) {
      alert("Max rounds must be between 1 and 20");
      return;
    }
    
    if (newRoomSettings.gameMode === 'points' && 
        (newRoomSettings.pointsToWin < 1 || newRoomSettings.pointsToWin > 10)) {
      alert("Points to win must be between 1 and 10");
      return;
    }
    
    if (newRoomSettings.roundDuration < 30 || newRoomSettings.roundDuration > 300) {
      alert("Round duration must be between 30 and 300 seconds");
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: newRoomSettings }),
      });
      const data = await response.json();
      if (data.success && data.roomId) {
        console.log('Room created via API:', data.roomId);
        // Navigate to the dynamic game route
        router.push(`/game/${data.roomId}`); 
      } else {
        alert('Failed to create room: ' + (data.message || 'Unknown error'));
        if (data.message && data.message.toLowerCase().includes('token')) {
            localStorage.removeItem('jwtToken');
            setLoggedInUser(null);
            window.dispatchEvent(new CustomEvent('authChange'));
            router.push('/login');
        }
      }
    } catch (error) {
      console.error('Create room fetch error:', error);
      alert('Failed to create room. Please try again.');
    }
    setShowCreateRoomModal(false);
  };

  const handleJoinRoomWithCode = async () => {
    if (!joinRoomCode.trim()) {
        alert('Please enter a room code.');
        return;
    }
    try {
        const response = await fetch(`http://localhost:4000/api/rooms/validate/${joinRoomCode.trim()}`);
        const data = await response.json();
        if (data.success) {
            // Navigate to the dynamic game route
            // If private, game page will need to ask for access code before emitting 'join_room' to socket
            router.push(`/game/${data.roomId}${data.isPrivate ? '?private=true' : ''}`);
        } else {
            alert('Failed to join room: ' + (data.message || 'Invalid room code.'));
        }
    } catch (error) {
        console.error('Join room fetch error:', error);
        alert('Failed to validate room code. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Pict-IO</h1>
        <div>
            {loggedInUser ? (
                <span>Welcome, {loggedInUser.username}! <button onClick={handleLogout} className="text-sm text-blue-500 hover:underline">(Logout)</button></span>
            ) : (
                <Link href="/login" className="text-blue-500 hover:underline">Login</Link>
            )}
        </div>
      </div>
      
      {authMessage && <p className="text-center mb-4 text-red-500">{authMessage}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h2 className="text-2xl font-semibold mb-4">Create New Room</h2>
          <button 
            onClick={handleConfigureRoomClick}
            className="w-full py-3 bg-blue-500 text-white rounded-lg text-lg hover:bg-blue-600"
          >
            Configure & Create Room
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h2 className="text-2xl font-semibold mb-4">Join Existing Room</h2>
           <div className="flex">
            <input 
              type="text" 
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code..." 
              className="flex-1 px-4 py-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleJoinRoomWithCode}
              className="px-6 py-3 bg-green-500 text-white rounded-r hover:bg-green-600"
            >
              Join
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
          {/* Placeholder for leaderboard */}
          <p>Leaderboard coming soon...</p>
        </div>
      </div>
      
      {showCreateRoomModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl text-black w-full max-w-md">
                <h3 className="text-2xl font-semibold mb-6">Create Room Settings</h3>
                
                {/* Max Players */}
                <div className="mb-4">
                    <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">
                        Max Players:
                    </label>
                    <input 
                        type="number" id="maxPlayers" value={newRoomSettings.maxPlayers}
                        onChange={(e) => setNewRoomSettings(prev => ({ 
                            ...prev, 
                            maxPlayers: parseInt(e.target.value, 10) || 2 
                        }))}
                        min="2" max="16"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                
                {/* Game Mode Selection */}
                <div className="mb-4">
                    <label htmlFor="gameMode" className="block text-sm font-medium text-gray-700 mb-1">
                        Game Mode:
                    </label>
                    <select 
                        id="gameMode"
                        value={newRoomSettings.gameMode}
                        onChange={(e) => setNewRoomSettings(prev => ({
                            ...prev,
                            gameMode: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="rounds">Fixed Number of Rounds</option>
                        <option value="points">First to X Points</option>
                    </select>
                </div>
                
                {/* Game Termination Condition (based on selected game mode) */}
                {newRoomSettings.gameMode === 'rounds' ? (
                    <div className="mb-4">
                        <label htmlFor="maxRounds" className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Rounds:
                        </label>
                        <input 
                            type="number" id="maxRounds" value={newRoomSettings.maxRounds}
                            onChange={(e) => setNewRoomSettings(prev => ({ 
                                ...prev, 
                                maxRounds: parseInt(e.target.value, 10) || 1
                            }))}
                            min="1" max="20"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                ) : (
                    <div className="mb-4">
                        <label htmlFor="pointsToWin" className="block text-sm font-medium text-gray-700 mb-1">
                            Points to Win:
                        </label>
                        <input 
                            type="number" id="pointsToWin" value={newRoomSettings.pointsToWin}
                            onChange={(e) => setNewRoomSettings(prev => ({ 
                                ...prev, 
                                pointsToWin: parseInt(e.target.value, 10) || 1
                            }))}
                            min="1" max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                )}
                
                {/* Round Time Limit */}
                <div className="mb-4">
                    <label htmlFor="roundDuration" className="block text-sm font-medium text-gray-700 mb-1">
                        Round Time Limit (seconds):
                    </label>
                    <input 
                        type="number" id="roundDuration" value={newRoomSettings.roundDuration}
                        onChange={(e) => setNewRoomSettings(prev => ({ 
                            ...prev, 
                            roundDuration: parseInt(e.target.value, 10) || 30
                        }))}
                        min="30" max="300" step="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Time limit per round (30-300 seconds)
                    </p>
                </div>

                {/* Drawer Selection Method */}
                <div className="mb-4">
                    <label htmlFor="drawerChoice" className="block text-sm font-medium text-gray-700 mb-1">
                        Drawer Selection Method:
                    </label>
                    <select 
                        id="drawerChoice"
                        value={newRoomSettings.drawerChoice}
                        onChange={(e) => setNewRoomSettings(prev => ({
                            ...prev,
                            drawerChoice: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="random">Random Each Round</option>
                        <option value="queue">Take Turns in Queue</option>
                        <option value="winner">Winner Becomes Drawer</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        How the drawer is chosen for each round
                    </p>
                </div>
                
                {/* Privacy Setting */}
                <div className="mb-4">
                    <label className="flex items-center">
                        <input type="checkbox" checked={newRoomSettings.isPrivate}
                            onChange={(e) => setNewRoomSettings(prev => ({ 
                                ...prev, 
                                isPrivate: e.target.checked, 
                                accessCode: e.target.checked ? prev.accessCode : '' 
                            }))}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Private Room</span>
                    </label>
                </div>
                
                {/* Access Code */}
                {newRoomSettings.isPrivate && (
                    <div className="mb-6">
                        <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-1">
                            Access Code (optional):
                        </label>
                        <input type="text" id="accessCode" value={newRoomSettings.accessCode}
                            onChange={(e) => setNewRoomSettings(prev => ({ 
                                ...prev, 
                                accessCode: e.target.value.toUpperCase() 
                            }))}
                            placeholder="e.g., MYCODE"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave blank for auto-generated if private.</p>
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                    <button onClick={() => setShowCreateRoomModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none">
                        Cancel
                    </button>
                    <button onClick={handleCreateRoom}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none">
                        Create & Start
                    </button>
                </div>
            </div>
        </div>
    )}
    </div>
  );
}