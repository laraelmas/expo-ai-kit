import { NativeModule, requireNativeModule } from 'expo';

import { ExpoLlmModuleEvents } from './ExpoLlm.types';

declare class ExpoLlmModule extends NativeModule<ExpoLlmModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoLlmModule>('ExpoLlm');
