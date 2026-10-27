import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Loader, X } from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { repositories } from '@/api/repositories';
import { colors, withAlpha } from '@/theme';
import {
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  resolveDefaultCategory,
  supportPhotoHint,
  type SupportAttachment,
  type SupportModule,
} from '@/lib/support';

/** Longest edge of an uploaded evidence photo — keeps uploads small. */
const EVIDENCE_MAX_WIDTH = 1600;

interface SupportRequestSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * The module resolved from the linked record. `null` means the record does
   * not identify a module — the sheet says so instead of guessing one.
   */
  module: SupportModule | null;
  /** The kind of record the request is about. */
  referenceType: 'order' | 'ride';
  referenceId: number;
  /** `order` for Food/Grocery orders, `ride` for a ride booking. */
  ticketType: 'order' | 'ride';
  title: string;
  subtitle?: string;
  /** Used as the subject when the customer leaves the subject field empty. */
  subjectFallback: string;
  /** The amount paid for the record — caps the requested refund. */
  totalAmount?: number | null;
  onSubmitted?: (ticketNumber?: string) => void;
}

/**
 * The module specific support form.
 *
 * The issue categories are fetched from the API for the module of the linked
 * record, so Food, Grocery and Ride each get their own list and a stale
 * selection can never be submitted against another module.
 */
export function SupportRequestSheet({
  visible,
  onClose,
  module,
  referenceType,
  referenceId,
  ticketType,
  title,
  subtitle,
  subjectFallback,
  totalAmount,
  onSubmitted,
}: SupportRequestSheetProps) {
  const [category, setCategory] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('wallet');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ['support', 'issue-categories', module],
    queryFn: () => repositories.support.getIssueCategories(module as string),
    enabled: visible && Boolean(module),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const options = optionsQuery.data;
  const categories = useMemo(() => options?.categories ?? [], [options]);

  // A new request (or a new record) starts empty — no stale category,
  // description or evidence can carry over.
  useEffect(() => {
    if (!visible) return;
    setCategory(null);
    setSubject('');
    setDescription('');
    setAmount('');
    setAttachments([]);
    setError(null);
    setSuccess(null);
  }, [visible, module, referenceType, referenceId]);

  // Keep the selection inside the categories of the current module.
  useEffect(() => {
    if (!visible) return;
    const list = options?.categories ?? [];
    if (!list.length) return;
    setCategory((current) => {
      if (current && list.some((option) => option.value === current)) return current;
      return resolveDefaultCategory(options);
    });
  }, [visible, options]);

  const resetForm = useCallback(() => {
    setSubject('');
    setDescription('');
    setAmount('');
    setAttachments([]);
  }, []);

  const pickPhotos = async () => {
    const remaining = MAX_SUPPORT_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_SUPPORT_ATTACHMENTS} photos.`);
      return;
    }
    setPicking(true);
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo access is needed to attach evidence to your request.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled) return;

      const prepared: SupportAttachment[] = [];
      for (const asset of result.assets) {
        const file = await prepareEvidence(asset);
        if (file) prepared.push(file);
      }
      if (!prepared.length) {
        setError('Those photos could not be prepared. Please pick a different image.');
        return;
      }
      setAttachments((prev) => [...prev, ...prepared].slice(0, MAX_SUPPORT_ATTACHMENTS));
    } catch {
      setError('Could not open your photo library.');
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!module) return;
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!category) {
      setError('Please choose an issue category.');
      return;
    }

    const requested = amount.trim() ? Number(amount.trim()) : undefined;
    if (requested !== undefined) {
      if (!Number.isFinite(requested) || requested <= 0) {
        setError('Requested refund amount must be a valid amount.');
        return;
      }
      if (totalAmount !== null && totalAmount !== undefined && requested > totalAmount) {
        setError('Requested refund amount cannot be more than the amount paid.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ticket_type: ticketType,
        subject: subject.trim() || subjectFallback,
        description: description.trim(),
        reference_type: referenceType,
        reference_id: referenceId,
        issue_category: category,
        refund_destination: destination,
        ...(requested !== undefined ? { requested_refund_amount: requested } : {}),
      };
      const response = attachments.length
        ? await repositories.support.createTicketWithAttachments(payload, attachments)
        : await repositories.support.createTicket(payload);
      const ticketNumber = (response as { ticket_number?: string } | null)?.ticket_number;
      setSuccess(
        ticketNumber
          ? `Request submitted (${ticketNumber}). Our team will review it.`
          : 'Request submitted. Our team will review it.'
      );
      resetForm();
      onSubmitted?.(ticketNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit support request');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(module) && Boolean(category) && description.trim().length > 0 && !submitting;

  return (
    <BottomSheet
      title={title}
      subtitle={subtitle}
      visible={visible}
      onClose={onClose}
      scrollable
      maxHeight="92%"
      keyboardAware
      footer={
        <View style={styles.footer}>
          <Pressable style={[styles.ghostButton, { flex: 1 }]} onPress={onClose}>
            <Text style={styles.ghostButtonText}>Close</Text>
          </Pressable>
          {!success && module ? (
            <Pressable
              style={[styles.primaryButton, { flex: 1 }, !canSubmit && styles.buttonDisabled]}
              onPress={submit}
              disabled={!canSubmit}
            >
              {submitting ? <Loader size={16} color="#fff" /> : null}
              <Text style={styles.primaryButtonText}>{submitting ? 'Submitting…' : 'Submit request'}</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      {success ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : !module ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            We could not tell which service this request is about, so the right support form cannot be
            shown. Please contact SuperBasket support and we will help you directly.
          </Text>
        </View>
      ) : optionsQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.ink[900]} />
          <Text style={styles.loadingText}>Loading issue categories…</Text>
        </View>
      ) : optionsQuery.isError ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            We could not load the issue categories for this request. Check your connection and try
            again.
          </Text>
          <Pressable style={styles.retryButton} onPress={() => optionsQuery.refetch()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Issue category</Text>
          <View style={styles.chipRow}>
            {categories.map((option) => {
              const selected = category === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setCategory(option.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Subject (optional)</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of the issue"
            placeholderTextColor={colors.neutral[400]}
            maxLength={255}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="Please describe the issue in detail, including relevant items/times if possible"
            placeholderTextColor={colors.neutral[400]}
            maxLength={2000}
          />

          <Text style={styles.label}>Add photos (optional)</Text>
          <Text style={styles.hint}>{supportPhotoHint(module)}</Text>
          <Pressable style={styles.photoButton} onPress={pickPhotos} disabled={picking}>
            <Camera size={16} color={colors.ink[800]} />
            <Text style={styles.photoButtonText}>
              {picking ? 'Preparing photos…' : `Add photo${attachments.length ? 's' : ''}`}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            Up to {MAX_SUPPORT_ATTACHMENTS} photos, {MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024)} MB
            each.
          </Text>
          {attachments.length ? (
            <View style={styles.previewRow}>
              {attachments.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.previewBox}>
                  <Image source={{ uri: file.uri }} style={styles.preview} />
                  <Pressable
                    style={styles.previewRemove}
                    onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={6}
                  >
                    <X size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>Refund destination</Text>
          <View style={styles.chipRow}>
            {(options?.refund_destinations ?? []).map((option) => {
              const selected = destination === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDestination(option.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Requested refund amount (optional)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Leave blank for full review"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="decimal-pad"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.hint}>
            Requesting a refund does not mean it has been approved. Our team will review your request
            and may ask for more details.
          </Text>
        </View>
      )}
    </BottomSheet>
  );
}

/**
 * Re-encode a picked photo as JPEG so every platform uploads a format the
 * ticket API accepts, and shrink it enough to stay below the size limit.
 */
async function prepareEvidence(
  asset: ImagePicker.ImagePickerAsset
): Promise<SupportAttachment | null> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > EVIDENCE_MAX_WIDTH) {
      context.resize({ width: EVIDENCE_MAX_WIDTH });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    const size = new File(saved.uri).size;
    if (!size || size > MAX_SUPPORT_ATTACHMENT_BYTES) return null;
    return {
      uri: saved.uri,
      name: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
      type: 'image/jpeg',
      size,
    };
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 13,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[800],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 13,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: 6,
    marginTop: 14,
  },
  hint: {
    fontSize: 11,
    color: colors.neutral[500],
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  chipSelected: {
    borderColor: colors.ink[900],
    backgroundColor: colors.ink[900],
  },
  chipText: {
    fontSize: 12,
    color: colors.ink[800],
  },
  chipTextSelected: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink[900],
    marginBottom: 4,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: withAlpha(colors.ink[900], 0.04),
    paddingVertical: 11,
    marginBottom: 6,
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  previewBox: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
    marginBottom: 4,
  },
  successBox: {
    borderRadius: 12,
    backgroundColor: withAlpha(colors.success ?? '#10b981', 0.12),
    padding: 12,
  },
  successText: {
    fontSize: 14,
    color: '#047857',
  },
  noticeBox: {
    borderRadius: 12,
    backgroundColor: withAlpha(colors.neutral[100], 0.6),
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    color: colors.ink[700],
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[900],
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[900],
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
    color: colors.neutral[500],
  },
});
