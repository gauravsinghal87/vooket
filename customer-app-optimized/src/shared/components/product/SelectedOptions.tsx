import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { SelectedOption } from '@/shared/types/models';
import { selectedOptionPrice } from '@/shared/utils/productOptions';
import { formatCurrency } from '@/shared/utils/utils';
import { colors } from '@/shared/theme';

interface SelectedOptionsListProps {
  options?: SelectedOption[] | null;
  style?: StyleProp<TextStyle>;
}

function groupSelectedOptions(options: SelectedOption[]) {
  const groups: { id: number; name: string; options: SelectedOption[] }[] = [];
  for (const option of options) {
    const existing = groups.find((g) => g.id === option.group_id);
    if (existing) {
      existing.options.push(option);
    } else {
      groups.push({ id: option.group_id, name: option.group_name, options: [option] });
    }
  }
  return groups;
}

/**
 * Port of customer-web components/product/selected-options.tsx (inline variant).
 * Each option group renders as `Group: Name +₹price · Name +₹price`, reading the
 * additional price from the cart snapshot's `price` field (falling back to
 * `option_price`) via the shared selectedOptionPrice helper.
 */
function optionText(option: SelectedOption): string {
  const price = selectedOptionPrice(option);
  return price > 0 ? `${option.option_name} +${formatCurrency(price)}` : option.option_name;
}

export function SelectedOptionsList({ options, style }: SelectedOptionsListProps) {
  if (!options || options.length === 0) return null;

  const groups = groupSelectedOptions(options);

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <Text
          key={group.id}
          style={[styles.line, style]}
          accessibilityLabel={`${group.name}: ${group.options.map(optionText).join(' · ')}`}
        >
          <Text style={styles.groupName}>{group.name}:</Text>{' '}
          {group.options.map((option, index) => (
            <Text key={option.option_id}>
              {index > 0 ? ' · ' : ''}
              {optionText(option)}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
    gap: 2,
  },
  line: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.neutral[500],
  },
  groupName: {
    fontWeight: '700',
    color: colors.neutral[700],
  },
});
