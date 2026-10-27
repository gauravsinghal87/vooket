import { useState } from "react";
import { cn } from "@/lib/utils";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3.6 10.4 12 3.4l8.4 7v8.2a1.9 1.9 0 0 1-1.9 1.9h-3.9v-5.4a2.6 2.6 0 0 0-5.2 0v5.4H5.5a1.9 1.9 0 0 1-1.9-1.9v-8.2Z" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V3Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
    </svg>
  );
}

function DiningBellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" />
      <path d="M3 16.5h18" />
      <path d="M12 9V6.8" />
      <circle cx="12" cy="5.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5c.5 4.8 2.7 7 7.5 7.5-4.8.5-7 2.7-7.5 7.5-.5-4.8-2.7-7-7.5-7.5 4.8-.5 7-2.7 7.5-7.5Z" />
    </svg>
  );
}

const tabs = [
  { id: "delivery", label: "Delivery", icon: HomeIcon, iconClass: "text-nav-accent" },
  { id: "history", label: "History", icon: ReceiptIcon, iconClass: "text-foreground" },
  { id: "dining", label: "Dining", icon: DiningBellIcon, iconClass: "text-dining-purple" },
] as const;

export function BottomNav() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("delivery");

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pb-2">
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3 px-4">
        <button
          type="button"
          aria-label="Explore"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-glow-core via-glow-soft to-glow-soft shadow-glow transition-transform active:scale-95"
        >
          <SparkleIcon className="h-6 w-6 text-primary-foreground" />
        </button>

        <nav className="flex items-center gap-1 rounded-full border border-border/60 bg-card p-1.5 shadow-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-3 text-[15px] font-semibold transition-colors",
                active === tab.id
                  ? "bg-nav-dark text-primary-foreground shadow-md"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              <tab.icon className={cn("h-5 w-5", tab.iconClass)} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-2 flex justify-center">
        <div className="h-1.5 w-32 rounded-full bg-foreground/70" />
      </div>
    </div>
  );
}
