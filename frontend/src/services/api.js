const API_BASE_URL = 'http://localhost:4000';

export async function validateRoom(roomCode) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rooms/validate/${roomCode.trim()}`);
    return await response.json();
  } catch (error) {
    console.error('Error validating room:', error);
    return { success: false, message: 'Network error' };
  }
}

export async function createRoom(settings, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ settings }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error creating room:', error);
    return { success: false, message: 'Network error' };
  }
}