"use client";

import { useEffect } from "react";

export default function DomainRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.host;

    // Check if we're not on hf.co or huggingface.co
    const isHfCo = host === "hf.co" || host.startsWith("hf.co:");
    const isHuggingFaceCo =
      host === "huggingface.co" || host.startsWith("huggingface.co:");

    if (!isHfCo && !isHuggingFaceCo) {
      // Open the correct URL in a new tab
      window.open("https://huggingface.co/deepsite", "_blank");
    }
  }, []);

  return null;
}
