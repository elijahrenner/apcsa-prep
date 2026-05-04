"use client";

import { useEffect, useRef, useState } from "react";

export type ExamTimerProps = {
  seconds: number;
  onExpire: () => void;
};

export function ExamTimer({ seconds, onExpire }: ExamTimerProps) {
  const [remaining, setRemaining] = useState<number>(seconds);
  const fired = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        expireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const urgent = remaining < 120;

  return (
    <div
      className={`font-mono text-2xl tabular-nums tracking-tight text-neutral-900 ${
        urgent ? "animate-pulse" : ""
      }`}
    >
      {pad(mm)}:{pad(ss)}
    </div>
  );
}
