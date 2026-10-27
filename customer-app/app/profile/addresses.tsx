import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { Address } from '@/types/catalog';
import { toast } from '@/stores/toastStore';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AddAddressSheet } from '@/components/address/AddAddressSheet';
import { Loader } from '@/components/ui/primitives';
import { colors, withAlpha } from '@/theme';

export default function AddressesScreen() {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => repositories.user.getAddresses() });

  const remove = useMutation({
    mutationFn: (id: number) => repositories.user.deleteAddress(id),
    onSuccess: () => {
      toast('Address deleted');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: () => toast("Couldn't delete address", 'error'),
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => repositories.user.setDefaultAddress(id),
    onSuccess: () => {
      toast('Default address updated');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: () => toast("Couldn't update default address", 'error'),
  });

  const openForm = (a?: Address) => {
    setEditing(a ?? null);
    setFormOpen(true);
  };

  return (
    <Screen header={<AppHeader variant="dark" title="My addresses" />} bottomNav={false} scroll={false}>
      {addresses.isLoading && <Loader label="Loading addresses…" />}

      {addresses.data && addresses.data.length === 0 && (
        <ScrollView contentContainerStyle={styles.empty}>
          <MapPin size={28} color={colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptyDesc}>Add a delivery address to speed up checkout.</Text>
          <Pressable style={styles.addBtn} onPress={() => openForm()}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add address</Text>
          </Pressable>
        </ScrollView>
      )}

      {addresses.data && addresses.data.length > 0 && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {addresses.data.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.labelBadge}>
                  <Text style={styles.labelBadgeText}>{a.label.toUpperCase()}</Text>
                </View>
                {a.is_default && (
                  <View style={styles.defaultBadge}>
                    <Star size={10} color={colors.amber[600]} />
                    <Text style={styles.defaultText}>DEFAULT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardName}>
                {[a.contact_name, a.contact_phone].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.cardAddr}>
                {[a.address_line_1, a.address_line_2, a.landmark, a.city, a.state, a.postal_code]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
              <View style={styles.cardActions}>
                {!a.is_default && (
                  <Pressable style={styles.cardAction} onPress={() => setDefault.mutate(a.id)}>
                    <Star size={14} color={colors.neutral[400]} />
                    <Text style={styles.cardActionText}>Set default</Text>
                  </Pressable>
                )}
                <Pressable style={styles.cardAction} onPress={() => openForm(a)}>
                  <Pencil size={14} color={colors.neutral[400]} />
                  <Text style={styles.cardActionText}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.cardAction, { marginLeft: 'auto' }]} onPress={() => setConfirmDelete(a)}>
                  <Trash2 size={14} color={colors.danger} />
                  <Text style={[styles.cardActionText, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable style={styles.addRow} onPress={() => openForm()}>
            <Plus size={16} color={colors.brand[700]} />
            <Text style={styles.addRowText}>Add new address</Text>
          </Pressable>
        </ScrollView>
      )}

      <AddAddressSheet
        visible={formOpen}
        address={editing}
        onClose={() => setFormOpen(false)}
        onCreated={() => setEditing(null)}
      />

      <BottomSheet title="Delete address?" visible={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <Text style={styles.deleteDesc}>
          This will permanently remove this address from your saved addresses.
        </Text>
        <View style={styles.deleteActions}>
          <Pressable style={[styles.deleteBtn, styles.cancelBtn]} onPress={() => setConfirmDelete(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.deleteBtn, styles.confirmDeleteBtn]}
            onPress={() => confirmDelete && remove.mutate(confirmDelete.id)}
            disabled={remove.isPending}
          >
            <Text style={styles.confirmDeleteText}>{remove.isPending ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 40,
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  addBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 14,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  labelBadge: {
    borderRadius: 999,
    backgroundColor: withAlpha(colors.brand[700], 0.08),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.brand[700],
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.amber[600], 0.1),
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.amber[700],
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  cardAddr: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.neutral[500],
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brand[300],
    borderStyle: 'dashed',
    paddingVertical: 14,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand[700],
  },
  deleteDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.neutral[500],
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  deleteBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[800],
  },
  confirmDeleteBtn: {
    backgroundColor: colors.danger,
  },
  confirmDeleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
