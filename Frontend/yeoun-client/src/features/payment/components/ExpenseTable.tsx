import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useExpenseStore, ExpenseItem, Member } from '@/src/store/expenseStore';

interface ExpenseRowProps {
  item: ExpenseItem;
  isSubItem?: boolean;
  members: Member[];
  draggingMemberId: string | null;
  hoveredExpenseId: string | null;
  toggleMemberInExpense: (expenseId: string, memberId: string) => void;
  toggleExpandExpense: (expenseId: string) => void;
  setHoveredExpense: (id: string | null) => void;
  registerDropZone: (id: string, layout: { x: number; y: number; width: number; height: number }) => void;
  unregisterDropZone: (id: string) => void;
  onOpenAddMember: (expenseId: string) => void;
  selectedAvatarId: string | null;
  setSelectedAvatarId: (id: string | null) => void;
}

const ExpenseRow = ({
  item,
  isSubItem = false,
  members,
  draggingMemberId,
  hoveredExpenseId,
  toggleMemberInExpense,
  toggleExpandExpense,
  setHoveredExpense,
  registerDropZone,
  unregisterDropZone,
  onOpenAddMember,
  selectedAvatarId,
  setSelectedAvatarId
}: ExpenseRowProps) => {
  const perPerson = item.memberIds.length > 0 
    ? Math.round(item.amount / item.memberIds.length) 
    : 0;

  const isHovered = hoveredExpenseId === item.id;
  const canDrop = !!draggingMemberId;
  const viewRef = useRef<View>(null);

  // Correctly use useEffect at the top level of this functional component
  useEffect(() => {
    const updateMeasure = () => {
      if (viewRef.current) {
        viewRef.current.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            registerDropZone(item.id, { x, y, width, height });
          }
        });
      }
    };

    const timeoutId = setTimeout(updateMeasure, 300);

    if (draggingMemberId) {
      updateMeasure();
    }

    return () => {
      clearTimeout(timeoutId);
      unregisterDropZone(item.id);
    };
  }, [item.id, !!draggingMemberId, registerDropZone, unregisterDropZone]);

  const activeMembers = members.filter(m => item.memberIds.includes(m.id));

  return (
    <View 
      ref={viewRef}
      className={`flex-row border-b border-gray-200 py-3 ${isSubItem ? 'bg-gray-50' : ''} ${isHovered ? 'bg-blue-100 border-blue-300' : ''}`} 
      style={{ minWidth: 500 }}
    >
      <TouchableOpacity 
        className="w-32 flex-row items-center border-r border-gray-200 px-2"
        activeOpacity={canDrop ? 0.6 : 1}
        onPress={() => {
          if (canDrop && draggingMemberId) {
            toggleMemberInExpense(item.id, draggingMemberId);
          }
        }}
        onPressIn={() => canDrop && setHoveredExpense(item.id)}
        onPressOut={() => canDrop && setHoveredExpense(null)}
      >
        {!isSubItem && item.subItems && (
          <TouchableOpacity onPress={() => toggleExpandExpense(item.id)} className="mr-1">
            <Ionicons 
              name={item.isExpanded ? "chevron-down" : "chevron-forward"} 
              size={16} 
              color="black" 
            />
          </TouchableOpacity>
        )}
        {isSubItem && <View className="w-4" />}
        <Text 
          className={`text-sm ${canDrop ? 'text-blue-600 font-bold' : 'text-black'}`} 
          style={{ fontFamily: 'DM Sans' }} 
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </TouchableOpacity>

      <View className="w-16 justify-center items-center border-r border-gray-200 px-1">
        <Text className="text-gray-500 text-xs" style={{ fontFamily: 'DM Sans' }}>{item.time}</Text>
      </View>

      <View className="w-24 justify-center items-end border-r border-gray-200 px-2">
        <Text className="text-black text-sm font-bold tracking-tight" style={{ fontFamily: 'DM Sans' }}>
          {item.amount.toLocaleString()}
        </Text>
      </View>

      <View className="w-24 justify-center items-end border-r border-gray-200 px-2 bg-gray-50/50">
        <Text className="text-black text-sm font-medium tracking-tight" style={{ fontFamily: 'DM Sans' }}>
          {perPerson > 0 ? perPerson.toLocaleString() : ''}
        </Text>
      </View>

      <View className="w-32 justify-center py-1">
        <View className="flex-row items-center justify-center gap-1 flex-wrap px-1">
          {activeMembers.map(member => (
            <TouchableOpacity
              key={member.id}
              onPress={() => setSelectedAvatarId(selectedAvatarId === `${item.id}-${member.id}` ? null : `${item.id}-${member.id}`)}
              className="relative"
              style={{ width: 18, height: 18 }}
            >
              <View
                style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: member.color }}
              />
              {selectedAvatarId === `${item.id}-${member.id}` && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleMemberInExpense(item.id, member.id);
                    setSelectedAvatarId(null);
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center border border-white z-10"
                >
                  <Ionicons name="remove" size={10} color="white" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            onPress={() => onOpenAddMember(item.id)}
            className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center border border-gray-300 ml-1"
          >
            <Ionicons name="add" size={14} color="#555" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export function ExpenseTable() {
  const { 
    expenses, 
    members, 
    toggleMemberInExpense, 
    toggleExpandExpense,
    draggingMemberId,
    hoveredExpenseId,
    setHoveredExpense,
    registerDropZone,
    unregisterDropZone
  } = useExpenseStore();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  // Helper to find specific expense item deeply
  const getExpenseById = (items: ExpenseItem[], id: string | null): ExpenseItem | null => {
    if (!id) return null;
    for (const item of items) {
      if (item.id === id) return item;
      if (item.subItems) {
        const found = getExpenseById(item.subItems, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeExpense = getExpenseById(expenses, selectedExpenseId);

  // Calculate totals locally and memoize 
  const memberTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    members.forEach(m => totals[m.id] = 0);

    const processItem = (item: ExpenseItem) => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(processItem);
      } else {
        if (item.memberIds.length > 0) {
          const splitAmount = item.amount / item.memberIds.length;
          item.memberIds.forEach(mId => {
            if (totals[mId] !== undefined) {
              totals[mId] += splitAmount;
            }
          });
        }
      }
    };

    expenses.forEach(processItem);
    return totals;
  }, [expenses, members]);

  const handleOpenAddMember = (expenseId: string) => {
    setSelectedExpenseId(expenseId);
    setModalVisible(true);
  };

  return (
    <View className="mt-6 flex-1">
      <View className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <ScrollView 
          horizontal 
          bounces={false} 
          showsHorizontalScrollIndicator={true}
          scrollEnabled={!draggingMemberId}
        >
          <View>
            <View className="flex-row border-b border-gray-300 py-3 bg-gray-100" style={{ minWidth: 500 }}>
              <View className="w-32 justify-center items-center border-r border-gray-300">
                <Text className="font-bold text-xs" style={{ fontFamily: 'DM Sans' }}>지점/아이템</Text>
              </View>
              <View className="w-16 justify-center items-center border-r border-gray-300">
                <Text className="font-bold text-xs" style={{ fontFamily: 'DM Sans' }}>시간</Text>
              </View>
              <View className="w-24 justify-center items-center border-r border-gray-300">
                <Text className="font-bold text-xs" style={{ fontFamily: 'DM Sans' }}>액수</Text>
              </View>
              <View className="w-24 justify-center items-center border-r border-gray-300">
                <Text className="font-bold text-xs flex-wrap text-center" style={{ fontFamily: 'DM Sans' }}>인당 액수</Text>
              </View>
              <View className="w-32 justify-center items-center">
                <Text className="font-bold text-xs" style={{ fontFamily: 'DM Sans' }}>멤버</Text>
              </View>
            </View>

            <View className="max-h-[600px]">
              {expenses.map(item => (
                <React.Fragment key={item.id}>
                  <ExpenseRow 
                    item={item}
                    members={members}
                    draggingMemberId={draggingMemberId}
                    hoveredExpenseId={hoveredExpenseId}
                    toggleMemberInExpense={toggleMemberInExpense}
                    toggleExpandExpense={toggleExpandExpense}
                    setHoveredExpense={setHoveredExpense}
                    registerDropZone={registerDropZone}
                    unregisterDropZone={unregisterDropZone}
                    onOpenAddMember={handleOpenAddMember}
                    selectedAvatarId={selectedAvatarId}
                    setSelectedAvatarId={setSelectedAvatarId}
                  />
                  {item.isExpanded && item.subItems && (
                    item.subItems.map(sub => (
                      <ExpenseRow 
                        key={sub.id}
                        item={sub}
                        isSubItem={true}
                        members={members}
                        draggingMemberId={draggingMemberId}
                        hoveredExpenseId={hoveredExpenseId}
                        toggleMemberInExpense={toggleMemberInExpense}
                        toggleExpandExpense={toggleExpandExpense}
                        setHoveredExpense={setHoveredExpense}
                        registerDropZone={registerDropZone}
                        unregisterDropZone={unregisterDropZone}
                        onOpenAddMember={handleOpenAddMember}
                        selectedAvatarId={selectedAvatarId}
                        setSelectedAvatarId={setSelectedAvatarId}
                      />
                    ))
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View className="mt-6 bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <Text className="text-black font-bold text-lg mb-4" style={{ fontFamily: 'DM Sans' }}>멤버별 정산 (총액)</Text>
        {members.map(member => (
          <View key={member.id} className="flex-row items-center justify-between py-2 border-b border-gray-50">
            <View className="flex-row items-center">
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: member.color, marginRight: 12 }} />
              <Text className="font-medium text-black text-base" style={{ fontFamily: 'DM Sans' }}>{member.name}</Text>
            </View>
            <Text className="font-bold text-black text-base tracking-tight" style={{ fontFamily: 'DM Sans' }}>
              {Math.round(memberTotals[member.id] || 0).toLocaleString()} 원
            </Text>
          </View>
        ))}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable 
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setModalVisible(false)}
        >
          <Pressable className="bg-white w-10/12 rounded-2xl p-6 shadow-xl" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-6">
               <View>
                 <Text className="font-bold text-xl text-black" style={{ fontFamily: 'DM Sans' }}>멤버 추가</Text>
                 {activeExpense && (
                   <Text className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'DM Sans' }}>
                     {activeExpense.name} 정산에 포함
                   </Text>
                 )}
               </View>
               <TouchableOpacity onPress={() => setModalVisible(false)}>
                 <Ionicons name="close-circle" size={28} color="#d1d5db" />
               </TouchableOpacity>
            </View>
            
            {members.map(member => {
               const isSelected = activeExpense?.memberIds.includes(member.id) ?? false;
               return (
                 <TouchableOpacity 
                   key={member.id} 
                   onPress={() => {
                     if (selectedExpenseId) toggleMemberInExpense(selectedExpenseId, member.id);
                   }}
                   className={`flex-row items-center justify-between p-4 mb-2 rounded-xl border ${isSelected ? 'border-black bg-gray-50/50' : 'border-gray-200'}`}
                 >
                   <View className="flex-row items-center">
                     <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: member.color, marginRight: 12 }} />
                     <Text className="font-medium text-base text-black" style={{ fontFamily: 'DM Sans' }}>{member.name}</Text>
                   </View>
                   <View className={`w-6 h-6 rounded-full border items-center justify-center ${isSelected ? 'border-black bg-black' : 'border-gray-300 bg-white'}`}>
                     {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                   </View>
                 </TouchableOpacity>
               )
            })}

            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              className="mt-6 w-full py-4 rounded-3xl bg-black items-center"
            >
              <Text className="text-white font-bold text-lg" style={{ fontFamily: 'DM Sans' }}>완료</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}
