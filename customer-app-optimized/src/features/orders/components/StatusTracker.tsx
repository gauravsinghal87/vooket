import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, withAlpha } from '@/shared/theme';

export interface TrackerStep {
  key: string;
  label: string;
}

export type TrackerState = 'done' | 'current' | 'todo';

export interface StatusTrackerStep extends TrackerStep {
  state: TrackerState;
}

function accent(tone: 'brand' | 'food') {
  return tone === 'food' ? colors.food[600] : colors.brand[600];
}

export function StatusTracker({ steps, tone = 'brand' }: { steps: StatusTrackerStep[]; tone?: 'brand' | 'food' }) {
  const a = accent(tone);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const done = step.state === 'done';
        const current = step.state === 'current';
        const prevDone = i > 0 && steps[i - 1].state === 'done';
        return (
          <View key={step.key} style={styles.col}>
            <View style={styles.track}>
              {i > 0 && <View style={[styles.line, prevDone ? { backgroundColor: a } : undefined]} />}
              <View
                style={[
                  styles.circle,
                  done && { backgroundColor: a },
                  current && { borderColor: a, borderWidth: 2, backgroundColor: withAlpha(a, 0.12) },
                ]}
              >
                {done ? (
                  <Check size={16} color="#fff" strokeWidth={3} />
                ) : current ? (
                  <View style={[styles.dot, { backgroundColor: a }]} />
                ) : (
                  <Text style={styles.indexText}>{i + 1}</Text>
                )}
              </View>
              {!isLast && <View style={[styles.line, done ? { backgroundColor: a } : undefined]} />}
            </View>
            <Text
              style={[
                styles.label,
                current && { color: a, fontWeight: '800' },
                done && { color: colors.neutral[500] },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function buildSteps<T extends string>(
  ordered: readonly T[],
  current: T | null | undefined,
  cancelled = false
): StatusTrackerStep[] {
  const currentIndex = current ? ordered.indexOf(current) : -1;
  return ordered.map((key, idx) => {
    let state: TrackerState = 'todo';
    if (!cancelled) {
      if (currentIndex >= 0 && idx < currentIndex) state = 'done';
      else if (currentIndex === idx) state = 'current';
    }
    return { key, label: key.replace(/_/g, ' '), state };
  });
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  col: {
    width: 96,
    alignItems: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    marginHorizontal: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indexText: {
    fontSize: 12,
    color: colors.neutral[300],
  },
  line: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.neutral[200],
  },
  label: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[400],
    textAlign: 'center',
  },
});