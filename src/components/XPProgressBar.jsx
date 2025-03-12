//XPProgressBar.jsx
import React from 'react';

const XPProgressBar = ({ xp, currentLevelXP, nextLevelXP, level }) => {
  // Calculate the percentage of XP progress
  const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
  const progressBarWidth = Math.min(100, Math.max(0, progress));

  return (
    <div className="xp-progress-container">
      <div className="xp-info">
        <span>Level {level}</span>
        <span>{xp - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress"
          style={{ width: `${progressBarWidth}%` }}
        />
      </div>
    </div>
  );
};

export default XPProgressBar;
