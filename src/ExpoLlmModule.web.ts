import { registerWebModule, NativeModule } from 'expo';

import { ExpoLlmModuleEvents } from './ExpoLlm.types';

class ExpoLlmModule extends NativeModule<ExpoLlmModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoLlmModule, 'ExpoLlmModule');
