import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

export function ExpenseGraph() {
  const stackData = [
    {
      stacks: [
        { value: 60, color: '#ADC178', marginBottom: 2 },
        { value: 25, color: '#DDE5B6' },
      ],
      label: '3/07',
    },
    {
      stacks: [
        { value: 35, color: '#ADC178', marginBottom: 2 },
        { value: 25, color: '#DDE5B6' },
      ],
      label: '3/08',
    },
    {
      stacks: [
        { value: 48, color: '#A98467', marginBottom: 2 },
        { value: 60, color: '#ADC178', marginBottom: 2 },
        { value: 25, color: '#DDE5B6' },
      ],
      label: '3/09',
    },
    {
      stacks: [
        { value: 42, color: '#ADC178', marginBottom: 2 },
        { value: 25, color: '#DDE5B6' },
      ],
      label: '3/10',
    },
    {
      stacks: [
        { value: 23, color: '#ADC178', marginBottom: 2 },
        { value: 60, color: '#DDE5B6' },
      ],
      label: '3/11',
    },
  ];

  return (
    <View style={styles.glassCard} className="pt-8 pb-5 px-3">
      <View className="items-center ml-[-15px]">
        <BarChart
          stackData={stackData}
          barWidth={20}
          spacing={28}
          hideRules={false}
          rulesColor="rgba(0,0,0,0.15)"
          rulesType="dashed"
          dashWidth={4}
          dashGap={4}
          xAxisThickness={1}
          yAxisThickness={0}
          yAxisLabelWidth={40}
          yAxisTextStyle={{ color: 'gray', fontSize: 11, fontFamily: 'DM Sans' }}
          hideYAxisText={false}
          xAxisColor="#000000"
          noOfSections={4}
          maxValue={160}
          labelsExtraHeight={20}
          xAxisLabelTextStyle={{ color: '#000', fontSize: 13, fontFamily: 'DM Sans', textAlign: 'center' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    overflow: 'hidden',
  }
});
