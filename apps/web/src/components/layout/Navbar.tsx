import Link from 'next/link';
import { ShieldCheck, Sliders, MessageSquare } from 'lucide-react';

export function Navbar() {
  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2 font-bold text-lg text-primary">
          <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-sm tracking-wider uppercase font-black">
            SL
          </span>
          <span>SpecLens</span>
        </Link>
        <nav className="flex items-center space-x-2 text-sm">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-foreground/80 hover:text-foreground hover:bg-accent/60 transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-foreground/80 hover:text-foreground hover:bg-accent/60 transition"
          >
            <Sliders className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      <div className="flex items-center space-x-3 text-xs">
        <div className="flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private Mode: ON</span>
        </div>
        <span className="text-muted-foreground">Local only · Fail closed</span>
      </div>
    </header>
  );
}
