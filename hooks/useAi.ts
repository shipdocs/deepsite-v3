import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "react-use";

import { MODELS } from "@/lib/providers";
import { useEditor } from "./useEditor";
import { Page, EnhancedSettings } from "@/types";
import { api } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "./useUser";
import { isTheSameHtml } from "@/lib/compare-html-diff";
import { defaultHTML } from "@/lib/consts";

export const useAi = (onScrollToBottom?: () => void) => {
  const client = useQueryClient();
  const audio = useRef<HTMLAudioElement | null>(null);
  const { setPages, setCurrentPage, setPreviewPage, setPrompts, prompts, pages, project, setProject, commits, setCommits, setLastSavedPages, isSameHtml } = useEditor();
  const [controller, setController] = useState<AbortController | null>(null);
  const [storageProvider, setStorageProvider] = useLocalStorage("provider", "zai-org");
  const [storageModel, setStorageModel] = useLocalStorage("model", MODELS[0].value);
  const router = useRouter();
  const { token } = useUser();
  const pathname = usePathname();
  const namespace = pathname.split("/")[1];
  const repoId = pathname.split("/")[2];
  const streamingPagesRef = useRef<Set<string>>(new Set());

  const { data: isAiWorking = false } = useQuery({
    queryKey: ["ai.isAiWorking"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsAiWorking = (newIsAiWorking: boolean) => {
    client.setQueryData(["ai.isAiWorking"], newIsAiWorking);
  };

  const { data: isThinking = false } = useQuery({
    queryKey: ["ai.isThinking"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsThinking = (newIsThinking: boolean) => {
    client.setQueryData(["ai.isThinking"], newIsThinking);
  };

  const { data: thinkingContent } = useQuery<string>({
    queryKey: ["ai.thinkingContent"],
    queryFn: async () => "",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: ""
  });
  const setThinkingContent = (newThinkingContent: string) => {
    client.setQueryData(["ai.thinkingContent"], newThinkingContent);
  };

  const { data: aiConversation } = useQuery<string>({
    queryKey: ["ai.conversation"],
    queryFn: async () => "",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: ""
  });
  const setAiConversation = (newConversation: string) => {
    client.setQueryData(["ai.conversation"], newConversation);
  };

  interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }

  const { data: chatMessages } = useQuery<ChatMessage[]>({
    queryKey: ["ai.chatMessages"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: []
  });
  const setChatMessages = (newMessages: ChatMessage[]) => {
    client.setQueryData(["ai.chatMessages"], newMessages);
  };

  const { data: selectedElement } = useQuery<HTMLElement | null>({
    queryKey: ["ai.selectedElement"],
    queryFn: async () => null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: null
  });
  const setSelectedElement = (newSelectedElement: HTMLElement | null) => {
    client.setQueryData(["ai.selectedElement"], newSelectedElement);
    setIsEditableModeEnabled(false);
  };

  const { data: isEditableModeEnabled = false } = useQuery({
    queryKey: ["ai.isEditableModeEnabled"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsEditableModeEnabled = (newIsEditableModeEnabled: boolean) => {
    client.setQueryData(["ai.isEditableModeEnabled"], newIsEditableModeEnabled);
  };

  const { data: selectedFiles } = useQuery<string[]>({
    queryKey: ["ai.selectedFiles"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: []
  });
  const setSelectedFiles = (newFiles: string[]) => {
    client.setQueryData(["ai.selectedFiles"], newFiles)
  };

  const { data: contextFile } = useQuery<string | null>({
    queryKey: ["ai.contextFile"],
    queryFn: async () => null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: null
  });
  const setContextFile = (newContextFile: string | null) => {
    client.setQueryData(["ai.contextFile"], newContextFile)
  };

  const { data: provider } = useQuery({
    queryKey: ["ai.provider"],
    queryFn: async () => storageProvider ?? "zai-org",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: storageProvider ?? "zai-org"
  });
  const setProvider = (newProvider: string) => {
    setStorageProvider(newProvider);
    client.setQueryData(["ai.provider"], newProvider);
  };

  const { data: model } = useQuery({
    queryKey: ["ai.model"],
    queryFn: async () => {
      // check if the model exist in the MODELS array
      const selectedModel = MODELS.find(m => m.value === storageModel || m.label === storageModel);
      if (selectedModel) {
        return selectedModel.value;
      }
      return MODELS[0].value;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: undefined,
  });
  const setModel = (newModel: string) => {
    setStorageModel(newModel);
    client.setQueryData(["ai.model"], newModel);
  };

  const getConversationalText = (content: string) => {
    // 1. Remove thinking tags
    let text = content.replace(/<thinking?>[\s\S]*?<\/thinking?>/gi, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // 2. Remove all file-related blocks
    text = text
      .replace(/<<<<<<< PROJECT_NAME_START[\s\S]*?>>>>>>> PROJECT_NAME_END/g, "")
      .replace(/<<<<<<< NEW_FILE_START[\s\S]*?>>>>>>> NEW_FILE_END[\s\n]*```[\w]*[\s\S]*?```/g, "")
      .replace(/<<<<<<< UPDATE_FILE_START[\s\S]*?>>>>>>> UPDATE_FILE_END[\s\n]*```[\w]*[\s\S]*?```/g, "")
      // Fallback for blocks without code fences (unlikely but possible)
      .replace(/<<<<<<< (NEW_FILE|UPDATE_FILE|PROJECT_NAME)_START[\s\S]*?>>>>>>> (NEW_FILE|UPDATE_FILE|PROJECT_NAME)_END/g, "")
      .replace(/<<<<<<< SEARCH[\s\S]*?REPLACE_END/g, "")
      .trim();

    return text;
  };

  const createNewProject = async (prompt: string, htmlPages: Page[], projectName: string | undefined, isLoggedIn?: boolean, userName?: string) => {
    if (isLoggedIn && userName) {
      try {
        const uploadRequest = await fetch(`/deepsite/api/me/projects/${userName}/new/update`, {
          method: "PUT",
          body: JSON.stringify({
            pages: htmlPages,
            commitTitle: prompt,
            isNew: true,
            projectName,
          }),
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        const uploadRes = await uploadRequest.json();
        
        if (!uploadRequest.ok || !uploadRes.ok) {
          throw new Error(uploadRes.error || "Failed to create project");
        }

        setIsAiWorking(false);
        router.replace(`/${uploadRes.repoId}`);
        toast.success("AI responded successfully");
        if (audio.current) audio.current.play();
      } catch (error: any) {
        setIsAiWorking(false);
        toast.error(error?.message || "Failed to create project");
      }
    } else {
      setIsAiWorking(false);
      toast.success("AI responded successfully");
      if (audio.current) audio.current.play();
    }
  }
  
  const callAiNewProject = async (prompt: string, enhancedSettings?: EnhancedSettings, redesignMarkdown?: string, isLoggedIn?: boolean, userName?: string) => {
    if (isAiWorking) return;
    if (!redesignMarkdown && !prompt.trim()) return;
    
    setIsAiWorking(true);
    setThinkingContent(""); // Reset thinking content
    setAiConversation(""); // Reset conversation content
    streamingPagesRef.current.clear(); // Reset tracking for new generation
    
    // Add user message to chat history
    setChatMessages([...chatMessages, {
      role: "user",
      content: prompt,
      timestamp: new Date()
    }]);
    
    const abortController = new AbortController();
    setController(abortController);
    
    try {
      const request = await fetch("/deepsite/api/ask", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          provider,
          model,
          redesignMarkdown,
          enhancedSettings,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": window.location.hostname,
          "Authorization": `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (request && request.body) {
        const reader = request.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let contentResponse = "";

        const read = async (): Promise<any> => {
          const { done, value } = await reader.read();
          
          if (done) {
            // Final processing - extract and remove thinking content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
              contentResponse = contentResponse.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            }

            const trimmedResponse = contentResponse.trim();
            if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
              try {
                const jsonResponse = JSON.parse(trimmedResponse);
                if (jsonResponse && !jsonResponse.ok) {
                  setIsAiWorking(false);
                  if (jsonResponse.openLogin) {
                    return { error: "login_required" };
                  } else if (jsonResponse.openSelectProvider) {
                    return { error: "provider_required", message: jsonResponse.message };
                  } else if (jsonResponse.openProModal) {
                    return { error: "pro_required" };
                  } else {
                    toast.error(jsonResponse.message);
                    return { error: "api_error", message: jsonResponse.message };
                  }
                }
              } catch (e) {
              }
            }

            // Extract conversational content
            const conversationText = getConversationalText(contentResponse);
            
            if (conversationText) {
              setAiConversation(conversationText);
              // Add to chat history
              setChatMessages([...chatMessages, {
                role: "assistant",
                content: conversationText,
                timestamp: new Date()
              }]);
            }
            
            const newPages = formatPages(contentResponse, false);
            let projectName = contentResponse.match(/<<<<<<< PROJECT_NAME_START\s*([\s\S]*?)\s*>>>>>>> PROJECT_NAME_END/)?.[1]?.trim();
            if (!projectName) {
              projectName = prompt.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "-") + "-" + Math.random().toString(36).substring(2, 9);
            }
            setPages(newPages);
            setLastSavedPages([...newPages]);
            if (newPages.length > 0 && !isTheSameHtml(newPages[0].html)) {
              createNewProject(prompt, newPages, projectName, isLoggedIn, userName);
            } else {
              // No files generated (conversational response only), reset working state
              setIsAiWorking(false);
              if (audio.current) audio.current.play();
            }
            setPrompts([...prompts, prompt]);

            return { success: true, pages: newPages };
          }

          const chunk = decoder.decode(value, { stream: true });
          contentResponse += chunk;
          
          // Extract thinking content while streaming
          if (contentResponse.includes('</think>')) {
            // Thinking is complete, extract final content and stop thinking
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
            }
          } else if (contentResponse.includes('<think>')) {
            // Still thinking, update content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*)$/);
            if (thinkMatch) {
              const thinkingText = thinkMatch[1].trim();
              if (thinkingText) {
                setIsThinking(true);
                setThinkingContent(thinkingText);
              }
            }
          }

          const trimmedResponse = contentResponse.trim();
          if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
            try {
              const jsonResponse = JSON.parse(trimmedResponse);
              if (jsonResponse && !jsonResponse.ok) {
                setIsAiWorking(false);
                if (jsonResponse.openLogin) {
                  return { error: "login_required" };
                } else if (jsonResponse.openSelectProvider) {
                  return { error: "provider_required", message: jsonResponse.message };
                } else if (jsonResponse.openProModal) {
                  return { error: "pro_required" };
                } else {
                  toast.error(jsonResponse.message);
                  return { error: "api_error", message: jsonResponse.message };
                }
              }
            } catch (e) {
            }
          }

          formatPages(contentResponse, true);
          
          return read();
        };

        return await read();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsAiWorking(false);
      setIsThinking(false);
      setThinkingContent("");
      setController(null);
      
      if (!abortController.signal.aborted) {
        toast.error(error.message || "Network error occurred");
      }
      
      if (error.openLogin) {
        return { error: "login_required" };
      }
      return { error: "network_error", message: error.message };
    }
  };

  const callAiFollowUp = async (prompt: string, enhancedSettings?: EnhancedSettings, isNew?: boolean) => {
    if (isAiWorking) return;
    if (!prompt.trim()) return;

    
    setIsAiWorking(true);
    setThinkingContent(""); // Reset thinking content
    
    const abortController = new AbortController();
    setController(abortController);
    
    try {
      const pagesToSend = contextFile 
        ? pages.filter(page => page.path === contextFile)
        : pages;

      const request = await fetch("/deepsite/api/ask", {
        method: "PUT",
        body: JSON.stringify({
          prompt,
          provider,
          previousPrompts: prompts,
          model,
          pages: pagesToSend,
          selectedElementHtml: selectedElement?.outerHTML,
          files: selectedFiles,
          repoId: project?.space_id,
          isNew,
          enhancedSettings,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": window.location.hostname,
          "Authorization": `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (request && request.body) {
        const reader = request.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let contentResponse = "";
        let metadata: any = null;

        const read = async (): Promise<any> => {
          const { done, value } = await reader.read();
          
          if (done) {
            // Extract and remove thinking content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
              contentResponse = contentResponse.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            }

            // const metadataMatch = contentResponse.match(/___METADATA_START___([\s\S]*?)___METADATA_END___/);
            // if (metadataMatch) {
            //   try {
            //     metadata = JSON.parse(metadataMatch[1]);
            //     contentResponse = contentResponse.replace(/___METADATA_START___[\s\S]*?___METADATA_END___/, '').trim();
            //   } catch (e) {
            //     console.error("Failed to parse metadata", e);
            //   }
            // }

            const trimmedResponse = contentResponse.trim();
            if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
              try {
                const jsonResponse = JSON.parse(trimmedResponse);
                if (jsonResponse && !jsonResponse.ok) {
                  setIsAiWorking(false);
                  if (jsonResponse.openLogin) {
                    return { error: "login_required" };
                  } else if (jsonResponse.openSelectProvider) {
                    return { error: "provider_required", message: jsonResponse.message };
                  } else if (jsonResponse.openProModal) {
                    return { error: "pro_required" };
                  } else {
                    toast.error(jsonResponse.message);
                    return { error: "api_error", message: jsonResponse.message };
                  }
                }
              } catch (e) {
                // Not JSON, continue with normal processing
              }
            }

            // Extract conversational content for follow-up
            const conversationText = getConversationalText(contentResponse);
            if (conversationText) {
              setAiConversation(conversationText);
              setChatMessages([...chatMessages, {
                role: "assistant",
                content: conversationText,
                timestamp: new Date()
              }]);
            }
            
            const { processAiResponse, extractProjectName } = await import("@/lib/format-ai-response");
            const { updatedPages, updatedLines } = processAiResponse(contentResponse, pagesToSend);
            
            const updatedPagesMap = new Map(updatedPages.map((p: Page) => [p.path, p]));
            const mergedPages: Page[] = pages.map(page => 
              updatedPagesMap.has(page.path) ? updatedPagesMap.get(page.path)! : page
            );
            updatedPages.forEach((page: Page) => {
              if (!pages.find(p => p.path === page.path)) {
                mergedPages.push(page);
              }
            });

            let projectName = null;
            if (isNew) {
              projectName = extractProjectName(contentResponse);
              if (!projectName) {
                projectName = prompt.substring(0, 40).replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40) + "-" + Math.random().toString(36).substring(2, 15);
              }
            }

            try {
              const uploadRequest = await fetch(`/deepsite/api/me/projects/${namespace ?? 'unknown'}/${repoId ?? 'unknown'}/update`, {
                method: "PUT",
                body: JSON.stringify({
                  pages: mergedPages,
                  commitTitle: prompt,
                  isNew,
                  projectName,
                }),
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                },
              });

              const uploadRes = await uploadRequest.json();
              
              if (!uploadRequest.ok || !uploadRes.ok) {
                throw new Error(uploadRes.error || "Failed to upload to HuggingFace");
              }

              toast.success("AI responded successfully");
              const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;

              if (isNew && uploadRes.repoId) {
                router.push(`/${uploadRes.repoId}`);
                setIsAiWorking(false);
              } else {
                setPages(mergedPages);
                setLastSavedPages([...mergedPages]);
                setCommits([uploadRes.commit, ...commits]);
                setPrompts([...prompts, prompt]);
                setSelectedElement(null);
                setSelectedFiles([]);
                setIsEditableModeEnabled(false);
                setIsAiWorking(false);
              }

              if (audio.current) audio.current.play();
              if (iframe) {
                setTimeout(() => {
                  iframe.src = iframe.src;
                }, 500);
              }

              return { success: true, updatedLines };
            } catch (uploadError: any) {
              setIsAiWorking(false);
              toast.error(uploadError.message || "Failed to save changes");
              return { error: "upload_error", message: uploadError.message };
            }
          }

          const chunk = decoder.decode(value, { stream: true });
          contentResponse += chunk;
          
          // Extract thinking content while streaming
          if (contentResponse.includes('</think>')) {
            // Thinking is complete, extract final content and stop thinking
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
            }
          } else if (contentResponse.includes('<think>')) {
            // Still thinking, update content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*)$/);
            if (thinkMatch) {
              const thinkingText = thinkMatch[1].trim();
              if (thinkingText) {
                setIsThinking(true);
                setThinkingContent(thinkingText);
              }
            }
          }

          // Check for error responses during streaming
          const trimmedResponse = contentResponse.trim();
          if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
            try {
              const jsonResponse = JSON.parse(trimmedResponse);
              if (jsonResponse && !jsonResponse.ok) {
                setIsAiWorking(false);
                if (jsonResponse.openLogin) {
                  return { error: "login_required" };
                } else if (jsonResponse.openSelectProvider) {
                  return { error: "provider_required", message: jsonResponse.message };
                } else if (jsonResponse.openProModal) {
                  return { error: "pro_required" };
                } else {
                  toast.error(jsonResponse.message);
                  return { error: "api_error", message: jsonResponse.message };
                }
              }
            } catch (e) {
              // Not complete JSON yet, continue
            }
          }
          
          return read();
        };

        return await read();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsAiWorking(false);
      setIsThinking(false);
      setThinkingContent("");
      setController(null);
      
      if (!abortController.signal.aborted) {
        toast.error(error.message || "Network error occurred");
      }
      
      if (error.openLogin) {
        return { error: "login_required" };
      }
      return { error: "network_error", message: error.message };
    }
  };

  const formatPages = (content: string, isStreaming: boolean = true) => {
    const pages: Page[] = [];
    if (!content.match(/<<<<<<< NEW_FILE_START[\s\S]*?>>>>>>> NEW_FILE_END/)) {
      return pages;
    }

    const cleanedContent = content.replace(
      /[\s\S]*?<<<<<<< NEW_FILE_START\s+([\s\S]*?)\s+>>>>>>> NEW_FILE_END/,
      "<<<<<<< NEW_FILE_START $1 >>>>>>> NEW_FILE_END"
    );
    const fileChunks = cleanedContent.split(
      /<<<<<<< NEW_FILE_START\s+([\s\S]*?)\s+>>>>>>> NEW_FILE_END/
    );
    const processedChunks = new Set<number>();

    fileChunks.forEach((chunk, index) => {
      if (processedChunks.has(index) || !chunk?.trim()) {
        return;
      }
      const filePath = chunk.trim();
      const rawChunk = fileChunks[index + 1];
      const fileContent = extractFileContent(rawChunk, filePath);

      if (fileContent) {
        const page: Page = {
          path: filePath,
          html: fileContent,
        };
        pages.push(page);

        if (fileContent.length > 200) {
          onScrollToBottom?.();
        }

        processedChunks.add(index);
        processedChunks.add(index + 1);
      }
    });

    if (pages.length > 0) {
      // If we're starting a new project and only had the defaultHTML, clear it out.
      const currentPages = client.getQueryData<Page[]>(["editor.pages"]) ?? [];
      const hasOnlyDefault = currentPages.length === 1 && currentPages[0].html === defaultHTML;
      
      if (hasOnlyDefault) {
        setPages(pages);
      } else {
        // Normal merge behavior for existing projects
        setPages(pages);
      }

      if (isStreaming) {
        const newPages = pages.filter(p => 
          !streamingPagesRef.current.has(p.path)
        );
        
        if (newPages.length > 0) {
          const newPage = newPages[0];
          setCurrentPage(newPage.path);
          streamingPagesRef.current.add(newPage.path);
          
          if (newPage.path.endsWith('.html') && !newPage.path.includes('/components/')) {
            setPreviewPage(newPage.path);
          }
        }
      } else {
        streamingPagesRef.current.clear();
        const indexPage = pages.find(p => p.path === 'index.html' || p.path === 'index' || p.path === '/');
        if (indexPage) {
          setCurrentPage(indexPage.path);
        }
      }
    }

    return pages;
  };

  const extractFileContent = (chunk: string, filePath: string): string => {
    if (!chunk) return "";
    
    let content = chunk.trim();
    
    // 1. Remove language marker if it's on the first line or joined with first word
    const knownLanguages = ['json', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'html', 'css', 'python', 'py', 'bash', 'shell'];
    
    // Check for "jsximport", "json{", etc.
    for (const lang of knownLanguages) {
      const regex = new RegExp(`^${lang}(\\s+|[\\{\\(\\[\\'\\"\\!\\/])`, 'i');
      if (regex.test(content)) {
        // If it was joined like "json{", we want to KEEP the "{"
        const match = content.match(regex);
        if (match) {
           // If match[1] is whitespace, remove the whole thing including whitespace
           // If match[1] is a symbol, remove only the language name
           if (/\s/.test(match[1])) {
             content = content.substring(match[0].length).trim();
           } else {
             content = content.substring(lang.length).trim();
           }
        }
        break;
      }
      
      // Also check for language name on its own line
      const firstLineRegex = new RegExp(`^${lang}\\s*\\n`, 'i');
      if (firstLineRegex.test(content)) {
        content = content.substring(content.indexOf('\n') + 1).trim();
        break;
      }
    }
    
    // 2. Handle Markdown Code Fences (remove ```json ... ```)
    const codeFenceMatch = content.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
    if (codeFenceMatch) {
      content = codeFenceMatch[1].trim();
    } else {
      content = content.replace(/^```(?:\w+)?\s*/i, "").replace(/```\s*$/i, "");
    }
    
    // 3. Final cleanup based on file extension
    if (filePath.endsWith('.json')) {
      // Remove ANY trailing HTML tags that models sometimes append
      content = content.replace(/<\/?[^>]+(>|$)/g, "").trim();
      // Try to ensure it starts with { or [
      const startJson = content.indexOf('{');
      const startArray = content.indexOf('[');
      const start = (startJson !== -1 && (startArray === -1 || startJson < startArray)) ? startJson : startArray;
      if (start !== -1) {
        content = content.substring(start);
      }
      const endJson = content.lastIndexOf('}');
      const endArray = content.lastIndexOf(']');
      const end = Math.max(endJson, endArray);
      if (end !== -1) {
        content = content.substring(0, end + 1);
      }
    } else if (filePath.endsWith('.html')) {
      const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*/i);
      if (doctypeMatch) {
        content = doctypeMatch[0];
      }
      content = ensureCompleteHtml(content.replace(/```/g, ""));
    } else {
       // Agressive cleanup for JS/CSS: remove trailing </html> if present
       content = content.replace(/<\/html>\s*$/i, "").trim();
    }
    
    return content.trim();
  };

  const ensureCompleteHtml = (html: string): string => {
    let completeHtml = html;
    if (completeHtml.includes("<head>") && !completeHtml.includes("</head>")) {
      completeHtml += "\n</head>";
    }
    if (completeHtml.includes("<body") && !completeHtml.includes("</body>")) {
      completeHtml += "\n</body>";
    }
    if (!completeHtml.includes("</html>")) {
      completeHtml += "\n</html>";
    }
    return completeHtml;
  };

  const cancelRequest = () => {
    if (controller) {
      controller.abort();
      setController(null);
    }
    setIsAiWorking(false);
    setIsThinking(false);
  };

  const selectedModel = useMemo(() => {
    return MODELS.find(m => m.value === model || m.label === model);
  }, [model]);

  return {
    isThinking,
    setIsThinking,
    thinkingContent,
    setThinkingContent,
    callAiNewProject,
    callAiFollowUp,
    isAiWorking,
    setIsAiWorking,
    selectedElement,
    setSelectedElement,
    selectedFiles,
    setSelectedFiles,
    contextFile,
    setContextFile,
    isEditableModeEnabled,
    setIsEditableModeEnabled,
    globalAiLoading: isThinking || isAiWorking,
    cancelRequest,
    model,
    setModel,
    provider,
    setProvider,
    selectedModel,
    audio,
    aiConversation,
    chatMessages,
    setChatMessages,
  };
}