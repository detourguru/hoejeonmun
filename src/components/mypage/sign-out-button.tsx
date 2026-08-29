import { LogOut } from "lucide-react";

export const SignOutButton = () => (
  <form action="/auth/signout" method="post">
    <button
      type="submit"
      className="hover:bg-sub flex w-full items-center gap-3 p-3 text-left transition-colors"
    >
      <span className="bg-destructive/10 flex size-9 shrink-0 items-center justify-center rounded-full">
        <LogOut className="text-destructive size-4" />
      </span>
      <span className="text-destructive flex-1 text-sm font-bold">
        로그아웃
      </span>
    </button>
  </form>
);
