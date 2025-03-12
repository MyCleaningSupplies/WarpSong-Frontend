//LevelUpModal.jsx
import React from 'react';

const LevelUpModal = ({ visible, level, onClose }) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="level-up-modal">
      <div className="modal-content">
        <h2>Congratulations!</h2>
        <p>You have reached Level {level}!</p>
        <button onClick={onClose}>Continue</button>
      </div>
    </div>
  );
};

export default LevelUpModal;
