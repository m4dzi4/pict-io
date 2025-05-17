'use client';
import React from 'react';

export default function WelcomeSection({ username, message }) {
  return (
    <div>
      <h1>Pict-IO</h1>
      {username && <div>Welcome, {username}!</div>}
      {message && <div>{message}</div>}
    </div>
  );
}