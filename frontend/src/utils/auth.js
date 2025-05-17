import { jwtDecode } from 'jwt-decode';

export function getLoggedInUser() {
  if (typeof window === 'undefined') return null;
  
  const storedToken = localStorage.getItem('jwtToken');
  if (!storedToken) return null;
  
  try {
    const decodedToken = jwtDecode(storedToken);
    return { 
      username: decodedToken.username, 
      userId: decodedToken.userId 
    };
  } catch (error) {
    console.error("Failed to decode token", error);
    localStorage.removeItem('jwtToken'); // Clear invalid token
    return null;
  }
}

export function handleAuthChange(setLoggedInUser) {
  const currentToken = localStorage.getItem('jwtToken');
  if (currentToken) {
    try {
      setLoggedInUser(jwtDecode(currentToken));
    } catch { 
      setLoggedInUser(null); 
    }
  } else {
    setLoggedInUser(null);
  }
}

export function clearAuthToken(setLoggedInUser, setAuthMessage) {
  localStorage.removeItem('jwtToken');
  setLoggedInUser(null);
  if (setAuthMessage) setAuthMessage('Logged out.');
  window.dispatchEvent(new CustomEvent('authChange'));
}