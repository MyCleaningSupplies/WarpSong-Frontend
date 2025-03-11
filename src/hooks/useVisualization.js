import { useEffect } from 'react';

export default function useVisualization({ mainAnalyzer, isPlaying }) {
  // Animation for main visualizer canvas
  useEffect(() => {
    if (!mainAnalyzer) return;
    const mainInterval = setInterval(drawMainVisualizer, 50);
    return () => clearInterval(mainInterval);
  }, [mainAnalyzer, isPlaying]);

  const drawMainVisualizer = () => {
    const canvas = document.getElementById("mainVisualizer");
    if (!canvas || !mainAnalyzer) return;

    // Skip rendering if tab is not visible or not playing
    if (document.hidden || !isPlaying) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    try {
      const barCount = 24;
      const barWidth = width / barCount;
      const buffer = mainAnalyzer.getValue();

      for (let i = 0; i < barCount; i++) {
        const start = Math.floor((i / barCount) * buffer.length);
        const end = Math.floor(((i + 1) / barCount) * buffer.length);
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += Math.abs(buffer[j]);
        }
        const avg = sum / (end - start);
        const barHeight = avg * height;

        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "#8B5CF6");
        gradient.addColorStop(1, "#EC4899");
        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
      }
    } catch (error) {
      // Silently handle any visualization errors
    }
  };

  return {
    drawMainVisualizer
  };
}
