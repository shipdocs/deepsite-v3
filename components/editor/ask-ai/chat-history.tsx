import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import classNames from "classnames";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatHistoryProps {
  messages: Message[];
  isAiWorking?: boolean;
}

export const ChatHistory = ({ messages, isAiWorking }: ChatHistoryProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiWorking]);

  if (messages.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="w-full max-h-[400px] overflow-y-auto px-4 py-3 space-y-3 border-b border-neutral-700"
    >
      {messages.map((message, index) => (
        <div
          key={index}
          className={classNames("flex gap-3 items-start", {
            "justify-end": message.role === "user",
          })}
        >
          {message.role === "assistant" && (
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
          )}
          <div
            className={classNames(
              "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
              {
                "bg-blue-600 text-white": message.role === "user",
                "bg-neutral-700/50 text-neutral-200": message.role === "assistant",
              }
            )}
          >
            <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
          </div>
          {message.role === "user" && (
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      ))}
      {isAiWorking && (
        <div className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="bg-neutral-700/50 rounded-lg px-4 py-2.5">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
