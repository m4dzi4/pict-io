'use client';
import React from 'react';

export default function CreateRoomSection({ onClick }) {
  return (
    <div>
      <h2>Create New Room</h2>
      <button onClick={onClick}>Configure & Create Room</button>
    </div>
  );
}