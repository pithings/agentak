import type { ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MicIcon, SquareIcon } from "@/lib/icons";
import { useAnimation } from "@/lib/use-animation";
import { useInteraction } from "@/lib/use-interaction";
import { sx, type Sx } from "@/styles/sx";

// The pulse ring used to need its own keyframes — `wa-ping`, not the shared
// `u.pulse` — because the three rings stagger with their own `animation-delay`.
// `useAnimation()` takes a `delay` in its options instead, so no keyframes are
// left. `75%, 100% { … }` set both stops to the same values, so the ring reaches
// its expanded, transparent state by 75% of the cycle and holds there until
// it loops. The implicit `0%` (the ring's own resting style) is written out
// below since WAAPI does not infer it the way the CSS shorthand did.
const PING_FRAMES: Keyframe[] = [
  { offset: 0, opacity: 1, transform: "scale(1)" },
  { offset: 0.75, opacity: 0, transform: "scale(2)" },
  { offset: 1, opacity: 0, transform: "scale(2)" },
];

const S = {
  speech: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  speechRing: {
    position: "absolute",
    inset: "0",
    border: "2px solid color-mix(in oklab, var(--wa-destructive) 30%, transparent)",
    borderRadius: "9999px",
  },
  // Reaches Button as `style`, so it lands after the variant — the button has
  // to sit over the rings, and the listening state repaints the variant.
  speechButton: { position: "relative", zIndex: "1", borderRadius: "9999px" },
  speechListening: {
    background: "var(--wa-destructive)",
    color: "var(--wa-destructive-foreground)",
  },
  speechListeningHover: {
    background: "color-mix(in oklab, var(--wa-destructive) 80%, transparent)",
  },
} satisfies Record<string, Sx>;

// Minimal shape of the Web Speech API. It is not in every lib.dom, and the
// component only reads these fields.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
}

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}

interface SpeechResultEvent extends Event {
  results: SpeechResultList;
  resultIndex: number;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechInputMode = "speech-recognition" | "media-recorder" | "none";

/** Reads the constructor off `window` — vendor prefixed on chromium. */
const getSpeechRecognition = (): SpeechRecognitionConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
};

const detectSpeechInputMode = (): SpeechInputMode => {
  if (typeof window === "undefined") return "none";
  if (getSpeechRecognition()) return "speech-recognition";
  if (
    "MediaRecorder" in window &&
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator
  ) {
    return "media-recorder";
  }
  return "none";
};

/**
 * One pulse ring. A component of its own because `useAnimation()` is a hook
 * — it has to run once per ring, in the same position every render, which a
 * hook call inside the `[0, 1, 2].map()` below cannot guarantee.
 */
const SpeechRing = ({ delay }: { delay: number }) => {
  const options = useMemo<KeyframeAnimationOptions>(
    () => ({ delay, duration: 2000, easing: "cubic-bezier(0, 0, 0.2, 1)", iterations: Infinity }),
    [delay],
  );
  const ref = useAnimation<HTMLDivElement>(PING_FRAMES, options);
  return <div ref={ref} style={S.speechRing} />;
};

export type SpeechInputProps = ComponentProps<typeof Button> & {
  onTranscriptionChange?: (text: string) => void;
  /**
   * Called with the recording when the Web Speech API is missing (firefox,
   * safari). Return the transcript; it is passed to `onTranscriptionChange`.
   */
  onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
  lang?: string;
};

export const SpeechInput = ({
  className,
  style,
  onTranscriptionChange,
  onAudioRecorded,
  lang = "en-US",
  ...props
}: SpeechInputProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode] = useState<SpeechInputMode>(detectSpeechInputMode);
  const [isRecognitionReady, setIsRecognitionReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Callbacks are read through refs, so the listeners never have to be rebound.
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  const onAudioRecordedRef = useRef(onAudioRecorded);
  onTranscriptionChangeRef.current = onTranscriptionChange;
  onAudioRecordedRef.current = onAudioRecorded;

  useEffect(() => {
    if (mode !== "speech-recognition") return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    const handleStart = () => setIsListening(true);
    const handleEnd = () => setIsListening(false);
    const handleError = () => setIsListening(false);

    const handleResult = (event: Event) => {
      const speechEvent = event as SpeechResultEvent;
      let finalTranscript = "";

      for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i += 1) {
        const result = speechEvent.results[i];
        if (result.isFinal) finalTranscript += result[0]?.transcript ?? "";
      }

      if (finalTranscript) onTranscriptionChangeRef.current?.(finalTranscript);
    };

    recognition.addEventListener("start", handleStart);
    recognition.addEventListener("end", handleEnd);
    recognition.addEventListener("result", handleResult);
    recognition.addEventListener("error", handleError);

    recognitionRef.current = recognition;
    setIsRecognitionReady(true);

    return () => {
      recognition.removeEventListener("start", handleStart);
      recognition.removeEventListener("end", handleEnd);
      recognition.removeEventListener("result", handleResult);
      recognition.removeEventListener("error", handleError);
      recognition.stop();
      recognitionRef.current = null;
      setIsRecognitionReady(false);
    };
  }, [mode, lang]);

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    },
    [],
  );

  const startMediaRecorder = useCallback(async () => {
    if (!onAudioRecordedRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      const stopTracks = () => {
        for (const track of stream.getTracks()) track.stop();
        streamRef.current = null;
      };

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        stopTracks();
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const transcribe = onAudioRecordedRef.current;
        if (audioBlob.size === 0 || !transcribe) return;

        setIsProcessing(true);
        transcribe(audioBlob)
          .then((transcript) => {
            if (transcript) onTranscriptionChangeRef.current?.(transcript);
          })
          // Errors belong to the onAudioRecorded caller.
          .catch(() => {})
          .finally(() => setIsProcessing(false));
      });

      mediaRecorder.addEventListener("error", () => {
        setIsListening(false);
        stopTracks();
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (mode === "speech-recognition" && recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } else if (mode === "media-recorder") {
      if (isListening) {
        stopMediaRecorder();
      } else {
        void startMediaRecorder();
      }
    }
  }, [mode, isListening, startMediaRecorder, stopMediaRecorder]);

  const isDisabled =
    mode === "none" ||
    (mode === "speech-recognition" && !isRecognitionReady) ||
    (mode === "media-recorder" && !onAudioRecorded) ||
    isProcessing;

  let icon = <MicIcon />;
  if (isProcessing) {
    icon = <Spinner />;
  } else if (isListening) {
    icon = <SquareIcon />;
  }

  return (
    <div style={S.speech}>
      {isListening && [0, 1, 2].map((index) => <SpeechRing delay={index * 300} key={index} />)}

      <Button
        aria-label={isListening ? "Stop recording" : "Start recording"}
        className={className}
        disabled={isDisabled}
        onClick={toggleListening}
        style={sx(
          S.speechButton,
          isListening && S.speechListening,
          isListening && hovered && S.speechListeningHover,
          style,
        )}
        type="button"
        {...props}
        {...handlers}
      >
        {icon}
      </Button>
    </div>
  );
};
