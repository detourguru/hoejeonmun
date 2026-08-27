export const SignOutButton = () => (
  <form action="/auth/signout" method="post">
    <button
      type="submit"
      className="border-border text-text-muted hover:border-destructive/40 hover:text-destructive w-full rounded-xl border py-2.5 text-xs font-medium transition-colors"
    >
      로그아웃
    </button>
  </form>
);
