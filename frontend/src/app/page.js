'use client'; // This directive makes it a Client Component

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

let socket; // Define socket outside the component to maintain a single instance

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [receivedMessage, setReceivedMessage] = useState('');

  useEffect(() => {
    // Initialize socket connection
    socket = io('http://localhost:4000'); // Your backend URL

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server:', socket.id);
    });

    socket.on('receive_guess', (data) => {
      console.log('Received guess:', data);
      setReceivedMessage(data.content);
    });

    // Clean up on component unmount
    return () => {
      if (socket) {
        socket.off('receive_guess');
        socket.disconnect();
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const sendMessage = () => {
    if (message.trim() && socket) {
      socket.emit('send_guess', { content: message });
      setMessage(''); // Clear input after sending
    }
  };

  return (
    <div>
      <h1>Pict.io Next.js Frontend</h1>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your guess"
      />
      <button onClick={sendMessage}>Send Guess</button>
      {receivedMessage && <p>Last guess received: {receivedMessage}</p>}
    </div>
  );
}