'use client';

import { useState } from 'react';

export default function TopBar({ username, roomCode, onUsernameUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);

  const shareRoom = () => {
    navigator.clipboard.writeText(roomCode)
      .then(() => alert('Room code copied to clipboard: ' + roomCode))
      .catch(err => console.error('Failed to copy room code:', err));
  };

  const saveSettings = () => {
    if (tempUsername.trim()) {
      onUsernameUpdate(tempUsername);
    }
    setShowSettings(false);
  };

  return (
    <>
      <div className="bg-white shadow mb-6 p-4 rounded-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{username}</span>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={shareRoom}
            className="bg-blue-500 text-white px-3 py-1 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Room
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Room Settings
          </button>
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Room Settings</h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Your Name
              </label>
              <input 
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Enter your name"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Room Code
              </label>
              <div className="flex">
                <input 
                  type="text"
                  value={roomCode}
                  readOnly
                  className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 bg-gray-100"
                />
                <button 
                  onClick={shareRoom}
                  className="bg-blue-500 text-white px-4 rounded-r"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={saveSettings}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}