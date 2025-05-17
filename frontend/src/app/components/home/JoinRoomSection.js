'use client';
import React, { useState } from 'react';

export default function JoinRoomSection({ onJoin }) {
  const [joinRoomCode, setJoinRoomCode] = useState('');
  
  return (
    <div>
      <h2>Join Existing Room</h2>
      <input
        type="text"
        value={joinRoomCode}
        onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
        placeholder="Enter room code..."
      />
      <button onClick={() => onJoin(joinRoomCode)}>Join</button>
    </div>
  );
}