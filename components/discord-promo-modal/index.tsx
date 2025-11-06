"use client";

import { useEffect, useState } from "react";
import { useLocalStorage } from "react-use";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DiscordIcon } from "@/components/icons/discord";
import Logo from "@/assets/logo.svg";

const DISCORD_PROMO_KEY = "discord-promo-dismissed";
const DISCORD_URL = "https://discord.gg/KpanwM3vXa";

export const DiscordPromoModal = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    DISCORD_PROMO_KEY,
    false
  );

  useEffect(() => {
    const cookieDismissed = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${DISCORD_PROMO_KEY}=`))
      ?.split("=")[1];

    if (dismissed || cookieDismissed === "true") {
      return;
    }

    const timer = setTimeout(() => {
      setOpen(true);
    }, 60000);

    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleClose = () => {
    setOpen(false);
    setDismissed(true);

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    document.cookie = `${DISCORD_PROMO_KEY}=true; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  };

  const handleJoinDiscord = () => {
    window.open(DISCORD_URL, "_blank");
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md lg:!p-0 !rounded-3xl !bg-gradient-to-br !from-neutral-900 !via-neutral-800 !to-neutral-900 !border !border-neutral-700/50 overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="hidden" />
        <main className="flex flex-col items-center text-center relative p-8">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          <div className="relative z-10 w-full">
            <div className="inline-flex items-center justify-center mb-6 gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white/10 rounded-xl blur-lg opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-white/20">
                  <Image
                    src={Logo}
                    alt="DeepSite"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
              </div>

              <div className="text-white/40 text-2xl font-bold animate-pulse">
                +
              </div>

              <div className="relative">
                <div
                  className="absolute inset-0 bg-indigo-500/80 rounded-xl blur-lg opacity-50 animate-pulse"
                  style={{ animationDelay: "0.5s" }}
                />
                <div className="relative bg-indigo-500 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-indigo-500/30">
                  <DiscordIcon className="size-8 text-whie" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3">
              Join Our Community! 🎉
            </h2>

            <p className="text-neutral-300 text-base mb-6 max-w-xs mx-auto leading-relaxed">
              Connect with other DeepSite users, get help, share your projects,
              and stay updated with the latest features!
            </p>

            <div className="flex flex-col gap-2 mb-8 text-left">
              {[
                { emoji: "💬", text: "Chat with the community" },
                { emoji: "🔔", text: "Get notified when new features drop" },
                { emoji: "🎨", text: "Share your creations" },
                { emoji: "🤝", text: "Get help from the team" },
              ].map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 text-neutral-200 text-sm bg-white/5 rounded-lg px-4 py-2 backdrop-blur-sm border border-white/10"
                  style={{
                    animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
                  }}
                >
                  <span className="text-base">{benefit.emoji}</span>
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={handleJoinDiscord}
                className="w-full !h-12 !text-base font-semibold !bg-indigo-500 hover:!bg-indigo-600 !text-white !border-0 transform hover:scale-[1.02] transition-all duration-300"
              >
                <DiscordIcon className="size-4 mr-2" />
                Join Discord Community
              </Button>
              <button
                onClick={handleClose}
                className="text-neutral-400 hover:text-neutral-300 text-sm font-medium transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </main>

        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};
