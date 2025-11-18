/**
 * 会话状态管理
 */
import { create } from 'zustand';
import type { Session, Message } from '../types';

export interface SessionState {
  session: Session | null;
  messages: Message[];
  
  setSession: (session: Session) => void;
  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  updateSession: (updates: Partial<Session>) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  messages: [],
  
  setSession: (session) => {
    set({ 
      session,
      messages: Array.isArray(session.messages) ? session.messages : [],
    });
  },
  
  addMessage: (message) => {
    set((state) => {
      // 检查消息是否已存在，避免重复添加
      const exists = state.messages.some((msg) => msg.id === message.id);
      if (exists) {
        return state;
      }
      return {
        messages: [...state.messages, message],
        session: state.session
          ? {
              ...state.session,
              messages: [...(state.session.messages || []), message],
            }
          : state.session,
      };
    });
  },

  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
      session: state.session
        ? {
            ...state.session,
            messages: (state.session.messages || []).filter(
              (msg) => msg.id !== messageId,
            ),
          }
        : state.session,
    }));
  },
  
  updateSession: (updates) => {
    set((state) => ({
      session: state.session ? { ...state.session, ...updates } : null,
    }));
  },
  
  reset: () => {
    set({
      session: null,
      messages: [],
    });
  },
}));
