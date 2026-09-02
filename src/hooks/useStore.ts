/**
 * 通用状态管理Hook
 * 提供轻量级的状态管理功能，支持订阅发布模式
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 状态管理器接口
 */
interface Store<T extends Record<string, any>> {
  /** 获取当前状态 */
  getState: () => T;
  /** 更新状态 */
  setState: (newState: Partial<T> | ((prevState: T) => Partial<T>)) => void;
  /** 订阅状态变化 */
  subscribe: (listener: (state: T) => void) => () => void;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 创建状态管理器
 */
export function createStore<T extends Record<string, any>>(initialState: T): Store<T> {
  let currentState = { ...initialState };
  const listeners = new Set<(state: T) => void>();
  
  const getState = () => currentState;
  
  const setState = (newState: Partial<T> | ((prevState: T) => Partial<T>)) => {
    // 计算新状态
    const nextState = {
      ...currentState,
      ...(typeof newState === 'function' ? newState(currentState) : newState)
    };
    
    // 检查状态是否发生变化
    const hasChanged = JSON.stringify(currentState) !== JSON.stringify(nextState);
    
    if (hasChanged) {
      currentState = nextState;
      // 通知所有订阅者
      listeners.forEach(listener => listener(currentState));
    }
  };
  
  const subscribe = (listener: (state: T) => void): (() => void) => {
    listeners.add(listener);
    // 返回取消订阅函数
    return () => listeners.delete(listener);
  };
  
  const reset = () => {
    currentState = { ...initialState };
    listeners.forEach(listener => listener(currentState));
  };
  
  return {
    getState,
    setState,
    subscribe,
    reset
  };
}

/**
 * 使用状态管理器Hook
 */
export function useStore<T extends Record<string, any>>(store: Store<T>) {
  // 获取初始状态
  const [state, setState] = useState<T>(store.getState());
  
  // 为了避免不必要的重渲染，使用ref存储最新状态
  const stateRef = useRef(state);
  stateRef.current = state;
  
  // 更新React组件状态
  const updateState = useCallback(() => {
    const newState = store.getState();
    // 只有在状态发生变化时才更新
    if (JSON.stringify(newState) !== JSON.stringify(stateRef.current)) {
      setState(newState);
    }
  }, [store]);
  
  // 订阅状态变化
  useEffect(() => {
    // 立即更新一次，确保组件状态与store同步
    updateState();
    // 订阅状态变化
    const unsubscribe = store.subscribe(updateState);
    
    // 组件卸载时取消订阅
    return unsubscribe;
  }, [store, updateState]);
  
  // 提供setState方法的包装，以保持接口一致性
  const setStoreState = useCallback((newState: Partial<T> | ((prevState: T) => Partial<T>)) => {
    store.setState(newState);
  }, [store]);
  
  // 提供reset方法
  const resetStore = useCallback(() => {
    store.reset();
  }, [store]);
  
  return [state, setStoreState, resetStore] as const;
}

/**
 * 使用指定的状态切片Hook
 */
export function useStoreSlice<T extends Record<string, any>, K extends keyof T>(
  store: Store<T>,
  selector: (state: T) => K extends keyof T ? T[K] : any
) {
  // 获取完整状态
  const [state, setState] = useStore(store);
  
  // 选择指定切片
  const selectedSlice = selector(state);
  
  // 更新指定切片
  const setSlice = useCallback((newValue: T[K] | ((prevValue: T[K]) => T[K])) => {
    setState((prevState) => ({
      ...prevState,
      [Object.keys(prevState).find(key => selector(prevState) === prevState[key as keyof T])!]:
        typeof newValue === 'function' ? (newValue as Function)(selector(prevState) as T[K]) : newValue
    }));
  }, [setState, selector]);
  
  return [selectedSlice, setSlice] as const;
}

/**
 * 创建持久化状态管理器
 */
export function createPersistentStore<T extends Record<string, any>>(
  initialState: T,
  key: string,
  storage: Storage = localStorage
): Store<T> {
  // 尝试从存储中恢复状态
  let persistedState: Partial<T> = {};
  try {
    const stored = storage.getItem(key);
    if (stored) {
      persistedState = JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load persisted state:', error);
  }
  
  // 创建状态管理器，合并初始状态和持久化状态
  const store = createStore<T>({
    ...initialState,
    ...persistedState
  });
  
  // 订阅状态变化，自动保存到存储
  store.subscribe((state) => {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  });
  
  return store;
}

export default useStore;