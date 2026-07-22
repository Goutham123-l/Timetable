import React, { useEffect, useRef, useState } from "react";

/**
 * Delete button that, when clicked, arms a short countdown with an Undo
 * option instead of an immediate action or a jarring browser confirm().
 * Only calls onConfirm once the countdown finishes without being cancelled.
 */
export default function UndoDeleteButton({
  label,
  onConfirm,
  size = "xs",
  seconds = 3,
}: {
  label: string; // e.g. "teacher", "this row", "all assignments" — used in the inline message
  onConfirm: () => void;
  size?: "xs" | "sm";
  seconds?: number;
}) {
  const [armed, setArmed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function start() {
    setArmed(true);
    setSecondsLeft(seconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setArmed(false);
          onConfirm();
          return seconds;
        }
        return s - 1;
      });
    }, 1000);
  }

  function cancel() {
    if (timerRef.current) clearInterval(timerRef.current);
    setArmed(false);
    setSecondsLeft(seconds);
  }

  const textSize = size === "xs" ? "text-xs" : "text-sm";

  if (armed) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textSize} bg-red-50 border border-red-200 rounded-full px-2 py-0.5`}>
        <span className="text-red-600">Deleting {label} in {secondsLeft}s…</span>
        <button onClick={cancel} className="text-brand-600 font-medium underline">
          Undo
        </button>
      </span>
    );
  }

  return (
    <button onClick={start} className={`text-red-500 font-medium ${textSize}`}>
      Delete
    </button>
  );
}
