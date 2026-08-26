"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DictationLanguage = "en" | "uk";

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionFactory = new () => BrowserRecognition;

type SpeechEnabledWindow = Window & {
  SpeechRecognition?: RecognitionFactory;
  webkitSpeechRecognition?: RecognitionFactory;
};

type DictationOptions = {
  language: DictationLanguage;
  onText: (text: string) => void;
  onError: (message: string) => void;
};

function browserRecognitionFactory(): RecognitionFactory | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechEnabledWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function finalTranscript(event: RecognitionEvent): string {
  const parts: string[] = [];
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (result?.isFinal && result[0]?.transcript) parts.push(result[0].transcript);
  }
  return parts.join(" ").trim();
}

export function useSpeechDictation({ language, onText, onError }: DictationOptions) {
  const [listening, setListening] = useState(false);
  const activeRecognition = useRef<BrowserRecognition | null>(null);
  const textHandler = useRef(onText);
  const errorHandler = useRef(onError);

  useEffect(() => { textHandler.current = onText; }, [onText]);
  useEffect(() => { errorHandler.current = onError; }, [onError]);

  const clearRecognition = useCallback(() => {
    activeRecognition.current = null;
    setListening(false);
  }, []);

  const abort = useCallback(() => {
    activeRecognition.current?.abort();
    clearRecognition();
  }, [clearRecognition]);

  const stop = useCallback(() => {
    activeRecognition.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (activeRecognition.current) {
      activeRecognition.current.stop();
      return;
    }

    const Factory = browserRecognitionFactory();
    if (!Factory) {
      errorHandler.current("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new Factory();
    recognition.lang = language === "uk" ? "uk-UA" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = finalTranscript(event);
      if (text) textHandler.current(text);
    };
    recognition.onerror = (event) => {
      clearRecognition();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        errorHandler.current("Microphone permission was denied.");
      }
    };
    recognition.onend = clearRecognition;
    activeRecognition.current = recognition;
    setListening(true);

    try {
      recognition.start();
    } catch {
      clearRecognition();
      errorHandler.current("Voice input could not be started.");
    }
  }, [clearRecognition, language]);

  useEffect(() => abort, [abort]);

  return { abort, listening, stop, toggle };
}

export function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M6.5 11.5v.5a5.5 5.5 0 0 0 11 0v-.5M12 17.5V21M9.5 21h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/>
    </svg>
  );
}
