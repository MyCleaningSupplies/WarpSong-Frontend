//AchievementBadge.jsx
import React from 'react';

const AchievementBadge = ({ type, unlocked }) => {
  return (
    <div className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`}>
      {type}
    </div>
  );
};

export default AchievementBadge;
