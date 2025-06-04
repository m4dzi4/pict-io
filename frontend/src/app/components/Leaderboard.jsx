"use client";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/services/api";
import styles from "./Leaderboard.module.css";

const Leaderboard = ({ loggedInUser }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const apiUrl = getApiUrl();

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/leaderboard`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setLeaderboard(data.leaderboard);
      } else {
        throw new Error(data.message || "Failed to fetch leaderboard");
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when component mounts and user is logged in
  useEffect(() => {
    if (loggedInUser) {
      fetchLeaderboard();
    }
  }, [loggedInUser]);

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return "🥇";
      case 1: return "🥈";
      case 2: return "🥉";
      default: return `#${index + 1}`;
    }
  };

  const getRankClass = (index) => {
    if (index < 3) return styles.topThree;
    if (index < 10) return styles.topTen;
    return "";
  };

  return (
    <div className={styles.leaderboardContainer}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>🏆 Leaderboard</h2>
          <div className={styles.subtitle}>Top players across all games</div>
        </div>
        <div className={styles.controls}>
          <button 
            onClick={fetchLeaderboard} 
            className={styles.refreshButton}
            disabled={isLoading}
          >
            {isLoading ? "⟳" : "🔄"}
          </button>
          <button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className={styles.toggleButton}
          >
            {showLeaderboard ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {showLeaderboard && (
        <div className={styles.leaderboardContent}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <span>Loading leaderboard...</span>
            </div>
          ) : leaderboard.length > 0 ? (
            <div className={styles.leaderboardTable}>
              {/* Header */}
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Rank</div>
                <div className={styles.headerCell}>Player</div>
                <div className={styles.headerCell}>Points</div>
                <div className={styles.headerCell}>Games</div>
                <div className={styles.headerCell}>Wins</div>
                <div className={styles.headerCell}>Win %</div>
              </div>

              {/* Body */}
              <div className={styles.tableBody}>
                {leaderboard.map((user, index) => {
                  const isCurrentUser = loggedInUser && user.username === loggedInUser.username;
                  
                  return (
                    <div
                      key={user.username}
                      className={`${styles.leaderboardRow} ${
                        isCurrentUser ? styles.currentUser : ""
                      } ${getRankClass(index)}`}
                    >
                      <div className={styles.rankCell}>
                        <span className={styles.rank}>
                          {getRankIcon(index)}
                        </span>
                      </div>
                      <div className={styles.playerCell}>
                        <span className={styles.playerName}>
                          {user.username}
                          {isCurrentUser && (
                            <span className={styles.youBadge}>You</span>
                          )}
                        </span>
                      </div>
                      <div className={styles.dataCell}>
                        <span className={styles.points}>
                          {user.totalPoints.toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.dataCell}>{user.gamesPlayed}</div>
                      <div className={styles.dataCell}>{user.gamesWon}</div>
                      <div className={styles.dataCell}>
                        <span className={styles.winRate}>{user.winRate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <div className={styles.emptyTitle}>No Rankings Yet</div>
              <div className={styles.emptySubtitle}>
                Play some games to see the leaderboard!
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;