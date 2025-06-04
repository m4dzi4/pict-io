"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/services/api";
import styles from "./ActiveRooms.module.css";

const ActiveRooms = ({ loggedInUser }) => {
  const [activeRooms, setActiveRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(true);
  const router = useRouter();
  const apiUrl = getApiUrl();

  // UPROSZCZONA fetch function - bez memoization
  const fetchActiveRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch(`${apiUrl}/api/rooms/active`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setActiveRooms(data.rooms);
      } else {
        console.error("Failed to fetch rooms:", data.message);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Auto-fetch and set up polling
  useEffect(() => {
    fetchActiveRooms();
    const interval = setInterval(fetchActiveRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const getDrawerModeLabel = (mode) => {
    switch (mode) {
      case "random": return "Random";
      case "queue": return "Queue";
      case "winner": return "Winner → Drawer";
      default: return mode;
    }
  };

  const getStatusInfo = (room) => {
    if (room.currentStatus === "playing") {
      return { text: "In Progress", className: styles.statusPlaying };
    }
    return { text: "Waiting", className: styles.statusWaiting };
  };

  const handleJoinActiveRoom = (room) => {
    if (room.isPrivate) {
      setJoinRoomCode(room.roomId);
      setShowJoinModal(true);
    } else {
      router.push(`/game/${room.roomId}`);
    }
  };

  const handleJoinRoomWithCode = async () => {
    if (!joinRoomCode.trim()) {
      alert("Please enter a room code.");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/rooms/validate/${joinRoomCode.trim()}`);
      const data = await response.json();
      
      if (data.success) {
        router.push(`/game/${data.roomId}${data.isPrivate ? "?private=true" : ""}`);
        setShowJoinModal(false);
        setJoinRoomCode("");
      } else {
        alert("Failed to join room: " + (data.message || "Invalid room code."));
      }
    } catch (error) {
      console.error("Join room fetch error:", error);
      alert("Failed to validate room code. Please try again.");
    }
  };

  const handleCreateRoom = () => {
    if (!loggedInUser) {
      router.push("/login?redirect=/");
      return;
    }
    window.dispatchEvent(new CustomEvent("openCreateRoomModal"));
  };

  return (
    <div className={styles.activeRoomsContainer}>
      {/* Create Room Section - bez zmian */}
      <div className={styles.createSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🎮 Start Playing</h2>
          <button 
            onClick={() => setShowCreateSection(!showCreateSection)}
            className={styles.collapseButton}
          >
            {showCreateSection ? "⏶" : "⏷"}
          </button>
        </div>

        {showCreateSection && (
          <div className={styles.createContent}>
            <div className={styles.createCard}>
              <div className={styles.createCardContent}>
                <div className={styles.createIcon}>🚀</div>
                <div className={styles.createInfo}>
                  <h3 className={styles.createTitle}>Create New Room</h3>
                  <p className={styles.createDescription}>
                    Set up a custom game with your preferred settings
                  </p>
                </div>
                <button 
                  onClick={handleCreateRoom}
                  className={styles.createButton}
                >
                  Create Room
                </button>
              </div>
            </div>

            <div className={styles.joinCard}>
              <div className={styles.joinCardContent}>
                <div className={styles.joinIcon}>🔐</div>
                <div className={styles.joinInfo}>
                  <h3 className={styles.joinTitle}>Join with Code</h3>
                  <p className={styles.joinDescription}>
                    Enter a room code to join a private game
                  </p>
                </div>
                <div className={styles.joinInputGroup}>
                  <input
                    type="text"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE"
                    className={styles.joinInput}
                  />
                  <button 
                    onClick={() => setShowJoinModal(true)}
                    className={styles.joinButton}
                    disabled={!joinRoomCode.trim()}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Rooms Section */}
      <div className={styles.roomsSection}>
        <div className={styles.roomsHeader}>
          <div className={styles.roomsHeaderLeft}>
            <h2 className={styles.roomsTitle}>🎯 Active Games</h2>
            <span className={styles.roomsCount}>
              {activeRooms.length} {activeRooms.length === 1 ? 'room' : 'rooms'} available
            </span>
          </div>
          {/* ZMIENIONY przycisk - zawsze ta sama ikona */}
          <button 
            onClick={fetchActiveRooms}
            className={styles.refreshButton}
            disabled={isLoadingRooms}
          >
            🔄
          </button>
        </div>

        {/* Wrapper o stałej wysokości */}
        <div className={styles.roomsContent}>
          {isLoadingRooms && activeRooms.length === 0 ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <span>Loading active games...</span>
            </div>
          ) : activeRooms.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎮</div>
              <div className={styles.emptyTitle}>No Active Games</div>
              <div className={styles.emptySubtitle}>
                Be the first to create a room and start playing!
              </div>
            </div>
          ) : (
            <div className={styles.roomsGrid}>
              {activeRooms.map((room) => {
                const status = getStatusInfo(room);
                const isFull = room.playerCount >= room.maxPlayers;
                
                return (
                  <div key={room.roomId} className={styles.roomCard}>
                    <div className={styles.roomHeader}>
                      <div className={styles.roomId}>
                        <span className={styles.roomIdLabel}>Room:</span>
                        <span className={styles.roomIdValue}>{room.roomId}</span>
                      </div>
                      <div className={styles.roomBadges}>
                        {room.isPrivate && (
                          <span className={styles.privateBadge}>🔒 Private</span>
                        )}
                        <span className={`${styles.statusBadge} ${status.className}`}>
                          {status.text}
                        </span>
                      </div>
                    </div>

                    <div className={styles.roomContent}>
                      <div className={styles.roomInfo}>
                        <div className={styles.infoRow}>
                          <span className={styles.infoIcon}>👑</span>
                          <span className={styles.infoLabel}>Host:</span>
                          <span className={styles.infoValue}>{room.ownerName || "Unknown"}</span>
                        </div>
                        
                        <div className={styles.infoRow}>
                          <span className={styles.infoIcon}>👥</span>
                          <span className={styles.infoLabel}>Players:</span>
                          <span className={`${styles.infoValue} ${isFull ? styles.fullPlayers : ""}`}>
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                        </div>

                        <div className={styles.infoRow}>
                          <span className={styles.infoIcon}>🎯</span>
                          <span className={styles.infoLabel}>Mode:</span>
                          <span className={styles.infoValue}>
                            {room.gameMode === "rounds" 
                              ? `${room.maxRounds} rounds` 
                              : `First to ${room.pointsToWin} points`}
                          </span>
                        </div>

                        <div className={styles.infoRow}>
                          <span className={styles.infoIcon}>🎨</span>
                          <span className={styles.infoLabel}>Drawer:</span>
                          <span className={styles.infoValue}>
                            {getDrawerModeLabel(room.drawerChoice)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.roomActions}>
                        <button
                          onClick={() => handleJoinActiveRoom(room)}
                          disabled={isFull}
                          className={`${styles.joinRoomButton} ${isFull ? styles.disabled : ""}`}
                        >
                          {isFull ? "Room Full" : 
                           room.isPrivate ? "Join Private" : "Join Game"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal bez zmian */}
      {showJoinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Join Private Room</h3>
              <button 
                onClick={() => setShowJoinModal(false)}
                className={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <p className={styles.modalDescription}>
                Enter the access code for this private room:
              </p>
              <input
                type="text"
                value={joinRoomCode}
                onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter access code..."
                className={styles.modalInput}
                autoFocus
              />
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                onClick={() => setShowJoinModal(false)}
                className={styles.modalCancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handleJoinRoomWithCode}
                className={styles.modalJoinButton}
                disabled={!joinRoomCode.trim()}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveRooms;