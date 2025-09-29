import { useState } from "react";
import { WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/useEditor";
import { useAi } from "@/hooks/useAi";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentModal } from "./content-modal";
import { EnhancedSettings } from "@/types";

export const PromptBuilder = ({
  enhancedSettings,
  setEnhancedSettings,
}: {
  enhancedSettings: EnhancedSettings;
  setEnhancedSettings: (settings: EnhancedSettings) => void;
}) => {
  const { globalAiLoading } = useAi();
  const { globalEditorLoading } = useEditor();

  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="xs"
        variant="outline"
        className="!rounded-md !border-white/10 !bg-gradient-to-r from-sky-400/15 to-purple-400/15 light-sweep hover:brightness-110"
        disabled={globalAiLoading || globalEditorLoading}
        onClick={() => {
          setOpen(true);
        }}
      >
        <WandSparkles className="size-3.5 text-sky-500 relative z-10" />
        <span className="text-transparent bg-gradient-to-r from-sky-400 to-purple-400 bg-clip-text relative z-10">
          Enhance
        </span>
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="sm:max-w-xl !p-0 !rounded-3xl !bg-neutral-900 !border-neutral-800/80 !gap-0">
          <DialogTitle className="px-6 py-3.5 border-b border-neutral-800">
            <div className="flex items-center justify-start gap-2 text-neutral-200 text-base font-medium">
              <WandSparkles className="size-3.5" />
              <p>Enhance Prompt</p>
            </div>
          </DialogTitle>
          <ContentModal
            enhancedSettings={enhancedSettings}
            setEnhancedSettings={setEnhancedSettings}
          />
          <DialogFooter className="px-6 py-3.5 border-t border-neutral-800">
            <Button
              variant="bordered"
              size="default"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
