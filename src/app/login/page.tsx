import { loginAction } from "./action";

const messages = [
  "This is Heqing's second brain. Visitors welcome, but only he has the keys. Fork it and build your own.",
  "You found the secret door. Unfortunately, it only opens for one person. But the blueprints are open source.",
  "A vault of books, ideas, and essays lives here. One PIN protects it. Yours could too — fork the repo.",
  "This brain is spoken for. But github.com/h3qing/second-brain is free for the taking.",
  "Plot twist: the real second brain is the one you build yourself. Fork this project and start reading.",
  "Heqing reads a lot. This is where the ideas go to be reviewed. You can build your own version.",
  "This vault is invite-only. Population: 1. But the architecture is open — make it population: 2.",
  "Behind this PIN: Kindle highlights, atomic ideas, and one person's attempt to remember what they read.",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";
  const isLocked = params.locked === "1";
  // eslint-disable-next-line react-hooks/purity
  const message = messages[Math.floor(Math.random() * messages.length)];

  return (
    <div className="flex flex-col items-center text-center py-10 sm:py-20">
      <p className="label mb-3">Second Brain</p>
      <h1
        className="font-heading tracking-tight"
        style={{
          fontSize: "2.5rem",
          fontWeight: 400,
          lineHeight: 1.1,
          marginBottom: "0.75rem",
        }}
      >
        Review Mode
      </h1>
      <p
        className="text-muted"
        style={{
          fontSize: "1rem",
          marginBottom: "2.5rem",
          maxWidth: "22rem",
        }}
      >
        Enter your PIN to pick up where you left off.
      </p>

      <form action={loginAction} className="w-full max-w-xs space-y-4">
        <input
          type="password"
          name="pin"
          placeholder="Enter PIN"
          autoComplete="current-password"
          inputMode="numeric"
          className="w-full px-4 py-4 text-center text-xl tracking-widest bg-background border-2 border-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground font-mono"
          required
          autoFocus
          disabled={isLocked}
        />

        {hasError && (
          <p className="text-danger text-sm text-center">
            Wrong PIN. Try again.
          </p>
        )}

        {isLocked && (
          <p className="text-danger text-sm text-center">
            Too many attempts. Try again in an hour.
          </p>
        )}

        <button
          type="submit"
          className="btn w-full bg-foreground text-background border-foreground"
          disabled={isLocked}
        >
          Enter
        </button>
      </form>

      <p
        className="text-muted leading-relaxed"
        style={{
          fontSize: "0.8125rem",
          fontStyle: "italic",
          marginTop: "2.5rem",
          maxWidth: "22rem",
        }}
      >
        {message}
      </p>
    </div>
  );
}
