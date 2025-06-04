"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/services/api";
import styles from "./CreateRoom.module.css";

const CreateRoom = ({ loggedInUser, onClose }) => {
  const [newRoomSettings, setNewRoomSettings] = useState({
    maxPlayers: 8,
    isPrivate: false,
    accessCode: "",
    gameMode: "rounds", // 'rounds' or 'points'
    maxRounds: 5, // Default 5 rounds
    pointsToWin: 25, // Default 25 points to win (for points mode)
    roundDuration: 60, // Default 60 seconds per round
    drawerChoice: "random", // 'random' or 'queue' or 'winner'
  });

  const router = useRouter();
  const apiUrl = getApiUrl();

  const handleCreateRoom = async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
      alert("Please log in to create a room.");
      router.push("/login?redirect=/");
      return;
    }

    // Validate settings before submitting
    if (newRoomSettings.isPrivate && !newRoomSettings.accessCode.trim()) {
      alert("Please enter an access code for private rooms");
      return;
    }

    if (
      newRoomSettings.gameMode === "rounds" &&
      (newRoomSettings.maxRounds < 1 || newRoomSettings.maxRounds > 20)
    ) {
      alert("Max rounds must be between 1 and 20");
      return;
    }

    if (
      newRoomSettings.gameMode === "points" &&
      (newRoomSettings.pointsToWin < 25 || newRoomSettings.pointsToWin > 100)
    ) {
      alert("Points to win must be between 25 and 100");
      return;
    }

    if (
      newRoomSettings.roundDuration < 30 ||
      newRoomSettings.roundDuration > 300
    ) {
      alert("Round duration must be between 30 and 300 seconds");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: newRoomSettings }),
      });
      const data = await response.json();
      if (data.success && data.roomId) {
        console.log("Room created via API:", data.roomId);
        // Navigate to the dynamic game route
        router.push(`/game/${data.roomId}`);
      } else {
        alert("Failed to create room: " + (data.message || "Unknown error"));
        if (data.message && data.message.toLowerCase().includes("token")) {
          localStorage.removeItem("jwtToken");
          window.dispatchEvent(new CustomEvent("authChange"));
          router.push("/login");
        }
      }
    } catch (error) {
      console.error("Create room fetch error:", error);
      alert("Failed to create room. Please try again.");
    }
    onClose();
  };

  const getDrawerModeLabel = (mode) => {
    switch (mode) {
      case "random":
        return "Random Each Round";
      case "queue":
        return "Take Turns in Queue";
      case "winner":
        return "Winner Becomes Drawer";
      default:
        return mode;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Create New Room</h3>
          <button 
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.settingsGrid}>
            {/* Max Players */}
            <div className={styles.field}>
              <label className={styles.label}>Max Players:</label>
              <input
                type="number"
                className={styles.input}
                value={newRoomSettings.maxPlayers}
                onChange={(e) =>
                  setNewRoomSettings((prev) => ({
                    ...prev,
                    maxPlayers: parseInt(e.target.value, 10) || 2,
                  }))
                }
                min="2"
                max="16"
              />
            </div>

            {/* Game Mode */}
            <div className={styles.field}>
              <label className={styles.label}>Game Mode:</label>
              <select
                className={styles.select}
                value={newRoomSettings.gameMode}
                onChange={(e) =>
                  setNewRoomSettings((prev) => ({
                    ...prev,
                    gameMode: e.target.value,
                  }))
                }
              >
                <option value="rounds">Fixed Number of Rounds</option>
                <option value="points">First to X Points</option>
              </select>
            </div>

            {/* Rounds or Points */}
            {newRoomSettings.gameMode === "rounds" ? (
              <div className={styles.field}>
                <label className={styles.label}>Number of Rounds:</label>
                <input
                  type="number"
                  className={styles.input}
                  value={newRoomSettings.maxRounds}
                  onChange={(e) =>
                    setNewRoomSettings((prev) => ({
                      ...prev,
                      maxRounds: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  min="1"
                  max="20"
                />
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.label}>Points to Win:</label>
                <input
                  type="number"
                  className={styles.input}
                  value={newRoomSettings.pointsToWin}
                  onChange={(e) =>
                    setNewRoomSettings((prev) => ({
                      ...prev,
                      pointsToWin: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  min="25"
                  max="100"
                />
              </div>
            )}

            {/* Round Duration */}
            <div className={styles.field}>
              <label className={styles.label}>Round Time Limit (seconds):</label>
              <input
                type="number"
                className={styles.input}
                value={newRoomSettings.roundDuration}
                onChange={(e) =>
                  setNewRoomSettings((prev) => ({
                    ...prev,
                    roundDuration: parseInt(e.target.value, 10) || 30,
                  }))
                }
                min="30"
                max="300"
                step="10"
              />
            </div>

            {/* Drawer Selection */}
            <div className={styles.field}>
              <label className={styles.label}>Drawer Selection Method:</label>
              <select
                className={styles.select}
                value={newRoomSettings.drawerChoice}
                onChange={(e) =>
                  setNewRoomSettings((prev) => ({
                    ...prev,
                    drawerChoice: e.target.value,
                  }))
                }
              >
                <option value="random">Random Each Round</option>
                <option value="queue">Take Turns in Queue</option>
                <option value="winner">Winner Becomes Drawer</option>
              </select>
            </div>

            {/* Private Room Checkbox */}
            <div className={styles.fieldCheckbox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={newRoomSettings.isPrivate}
                  onChange={(e) =>
                    setNewRoomSettings((prev) => ({
                      ...prev,
                      isPrivate: e.target.checked,
                      accessCode: e.target.checked ? prev.accessCode : "",
                    }))
                  }
                />
                <span className={styles.checkboxText}>Private Room</span>
              </label>
            </div>

            {/* Access Code (if private) */}
            {newRoomSettings.isPrivate && (
              <div className={styles.field}>
                <label className={styles.label}>Access Code:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newRoomSettings.accessCode}
                  onChange={(e) =>
                    setNewRoomSettings((prev) => ({
                      ...prev,
                      accessCode: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., MYCODE"
                />
              </div>
            )}
          </div>

          <div className={styles.summary}>
            <h4 className={styles.summaryTitle}>Room Summary:</h4>
            <div className={styles.summaryContent}>
              <div>👥 {newRoomSettings.maxPlayers} players max</div>
              <div>🎮 {newRoomSettings.gameMode === "rounds" 
                ? `${newRoomSettings.maxRounds} rounds` 
                : `First to ${newRoomSettings.pointsToWin} points`}
              </div>
              <div>⏱️ {newRoomSettings.roundDuration}s per round</div>
              <div>🎨 {getDrawerModeLabel(newRoomSettings.drawerChoice)}</div>
              {newRoomSettings.isPrivate && (
                <div>🔒 Private ({newRoomSettings.accessCode || "No code set"})</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button 
            onClick={onClose}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button 
            onClick={handleCreateRoom}
            className={styles.createButton}
          >
            Create & Start Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;