import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './GameEndPopup.module.css';

const GameEndPopup = ({ winner, scores, gameStats, socket, roomId }) => {
  const router = useRouter();
  const scoreArray = Object.entries(scores).map(([username, score]) => ({ 
    username, 
    score 
  })).sort((a, b) => b.score - a.score); // Sort by score in descending order;

  const handleReturnHome = () => {
    // Po prostu przekieruj na stronę główną - endGame już zajmuje się resztą
    router.push('/');
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <h2>Game ended!</h2>
        <div className={styles.winnerInfo}>
          <h3>Winner: {winner.name}</h3>
          <p>Points: {winner.score}</p>
        </div>
        
        <div className={styles.gameStats}>
          <p>Rounds: {gameStats.rounds}</p>
          <p>Time: {Math.floor(gameStats.totalTime / 60000)} min {Math.floor((gameStats.totalTime % 60000) / 1000)} sek</p>
        </div>
        
        <h3>Final Scores:</h3>
        <div className={styles.scoresTable}>
          {scoreArray.map((player, index) => (
            <div key={index}>
              <span>{player.username === winner.name ? '👑 ' : ''} {index + 1}. {player.username}</span>
              <span>{player.score} points</span>
            </div>
          ))}
        </div>
        
        <div className={styles.buttonContainer}>
          <button 
            onClick={handleReturnHome}
            className={styles.homeButton}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEndPopup;