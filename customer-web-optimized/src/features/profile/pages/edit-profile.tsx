import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Avatar } from '@/shared/components/ui/avatar';
import { toast } from '@/shared/components/ui/toast';

export function EditProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const save = useMutation({
    mutationFn: () =>
      repositories.user.updateProfile({
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      toast('Profile updated');
    },
    onError: () => toast('Could not update profile', 'error'),
  });

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <Link to="/profile" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Profile
        </Link>
        <h1 className="text-xl font-extrabold text-neutral-900">Edit profile</h1>
      </div>

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={name || 'User'} size="lg" />
        <div>
          <p className="text-sm font-bold text-neutral-900">{name || 'Your name'}</p>
          <p className="text-xs text-neutral-500">Profile photo coming soon</p>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </Card>
    </div>
  );
}