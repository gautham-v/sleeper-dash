'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AboutModal } from '@/components/AboutModal';
import { ContactModal } from '@/components/ContactModal';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';

export default function HomePage() {
  const [value, setValue] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) router.push(`/user/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-4 font-sans gap-5">
      <Card className="relative z-10 w-full max-w-sm border-card-border gap-0 py-0">
        <CardHeader className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
          <span className="text-5xl leading-none">📖</span>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              recordbook.fyi
            </CardTitle>
            <CardDescription>
              Fantasy football analytics for your Sleeper leagues
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-8">
          <form id="username-form" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. sleeperuser123"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="focus-visible:ring-brand-cyan/30 focus-visible:border-brand-cyan/50 h-10"
              />
            </Field>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3 border-t border-border pt-6 pb-6">
          <Button
            type="submit"
            form="username-form"
            disabled={!value.trim()}
            size="lg"
            className="w-full font-bold"
          >
            View Dashboard
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Reads public league data from the Sleeper API
          </p>
        </CardFooter>
      </Card>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <AboutModal>
          <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
            About
          </button>
        </AboutModal>
        <span>·</span>
        <ContactModal>
          <button className="hover:text-gray-300 transition-colors px-1.5 py-1 rounded hover:bg-white/5">
            Contact
          </button>
        </ContactModal>
        <span>·</span>
        <span className="text-gray-700">Free &amp; open · Made in Seattle 🌧️</span>
      </div>
    </div>
  );
}
