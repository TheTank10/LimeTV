import { FebBoxStreamResult } from './febbox';

export interface FebBoxResolveTask {
  shareKey: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  token: string;
  server: string;
  is4KEnabled: boolean;
  resolve: (result: FebBoxStreamResult) => void;
  reject: (error: Error) => void;
}

class FebBoxResolverManager {
  private currentTask: FebBoxResolveTask | null = null;
  private listener: ((task: FebBoxResolveTask | null) => void) | null = null;

  setListener(fn: (task: FebBoxResolveTask | null) => void) {
    this.listener = fn;
    if (this.currentTask) {
      this.listener(this.currentTask);
    }
  }

  removeListener() {
    this.listener = null;
  }

  resolve(taskData: Omit<FebBoxResolveTask, 'resolve' | 'reject'>): Promise<FebBoxStreamResult> {
    return new Promise((resolve, reject) => {
      this.currentTask = { ...taskData, resolve, reject };
      if (this.listener) {
        this.listener(this.currentTask);
      }
    });
  }

  finish(result: FebBoxStreamResult) {
    if (this.currentTask) {
      this.currentTask.resolve(result);
      this.currentTask = null;
      if (this.listener) {
        this.listener(null);
      }
    }
  }

  cancel(errorMsg: string = 'Stream resolution cancelled') {
    if (this.currentTask) {
      this.currentTask.resolve({ success: false, error: errorMsg });
      this.currentTask = null;
      if (this.listener) {
        this.listener(null);
      }
    }
  }

  hasActiveTask(): boolean {
    return this.currentTask !== null;
  }
}

export const febboxResolverManager = new FebBoxResolverManager();
