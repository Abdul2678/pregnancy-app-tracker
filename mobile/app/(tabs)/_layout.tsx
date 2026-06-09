// app/(tabs)/_layout.tsx
// Bottom tabs: Home, Track, Chat, Learn, Profile.

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#F4F1EA' },
        headerTintColor: '#5A4636',
        tabBarActiveTintColor: '#C97B63',
        tabBarInactiveTintColor: '#A8997F',
        tabBarStyle: { backgroundColor: '#FFFDF9', borderTopColor: '#EEE5D8' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          headerShown: false,
          title: 'Track',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          headerShown: false,
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          headerShown: false,
          title: 'Baby',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
