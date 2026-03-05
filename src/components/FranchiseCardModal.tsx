'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { FranchiseShareCard, type FranchiseShareCardProps } from '@/components/FranchiseShareCard';

interface FranchiseCardModalProps {
  open: boolean;
  onClose: () => void;
  cardProps: FranchiseShareCardProps;
}

export function FranchiseCardModal({ open, onClose, cardProps }: FranchiseCardModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed z-50 left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 focus:outline-none"
        >
          <Dialog.Title className="sr-only">Share Franchise Card</Dialog.Title>
          {/*
            On phones < 640px, scale to 87.5% so the 400px card gets ~16px breathing room
            on a 375px screen. origin-top keeps the math exact: dead layout space only
            appears at the bottom, which -mb-[65px] reclaims (520 * 0.125 = 65).
          */}
          <div className="origin-top scale-[0.875] -mb-[65px] sm:scale-100 sm:mb-0">
            <FranchiseShareCard {...cardProps} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
