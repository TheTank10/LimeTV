import { requireOptionalNativeModule } from 'expo';

export interface StreamProxyNativeModule {
  startServerAsync(): Promise<number>;
  stopServerAsync(): Promise<boolean>;
  getServerPort(): number;
}

const StreamProxy = requireOptionalNativeModule<StreamProxyNativeModule>('StreamProxy');

export default StreamProxy;
