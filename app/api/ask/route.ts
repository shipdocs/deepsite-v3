/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { InferenceClient } from "@huggingface/inference";

import { MODELS } from "@/lib/providers";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT_LIGHT,
  INITIAL_SYSTEM_PROMPT,
  INITIAL_SYSTEM_PROMPT_LIGHT,
  MAX_REQUESTS_PER_IP,
  PROMPT_FOR_PROJECT_NAME,
} from "@/lib/prompts";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";
import { Page } from "@/types";
import { isAuthenticated } from "@/lib/auth";
import { getBestProvider } from "@/lib/best-provider";

const ipAddresses = new Map();

export async function POST(request: NextRequest) {
  const authHeaders = await headers();
  const tokenInHeaders = authHeaders.get("Authorization");
  const userToken = tokenInHeaders ? tokenInHeaders.replace("Bearer ", "") : request.cookies.get(MY_TOKEN_KEY())?.value;

  const body = await request.json();
  const { prompt, provider, model, redesignMarkdown, enhancedSettings, pages } = body;

  if (!model || (!prompt && !redesignMarkdown)) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const selectedModel = MODELS.find(
    (m) => m.value === model || m.label === model
  );

  if (!selectedModel) {
    return NextResponse.json(
      { ok: false, error: "Invalid model selected" },
      { status: 400 }
    );
  }

  let token: string | null = null;
  if (userToken) token = userToken;
  let billTo: string | null = null;

  /**
   * Handle local usage token, this bypass the need for a user token
   * and allows local testing without authentication.
   * This is useful for development and testing purposes.
   */
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.length > 0) {
    token = process.env.HF_TOKEN;
  }

  const ip = authHeaders.get("x-forwarded-for")?.includes(",")
    ? authHeaders.get("x-forwarded-for")?.split(",")[1].trim()
    : authHeaders.get("x-forwarded-for");

  if (!token || token === "null" || token === "") {
    ipAddresses.set(ip, (ipAddresses.get(ip) || 0) + 1);
    if (ipAddresses.get(ip) > MAX_REQUESTS_PER_IP) {
      return NextResponse.json(
        {
          ok: false,
          openLogin: true,
          message: "Log In to continue using the service",
        },
        { status: 429 }
      );
    }

    token = process.env.DEFAULT_HF_TOKEN as string;
    billTo = "huggingface";
  }

  try {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const response = new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    (async () => {
      try {
        const systemPrompt = selectedModel.value.includes('MiniMax') 
          ? INITIAL_SYSTEM_PROMPT_LIGHT 
          : INITIAL_SYSTEM_PROMPT;
        
        const userPrompt = prompt;

        const messages: any[] = [
              {
                role: "system",
                content: systemPrompt,
              },
              ...(redesignMarkdown ? [{
                role: "assistant",
                content: `User will ask you to redesign the site based on this markdown. Use the same images as the site, but you can improve the content and the design. Here is the markdown: ${redesignMarkdown}`
              }] : []),
              {
                role: "user",
                content: userPrompt + (enhancedSettings.isActive ? `1. I want to use the following primary color: ${enhancedSettings.primaryColor} (eg: bg-${enhancedSettings.primaryColor}-500).
2. I want to use the following secondary color: ${enhancedSettings.secondaryColor} (eg: bg-${enhancedSettings.secondaryColor}-500).
3. I want to use the following theme: ${enhancedSettings.theme} mode.` : "")
              },
            ];

        if (process.env.LLM_BASE_URL) {
          const url = process.env.LLM_BASE_URL.endsWith("/") 
              ? process.env.LLM_BASE_URL + "chat/completions" 
              : process.env.LLM_BASE_URL + "/chat/completions";

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.LLM_API_KEY}`
            },
            body: JSON.stringify({
              model: process.env.LLM_MODEL || selectedModel.value,
              messages: messages,
              stream: true,
              max_tokens: 16_384,
              temperature: selectedModel.temperature || 0.7,
              top_p: selectedModel.top_p || 0.7
            })
          });

          if (!res.ok) throw new Error(`LLM Error: ${res.status} ${res.statusText}`);

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader?.read() || { done: true, value: undefined };
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.trim().slice(6);
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const content = json.choices[0]?.delta?.content;
                  if (content) await writer.write(encoder.encode(content));
                } catch (e) {}
              }
            }
          }

        } else {
          const client = new InferenceClient(token);
          const chatCompletion = client.chatCompletionStream(
            {
              model: selectedModel.value + (provider !== "auto" ? `:${provider}` : ""),
              messages,
              ...(selectedModel.top_k ? { top_k: selectedModel.top_k } : {}),
              ...(selectedModel.temperature ? { temperature: selectedModel.temperature } : {}),
              ...(selectedModel.top_p ? { top_p: selectedModel.top_p } : {}),
              max_tokens: 16_384,
            },
            billTo ? { billTo } : {}
          );

          while (true) {
            const { done, value } = await chatCompletion.next()
            if (done) {
              break;
            }

            const chunk = value.choices[0]?.delta?.content;
            if (chunk) {
              await writer.write(encoder.encode(chunk));
            }
          }
        }
        
        await writer.close();
      } catch (error: any) {
        console.error(error);
        if (error.message?.includes("exceeded your monthly included credits")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openProModal: true,
                message: error.message,
              })
            )
          );
        } else if (error?.message?.includes("inference provider information")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openSelectProvider: true,
                message: error.message,
              })
            )
          );
        }
        else {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message:
                  error.message ||
                  "An error occurred while processing your request.",
              })
            )
          );
        }
      } finally {
        try {
          await writer?.close();
        } catch {
        }
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error?.message || "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await isAuthenticated();
  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authHeaders = await headers();

  const body = await request.json();
  const { prompt, provider, selectedElementHtml, model, pages, files, repoId, isNew } =
    body;

  if (!prompt || pages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const selectedModel = MODELS.find(
    (m) => m.value === model || m.label === model
  );
  if (!selectedModel) {
    return NextResponse.json(
      { ok: false, error: "Invalid model selected" },
      { status: 400 }
    );
  }

  let token = user.token as string;
  let billTo: string | null = null;

  /**
   * Handle local usage token, this bypass the need for a user token
   * and allows local testing without authentication.
   * This is useful for development and testing purposes.
   */
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.length > 0) {
    token = process.env.HF_TOKEN;
  }

  const ip = authHeaders.get("x-forwarded-for")?.includes(",")
    ? authHeaders.get("x-forwarded-for")?.split(",")[1].trim()
    : authHeaders.get("x-forwarded-for");

  if (!token || token === "null" || token === "") {
    ipAddresses.set(ip, (ipAddresses.get(ip) || 0) + 1);
    if (ipAddresses.get(ip) > MAX_REQUESTS_PER_IP) {
      return NextResponse.json(
        {
          ok: false,
          openLogin: true,
          message: "Log In to continue using the service",
        },
        { status: 429 }
      );
    }

    token = process.env.DEFAULT_HF_TOKEN as string;
    billTo = "huggingface";
  }

  try {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const response = new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    (async () => {
      try {
        const basePrompt = selectedModel.value.includes('MiniMax') 
          ? FOLLOW_UP_SYSTEM_PROMPT_LIGHT 
          : FOLLOW_UP_SYSTEM_PROMPT;
        const systemPrompt = basePrompt + (isNew ? PROMPT_FOR_PROJECT_NAME : "");
        // const userContext = "You are modifying the HTML file based on the user's request.";

        const allPages = pages || [];
        const pagesContext = allPages
          .map((p: Page) => `- ${p.path}\n${p.html}`)
          .join("\n\n");

        const assistantContext = `${selectedElementHtml
            ? `\n\nYou have to update ONLY the following element, NOTHING ELSE: \n\n\`\`\`html\n${selectedElementHtml}\n\`\`\` Could be in multiple pages, if so, update all the pages.`
            : ""
          }. Current pages (${allPages.length} total): ${pagesContext}. ${files?.length > 0 ? `Available images: ${files?.map((f: string) => f).join(', ')}.` : ""}`;

        const messages: any[] = [
              {
                role: "system",
                content: systemPrompt + assistantContext
              },
              {
                role: "user",
                content: prompt,
              },
            ];

        if (process.env.LLM_BASE_URL) {
          const url = process.env.LLM_BASE_URL.endsWith("/") 
              ? process.env.LLM_BASE_URL + "chat/completions" 
              : process.env.LLM_BASE_URL + "/chat/completions";
          
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.LLM_API_KEY}`
            },
            body: JSON.stringify({
              model: process.env.LLM_MODEL || selectedModel.value,
              messages: messages,
              stream: true,
              max_tokens: 16_384,
              temperature: selectedModel.temperature || 0.7,
              top_p: selectedModel.top_p || 0.7
            })
          });

          if (!res.ok) throw new Error(`LLM Error: ${res.status} ${res.statusText}`);

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader?.read() || { done: true, value: undefined };
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.trim().slice(6);
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const content = json.choices[0]?.delta?.content;
                  if (content) await writer.write(encoder.encode(content));
                } catch (e) {}
              }
            }
          }
        } else {
          const client = new InferenceClient(token);
          const chatCompletion = client.chatCompletionStream(
            {
              model: selectedModel.value + (provider !== "auto" ? `:${provider}` : ""),
              messages,
              ...(selectedModel.top_k ? { top_k: selectedModel.top_k } : {}),
              ...(selectedModel.temperature ? { temperature: selectedModel.temperature } : {}),
              ...(selectedModel.top_p ? { top_p: selectedModel.top_p } : {}),
              max_tokens: 16_384,
            },
            billTo ? { billTo } : {}
          );

          // Stream the response chunks to the client
          while (true) {
            const { done, value } = await chatCompletion.next();
            if (done) {
              break;
            }

            const chunk = value.choices[0]?.delta?.content;
            if (chunk) {
              await writer.write(encoder.encode(chunk));
            }
          }
        }

        await writer.write(encoder.encode(`\n___METADATA_START___\n${JSON.stringify({
          repoId,
          isNew,
          userName: user.name,
        })}\n___METADATA_END___\n`));

        await writer.close();
      } catch (error: any) {
        if (error.message?.includes("exceeded your monthly included credits")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openProModal: true,
                message: error.message,
              })
            )
          );
        } else if (error?.message?.includes("inference provider information")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openSelectProvider: true,
                message: error.message,
              })
            )
          );
        } else {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message:
                  error.message ||
                  "An error occurred while processing your request.",
              })
            )
          );
        }
      } finally {
        try {
          await writer?.close();
        } catch {
          // ignore
        }
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error.message || "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}

