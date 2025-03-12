//StreakCounter.jsx
import React from 'react';

const StreakCounter = ({ streak }) => {
  return (
    <div className="streak-counter">
      🔥 {streak} day streak!
    </div>
  );
};

export default StreakCounter;
