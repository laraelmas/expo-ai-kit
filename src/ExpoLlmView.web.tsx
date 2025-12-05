import * as React from 'react';

import { ExpoLlmViewProps } from './ExpoLlm.types';

export default function ExpoLlmView(props: ExpoLlmViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
