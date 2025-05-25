import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './GameEndPopup.module.css';

const GameEndPopup = ({ winner, scores, gameStats, socket, roomId, isRoomOwner }) => {
  const router = useRouter();

  const handleReturnHome = () => {
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
        
        <div className={styles.buttonContainer}>
          <button 
            onClick={handleReturnHome}
            className={styles.homeButton}
          >
            Go to main page
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEndPopup;