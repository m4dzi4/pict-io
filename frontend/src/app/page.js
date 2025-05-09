'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Link from 'next/link';

let socket;

export default function HomePage() {
  const [rooms, setRooms] = useState([
    { id: '1.220', users: ['User 1', 'User 2'] },
    { id: '3.55', users: ['User 1...'] },
    { id: '3.79%', users: [] }
  ]);

  const [leaderboard, setLeaderboard] = useState([
    { rank: 1, name: 'Player 1', games: 10, points: 100, winPercent: '80%' },
    { rank: 2, name: 'Player 2', games: 8, points: 90, winPercent: '75%' },
    { rank: 3, name: 'Player 3', games: 15, points: 85, winPercent: '60%' },
    { rank: 4, name: 'Player 4', games: 12, points: 75, winPercent: '50%' },
    { rank: 5, name: 'Player 5', games: 7, points: 65, winPercent: '40%' }
  ]);

  const [showRoomList, setShowRoomList] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    socket = io('http://localhost:4000');

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server:', socket.id);
    });

    // Listen for room updates
    socket.on('room_update', (updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      if (socket) {
        socket.off('room_update');
        socket.disconnect();
      }
    };
  }, []);

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      console.log('Joining room with code:', roomCode);
      // Add room joining logic here
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Pict-IO</h1>
        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Profile
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
            Settings
          </button>
        </div>
      </div>
      
      {/* Three Vertical Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Section 1: Create new room */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Create new room</h2>
          <div className="space-y-4">
            <button className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Play as a User
            </button>
            <button className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600">
              Play as a Guest
            </button>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <Link 
                href="/auth/login-signup" 
                className="w-full block py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-center"
              >
                Log In / Sign Up
              </Link>
            </div>
          </div>
        </div>

        {/* Section 2: Active rooms */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Active rooms</h2>
          <div className="relative">
            <button 
              className="w-full flex justify-between items-center py-2 px-4 border rounded mb-2"
              onClick={() => setShowRoomList(!showRoomList)}
            >
              <span>Select a Room</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 011.414 1.414l-4 4a1 1 01-1.414 0l-4-4a1 1 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {showRoomList && (
              <div className="absolute z-10 w-full bg-white border rounded shadow-lg">
                {rooms.map((room) => (
                  <button 
                    key={room.id} 
                    className="w-full text-left py-2 px-4 hover:bg-gray-100 flex justify-between"
                    onClick={() => {
                      console.log('Room selected:', room.id);
                      setShowRoomList(false);
                    }}
                  >
                    <span>Room {room.id}</span>
                    <span className="text-sm text-gray-500">
                      {room.users.length > 0 ? `${room.users.length} players` : 'Empty'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
            Click Room to Join
          </button>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2 text-center">
              Currently active rooms: {rooms.length}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {rooms.map((room, idx) => (
                <div key={idx} className="bg-gray-100 p-2 rounded text-center text-sm">
                  Room {room.id.substring(0, 4)}
                </div>
              )).slice(0, 6)}
            </div>
          </div>
        </div>

        {/* Section 3: Leaderboard */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="py-2 text-left text-sm font-medium text-gray-700">Rank</th>
                  <th className="py-2 text-left text-sm font-medium text-gray-700">Player</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-700">Games</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-700">Points</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-700">Win %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player) => (
                  <tr key={player.rank} className="border-t">
                    <td className="py-2 text-sm">{player.rank}</td>
                    <td className="py-2 text-sm font-medium">{player.name}</td>
                    <td className="py-2 text-sm text-right">{player.games}</td>
                    <td className="py-2 text-sm text-right">{player.points}</td>
                    <td className="py-2 text-sm text-right">{player.winPercent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Bottom Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Join a random game</h2>
          <button className="w-full py-3 bg-green-500 text-white rounded-lg text-lg hover:bg-green-600">
            Join Random Game
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Insert room code</h2>
          <div className="flex">
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter room code..." 
              className="flex-1 px-4 py-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleJoinRoom}
              className="px-6 py-3 bg-blue-500 text-white rounded-r hover:bg-blue-600"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}