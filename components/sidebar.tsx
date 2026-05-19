"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useTheme } from "next-themes";
import { useRouter, useParams } from "next/navigation";
import {
  PlusIcon,
  Trash2Icon,
  LaptopIcon,
  MoonIcon,
  SunIcon,
  SettingsIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllConversations,
  removeConversation,
  type StoredConversation,
} from "@/lib/db";
import { useChatContext } from "@/lib/chat-context";

// ── Icons ───────────────────────────────────────────────────────────────────

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <img src="/svg/openai-white-logomark.jpg" className={className} alt="OpenAI" />
  );
}

function AnthropicIcon({ className }: { className?: string }) {
  return (
    <img src="/svg/anthropic-logo.svg" className={className} alt="Claude" />
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <img src="/svg/google-gemini-logo.svg" className={className} alt="Gemini" />
  );
}

function OpenRouterIcon({ className }: { className?: string }) {
  return (
    <img src="/svg/openrouter-logo.png" className={className} alt="OpenRouter" />
  );
}

// ── ThemeToggle ────────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-9" />;

  const cycle = () =>
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");

  return (
    <Button variant="ghost" size="icon" onClick={cycle} title={`Theme: ${theme}`}>
      {theme === "dark" ? (
        <MoonIcon className="size-4" />
      ) : theme === "light" ? (
        <SunIcon className="size-4" />
      ) : (
        <LaptopIcon className="size-4" />
      )}
    </Button>
  );
}

// ── SettingsDialog ───────────────────────────────────────────────────────────

function SettingsDialog() {
  const { settings, updateSettings, isSettingsOpen, setIsSettingsOpen } = useChatContext();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [projectId, setProjectId] = useState(settings.projectId);
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "google" | "openrouter">(settings.aiProvider);
  const [aiApiKey, setAiApiKey] = useState(settings.aiApiKey);
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [isManualModel, setIsManualModel] = useState(false);
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const PREDEFINED_MODELS = {
    openai: ["gpt-5.5-instant", "gpt-5.5-pro", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "o1", "o3-mini"],
    anthropic: ["claude-4.7-opus-latest", "claude-4.6-sonnet-latest", "claude-4.5-haiku-latest", "claude-3-7-sonnet-latest"],
    google: ["gemini-3.1-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro"],
    openrouter: ["poolside/laguna-m.1:free", "openai/gpt-oss-120b:free", "anthropic/claude-4.7-opus", "openai/gpt-5.5-instant", "anthropic/claude-4.6-sonnet"],
  };

  useEffect(() => {
    setApiKey(settings.apiKey);
    setProjectId(settings.projectId);
    setAiProvider(settings.aiProvider || "openai");
    setAiApiKey(settings.aiApiKey);

    const providerKey = (settings.aiProvider || "openai") as keyof typeof PREDEFINED_MODELS;

    if (!settings.aiModel) {
      setAiModel(PREDEFINED_MODELS[providerKey][0]);
      setIsManualModel(false);
    } else if (!PREDEFINED_MODELS[providerKey].includes(settings.aiModel)) {
      setAiModel(settings.aiModel);
      setIsManualModel(true);
    } else {
      setAiModel(settings.aiModel);
      setIsManualModel(false);
    }

    if (!isSettingsOpen) {
      setShowAiApiKey(false);
      setShowApiKey(false);
    }
  }, [settings, isSettingsOpen]);

  const handleSave = () => {
    updateSettings({ apiKey, projectId, aiProvider, aiApiKey, aiModel });
    setIsSettingsOpen(false);
  };

  const providers = [
    { id: "openai", name: "OpenAI", icon: <OpenAIIcon className="size-4" /> },
    { id: "anthropic", name: "Claude", icon: <AnthropicIcon className="size-4" /> },
    { id: "google", name: "Gemini", icon: <GoogleIcon className="size-4" /> },
    { id: "openrouter", name: "OpenRouter", icon: <OpenRouterIcon className="size-4" /> },
  ] as const;

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title="Settings" onClick={() => setIsSettingsOpen(true)} />}>
        <SettingsIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* AI Settings Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium border-b pb-2">AI Provider</h3>
            <div className="space-y-2">
              <Label htmlFor="aiProvider">Provider</Label>
              <Select
                value={aiProvider}
                onValueChange={(v: any) => {
                  setAiProvider(v);
                  setIsManualModel(false);
                  const providerKey = v as keyof typeof PREDEFINED_MODELS;
                  setAiModel(PREDEFINED_MODELS[providerKey][0]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon}
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {aiProvider && (
              <div className="space-y-2">
                <Label htmlFor="aiModel">Model</Label>
                <Select
                  value={isManualModel ? "manual" : aiModel}
                  onValueChange={(v) => {
                    if (v === "manual") {
                      setIsManualModel(true);
                      setAiModel("");
                    } else {
                      setIsManualModel(false);
                      setAiModel(v || "");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PREDEFINED_MODELS[aiProvider as keyof typeof PREDEFINED_MODELS].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual">Enter Manually...</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {isManualModel && (
                  <Input
                    id="aiModelManual"
                    placeholder={`e.g. ${PREDEFINED_MODELS[aiProvider as keyof typeof PREDEFINED_MODELS][0]}`}
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="aiApiKey">API Key</Label>
              <InputGroup>
                <InputGroupInput
                  id="aiApiKey"
                  type={showAiApiKey ? "text" : "password"}
                  placeholder={`${aiProvider.toUpperCase()}_API_KEY`}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => setShowAiApiKey((p) => !p)}
                    aria-label={showAiApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showAiApiKey ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>Need a key? Get it here:</span>
                {aiProvider === "openai" && (
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                    OpenAI API Keys
                  </a>
                )}
                {aiProvider === "anthropic" && (
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                    Anthropic Keys
                  </a>
                )}
                {aiProvider === "google" && (
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                    Google AI Studio Keys
                  </a>
                )}
                {aiProvider === "openrouter" && (
                  <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                    OpenRouter Keys
                  </a>
                )}
              </p>
            </div>
          </div>

          {/* PostHog Settings Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-medium border-b pb-2">PostHog Analytics</h3>
            <div className="space-y-2">
              <Label htmlFor="apiKey">PostHog MCP API Key</Label>
              <InputGroup>
                <InputGroupInput
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="ph_mcp_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => setShowApiKey((p) => !p)}
                    aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showApiKey ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-[10px] text-muted-foreground leading-normal">
                To find this, <span className="font-semibold">go to Settings</span>, look for <span className="font-semibold">Personal API Keys</span>, and click <span className="font-semibold">Create personal API key</span>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">PostHog Project ID (Optional)</Label>
              <Input
                id="projectId"
                placeholder="12345"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full sm:w-auto">Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SidebarProps {
  conversations: StoredConversation[];
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, onDelete }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id as string | undefined;

  const createNewChat = useCallback(() => {
    const newId = nanoid();
    router.push(`/${newId}`);
  }, [router]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold tracking-tight cursor-pointer" onClick={() => router.push("/")}>
          posthog-ai
        </span>
        <div className="flex items-center gap-0.5">
          <SettingsDialog />
          <ThemeToggle />
        </div>
      </div>

      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={createNewChat}
        >
          <PlusIcon className="size-4" />
          New Chat
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/${conv.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/${conv.id}`)}
              className={`group flex cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${activeId === conv.id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground"
                }`}
            >
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                type="button"
                aria-label="Delete conversation"
                className="ml-1 hidden shrink-0 rounded p-0.5 hover:text-destructive group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
