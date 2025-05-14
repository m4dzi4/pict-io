'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode'; // If you need to decode for immediate use

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setMessage('Registration successful! Please log in.');
    }
    if (searchParams.get('redirect')) {
        setMessage('Please log in to continue.');
    }
    if (localStorage.getItem('jwtToken')) { // If already logged in, redirect
        router.push('/');
    }
  }, [searchParams, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!username || !password) {
      setMessage('Username and password are required.');
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      setMessage(data.message);
      if (data.success && data.token) {
        localStorage.setItem('jwtToken', data.token);
        // Optionally decode for immediate use or let TopBar handle it
        // const decoded = jwtDecode(data.token);
        // console.log('Logged in user:', decoded.username);
        window.dispatchEvent(new CustomEvent('authChange')); // Notify TopBar/Layout
        const redirectUrl = searchParams.get('redirect') || '/';
        router.push(redirectUrl);
      }
    } catch (error) {
      console.error('Login fetch error:', error);
      setMessage('Login failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-md text-black">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Login</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors duration-150"
          >
            Login
          </button>
        </form>
        {message && (
          <p className={`mt-4 text-center text-sm ${message.includes('successful') ? 'text-green-600' : (message.includes('required') || message.includes('failed') || message.includes('Invalid') ? 'text-red-600' : 'text-gray-700') }`}>
            {message}
          </p>
        )}
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/register" className="text-purple-600 hover:text-purple-800 font-medium">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}