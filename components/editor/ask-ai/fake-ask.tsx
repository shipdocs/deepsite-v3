import { useState } from "react";
import { useLocalStorage } from "react-use";
import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useLoginModal } from "@/components/contexts/login-context";
import { PromptBuilder } from "./prompt-builder";
import { EnhancedSettings } from "@/types";
import { Settings } from "./settings";

export const FakeAskAi = () => {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [openProvider, setOpenProvider] = useState(false);
  const [enhancedSettings, setEnhancedSettings, removeEnhancedSettings] =
    useLocalStorage<EnhancedSettings>("deepsite-enhancedSettings", {
      isActive: true,
      primaryColor: undefined,
      secondaryColor: undefined,
      theme: undefined,
    });
  const [, setPromptStorage] = useLocalStorage("prompt", "");

  const callAi = async () => {
    setPromptStorage(prompt);
    router.push("/projects/new");
  };

  // todo redirect to login + set prompt in storage, then redirect to projects/new + set the prompt in the state

  return (
    <div className="p-3 w-full max-w-xl mx-auto">
      <div className="relative bg-neutral-800 border border-neutral-700 rounded-2xl ring-[4px] focus-within:ring-neutral-500/30 focus-within:border-neutral-600 ring-transparent z-20 w-full group">
        <div className="w-full relative flex items-center justify-between">
          <textarea
            className="w-full bg-transparent text-sm outline-none text-white placeholder:text-neutral-400 p-4 resize-none"
            placeholder="Ask DeepSite anything..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                callAi();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-3 mt-2">
          <div className="flex-1 flex items-center justify-start gap-1.5 flex-wrap">
            <PromptBuilder
              enhancedSettings={enhancedSettings!}
              setEnhancedSettings={setEnhancedSettings}
            />
            <Settings
              open={openProvider}
              isFollowUp={false}
              error=""
              onClose={setOpenProvider}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="iconXs"
              variant="outline"
              className="!rounded-md"
              onClick={() => callAi()}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
