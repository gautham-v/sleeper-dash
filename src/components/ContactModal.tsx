import { useState } from 'react';
import { X, Mail, Globe, Linkedin, ExternalLink, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export function ContactModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="bg-base-bg text-white border-t border-card-border rounded-t-2xl p-0 max-h-[90vh] overflow-y-auto [&>button]:hidden sm:max-w-xl sm:mx-auto sm:rounded-2xl sm:border sm:border-card-border"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Desktop close button */}
        <button
          onClick={() => setOpen(false)}
          className="hidden sm:flex absolute right-4 top-4 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <SheetTitle className="sr-only">Contact</SheetTitle>

        <div className="px-5 pb-8 pt-4 sm:pt-6 sm:px-7 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
              <MessageSquare size={18} className="text-brand-cyan" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">Get in Touch</h2>
              <p className="text-sm text-gray-400 mt-0.5">I'd love to hear from you</p>
            </div>
          </div>

          {/* Blurb */}
          <p className="text-sm text-gray-300 leading-relaxed">
            Found a bug 🐛? Have a feature idea 💡? Just want to say hi 👋? I read every message — reach out
            anytime. This is a one-person project and feedback genuinely shapes what gets built next.
          </p>

          {/* Contact links */}
          <div className="space-y-3">
            <a
              href="mailto:gvem@duck.com"
              className="flex items-center gap-4 bg-card-bg border border-card-border rounded-xl px-4 py-3.5 hover:border-gray-500 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Email</div>
                <div className="text-sm font-semibold text-white mt-0.5">gvem@duck.com</div>
              </div>
              <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 ml-auto flex-shrink-0 transition-colors" />
            </a>

            <a
              href="https://gauthamv.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-card-bg border border-card-border rounded-xl px-4 py-3.5 hover:border-gray-500 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Globe size={16} className="text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Website</div>
                <div className="text-sm font-semibold text-white mt-0.5">gauthamv.com</div>
              </div>
              <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 ml-auto flex-shrink-0 transition-colors" />
            </a>

            <a
              href="https://linkedin.com/in/gautham-v"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-card-bg border border-card-border rounded-xl px-4 py-3.5 hover:border-gray-500 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Linkedin size={16} className="text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">LinkedIn</div>
                <div className="text-sm font-semibold text-white mt-0.5">linkedin.com/in/gautham-v</div>
              </div>
              <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 ml-auto flex-shrink-0 transition-colors" />
            </a>
          </div>

          <p className="text-xs text-gray-600 text-center">
            Built with ☕ in Seattle, WA 🌧️ — recordbook.fyi is free forever.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
