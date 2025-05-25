'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// import io from 'socket.io-client'; // No longer needed here
import { jwtDecode } from 'jwt-decode';

// let socketClient = null; // Remove

export default function HomePage() {
  const [rooms, setRooms] = useState([]); // Example state
  const [leaderboard, setLeaderboard] = useState([]); // Example state
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomSettings, setNewRoomSettings] = useState({
      maxPlayers: 8,
      isPrivate: false,
      accessCode: '', //new comment
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
    <div>
      <h1>Pict-IO</h1>
      {loggedInUser && <div>Welcome, {loggedInUser.username}!</div>}
      {authMessage && <div>{authMessage}</div>}

      <div>
        <h2>Create New Room</h2>
        <button onClick={handleConfigureRoomClick}>Configure & Create Room</button>
      </div>

      <div>
        <h2>Join Existing Room</h2>
        <input
          type="text"
          value={joinRoomCode}
          onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
          placeholder="Enter room code..."
        />
        <button onClick={handleJoinRoomWithCode}>Join</button>
      </div>

      <div>
        <h2>Leaderboard</h2>
        <p>Leaderboard coming soon...</p>
      </div>

      {showCreateRoomModal && (
        <div>
          <h3>Create Room Settings</h3>
          <div>
            <label>
              Max Players:
              <input
                type="number"
                value={newRoomSettings.maxPlayers}
                onChange={e => setNewRoomSettings(prev => ({
                  ...prev,
                  maxPlayers: parseInt(e.target.value, 10) || 2
                }))}
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
                onChange={e => setNewRoomSettings(prev => ({
                  ...prev,
                  gameMode: e.target.value
                }))}
              >
                <option value="rounds">Fixed Number of Rounds</option>
                <option value="points">First to X Points</option>
              </select>
            </label>
          </div>
          {newRoomSettings.gameMode === 'rounds' ? (
            <div>
              <label>
                Number of Rounds:
                <input
                  type="number"
                  value={newRoomSettings.maxRounds}
                  onChange={e => setNewRoomSettings(prev => ({
                    ...prev,
                    maxRounds: parseInt(e.target.value, 10) || 1
                  }))}
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
                  onChange={e => setNewRoomSettings(prev => ({
                    ...prev,
                    pointsToWin: parseInt(e.target.value, 10) || 1
                  }))}
                  min="1"
                  max="10"
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
                onChange={e => setNewRoomSettings(prev => ({
                  ...prev,
                  roundDuration: parseInt(e.target.value, 10) || 30
                }))}
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
                onChange={e => setNewRoomSettings(prev => ({
                  ...prev,
                  drawerChoice: e.target.value
                }))}
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
                onChange={e => setNewRoomSettings(prev => ({
                  ...prev,
                  isPrivate: e.target.checked,
                  accessCode: e.target.checked ? prev.accessCode : ''
                }))}
              />
              Private Room
            </label>
          </div>
          {newRoomSettings.isPrivate && (
            <div>
              <label>
                Access Code (optional):
                <input
                  type="text"
                  value={newRoomSettings.accessCode}
                  onChange={e => setNewRoomSettings(prev => ({
                    ...prev,
                    accessCode: e.target.value.toUpperCase()
                  }))}
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