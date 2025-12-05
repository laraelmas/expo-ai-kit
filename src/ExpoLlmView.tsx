import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoLlmViewProps } from './ExpoLlm.types';

const NativeView: React.ComponentType<ExpoLlmViewProps> =
  requireNativeView('ExpoLlm');

export default function ExpoLlmView(props: ExpoLlmViewProps) {
  return <NativeView {...props} />;
}
