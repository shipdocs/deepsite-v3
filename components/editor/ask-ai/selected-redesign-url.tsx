import classNames from "classnames";
import { Paintbrush, XCircle } from "lucide-react";

export const SelectedRedesignUrl = ({
  url,
  isAiWorking = false,
  onDelete,
}: {
  url: string;
  isAiWorking: boolean;
  onDelete?: () => void;
}) => {
  return (
    <div
      className={classNames(
        "border border-emerald-500/50 bg-emerald-500/10 rounded-xl p-1.5 pr-3 max-w-max hover:brightness-110 transition-all duration-200 ease-in-out",
        {
          "cursor-pointer": !isAiWorking,
          "opacity-50 cursor-not-allowed": isAiWorking,
        }
      )}
      onClick={() => {
        if (!isAiWorking && onDelete) {
          onDelete();
        }
      }}
    >
      <div className="flex items-center justify-start gap-2">
        <div className="rounded-lg bg-emerald-500/20 size-6 flex items-center justify-center">
          <Paintbrush className="text-emerald-300 size-3.5" />
        </div>
        <p className="text-sm font-semibold text-emerald-200">{url}</p>
        <XCircle className="text-emerald-300 size-4 hover:text-emerald-200 transition-colors" />
      </div>
    </div>
  );
};
