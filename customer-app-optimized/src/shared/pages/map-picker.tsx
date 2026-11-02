import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useMapDraftStore } from '@/modules/rides/store/mapDraftStore';
import { toast } from '@/shared/stores/toastStore';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { colors } from '@/shared/theme';

const DELHI = { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function MapPickerScreen() {
  const router = useRouter();
  const draft = useMapDraftStore((s) => s.point);
  const setPoint = useMapDraftStore((s) => s.setPoint);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(draft);

  const confirm = () => {
    if (!selected) {
      toast('Tap the map to choose a location', 'error');
      return;
    }
    setPoint(selected, null);
    router.back();
  };

  return (
    <Screen header={<AppHeader variant="dark" title="Set location" />} bottomNav={false} scroll={false} padded={false}>
      <View style={styles.wrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: draft?.latitude ?? DELHI.latitude,
            longitude: draft?.longitude ?? DELHI.longitude,
            latitudeDelta: DELHI.latitudeDelta,
            longitudeDelta: DELHI.longitudeDelta,
          }}
          onPress={(e) => {
            const c = e.nativeEvent.coordinate;
            setSelected({ latitude: c.latitude, longitude: c.longitude });
          }}
          showsUserLocation
        >
          {selected && <Marker coordinate={selected} pinColor={colors.brand[600]} />}
        </MapView>

        <View style={styles.banner}>
          <MapPin size={16} color={colors.brand[700]} />
          <Text style={styles.bannerText}>Tap anywhere on the map to set a delivery location.</Text>
        </View>

        <View style={styles.footer}>
          {selected && (
            <View style={styles.coordsRow}>
              <Text style={styles.coordsLabel}>Selected</Text>
              <Text style={styles.coordsText}>
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              </Text>
            </View>
          )}
          <Pressable style={styles.confirmBtn} onPress={confirm} disabled={!selected}>
            <LocateFixed size={16} color="#fff" />
            <Text style={styles.confirmText}>Confirm location</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  banner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink[800],
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coordsLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  coordsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink[800],
    fontVariant: ['tabular-nums'],
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 14,
    opacity: 1,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});