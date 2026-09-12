import React from "react";

interface PhotoScore {
  uri: string;
  score: number;
}

interface IntelligenceV3 {
  listing: string;
  flipProbability: number;
  photoScores: PhotoScore[];
  damageDetected: boolean;
}

interface IntelligencePanelProps {
  intel: IntelligenceV3;
}

export default function IntelligencePanel({ intel }: IntelligencePanelProps) {
  if (!intel) return null;

  return (
    <div className="text-white bg-flipGlass p-4 rounded-xl border border-gold mt-6">
      <h3 className="text-gold font-bold text-lg mb-3">AI Intelligence (V3)</h3>

      {/* Flip Probability */}
      <p className="text-white/80 text-sm mb-2">
        Flip Probability:{" "}
        <span className="font-bold text-gold">{intel.flipProbability}%</span>
      </p>

      {/* AI Listing */}
      <p className="text-white/80 text-sm mb-3">
        AI Listing:{" "}
        <span className="font-bold">{intel.listing}</span>
      </p>

      <hr className="border-gold/40 my-3" />

      {/* Photo Scores */}
      <h4 className="text-white/70 text-sm mb-2">Photo Scores</h4>

      {intel.photoScores.map((p: PhotoScore, i: number) => (
        <div key={i} className="text-white/60 text-xs mb-1">
          Score {p.score}/100
        </div>
      ))}

      <hr className="border-gold/40 my-3" />

      {/* Damage Detection */}
      <p className="text-white/80 text-sm">
        Damage Detected:{" "}
        <span className="font-bold">
          {intel.damageDetected ? "YES" : "NO"}
        </span>
      </p>
    </div>
  );
}

