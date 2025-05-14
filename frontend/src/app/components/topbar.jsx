// filepath: d:\SUMMER 2025 POLIBUDA\Advanced Web Tech\pict-io\frontend\src\app\components\topbar.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [loggedInUser, setLoggedInUser] = useState(null); // Stores { username, userId }
  // const [usernameForEdit, setUsernameForEdit] = useState(''); // Can be removed if not editing username via topbar
  
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);

  // Game settings state (can be removed if not used in TopBar directly)
  const [roomSize, setRoomSize] = useState(8);
  const [isPrivate, setIsPrivate] = useState(false);
  const [drawerMode, setDrawerMode] = useState('first_joiner');

  const isGamePage = pathname.startsWith('/game');

  useEffect(() => {
    const updateUserStateFromToken = () => {
      const storedToken = localStorage.getItem('jwtToken');
      if (storedToken) {
        try {
          const decodedToken = jwtDecode(storedToken);
          setLoggedInUser({ username: decodedToken.username, userId: decodedToken.userId });
          // setUsernameForEdit(decodedToken.username);
        } catch (error) {
          console.error("Error decoding token in TopBar:", error);
          localStorage.removeItem('jwtToken'); // Clear invalid token
          setLoggedInUser(null);
        }
      } else {
        setLoggedInUser(null);
      }
    };

    updateUserStateFromToken(); // Initial check
    window.addEventListener('authChange', updateUserStateFromToken); // Listen for auth changes

    return () => {
      window.removeEventListener('authChange', updateUserStateFromToken);
    };
  }, []);

  // const handleUsernameUpdate = () => { ... }; // Keep if needed, but ensure it updates JWT or re-authenticates

  const handleGameSettingsUpdate = () => {
    console.log("Updating game settings:", { roomSize, isPrivate, drawerMode });
    setShowGameSettings(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('jwtToken'); // Remove JWT
    setLoggedInUser(null);
    setShowUserSettings(false);
    window.dispatchEvent(new CustomEvent('authChange'));
    router.push('/'); 
  };

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Pict-IO
        </Link>
        <div className="flex items-center space-x-4">
          {loggedInUser ? (
            <>
              <div className="relative">
                <button onClick={() => setShowUserSettings(!showUserSettings)} className="flex items-center hover:text-gray-300">
                  <span>{loggedInUser.username}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {showUserSettings && (
                  <div className="absolute right-0 mt-2 w-64 bg-white text-black rounded-md shadow-lg py-1 z-50">
                    {/* User stats can be added here if fetched after login or included in token (not recommended for large stats) */}
                    {/* <div className="px-4 py-2">
                      <p className="text-sm"><strong>Stats:</strong></p>
                      <p className="text-xs">Rank: N/A</p>
                    </div>
                    <hr/> */}
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {isGamePage && (
                 // ... (Game Settings Dropdown - no changes needed here)
                <div className="relative">
                  <button onClick={() => setShowGameSettings(!showGameSettings)} className="hover:text-gray-300">
                    Game Settings
                    <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  {showGameSettings && (
                    <div className="absolute right-0 mt-2 w-72 bg-white text-black rounded-md shadow-lg p-4 z-50">
                      <h4 className="text-md font-semibold mb-2">Room Configuration</h4>
                      <div className="mb-2">
                        <label className="block text-xs font-medium">Room Size (Players):</label>
                        <input type="number" min="2" max="16" value={roomSize} onChange={e => setRoomSize(parseInt(e.target.value))} className="w-full px-2 py-1 border rounded text-sm"/>
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs font-medium">
                          <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="mr-1"/>
                          Private Room
                        </label>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium">Drawer Selection:</label>
                        <select value={drawerMode} onChange={e => setDrawerMode(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                          <option value="first_joiner">First to Join</option>
                          <option value="random">Random per Round</option>
                          <option value="host_selects">Host Selects</option>
                        </select>
                      </div>
                      <button onClick={handleGameSettingsUpdate} className="w-full text-sm bg-green-500 hover:bg-green-600 text-white py-1 rounded">
                        Apply Settings
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gray-300">
                Login
              </Link>
              <Link href="/register" className="hover:text-gray-300">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}