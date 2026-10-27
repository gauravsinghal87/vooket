import { useState } from 'react';
import { Check, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FOOD_NOTE_MAX_LENGTH } from '@/store/cartStore';

interface FoodPreparationChipsProps {
  note: string;
  noCutlery: boolean;
  onNoteChange: (note: string) => void;
  onNoCutleryChange: (noCutlery: boolean) => void;
}

/**
 * Food-only, pre-order instructions. Compact two-row chip area shown in the
 * cart, the way a Zomato-style cart presents them.
 *
 * Deliberately minimal: a restaurant-level note and a cutlery preference. No
 * preparation questionnaire, no per-item notes, no pricing impact.
 */
export function FoodPreparationChips({
  note,
  noCutlery,
  onNoteChange,
  onNoCutleryChange,
}: FoodPreparationChipsProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(note);

  const openNote = () => {
    setDraft(note);
    setNoteOpen(true);
  };

  const saveNote = () => {
    onNoteChange(draft.trim().slice(0, FOOD_NOTE_MAX_LENGTH));
    setNoteOpen(false);
  };

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={openNote}
          className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors active:bg-neutral-50"
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              note ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500',
            )}
          >
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">
              Add a note for the restaurant
            </span>
            {note ? (
              <span className="mt-0.5 block truncate text-xs text-neutral-500">{note}</span>
            ) : (
              <span className="mt-0.5 block text-xs text-neutral-400">
                e.g. Please make it medium spicy.
              </span>
            )}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
        </button>

        <div className="h-px bg-neutral-100" />

        <button
          type="button"
          role="switch"
          aria-checked={noCutlery}
          onClick={() => onNoCutleryChange(!noCutlery)}
          className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors active:bg-neutral-50"
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              noCutlery ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500',
            )}
          >
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
            Don't send cutlery
          </span>
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              noCutlery ? 'border-brand-600 bg-brand-600' : 'border-neutral-300',
            )}
          >
            {noCutlery && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </span>
        </button>
      </div>

      <BottomSheet
        title="Add a note for the restaurant"
        open={noteOpen}
        onOpenChange={(open) => {
          if (!open) setDraft(note);
          setNoteOpen(open);
        }}
      >
        <textarea
          value={draft}
          maxLength={FOOD_NOTE_MAX_LENGTH}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="e.g. Please make it medium spicy."
          className="w-full rounded-2xl border border-neutral-200 bg-white p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <p className="mt-1 text-right text-[11px] text-neutral-400">
          {draft.length}/{FOOD_NOTE_MAX_LENGTH}
        </p>
        <div className="mt-3 flex gap-2">
          {note && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onNoteChange('');
                setDraft('');
                setNoteOpen(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={saveNote}>
            Save note
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
