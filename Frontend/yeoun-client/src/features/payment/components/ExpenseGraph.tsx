import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useExpenseStore } from '@/src/store/expenseStore';

const CATEGORIES = [
  { label: '식비', color: '#ADC178' },
  { label: '숙소비', color: '#A98467' },
  { label: '교통비', color: '#6C584C' },
  { label: '기타', color: '#DDE5B6' },
];

export function ExpenseGraph() {
  const { expenses } = useExpenseStore();

  // Group real expenses by date for stackData
  const stackData = useMemo(() => {
    const dailyMap: Record<string, Record<string, number>> = {};
    const dates = ['3/07', '3/08', '3/09', '3/10', '3/11']; // Target date range

    // Initialize map
    dates.forEach(d => {
      dailyMap[d] = { '식비': 0, '숙소비': 0, '교통비': 0, '기타': 0 };
    });

    // Aggregate expenses by date and category
    expenses.forEach(exp => {
      if (dailyMap[exp.date]) {
        dailyMap[exp.date][exp.category] += exp.amount;
      }
    });

    // Map to stackData format
    return dates.map(date => {
      const stacks = CATEGORIES.map(cat => ({
        value: dailyMap[date][cat.label],
        color: cat.color,
        category: cat.label,
        marginBottom: 2
      })).filter(s => s.value > 0);

      return { label: date, stacks };
    });
  }, [expenses]);

  const [activeItem, setActiveItem] = useState<any>(stackData[stackData.length - 1]);

  useEffect(() => {
    if (stackData.length > 0) {
      setActiveItem(stackData[stackData.length - 1]);
    }
  }, [stackData]);

  const dynamicMaxValue = useMemo(() => {
    const totals = stackData.map(item => 
      item.stacks.reduce((acc: number, s: any) => acc + s.value, 0)
    );
    const maxVal = Math.max(...totals, 50000);
    return Math.ceil((maxVal * 1.1) / 10000) * 10000;
  }, [stackData]);

  return (
    <View className="pt-2 pb-5 px-3">
      {/* Horizontal Centering Container */}
      <View style={{ alignItems: 'center', width: '100%', marginLeft: -15 }}>
        <BarChart
          stackData={stackData}
          barWidth={24}
          spacing={28}
          hideRules={false}
          rulesColor="rgba(0,0,0,0.1)"
          rulesType="dashed"
          dashWidth={4}
          dashGap={4}
          xAxisThickness={1}
          yAxisThickness={0}
          yAxisLabelWidth={55}
          yAxisTextStyle={{ color: 'gray', fontSize: 10, fontFamily: 'DM Sans' }}
          hideYAxisText={false}
          xAxisColor="#000000"
          noOfSections={4}
          maxValue={dynamicMaxValue}
          yAxisExtraHeight={20}
          labelsExtraHeight={20}
          xAxisLabelTextStyle={{ color: '#000', fontSize: 12, fontFamily: 'DM Sans', textAlign: 'center' }}
          onPress={(item: any) => {
            setActiveItem(item);
          }}
          pointerConfig={{
            showPointerStrip: true,
            pointerStripColor: 'transparent',
            pointerColor: 'transparent',
            radius: 0,
            pointerLabelComponent: (items: any) => {
              const item = items[0];
              if (item && item.label !== activeItem?.label) {
                setTimeout(() => setActiveItem(item), 0);
              }
              return null;
            },
            activatePointersOnLongPress: false,
            activatePointersDelay: 0,
          }}
        />
      </View>

      {/* Category Legend - Repositioned between graph and card */}
      <View className="flex-row justify-center items-center mt-6 mb-4 gap-4 flex-wrap">
        {CATEGORIES.map((category) => (
          <View key={category.label} className="flex-row items-center">
            <View 
              style={{ 
                width: 10, 
                height: 10, 
                borderRadius: 2, 
                backgroundColor: category.color, 
                marginRight: 6 
              }} 
            />
            <Text className="text-gray-600 text-[11px] font-medium" style={{ fontFamily: 'DM Sans' }}>
              {category.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 고정된 상세 정보 카드 */}
      <View style={styles.detailCard}>
        <View className="flex-row justify-between items-center mb-3">
          <Text style={styles.detailDate}>{activeItem?.label || '3/11'} 상세 지출</Text>
          <Text style={styles.detailTotal}>
            총 {(activeItem?.stacks.reduce((acc: number, s: any) => acc + s.value, 0) || 0).toLocaleString()}원
          </Text>
        </View>
        <View className="flex-row flex-wrap">
          {CATEGORIES.map((category) => {
            const stackItem = activeItem?.stacks.find((s: any) => s.category === category.label);
            const value = stackItem ? stackItem.value : 0;
            return (
              <View key={category.label} className="flex-row items-center w-1/2 mb-2">
                <View style={[styles.detailDot, { backgroundColor: category.color }]} />
                <Text style={styles.detailText}>
                  {category.label}: <Text className="font-bold">{value.toLocaleString()}원</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    minHeight: 110,
  },
  detailDate: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'DM Sans',
    fontWeight: '600',
  },
  detailTotal: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'DM Sans',
    fontWeight: 'bold',
  },
  detailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#444',
    fontFamily: 'DM Sans',
  },
});
