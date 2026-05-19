"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const router = useRouter();

  const createNewChat = () => {
    const id = nanoid();
    router.push(`/${id}`);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Welcome to Relia Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Create a new chat or select one from the sidebar.
        </p>
      </div>
      <Button onClick={createNewChat} className="gap-2">
        <PlusIcon className="size-4" />
        New Chat
      </Button>
    </div>
  );
}
