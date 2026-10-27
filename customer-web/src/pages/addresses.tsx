import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, MapPin, Trash2, Loader2, MapIcon } from 'lucide-react';
import { repositories } from '@/repositories';
import type { Address } from '@/types/catalog';
import { MapPicker } from '@/components/map/MapPicker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';

export function AddressesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  const [form, setForm] = useState({
    label: 'Home',
    contact_name: '',
    contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    latitude: '',
    longitude: '',
    place_id: null as string | null,
    formatted_address: null as string | null,
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [locationPicked, setLocationPicked] = useState(false);

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!locationPicked || !form.latitude || !form.longitude) {
        throw new Error('Please pick your location on the map first.');
      }
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        address_line_2: form.address_line_2 || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        country: form.country || 'India',
        latitude: form.latitude,
        longitude: form.longitude,
        place_id: form.place_id,
        formatted_address: form.formatted_address,
      };
      return editing
        ? repositories.user.updateAddress(editing.id, payload)
        : repositories.user.createAddress(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setModalOpen(false);
      setEditing(null);
      resetForm();
      toast(editing ? 'Address updated' : 'Address added');
    },
    onError: () => toast('Could not save address', 'error'),
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => repositories.user.setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast('Default address updated');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => repositories.user.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setConfirmDelete(null);
      toast('Address deleted');
    },
  });

  const openAdd = () => {
    setEditing(null);
    resetForm();
    setLocationPicked(false);
    setMapOpen(true);
    setModalOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({
      label: a.label,
      contact_name: a.contact_name ?? '',
      contact_phone: a.contact_phone ?? '',
      address_line_1: a.address_line_1,
      address_line_2: a.address_line_2 ?? '',
      city: a.city,
      state: a.state ?? '',
      postal_code: a.postal_code ?? '',
      country: a.country || 'India',
      latitude: a.latitude ?? '',
      longitude: a.longitude ?? '',
      place_id: a.place_id ?? null,
      formatted_address: a.formatted_address ?? null,
    });
    setLocationPicked(!!(a.latitude && a.longitude));
    setMapOpen(false);
    setModalOpen(true);
  };

  const resetForm = () =>
    setForm({
      label: 'Home',
      contact_name: '',
      contact_phone: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      latitude: '',
      longitude: '',
      place_id: null,
      formatted_address: null,
    });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/profile" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
            <ArrowLeft className="h-4 w-4" /> Profile
          </Link>
          <h1 className="text-xl font-extrabold text-neutral-900">My addresses</h1>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {isLoading && <Skeleton className="h-32 w-full rounded-2xl" />}
      {isError && <ErrorState title="Couldn't load addresses" action={{ label: 'Retry', onClick: () => refetch() }} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add a delivery address to checkout faster."
          action={{ label: 'Add address', onClick: openAdd }}
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">{a.label}</p>
                    {a.is_default && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {a.address_line_1}
                    {a.address_line_2 ? `, ${a.address_line_2}` : ''}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {a.city} {a.postal_code}
                  </p>
                  {a.contact_phone && <p className="mt-0.5 text-xs text-neutral-500">{a.contact_phone}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!a.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDefault.mutate(a.id)} disabled={setDefault.isPending}>
                      {setDefault.isPending && setDefault.variables === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Set default'
                      )}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <button onClick={() => setConfirmDelete(a)} className="text-neutral-300 hover:text-danger" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title={editing ? 'Edit address' : 'Add address'} open={modalOpen} onOpenChange={setModalOpen}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {['Home', 'Work', 'Other'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setForm((f) => ({ ...f, label: l }))}
                className={`rounded-xl border py-2 text-sm font-semibold transition-colors ${
                  form.label === l ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact name"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
            <Input
              label="Contact phone"
              type="tel"
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Select location on map</p>
              {locationPicked && (
                <span className="text-[11px] font-semibold text-success">Location set</span>
              )}
            </div>
            {mapOpen ? (
              <MapPicker
                publicKey={appConfig!.maps.public_key!}
                initialLatitude={form.latitude ? parseFloat(form.latitude) : null}
                initialLongitude={form.longitude ? parseFloat(form.longitude) : null}
                initialAddressLine1={form.address_line_1}
                initialCity={form.city}
                countryCode={form.country?.slice(0, 2)}
                onSelected={(place) => {
                  setForm((f) => ({
                    ...f,
                    address_line_1: f.address_line_1 || place.label || place.formatted_address || place.address_line_1,
                    city: place.city || f.city,
                    state: place.state || f.state,
                    postal_code: place.postal_code || f.postal_code,
                    country: place.country || f.country || 'India',
                    latitude: String(place.latitude),
                    longitude: String(place.longitude),
                    place_id: place.place_id ?? null,
                    formatted_address: place.formatted_address ?? null,
                  }));
                  setLocationPicked(true);
                  setMapOpen(false);
                  toast('Location set');
                }}
                onCancel={() => setMapOpen(false)}
              />
            ) : (
              <button
                type="button"
                disabled={!appConfig?.maps?.public_key}
                onClick={() => setMapOpen(true)}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-semibold hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 ${
                  locationPicked
                    ? 'border-success/40 bg-success/5 text-success'
                    : 'border-brand-200 bg-brand-50 text-brand-700'
                }`}
              >
                <MapIcon className="h-4 w-4" />
                {appConfig?.maps?.public_key
                  ? locationPicked
                    ? 'Change location on map'
                    : 'Pick location on map'
                  : 'Loading map…'}
              </button>
            )}
          </div>

          <Input
            label="Address / House no., Building"
            required
            value={form.address_line_1}
            onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))}
          />
          <Input
            label="Landmark"
            value={form.address_line_2}
            onChange={(e) => setForm((f) => ({ ...f, address_line_2: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} readOnly />
            <Input label="State" value={form.state} readOnly />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postal code" value={form.postal_code} readOnly />
            <Input label="Country" value={form.country} readOnly />
          </div>

          <Button type="submit" className="w-full" disabled={save.isPending || !locationPicked}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Add address'}
          </Button>
        </form>
      </Modal>

      <Modal title="Delete address?" open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <p className="text-sm text-neutral-600">This address will be removed permanently.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}>
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}