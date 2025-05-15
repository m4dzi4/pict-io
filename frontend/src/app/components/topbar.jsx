// filepath: d:\SUMMER 2025 POLIBUDA\Advanced Web Tech\pict-io\frontend\src\app\components\topbar.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

export default function TopBar() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      try {
        jwtDecode(token);
        setLoggedIn(true);
      } catch {
        setLoggedIn(false);
      }
    } else {
      setLoggedIn(false);
    }
    const handler = () => {
      const token = localStorage.getItem('jwtToken');
      setLoggedIn(!!token);
    };
    window.addEventListener('authChange', handler);
    return () => window.removeEventListener('authChange', handler);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('jwtToken');
    setLoggedIn(false);
    window.dispatchEvent(new CustomEvent('authChange'));
    router.push('/');
  };

  return (
    <nav>
      <div>
          <Link href="/">Home</Link>
          {loggedIn ? (<button onClick={handleSignOut}> Sign Out </button>)
          : (
          <>
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
          </>
          )}
        </div>
    </nav>
  );
}
