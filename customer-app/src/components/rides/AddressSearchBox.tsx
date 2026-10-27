import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LocateFixed, MapPin, Search, X } from 'lucide-react-native';
import { user } from '@/api/repositories';
import type { PlaceResult } from '@/types/models';
import { colors } from '@/theme';

interface SearchResultPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

interface AddressSearchBoxProps {
  value: string;
  placeholder: string;
  tone: 'pickup' | 'drop';
  includeLocate?: boolean;
  locateLoading?: boolean;
  onLocate?: () => void;
  onSelect: (p: SearchResultPoint) => void;
}

export function AddressSearchBox({
  value,
  placeholder,
  tone,
  includeLocate,
  locateLoading,
  onLocate,
  onSelect,
}: AddressSearchBoxProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
    setResults([]);
    setSearched(false);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const { results: found } = await user.searchPlaces(term);
      setResults(found);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(false);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const pick = (r: PlaceResult) => {
    if (r.latitude == null || r.longitude == null) return;
    setResults([]);
    setSearched(false);
    onSelect({ latitude: r.latitude, longitude: r.longitude, label: r.main });
  };

  const accent = tone === 'pickup' ? colors.success : colors.accent[500];

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.fieldWrap, { borderColor: colors.neutral[200] }]}>
          <Search size={16} color={colors.neutral[400]} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={colors.neutral[400]}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.neutral[400]} />
          ) : (
            query.length > 0 && (
              <Pressable onPress={clear} hitSlop={8}>
                <X size={16} color={colors.neutral[400]} />
              </Pressable>
            )
          )}
        </View>
        {includeLocate && onLocate && (
          <Pressable
            onPress={onLocate}
            disabled={locateLoading}
            style={styles.locate}
            accessibilityLabel="Use my location"
          >
            {locateLoading ? (
              <ActivityIndicator size="small" color={colors.neutral[500]} />
            ) : (
              <LocateFixed size={18} color={colors.neutral[500]} />
            )}
          </Pressable>
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => pick(item)}>
                <MapPin size={16} color={colors.neutral[400]} />
                <View style={styles.resultText}>
                  <Text style={styles.resultMain} numberOfLines={1}>
                    {item.main}
                  </Text>
                  {item.secondary ? (
                    <Text style={styles.resultSecondary} numberOfLines={1}>
                      {item.secondary}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            keyExtractor={(item) => String(item.id ?? item.main)}
          />
        </View>
      )}

      {searched && !searching && results.length === 0 && query.trim().length >= 2 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No matching locations found.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  locate: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    maxHeight: 288,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultText: {
    flex: 1,
  },
  resultMain: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  resultSecondary: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  empty: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    padding: 10,
  },
  emptyText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
});