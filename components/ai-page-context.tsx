"use client";

import { useEffect } from "react";
import { useAIContext } from "@/app/contexts/ai-context";

type Props = {
  page: string;
  title: string;
};

export function AIPageContext({
  page,
  title,
}: Props) {
  const { setContext } = useAIContext();

  useEffect(() => {
    setContext({
      page,
      title,
    });
  }, [page, title, setContext]);

  return null;
}