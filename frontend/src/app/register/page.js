'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './Register.module.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    
    if (!username || !password || !confirmPassword) {
      setMessage('All fields are required.');
      setMessageType('error');
      return;
    }
    
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long.');
      setMessageType('error');
      return;
    }
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setMessageType('error');
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      setMessage(data.message);
      
      if (data.success) {
        setMessageType('success');
        console.log('Registration successful:', data.user);
        setTimeout(() => {
          router.push('/login?registered=true');
        }, 1500);
      } else {
        setMessageType('error');
      }
    } catch (error) {
      console.error('Registration fetch error:', error);
      setMessage('Registration failed. Please try again.');
      setMessageType('error');
    }
  };

  // Determine message class based on type
  const getMessageClass = () => {
    if (messageType === 'success') return styles.messageSuccess;
    if (messageType === 'error') return styles.messageError;
    return styles.message;
  };

  return (
    <div className={styles.container}>
      <div className={styles.registerCard}>
        <h1 className={styles.title}>Create Account</h1>
        
        <form onSubmit={handleRegister} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password (min. 6 characters)"
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className={styles.input}
              required
            />
          </div>
          
          <button type="submit" className={styles.registerButton}>
            Register
          </button>
        </form>

        {message && <p className={getMessageClass()}>{message}</p>}

        <p className={styles.loginLink}>
          Already have an account?{' '}
          <Link href="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}