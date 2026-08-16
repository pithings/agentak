import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const engine = (): SpeechSynthesis | undefined =>
  typeof window === "undefined" ? undefined : window.speechSynthesis;

/**
 * Longest piece handed to the engine at once.
 *
 * Chrome drops an utterance that runs past about fifteen seconds, so a whole
 * answer given in one go stops halfway through. Sentences go in as separate
 * utterances instead, and the engine reads the queue without a gap.
 */
const CHUNK = 180;

/**
 * How fast the reading runs. 1 is the engine's own pace, which is the pace a
 * voice was recorded at and the one it sounds best at. `useSpeech` takes another
 * number where a caller wants one.
 */
const RATE = 1;

/**
 * How good a voice sounds, read off its name.
 *
 * A name is nearly all the API says about a voice, and every engine lists a
 * plain one first: `getVoices()[0]` on macOS is Alex or Albert, and on Linux it
 * is eSpeak. The better voices are marked, though, and each engine marks them
 * its own way. Apple writes "(Enhanced)" or "(Premium)" after the name of a
 * voice the system has downloaded, Microsoft writes "Online (Natural)" for the
 * neural ones Edge streams, and Chrome's own network voices are all named
 * "Google …". What is left is the built-in formant set, which is the robotic
 * one, and macOS shelves a row of joke voices beside it.
 *
 * Safari alone has no mark to read where the reader has downloaded nothing: it
 * offers Apple's voices and no others, all of them local, and a plain name is
 * all a good one carries. Its own newer names go above Alex for that.
 */
const QUALITY: readonly (readonly [RegExp, number])[] = [
  [/\((enhanced|premium)\)|siri/i, 4],
  [/\bnatural\b|\bneural\b/i, 4],
  [/^google\b/i, 2],
  // Apple's modern voices, named plainly: the Siri pair, and Samantha, which is
  // what macOS and iOS read with before a reader picks anything.
  [/^(aaron|allison|ava|nicky|samantha|susan|tom|zoe)\b/i, 1],
  // The macOS joke shelf, plus the oldest of its plain voices.
  [
    /^(agnes|albert|bad news|bahh|bells|boing|bruce|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|victoria|whisper|wobble|zarvox)\b/i,
    -4,
  ],
  [/\bcompact\b|espeak/i, -2],
];

/** The base of a language tag: `en` for `en-US`, and for Android's `en_US`. */
const base = (tag: string): string => tag.replace("_", "-").split("-")[0].toLowerCase();

/**
 * The best voice the engine offers for `lang`, or none where it offers no list.
 *
 * The language comes first — a French voice reading English is worse than any
 * plain English one — and the name only decides between the voices that speak
 * it. The first of an equal pair wins, which is the engine's own order.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let top = Number.NEGATIVE_INFINITY;

  for (const voice of voices) {
    const tag = voice.lang.replace("_", "-");
    const language =
      tag.toLowerCase() === lang.toLowerCase() ? 2 : base(tag) === base(lang) ? 1 : 0;

    let score = language * 10;
    for (const [pattern, weight] of QUALITY) if (pattern.test(voice.name)) score += weight;

    if (score > top) {
      top = score;
      best = voice;
    }
  }

  return best;
}

/** The language the reading is wanted in: the page's own. */
const pageLang = (): string =>
  (typeof document === "undefined" ? "" : document.documentElement.lang) ||
  (typeof navigator === "undefined" ? "" : navigator.language) ||
  "en-US";

/** The text as utterances: whole sentences, none of them over `CHUNK`. */
export function speechChunks(text: string): string[] {
  const out: string[] = [];
  let current = "";

  const push = () => {
    if (current) out.push(current);
    current = "";
  };
  const add = (piece: string) => {
    if (current.length + piece.length + 1 > CHUNK) push();
    current = current ? `${current} ${piece}` : piece;
  };

  // A sentence end or a line break; a sentence longer than the cap is then cut
  // between words, which is the only break left that is not mid-word.
  for (const piece of text.split(/(?<=[.!?…:;])\s+|\n+/)) {
    const sentence = piece.trim();
    if (!sentence) continue;

    if (sentence.length <= CHUNK) {
      add(sentence);
      continue;
    }

    push();
    for (const word of sentence.split(/\s+/)) add(word);
    push();
  }

  push();
  return out;
}

export interface Speech {
  /** The browser speaks. Nothing offers the button where it does not. */
  supported: boolean;
  /** This hook's own reading is running. */
  speaking: boolean;
  /** Read `text` aloud, or stop if this hook is already reading. */
  toggle: (text: string) => void;
  stop: () => void;
}

/**
 * Read text aloud through the browser's own speech synthesis.
 *
 * One voice at a time: starting a reading cancels whatever else was being read,
 * including another instance of this hook, and that instance sees its own
 * utterance end and reports it. Each reading carries a number, so the end of a
 * cancelled one never clears the flag of the one that replaced it — the events
 * arrive after the new reading has already started.
 */
export function useSpeech(rate = RATE): Speech {
  const [speaking, setSpeaking] = useState(false);
  const reading = useRef(0);
  const live = useRef(false);

  live.current = speaking;

  // A reading outlives the row that started it — the page can drop the
  // transcript for a settings page, and the voice would carry on alone. The
  // first `getVoices()` is also what starts Chrome loading its list, which is
  // asked for over the network and is empty until then.
  useEffect(() => {
    engine()?.getVoices?.();
    return () => {
      if (live.current) engine()?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    reading.current++;
    engine()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = engine();
      const parts = speechChunks(text);
      if (!synth || parts.length === 0) return;

      // Chrome needs the queue cleared before a new utterance takes, and a
      // second voice over the first is not what the reader asked for either way.
      synth.cancel();

      const id = ++reading.current;
      const done = () => {
        if (reading.current === id) setSpeaking(false);
      };

      // One voice for the whole reading, or the engine's own where the list has
      // not arrived yet. Picking again per sentence could change voice midway.
      const voice = pickVoice(synth.getVoices?.() ?? [], pageLang());

      for (const [index, part] of parts.entries()) {
        const utterance = new SpeechSynthesisUtterance(part);
        utterance.rate = rate;
        if (voice) utterance.voice = voice;
        utterance.onerror = done;
        // Only the last one ends the reading; the others hand over to the next.
        if (index === parts.length - 1) utterance.onend = done;
        synth.speak(utterance);
      }

      setSpeaking(true);
    },
    [rate],
  );

  const toggle = useCallback(
    (text: string) => {
      if (live.current) stop();
      else speak(text);
    },
    [speak, stop],
  );

  return { speaking, stop, supported: Boolean(engine()), toggle };
}
