import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronRight, UtensilsCrossed } from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FOOD_NOTE_MAX_LENGTH } from '@/stores/cartStore';
import { colors } from '@/theme';

interface FoodPreparationChipsProps {
  note: string;
  noCutlery: boolean;
  onNoteChange: (note: string) => void;
  onNoCutleryChange: (noCutlery: boolean) => void;
}

/**
 * Native port of customer-web components/order/food-preparation-chips.tsx.
 * Two compact cart rows: a restaurant note (opens a bottom-sheet modal) and
 * an independent "Don't send cutlery" toggle. No per-item notes, no presets.
 */
export function FoodPreparationChips({
  note,
  noCutlery,
  onNoteChange,
  onNoCutleryChange,
}: FoodPreparationChipsProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const [focused, setFocused] = useState(false);

  const openNote = () => {
    setDraft(note);
    setNoteOpen(true);
  };

  const closeNote = () => {
    setDraft(note);
    setNoteOpen(false);
  };

  const saveNote = () => {
    onNoteChange(draft.trim().slice(0, FOOD_NOTE_MAX_LENGTH));
    setNoteOpen(false);
  };

  const removeNote = () => {
    onNoteChange('');
    setDraft('');
    setNoteOpen(false);
  };

  return (
    <>
      <View style={styles.card}>
        <Pressable
          onPress={openNote}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Add a note for the restaurant"
        >
          <View style={[styles.rowIcon, note ? styles.rowIconActive : styles.rowIconIdle]}>
            <UtensilsCrossed size={16} color={note ? '#fff' : colors.neutral[500]} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Add a note for the restaurant</Text>
            {note ? (
              <Text style={styles.rowNote} numberOfLines={1}>
                {note}
              </Text>
            ) : (
              <Text style={styles.rowHint}>e.g. Please make it medium spicy.</Text>
            )}
          </View>
          <ChevronRight size={16} color={colors.neutral[300]} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={() => onNoCutleryChange(!noCutlery)}
          style={styles.row}
          accessibilityRole="switch"
          accessibilityState={{ checked: noCutlery }}
          accessibilityLabel="Don't send cutlery"
        >
          <View style={[styles.rowIcon, noCutlery ? styles.rowIconActive : styles.rowIconIdle]}>
            <UtensilsCrossed size={16} color={noCutlery ? '#fff' : colors.neutral[500]} />
          </View>
          <Text style={[styles.rowTitle, styles.rowTitleFlex]}>{"Don't send cutlery"}</Text>
          <View style={[styles.checkCircle, noCutlery && styles.checkCircleActive]}>
            {noCutlery && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
        </Pressable>
      </View>

      <BottomSheet
        visible={noteOpen}
        onClose={closeNote}
        title="Add a note for the restaurant"
        keyboardAware
        footer={
          <View style={styles.footerRow}>
            {note ? (
              <Pressable style={[styles.footerBtn, styles.removeBtn]} onPress={removeNote} accessibilityLabel="Remove note">
                <Text style={styles.removeBtnText}>Remove</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.footerBtn, styles.saveBtn]} onPress={saveNote} accessibilityLabel="Save note">
              <Text style={styles.saveBtnText}>Save note</Text>
            </Pressable>
          </View>
        }
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={FOOD_NOTE_MAX_LENGTH}
          autoFocus
          multiline
          textAlignVertical="top"
          placeholder="e.g. Please make it medium spicy."
          placeholderTextColor={colors.neutral[400]}
          style={[styles.input, focused && styles.inputFocused]}
        />
        <Text style={styles.counter}>
          {draft.length}/{FOOD_NOTE_MAX_LENGTH}
        </Text>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconActive: {
    backgroundColor: colors.brand[600],
  },
  rowIconIdle: {
    backgroundColor: colors.neutral[100],
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  rowTitleFlex: {
    flex: 1,
  },
  rowNote: {
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[500],
  },
  rowHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[400],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[600],
  },
  input: {
    minHeight: 96,
    maxHeight: 160,
    backgroundColor: colors.ink[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    fontSize: 14,
    color: colors.ink[900],
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: colors.brand[500],
    backgroundColor: '#fff',
  },
  counter: {
    marginTop: 4,
    textAlign: 'right',
    fontSize: 11,
    color: colors.neutral[400],
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  saveBtn: {
    backgroundColor: colors.brand[600],
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
