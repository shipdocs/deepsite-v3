"use client";
import Loading from "@/components/loading";
import { useState, useEffect } from "react";
import { useInterval } from "react-use";

const TEXTS = [
  "Teaching pixels to dance with style...",
  "AI is having a creative breakthrough...",
  "Channeling digital vibes into pure code...",
  "Summoning the website spirits...",
  "Brewing some algorithmic magic...",
  "Composing a symphony of divs and spans...",
  "Riding the wave of computational creativity...",
  "Aligning the stars for perfect design...",
  "Training circus animals to write CSS...",
  "Launching ideas into the digital stratosphere...",
];

export const AiLoading = ({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) => {
  const [selectedText, setSelectedText] = useState(
    text ?? TEXTS[0] // Start with first text to avoid hydration issues
  );

  // Set random text on client-side only to avoid hydration mismatch
  useEffect(() => {
    if (!text) {
      setSelectedText(TEXTS[Math.floor(Math.random() * TEXTS.length)]);
    }
  }, [text]);

  useInterval(() => {
    if (!text) {
      if (selectedText === TEXTS[TEXTS.length - 1]) {
        setSelectedText(TEXTS[0]);
      } else {
        setSelectedText(TEXTS[TEXTS.indexOf(selectedText) + 1]);
      }
    }
  }, 12000);
  return (
    <div className={`flex items-center justify-start gap-2 ${className}`}>
      <Loading overlay={false} className="!size-5 opacity-50" />
      <p className="text-neutral-400 text-sm">
        <span className="inline-flex">
          {selectedText.split("").map((char, index) => (
            <span
              key={index}
              className="bg-gradient-to-r from-neutral-100 to-neutral-300 bg-clip-text text-transparent animate-pulse"
              style={{
                animationDelay: `${index * 0.1}s`,
                animationDuration: "1.3s",
                animationIterationCount: "infinite",
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </span>
      </p>
    </div>
  );
};
