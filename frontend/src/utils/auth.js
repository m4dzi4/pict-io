import { jwtDecode } from 'jwt-decode';
import { getSession } from 'next-auth/react';

export async function getLoggedInUser() {
  if (typeof window === 'undefined') return null;
  
  // Check NextAuth session first
  try {
    const session = await getSession();
    if (session) {
      return {
        username: session.user.username || session.user.name,
        userId: session.user.id,
        backendToken: session.user.backendToken
      };
    }
  } catch (error) {
    console.error('NextAuth session error:', error);
  }
  
  // Fallback to JWT token
  const storedToken = localStorage.getItem('jwtToken');
  if (!storedToken) return null;
  
  try {
    const decodedToken = jwtDecode(storedToken);
    return { 
      username: decodedToken.username, 
      userId: decodedToken.userId,
      backendToken: storedToken
    };
  } catch (error) {
    console.error("Failed to decode token", error);
    localStorage.removeItem('jwtToken');
    return null;
  }
}

export async function handleAuthChange(setLoggedInUser) {
  const user = await getLoggedInUser();
  setLoggedInUser(user);
}

export function clearAuthToken(setLoggedInUser, setAuthMessage) {
  localStorage.removeItem('jwtToken');
  setLoggedInUser(null);
  if (setAuthMessage) setAuthMessage('Logged out.');
  window.dispatchEvent(new CustomEvent('authChange'));
}

// Helper function to get backend token for API calls
export async function getBackendToken() {
  const user = await getLoggedInUser();
  return user?.backendToken || null;
}