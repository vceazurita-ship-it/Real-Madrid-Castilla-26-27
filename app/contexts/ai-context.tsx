"use client";

import {
  createContext,
  useContext,
  useState,
} from "react";

type AIContextData = {
  page?: string;
  title?: string;
  data?: unknown;
};

type AIContextType = {
  context: AIContextData;
  setContext: (value: AIContextData) => void;
};

const AIContext = createContext<AIContextType>({
  context: {},
  setContext: () => {},
});

export function AIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [context, setContext] =
    useState<AIContextData>({});

  return (
    <AIContext.Provider
      value={{
        context,
        setContext,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  return useContext(AIContext);
}