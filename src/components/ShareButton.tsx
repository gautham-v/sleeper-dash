'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  className?: string;
}

export function ShareButton({ className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled or error — fall through
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        copied ? 'text-green-400' : 'text-gray-400 hover:text-white'
      } ${className ?? ''}`}
    >
      {copied ? <Check size={13} /> : <Share2 size={13} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
