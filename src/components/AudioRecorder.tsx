"use client";

import { Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blobToBase64, type AudioClip } from "@/lib/client";

const MAX_SECONDS = 40;
const MAX_BASE64_CHARS = 590_000; // keep in sync with the server limit

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** Records a short voice answer (works in any language) at a low bitrate. */
export default function AudioRecorder({
  value,
  onChange,
  disabled,
}: {
  value: AudioClip | null;
  onChange: (clip: AudioClip | null) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording isn't supported in this browser. Please type the answer instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        const data = await blobToBase64(blob);
        if (data.length > MAX_BASE64_CHARS) {
          setError("That recording is too long. Please keep it under 40 seconds.");
          return;
        }
        onChange({ data, mimeType: blob.type, previewUrl: URL.createObjectURL(blob) });
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser, or type the answer instead.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!recording ? (
        <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={start} disabled={disabled}>
          <Mic size={16} /> {value ? "Re-record" : "Record voice answer"}
        </button>
      ) : (
        <button type="button" className="btn !py-1.5 bg-red-600 text-sm text-white" onClick={stop}>
          <Square size={14} /> Stop ({seconds}s / {MAX_SECONDS}s)
        </button>
      )}
      {value && !recording && (
        <>
          <audio controls src={value.previewUrl} className="h-9 max-w-full" />
          <button type="button" aria-label="Delete recording" className="text-muted hover:text-red-600" onClick={() => onChange(null)}>
            <Trash2 size={16} />
          </button>
        </>
      )}
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
