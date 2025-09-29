"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { LoginModal } from "@/components/login-modal";
import { Page } from "@/types";

interface LoginContextType {
  isOpen: boolean;
  openLoginModal: (options?: LoginModalOptions) => void;
  closeLoginModal: () => void;
}

interface LoginModalOptions {
  pages?: Page[];
  title?: string;
  prompt?: string;
  description?: string;
}

const LoginContext = createContext<LoginContextType | undefined>(undefined);

export function LoginProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<LoginModalOptions>({});

  const openLoginModal = (options: LoginModalOptions = {}) => {
    setModalOptions(options);
    setIsOpen(true);
  };

  const closeLoginModal = () => {
    setIsOpen(false);
    setModalOptions({});
  };

  const value = {
    isOpen,
    openLoginModal,
    closeLoginModal,
  };

  return (
    <LoginContext.Provider value={value}>
      {children}
      <LoginModal
        open={isOpen}
        onClose={setIsOpen}
        title={modalOptions.title}
        prompt={modalOptions.prompt}
        description={modalOptions.description}
      />
    </LoginContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginContext);
  if (context === undefined) {
    throw new Error("useLoginModal must be used within a LoginProvider");
  }
  return context;
}
