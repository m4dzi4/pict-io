"use client";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/services/api";
import styles from "./Statistics.module.css";

const Statistics = ({ loggedInUser }) => {
  const [userStatistics, setUserStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const apiUrl = getApiUrl();

  // Fetch user statistics
  const fetchUserStatistics = async () => {
    if (!loggedInUser) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`${apiUrl}/api/user/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setUserStatistics(data.statistics);
      } else {
        throw new Error(data.message || "Failed to fetch statistics");
      }
    } catch (error) {
      console.error("Error fetching user statistics:", error);
      setError("Failed to load your statistics. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to fetch data when user changes
  useEffect(() => {
    if (loggedInUser) {
      fetchUserStatistics();
    } else {
      setUserStatistics(null);
      setError(null);
    }
  }, [loggedInUser]);

  // Don't render anything if user is not logged in
  if (!loggedInUser) {
    return null;
  }

  return (
    <div className={styles.statisticsContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>📊 Your Statistics</h3>
        <button 
          onClick={fetchUserStatistics} 
          className={styles.refreshButton}
          disabled={isLoading}
        >
          {isLoading ? "⟳" : "🔄"}
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading your statistics...</span>
        </div>
      ) : userStatistics ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎮</div>
            <div className={styles.statValue}>{userStatistics.gamesPlayed}</div>
            <div className={styles.statLabel}>Games Played</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏆</div>
            <div className={styles.statValue}>{userStatistics.gamesWon}</div>
            <div className={styles.statLabel}>Games Won</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>⭐</div>
            <div className={styles.statValue}>
              {userStatistics.totalPoints.toLocaleString()}
            </div>
            <div className={styles.statLabel}>Total Points</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>📈</div>
            <div className={styles.statValue}>{userStatistics.winRate}%</div>
            <div className={styles.statLabel}>Win Rate</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎯</div>
            <div className={styles.statValue}>{userStatistics.pointsPerGame}</div>
            <div className={styles.statLabel}>Points/Game</div>
          </div>
        </div>
      ) : (
        <div className={styles.noDataMessage}>
          <div className={styles.noDataIcon}>📊</div>
          <p>No statistics available yet.</p>
          <p className={styles.subText}>Play some games to see your stats!</p>
        </div>
      )}
    </div>
  );
};

export default Statistics;