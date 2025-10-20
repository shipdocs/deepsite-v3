import { useRef, useState } from "react";
import {
  CheckCircle,
  ImageIcon,
  Paperclip,
  Upload,
  Video,
  Music,
  FileVideo,
  Lock,
} from "lucide-react";
import Image from "next/image";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Project } from "@/types";
import Loading from "@/components/loading";
import { useUser } from "@/hooks/useUser";
import { useEditor } from "@/hooks/useEditor";
import { useAi } from "@/hooks/useAi";
import { useLoginModal } from "@/components/contexts/login-context";
import Link from "next/link";

export const getFileType = (url: string) => {
  if (typeof url !== "string") {
    return "unknown";
  }
  const extension = url.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension || "")) {
    return "image";
  } else if (["mp4", "webm", "ogg", "avi", "mov"].includes(extension || "")) {
    return "video";
  } else if (["mp3", "wav", "ogg", "aac", "m4a"].includes(extension || "")) {
    return "audio";
  }
  return "unknown";
};

export const Uploader = ({ project }: { project: Project | undefined }) => {
  const { user } = useUser();
  const { openLoginModal } = useLoginModal();
  const {
    uploadFiles,
    isUploading,
    files,
    globalEditorLoading,
    project: editorProject,
  } = useEditor();
  const { selectedFiles, setSelectedFiles, globalAiLoading } = useAi();

  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (url: string) => {
    const fileType = getFileType(url);
    switch (fileType) {
      case "image":
        return <ImageIcon className="size-4" />;
      case "video":
        return <Video className="size-4" />;
      case "audio":
        return <Music className="size-4" />;
      default:
        return <FileVideo className="size-4" />;
    }
  };

  if (!user)
    return (
      <Button
        size="xs"
        variant="outline"
        className="!rounded-md"
        disabled={globalAiLoading || globalEditorLoading}
        onClick={() => openLoginModal()}
      >
        <Paperclip className="size-3.5" />
        Attach
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <form className="h-[24px]">
        <PopoverTrigger asChild>
          <Button
            size="xs"
            variant={open ? "default" : "outline"}
            className="!rounded-md"
            disabled={globalAiLoading || globalEditorLoading}
          >
            <Paperclip className="size-3.5" />
            Attach
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="!rounded-2xl !p-0 !bg-white !border-neutral-100 min-w-xs text-center overflow-hidden"
        >
          <header className="bg-neutral-50 p-6 border-b border-neutral-200/60">
            <div className="flex items-center justify-center -space-x-4 mb-3">
              <div className="size-9 rounded-full bg-pink-200 shadow-2xs flex items-center justify-center text-xl opacity-50">
                🎨
              </div>
              <div className="size-11 rounded-full bg-amber-200 shadow-2xl flex items-center justify-center text-2xl z-2">
                📁
              </div>
              <div className="size-9 rounded-full bg-sky-200 shadow-2xs flex items-center justify-center text-xl opacity-50">
                💻
              </div>
            </div>
            <p className="text-xl font-semibold text-neutral-950">
              Add Media Files
            </p>
            <p className="text-sm text-neutral-500 mt-1.5">
              Upload images, videos, and audio files to your project!
            </p>
          </header>
          <main className="space-y-4 p-5">
            {editorProject?.private && (
              <div className="flex items-center justify-center flex-col gap-2 bg-amber-500/10 rounded-md p-3 border border-amber-500/10">
                <Lock className="size-4 text-lg text-amber-700" />
                <p className="text-xs text-amber-700">
                  You can upload media files to your private project, but
                  probably won't be able to see them in the preview.
                </p>
                <Link
                  href={`https://huggingface.co/spaces/${editorProject.space_id}/settings`}
                  target="_blank"
                >
                  <Button
                    variant="black"
                    size="xs"
                    className="!bg-amber-600 !text-white"
                  >
                    Make it public
                  </Button>
                </Link>
              </div>
            )}
            <div>
              <p className="text-xs text-left text-neutral-700 mb-2">
                Uploaded Media Files
              </p>
              {files?.length > 0 ? (
                <div className="grid grid-cols-4 gap-1 flex-wrap max-h-40 overflow-y-auto">
                  {files.map((file: string) => {
                    const fileType = getFileType(file);
                    return (
                      <div
                        key={file}
                        className="select-none relative cursor-pointer bg-white rounded-md border-[2px] border-white hover:shadow-2xl transition-all duration-300"
                        onClick={() =>
                          setSelectedFiles(
                            selectedFiles.includes(file)
                              ? selectedFiles.filter((f) => f !== file)
                              : [...selectedFiles, file]
                          )
                        }
                      >
                        {fileType === "image" ? (
                          <Image
                            src={file}
                            alt="uploaded image"
                            width={56}
                            height={56}
                            className="object-cover w-full rounded-sm aspect-square"
                          />
                        ) : fileType === "video" ? (
                          <div className="w-full h-14 rounded-sm bg-gray-100 flex items-center justify-center relative">
                            <video
                              src={file}
                              className="w-full h-full object-cover rounded-sm"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-sm">
                              <Video className="size-4 text-white" />
                            </div>
                          </div>
                        ) : fileType === "audio" ? (
                          <div className="w-full h-14 rounded-sm bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                            <Music className="size-6 text-purple-600" />
                          </div>
                        ) : (
                          <div className="w-full h-14 rounded-sm bg-gray-100 flex items-center justify-center">
                            {getFileIcon(file)}
                          </div>
                        )}
                        {selectedFiles.includes(file) && (
                          <div className="absolute top-0 right-0 h-full w-full flex items-center justify-center bg-black/50 rounded-md">
                            <CheckCircle className="size-6 text-neutral-100" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-mono flex flex-col items-center gap-1 pt-2">
                  <ImageIcon className="size-4" />
                  No media files uploaded yet
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-left text-neutral-700 mb-2">
                Or import media files from your computer
              </p>
              <Button
                variant="black"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loading
                      overlay={false}
                      className="ml-2 size-4 animate-spin"
                    />
                    Uploading media file(s)...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload Media Files
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,video/*,audio/*,.mp3,.mp4,.wav,.aac,.m4a,.ogg,.webm,.avi,.mov"
                onChange={(e) => uploadFiles(e.target.files, project!)}
              />
            </div>
          </main>
        </PopoverContent>
      </form>
    </Popover>
  );
};
